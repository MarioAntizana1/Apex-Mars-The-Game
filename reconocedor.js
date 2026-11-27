// Web Speech no es uniforme entre navegadores. El motor sólo existe mientras la
// campaña está activa; cada sesión posee sus callbacks (incluido el final de PTT).
export function crearReconocedor({ alTexto = () => {}, alEstado = () => {}, entorno = globalThis } = {}) {
  const Motor = entorno.SpeechRecognition || entorno.webkitSpeechRecognition
  let modo = 'apagada', idioma = 'es-ES', activo = false, pulsado = false
  let muerta = false, bloqueo = '', generacion = 0, sesion = null, espera, vacias = 0
  const estado = (mensaje, escuchando = false, motor = '') => {
    if (!muerta) alEstado({ mensaje, escuchando, motor })
  }
  const quiere = () => activo && !bloqueo && !muerta && (modo === 'siempre' || (modo === 'ptt' && pulsado))
  function cancelar() {
    ++generacion; clearTimeout(espera)
    const s = sesion; sesion = null
    if (!s) return
    clearTimeout(s.limite)
    if (s.rec) {
      s.rec.onresult = s.rec.onerror = s.rec.onend = s.rec.onstart = null
      try { s.rec.abort() } catch { /* ya terminó */ }
    }
  }
  function bloquear(error) {
    cancelar(); bloqueo = error
    estado(error === 'not-allowed' || error === 'service-not-allowed' ? 'Permiso de micrófono denegado. Puedes escribir la orden.' : 'Reconocimiento no disponible. Puedes escribir la orden.')
  }
  async function iniciar() {
    if (!quiere() || sesion) return
    if (!Motor) { bloquear('sin-soporte'); return }
    const s = sesion = { rec: null, directo: pulsado, termina: false, limite: null, local: false }
    const vigente = () => sesion === s && !muerta
    try {
      const rec = s.rec = new Motor()
      rec.lang = idioma; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1
      if ('processLocally' in rec && typeof Motor.available === 'function') {
        // Consultar, nunca descargar un paquete ni solicitar permisos en bucle.
        try { s.local = await Motor.available({ langs: [idioma], processLocally: true }) === 'available' } catch { /* servicio del navegador */ }
        if (!vigente()) return
        rec.processLocally = s.local
      }
      const motor = s.local ? 'local' : 'navegador'
      rec.onstart = () => { if (vigente() && !s.termina) estado(s.local ? 'Reconocimiento local activo.' : 'Escuchando con el servicio del navegador.', true, motor) }
      const emitidos = new Set()
      rec.onresult = e => {
        if (!vigente()) return
        for (let i = e.resultIndex ?? 0; i < e.results.length && vigente(); ++i) {
          const r = e.results[i], frase = r[0]?.transcript?.trim()
          if (r.isFinal && frase && !emitidos.has(i)) {
            emitidos.add(i); s.resultado = true; vacias = 0; alTexto(frase, { directo: s.directo })
          }
        }
      }
      rec.onerror = e => { if (vigente() && !['no-speech','aborted'].includes(e.error)) bloquear(e.error || 'error') }
      rec.onend = () => {
        if (!vigente()) return
        sesion = null; clearTimeout(s.limite)
        estado(modo === 'ptt' ? 'Mantén pulsado para hablar.' : modo === 'siempre' ? 'OBC en espera de «Nostromo».' : 'Micrófono en espera.')
        if (quiere()) {
          if (!s.resultado) ++vacias
          const token = generacion
          espera = setTimeout(() => { if (token === generacion) iniciar() }, Math.min(4000, 250 * 2 ** Math.min(vacias, 4)))
        }
      }
      rec.start(); s.iniciada = true
    } catch (e) { if (vigente()) bloquear(e?.name === 'NotAllowedError' ? 'not-allowed' : 'error') }
  }
  function configurar({ modo: m = modo, idioma: i = idioma, activo: a = activo } = {}) {
    if (muerta) return
    m = ['siempre','ptt'].includes(m) ? m : 'apagada'; a = Boolean(a)
    if (modo === m && idioma === i && activo === a) return
    cancelar(); pulsado = false; vacias = 0
    // Suspender y volver a la cabina no debe volver a pedir un permiso denegado.
    if (m === 'apagada') bloqueo = ''
    modo = m; idioma = i; activo = a
    if (quiere()) iniciar()
    else estado(!activo ? 'Micrófono suspendido.' : modo === 'apagada' ? 'Micrófono apagado.' : bloqueo ? 'Micrófono no disponible. Puedes escribir la orden.' : modo === 'siempre' ? 'OBC en espera de «Nostromo».' : 'Mantén pulsado para hablar.')
  }
  function pulsar(valor) {
    if (!activo || muerta || bloqueo || modo === 'apagada' || pulsado === !!valor) return
    pulsado = !!valor
    if (pulsado) { cancelar(); iniciar(); return }
    const s = sesion
    if (s?.iniciada && s.directo) {
      s.termina = true
      // stop conserva el último resultado; abort en una suspensión lo invalida.
      s.limite = setTimeout(() => { if (sesion === s) { cancelar(); estado('Micrófono en espera.'); iniciar() } }, 2500)
      try { s.rec.stop(); return } catch { /* fuera de sesión */ }
    }
    cancelar(); iniciar()
  }
  function dispose() { muerta = true; cancelar() }
  return { configurar, pulsar, dispose }
}
