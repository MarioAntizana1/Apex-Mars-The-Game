// El diagnóstico no inicia Web Speech ni conserva el stream de prueba. Sus
// resultados son informativos: el reconocimiento decide por sí mismo.
export function conectarPermisoMicrofono({ documento, entorno, signal, modo }) {
  const nodo = id => documento.getElementById(id)
  const paneles = ['opcion', 'pausa'].map(p => ({
    voz: nodo(`${p}-voz`), boton: nodo(`${p}-probar-micro`), salida: nodo(`${p}-estado-micro`)
  }))
  conectarDiagnostico({ documento, entorno, signal })
  let pendiente = false
  const mostrar = mensaje => { for (const {salida} of paneles) if (salida) salida.textContent = mensaje }
  async function solicitar() {
    if (pendiente) return
    pendiente = true
    for (const {boton} of paneles) if (boton) boton.disabled = true
    // Mientras el diálogo del navegador está abierto no se bloquea el motor: si
    // el jugador lo ignora, la orden hablada debe poder intentarse igualmente.
    const espera = 'Comprobando acceso al micrófono…'
    mostrar(espera)
    try {
      const {ok, mensaje} = await probarMicrofono(entorno)
      if (signal.aborted) return
      mostrar(ok ? mensaje : `${mensaje} Puedes escribir la orden.`)
      entorno.dispatchEvent(new Event('apex:micro-comprobado'))
    } finally {
      pendiente = false
      for (const {boton} of paneles) if (boton) boton.disabled = false
    }
  }
  for (const {voz, boton} of paneles) {
    // En el change original, antes de guardar la preferencia: conserva el gesto del usuario.
    voz?.addEventListener('change', () => {
      if (modo() === 'apagada' && ['ptt','siempre'].includes(voz.value)) solicitar()
    }, {signal})
    boton?.addEventListener('click', solicitar, {signal})
  }
}
// El diagnóstico de señal es local e independiente del permiso para Web Speech.
function conectarDiagnostico({ documento, entorno, signal }) {
  const paneles = ['opcion', 'pausa'].map(p => ({
    boton: documento.getElementById(`${p}-probar-senal`), salida: documento.getElementById(`${p}-estado-senal`)
  }))
  let actual
  for (const panel of paneles) panel.boton?.addEventListener('click', async () => {
    if (actual) { actual.abort(); return }
    const control = actual = new AbortController()
    const cancelar = () => control.abort()
    const siOculto = () => { if (documento.hidden || panel.boton.closest?.('[hidden]')) cancelar() }
    const observador = entorno.MutationObserver && new entorno.MutationObserver(siOculto)
    for (let el = panel.boton.parentElement; observador && el; el = el.parentElement)
      observador.observe(el, { attributes: true, attributeFilter: ['hidden'] })
    signal.addEventListener('abort', cancelar, { once: true })
    entorno.addEventListener('pagehide', cancelar, {signal: control.signal})
    documento.addEventListener?.('visibilitychange', siOculto, {signal: control.signal})
    const mostrar = texto => { if (panel.salida) panel.salida.textContent = texto }
    panel.boton.textContent = 'Terminar prueba de señal'
    for (const otro of paneles) if (otro !== panel && otro.boton) otro.boton.disabled = true
    try {
      mostrar('Abriendo la entrada de audio…')
      mostrar(await diagnosticarSenal(entorno, {signal: control.signal, alEstado: mostrar}))
    } finally {
      observador?.disconnect(); signal.removeEventListener('abort', cancelar); control.abort()
      panel.boton.textContent = 'Probar señal del micrófono'
      for (const otro of paneles) if (otro.boton) otro.boton.disabled = false
      actual = null
    }
  }, {signal})
}

// RMS de la componente variable: una entrada con sólo desplazamiento DC es silencio.
function haySenal(datos) {
  let suma = 0, cuadrados = 0
  for (const x of datos) { suma += x; cuadrados += x * x }
  return cuadrados / datos.length - (suma / datos.length) ** 2 >= .01 ** 2
}

