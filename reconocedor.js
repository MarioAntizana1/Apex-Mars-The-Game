import { explicarError, problemaCaptura } from './microfono.js'

// Web Speech no es uniforme entre navegadores. El motor sólo existe mientras la
// campaña está activa; cada sesión posee sus callbacks (incluido el final de PTT).
export function crearReconocedor({ alTexto = () => {}, alParcial = () => {}, alEstado = () => {}, entorno = globalThis } = {}) {
  const Motor = entorno.SpeechRecognition || entorno.webkitSpeechRecognition
  let modo = 'apagada', idioma = 'es-ES', activo = false, pulsado = false
  let muerta = false, bloqueo = '', generacion = 0, sesion = null, espera, vacias = 0
  let causa = ''
  const estado = (mensaje, escuchando = false, motor = '', error = false, directo = false) => {
    if (!muerta) alEstado({ mensaje, escuchando, motor, error, directo })
  }
  const quiere = () => activo && !bloqueo && !muerta && (modo === 'siempre' || (modo === 'ptt' && pulsado))
  function cancelar() {
    ++generacion; clearTimeout(espera)
    const s = sesion; sesion = null
    if (!s) return
    clearTimeout(s.limite)
    alParcial('')
    if (s.rec) {
      s.rec.onresult = s.rec.onerror = s.rec.onend = s.rec.onstart = s.rec.onaudiostart = null
      try { s.rec.abort() } catch { /* ya terminó */ }
    }
  }
  function bloquear(mensaje, codigo = '') {
    cancelar(); causa = codigo
    const recuperable = ['network','audio-capture'].includes(causa)
    bloqueo = `${mensaje} ${recuperable ? 'Vuelve a pulsar para reintentar. ' : ''}Puedes escribir la orden.`
    estado(bloqueo, false, '', true)
  }
  async function iniciar() {
    if (!quiere() || sesion) return
    // La prueba de permiso del menú es informativa: sólo el propio motor decide
    // si puede capturar. Un getUserMedia denegado (p. ej. por política del
    // navegador) no debe silenciar un reconocimiento que sí funcionaría.
    const problema = problemaCaptura(entorno)
    if (problema) { bloquear(problema); return }
    estado('Iniciando reconocimiento…', false, '', false, pulsado)
    const s = sesion = { rec: null, directo: pulsado, termina: false, limite: null, local: false }
    const vigente = () => sesion === s && !muerta
    try {
      const rec = s.rec = new Motor()
      // Los resultados parciales no ejecutan nada: sólo muestran en el OBC lo
      // que el motor está oyendo, para distinguir un micrófono mudo de un motor
      // que no entiende la orden.
      rec.lang = idioma; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1
      if ('processLocally' in rec && typeof Motor.available === 'function') {
        // Consultar, nunca descargar un paquete ni solicitar permisos en bucle.
        try { s.local = await Motor.available({ langs: [idioma], processLocally: true }) === 'available' } catch { /* servicio del navegador */ }
        if (!vigente()) return
        rec.processLocally = s.local
      }
      const motor = s.local ? 'local' : 'navegador'
      rec.onstart = () => { if (vigente() && !s.termina) estado(s.local ? 'Reconocimiento local activo.' : 'Escuchando con el servicio del navegador.', true, motor, false, s.directo) }
      rec.onaudiostart = () => { if (vigente() && !s.termina) estado('Captura de audio iniciada.', true, motor, false, s.directo) }
      const emitidos = new Set()
      rec.onresult = e => {
        if (!vigente()) return
        for (let i = e.resultIndex ?? 0; i < e.results.length && vigente(); ++i) {
          const r = e.results[i], frase = r[0]?.transcript?.trim()
          if (!frase) continue
          if (r.isFinal) {
            if (emitidos.has(i)) continue
            emitidos.add(i); s.resultado = true; vacias = 0
            alParcial('')
            alTexto(frase, { directo: s.directo })
          } else alParcial(frase)
        }
      }
      rec.onerror = e => { if (vigente() && !['no-speech','aborted'].includes(e.error)) bloquear(explicarError(e.error), e.error) }
      rec.onend = () => {
        if (!vigente()) return
        sesion = null; clearTimeout(s.limite)
        alParcial('')
        estado(modo === 'ptt' ? 'Mantén pulsado para hablar.' : modo === 'siempre' ? 'OBC en espera de «Nostromo».' : 'Micrófono en espera.')
        if (quiere()) {
          if (!s.resultado) ++vacias
          const token = generacion
          espera = setTimeout(() => { if (token === generacion) iniciar() }, Math.min(4000, 250 * 2 ** Math.min(vacias, 4)))
        }
      }
      rec.start(); s.iniciada = true
    } catch (e) { if (vigente()) bloquear(explicarError(e?.name === 'NotAllowedError' ? 'not-allowed' : 'error')) }
  }
  function configurar({ modo: m = modo, idioma: i = idioma, activo: a = activo } = {}) {
    if (muerta) return
    m = ['siempre','ptt'].includes(m) ? m : 'apagada'; a = Boolean(a)
    if (modo === m && idioma === i && activo === a) return
    cancelar(); pulsado = false; vacias = 0
    // Suspender y volver a la cabina no debe volver a pedir un permiso denegado.
    if (m === 'apagada' || (i !== idioma && causa === 'language-not-supported')) bloqueo = ''
    modo = m; idioma = i; activo = a
    actualizarEstado()
  }
  function actualizarEstado() {
    if (!activo || modo === 'apagada') { estado(!activo ? 'Micrófono suspendido.' : 'Micrófono apagado.'); return }
    if (bloqueo) { estado(bloqueo, false, '', true); return }
    const problema = problemaCaptura(entorno)
    if (problema) { bloquear(problema); return }
    if (quiere()) iniciar()
    else estado('Mantén pulsado para hablar.')
  }
  function pulsar(valor) {
    if (!activo || muerta || modo === 'apagada' || pulsado === !!valor) return
    pulsado = !!valor
    if (bloqueo) {
      // Reintento explícito tras un fallo transitorio; nunca repetir el permiso.
      if (!pulsado || !['network','audio-capture'].includes(causa)) return
      bloqueo = ''
    }
    if (pulsado) { cancelar(); iniciar(); return }
    const s = sesion
    if (s?.iniciada && s.directo) {
      s.termina = true
      // stop conserva el último resultado; abort en una suspensión lo invalida.
      s.limite = setTimeout(() => { if (sesion === s) { cancelar(); estado('Micrófono en espera.'); iniciar() } }, 2500)
      try { s.rec.stop(); return } catch { /* fuera de sesión */ }
    }
    cancelar()
    if (quiere()) iniciar()
    else estado('Mantén pulsado para hablar.')
  }
  function dispose() { muerta = true; cancelar() }
  function reintentar() {
    if (muerta || !bloqueo) return
    bloqueo = ''; pulsado = false
    actualizarEstado()
  }
  return { configurar, pulsar, reintentar, dispose }
}
