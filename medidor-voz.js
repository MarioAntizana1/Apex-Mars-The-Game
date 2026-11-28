// Nivel del micrófono para la tira KITT. Mide lo que el navegador entrega a la
// página —independientemente del servicio de reconocimiento— y no guarda audio.
// Una sola captura compartida: abrir dos veces no crea dos flujos.
export function crearMedidorVoz({ entorno = globalThis } = {}) {
  const Contexto = entorno.AudioContext || entorno.webkitAudioContext
  let flujo = null, contexto = null, fuente = null, analizador = null, datos = null
  let pedido = 0, estado = 'parado', nivel = 0, pico = 0, motivo = ''

  const disponible = () => Boolean(entorno.navigator?.mediaDevices?.getUserMedia && Contexto)

  function soltar() {
    if (flujo) { for (const pista of flujo.getTracks()) { try { pista.stop() } catch { /* ya terminó */ } } }
    try { fuente?.disconnect() } catch { /* nodo ya liberado */ }
    try { analizador?.disconnect() } catch { /* idem */ }
    if (contexto && contexto.state !== 'closed') { try { contexto.close() } catch { /* cierre diferido */ } }
    flujo = contexto = fuente = analizador = datos = null
  }

  function cerrar() {
    pedido += 1
    const estaba = estado
    soltar()
    estado = 'parado'; nivel = 0; pico = 0
    return estaba
  }

  async function abrir() {
    if (estado === 'activo' || estado === 'abriendo') return estado
    if (!disponible()) {
      estado = 'sin-soporte'
      motivo = 'Este navegador no permite medir la señal del micrófono.'
      return estado
    }
    const token = ++pedido
    estado = 'abriendo'; motivo = ''
    try {
      const [f] = await Promise.all([
        entorno.navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        }),
        (async () => {
          contexto = new Contexto()
          if (contexto.state === 'suspended') await contexto.resume().catch(() => {})
        })(),
      ])
      // Mientras se esperaba el permiso la captura pudo cancelarse: no dejar el
      // micrófono abierto por una respuesta que ya no interesa.
      if (token !== pedido) { for (const pista of f.getTracks()) { try { pista.stop() } catch { /* idem */ } } return estado }
      flujo = f
      analizador = contexto.createAnalyser()
      analizador.fftSize = 1024
      analizador.smoothingTimeConstant = 0
      try { fuente = contexto.createMediaStreamSource(f); fuente.connect(analizador) } catch (e) {
        cerrar(); estado = 'sin-soporte'; motivo = 'No se pudo leer la entrada de audio.'; return estado
      }
      datos = new Float32Array(analizador.fftSize)
      estado = 'activo'
      return estado
    } catch (e) {
      if (token === pedido) {
        soltar()
        estado = 'error'
        motivo = ['NotAllowedError', 'SecurityError'].includes(e?.name)
          ? 'Permiso denegado para medir la entrada; la voz sigue activa.'
          : 'No se puede medir la entrada de audio; la voz sigue activa.'
      }
      return estado
    }
  }

  // RMS en el dominio temporal: una entrada con desplazamiento continuo (DC) es
  // silencio. Ataque rápido y caída suave para que la tira siga la voz.
  function leer() {
    if (estado !== 'activo' || !analizador || !datos) {
      nivel = Math.max(0, nivel - .12); pico = Math.max(0, pico - .06)
      return { nivel, pico, activo: false }
    }
    analizador.getFloatTimeDomainData(datos)
    let suma = 0, cuadrados = 0
    for (const x of datos) { suma += x; cuadrados += x * x }
    const media = suma / datos.length
    const rms = Math.sqrt(Math.max(0, cuadrados / datos.length - media * media))
    const bruto = rms < .004 ? 0 : Math.min(1, Math.sqrt(rms * 9))
    nivel = bruto > nivel ? bruto : nivel * .82
    pico = Math.max(nivel, pico * .94)
    return { nivel, pico, activo: true }
  }

  return { disponible, abrir, cerrar, leer, estado: () => estado, motivo: () => motivo }
}
