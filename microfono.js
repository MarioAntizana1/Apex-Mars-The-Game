// El diagnóstico no inicia Web Speech ni conserva el stream de prueba.
const permisos = new WeakMap()
export const impedimentoMicrofono = entorno => permisos.get(entorno) || ''

export function conectarPermisoMicrofono({ documento, entorno, signal, modo }) {
  const nodo = id => documento.getElementById(id)
  const paneles = ['opcion', 'pausa'].map(p => ({
    voz: nodo(`${p}-voz`), boton: nodo(`${p}-probar-micro`), salida: nodo(`${p}-estado-micro`)
  }))
  let pendiente = false
  const mostrar = mensaje => { for (const {salida} of paneles) if (salida) salida.textContent = mensaje }
  async function solicitar() {
    if (pendiente) return
    pendiente = true
    for (const {boton} of paneles) if (boton) boton.disabled = true
    const espera = 'Comprobando acceso al micrófono…'
    permisos.set(entorno, espera); mostrar(espera)
    try {
      const {ok, mensaje} = await probarMicrofono(entorno)
      // Si la API de diagnóstico no existe, Web Speech aún puede gestionar su propio permiso.
      permisos.set(entorno, ok || !entorno.navigator?.mediaDevices?.getUserMedia ? '' : mensaje)
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
    return { ok: true, mensaje: 'Acceso al micrófono confirmado. Prueba terminada; no está escuchando.' }
  } catch (e) {
    const permiso = ['NotAllowedError','SecurityError'].includes(e?.name)
    return { ok: false, mensaje: explicarError(permiso ? 'not-allowed' : 'audio-capture') }
  }
}