export async function diagnosticarSenal(entorno, {signal, alEstado = () => {}} = {}) {
  const Contexto = entorno.AudioContext || entorno.webkitAudioContext
  const media = entorno.navigator?.mediaDevices
  if (entorno.isSecureContext === false) return 'Abre el juego por HTTPS o localhost para usar el micrófono.'
  if (!media?.getUserMedia || !Contexto) return 'Este navegador no permite medir la señal del micrófono.'
  let flujo, contexto, fuente, analizador, reloj, limite, terminado = false, resolver
  const resultado = new Promise(r => { resolver = r })
  const finalizar = mensaje => { if (!terminado) { terminado = true; resolver(mensaje) } }
  const cancelar = () => finalizar('Prueba de señal cancelada.')
  const detener = f => { for (const pista of f.getTracks()) pista.stop() }
  async function abrir() {
    try {
      // Arranca Web Audio en el gesto del botón; nunca se conecta a los altavoces.
      contexto = new Contexto()
      const listo = contexto.state === 'suspended' ? contexto.resume() : Promise.resolve()
      await Promise.all([listo, media.getUserMedia({audio:true}).then(f => {
        if (terminado) detener(f); else flujo = f
      })])
      if (terminado) return
      const pista = flujo.getAudioTracks()[0]
      if (!pista) { finalizar('No hay pista de entrada de audio.'); return }
      const dispositivo = `Entrada: ${pista.label || 'micrófono sin nombre'}. `
      fuente = contexto.createMediaStreamSource(flujo); analizador = contexto.createAnalyser()
      analizador.fftSize = 2048; fuente.connect(analizador)
      const datos = new Float32Array(analizador.fftSize)
      let detectada = false, anterior = ''
      function medir() {
        if (pista.readyState === 'ended') { finalizar(dispositivo + 'Micrófono desconectado.'); return }
        if (contexto.state !== 'running') { finalizar(dispositivo + 'No se pudo medir: audio suspendido.'); return }
        analizador.getFloatTimeDomainData(datos)
        const audible = !pista.muted && pista.enabled !== false && haySenal(datos)
        detectada ||= audible
        const estado = audible ? 'Señal audible detectada.' : 'Silencio: habla para probar.'
        if (anterior !== estado) { alEstado(dispositivo + estado); anterior = estado }
      }
      medir()
      if (terminado) return
      reloj = entorno.setInterval(() => {
        try { medir() } catch { finalizar(dispositivo + 'No se pudo medir la señal.') }
      }, 50)
      entorno.clearTimeout(limite)
      limite = entorno.setTimeout(() => finalizar(dispositivo + (detectada ? 'Se detectó señal audible.' :
        'Silencio: no se detectó señal audible.') + ' Prueba terminada.'), 4000)
    } catch (e) {
      finalizar(['NotAllowedError','SecurityError'].includes(e?.name) ? explicarError('not-allowed') :
        'No se pudo medir la señal. Comprueba la entrada y los ajustes de audio.')
    }
  }
  try {
    if (signal?.aborted) cancelar()
    else {
      signal?.addEventListener('abort', cancelar, {once:true})
      limite = entorno.setTimeout(() => finalizar('No se pudo iniciar la prueba de señal a tiempo.'), 30000)
      void abrir()
    }
    return await resultado
  } finally {
    signal?.removeEventListener('abort', cancelar)
    entorno.clearInterval(reloj); entorno.clearTimeout(limite)
    if (flujo) detener(flujo)
    fuente?.disconnect(); analizador?.disconnect()
    if (contexto && contexto.state !== 'closed') await contexto.close().catch(() => {})
  }
}

export function problemaCaptura(entorno) {
  if (entorno.isSecureContext === false) return 'Abre el juego por HTTPS o localhost para usar el micrófono.'
  if (!(entorno.SpeechRecognition || entorno.webkitSpeechRecognition)) return 'Este navegador no ofrece reconocimiento de voz.'
  return ''
}
export function explicarError(codigo) {
  const mensajes = {
    'not-allowed': 'Permiso de micrófono denegado. Revisa los permisos del sitio y del sistema.',
    'service-not-allowed': 'El navegador bloquea el servicio de reconocimiento.',
    'audio-capture': 'No se puede abrir el micrófono. Comprueba la entrada y si está en uso.',
    'network': 'El servicio de reconocimiento no tiene conexión.',
    'language-not-supported': 'El motor no admite el idioma seleccionado.'
  }
  return mensajes[codigo] || 'Reconocimiento no disponible.'
}
export async function probarMicrofono(entorno = globalThis) {
  const problema = problemaCaptura(entorno)
  if (problema) return { ok: false, mensaje: problema }
  const media = entorno.navigator?.mediaDevices
  if (!media?.getUserMedia) return { ok: false, mensaje: 'Este navegador no permite comprobar la entrada de audio.' }
  try {
    const flujo = await media.getUserMedia({ audio: true })
    for (const pista of flujo.getTracks()) pista.stop()
    return { ok: true, mensaje: 'Acceso al micrófono confirmado. La comprobación de permiso no mide la señal.' }
  } catch (e) {
    const denegado = ['NotAllowedError','SecurityError'].includes(e?.name)
    return { ok: false, denegado, mensaje: explicarError(denegado ? 'not-allowed' : 'audio-capture') }
  }
}