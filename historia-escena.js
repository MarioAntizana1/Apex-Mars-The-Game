import * as T from './vendor/three/three.module.min.js'
import { crearCine } from './historia-cine.js'
import { crearExploracion } from './historia-explora.js'
import { DURACION, ejeTactil } from './historia-guion.js'
import { guardarPreferencias, leerPreferencias } from './preferencias.js'
import { GEO, MUNDO, ORIGEN, SAGAN } from './historia-terreno.js'

// A local, metre-scale stage. The globe and free-flight camera stay parked while this canvas is in use.
export function crearCampana({ reduced = false } = {}) {
  const $ = id => document.getElementById(id)
  const panel = $('historia'), host = $('historia-escena'), negro = $('historia-negro')
  const caption = $('historia-estado'), title = $('historia-titulo'), skipButton = $('historia-saltar')
  const useButton = $('eva-uso'), pad = $('eva-pad'), audioButton = $('historia-sonido')
  const pauseButton = $('juego-pausa'), mapaButton = $('eva-mapa'), vehiculoButton = $('eva-vehiculo')
  const tabletDialog = $('tablet'), tabletCanvas = $('tablet-carta')
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  const canvas = renderer.domElement
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', 'Escenario tridimensional. WASD para caminar; arrastra para mirar y usa E para interactuar.')
  host.replaceChildren(canvas)
  host.hidden = false
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(59, 1, .06, 5000)
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6, Math.sqrt(1900000 / (w * h))))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  let cine, eva, raf = 0, previous = null, elapsed = 0, ended = false
  let fuera = false, vehiculoEstado = 'guardado'
  let pausaAbierta = false, mapaAbierto = false
  let ultima = { x: 0, z: 1.34, y: 0, rumbo: 0, conduciendo: false, caminando: false, velocidad: 0, distanciaSagan: 2000, direccionSagan: 'sureste' }
  let preferencias = leerPreferencias()
  let muted = !preferencias.sonido
  let audio, filtroViento, volumen, motorOsc, motorFiltro, motorGanancia, bufferPaso
  let proximoPaso = 0, pointer = null, wakeTime = 0, messageTime = 0
  const events = new AbortController(), opts = { signal: events.signal }
  const text = (node, value) => { const v = value || ''; if (node.textContent !== v) node.textContent = v }
  const status = $('eva-aviso')
  const ZOOMS = [6, 12, 25, 50, 100, 250, 600]
  let zoomMapa = 3, centroMapa = 'jugador'

  const ui = {
    objective: v => text($('eva-objetivo'), v), inventory: v => text($('eva-equipo'), v),
    status(v) { text(status, v); messageTime = 6; if (v && audio && !muted) aviso() },
    prompt(v) { text(useButton, v); useButton.hidden = !v },
    exterior(v) {
      fuera = Boolean(v)
      panel.dataset.zone = fuera ? 'exterior' : 'cabina'
      vehiculoButton.hidden = !fuera
      mix()
    },
    vehiculo(estado) {
      vehiculoEstado = estado
      const textos = { guardado: 'Desplegar vehículo · V', desplegado: 'Subir al rover · V', conduciendo: 'Bajar del rover · V' }
      text(vehiculoButton, textos[estado] ?? textos.guardado)
      vehiculoButton.hidden = !fuera
    },
    tablet(v) { mapaButton.hidden = !v },
    mapa() { alternarMapa() },
    paused() { return mapaAbierto || pausaAbierta },
    position(datos) {
      ultima = datos
      actualizarRuta(datos)
      actualizarMotor(datos)
    },
  }

  function mix() {
    if (!audio) return
    filtroViento.frequency.setTargetAtTime(fuera ? 680 : 210, audio.currentTime, .55)
    const enPausa = pausaAbierta || mapaAbierto || document.hidden
    volumen.gain.setTargetAtTime(muted || enPausa ? 0 : fuera ? .085 : .033, audio.currentTime, .6)
  }

  function ambiente() {
    if (audio || muted) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      audio = new AC()
      const buffer = audio.createBuffer(1, 2 * audio.sampleRate, audio.sampleRate)
      let prev = 0; const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = prev = .55 * prev + .45 * (Math.random() * 2 - 1)
      const wind = audio.createBufferSource(); wind.buffer = buffer; wind.loop = true
      filtroViento = audio.createBiquadFilter(); filtroViento.type = 'lowpass'
      volumen = audio.createGain(); volumen.gain.value = 0
      wind.connect(filtroViento).connect(volumen).connect(audio.destination); wind.start()
      // Motor del rover y pasos: sintetizados, sin archivos externos.
      motorOsc = audio.createOscillator(); motorOsc.type = 'sawtooth'; motorOsc.frequency.value = 46
      motorFiltro = audio.createBiquadFilter(); motorFiltro.type = 'lowpass'; motorFiltro.frequency.value = 240
      motorGanancia = audio.createGain(); motorGanancia.gain.value = 0
      motorOsc.connect(motorFiltro).connect(motorGanancia).connect(volumen); motorOsc.start()
      bufferPaso = audio.createBuffer(1, Math.floor(audio.sampleRate * .16), audio.sampleRate)
      const d = bufferPaso.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * .028))
      mix(); audio.resume().catch(() => {})
    } catch { audio?.close().catch(() => {}); audio = null }
  }

  function paso() {
    if (!audio || !bufferPaso || muted) return
    const src = audio.createBufferSource(); src.buffer = bufferPaso
    const filtro = audio.createBiquadFilter(); filtro.type = 'bandpass'
    filtro.frequency.value = 470 + Math.random() * 240; filtro.Q.value = 1.1
    const g = audio.createGain(), t = audio.currentTime
    g.gain.setValueAtTime(.14, t)
    g.gain.exponentialRampToValueAtTime(.0001, t + .14)
    src.connect(filtro).connect(g).connect(volumen)
    src.start(t); src.stop(t + .16)
  }

  function aviso() {
    if (!audio || muted) return
    const osc = audio.createOscillator(), g = audio.createGain()
    const t = audio.currentTime
    osc.type = 'sine'; osc.frequency.setValueAtTime(760, t); osc.frequency.exponentialRampToValueAtTime(980, t + .08)
    g.gain.setValueAtTime(.028, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16)
    osc.connect(g).connect(volumen); osc.start(t); osc.stop(t + .17)
  }

  function actualizarMotor(datos) {
    if (!audio || !motorGanancia) return
    const t = audio.currentTime
    const v = datos.conduciendo ? Math.min(1, Math.abs(datos.velocidad || 0) / 26) : 0
    motorGanancia.gain.setTargetAtTime(datos.conduciendo ? .05 + .11 * v : 0, t, .25)
    motorOsc.frequency.setTargetAtTime(46 + v * 90, t, .2)
    motorFiltro.frequency.setTargetAtTime(240 + v * 380, t, .2)
    if (datos.caminando && !datos.conduciendo && t > proximoPaso) {
      paso()
      proximoPaso = t + ((datos.velocidad || 0) > 3.5 ? .34 : .52)
    }
  }

  function aplicarSonido(activo) {
    muted = !activo
    if (audioButton) {
      audioButton.setAttribute('aria-pressed', String(!muted))
      text(audioButton, muted ? 'Audio: no' : 'Audio: sí')
    }
    if ($('pausa-sonido')) $('pausa-sonido').checked = activo
    if (activo) {
      if (eva) ambiente()
      audio?.resume().catch(() => {})
      if (cine) cine.beginAudio?.()
    }
    mix()
  }

  function cambiarSonido(activo) {
    guardarPreferencias({ sonido: activo })
    aplicarSonido(activo)
  }

  audioButton.hidden = false
  text(audioButton, muted ? 'Audio: no' : 'Audio: sí')
  audioButton.setAttribute('aria-pressed', String(!muted))
  audioButton.addEventListener('click', () => cambiarSonido(muted), opts)

  const resetPad = () => { pointer = null; pad.firstElementChild.style.transform = ''; eva?.move(0, 0) }
  function padTo(e) {
    const r = pad.getBoundingClientRect(), [x, z] = ejeTactil(e.clientX - r.left - r.width / 2, r.top + r.height / 2 - e.clientY, r.width * .37)
    pad.firstElementChild.style.transform = `translate(${x * 25}px,${-z * 25}px)`; eva?.move(x, z)
  }
  pad.addEventListener('pointerdown', e => { if (pointer !== null) return; e.preventDefault(); pointer = e.pointerId; pad.setPointerCapture(pointer); padTo(e) }, opts)
  pad.addEventListener('pointermove', e => { if (e.pointerId === pointer) padTo(e) }, opts)
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(event, e => { if (e.pointerId === pointer) resetPad() }, opts)
  useButton.addEventListener('click', () => { eva?.interact(); canvas.focus({ preventScroll: true }) }, opts)

  // Herramientas táctiles y de teclado.
  mapaButton.addEventListener('click', () => eva?.mapa(), opts)
  vehiculoButton.addEventListener('click', () => eva?.vehicle(), opts)
  $('eva-salto').addEventListener('click', () => eva?.jump(), opts)
  const correr = $('eva-correr')
  correr.addEventListener('pointerdown', e => { e.preventDefault(); correr.setAttribute('aria-pressed', 'true'); eva?.sprint(true) }, opts)
  for (const evento of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) correr.addEventListener(evento, () => { correr.setAttribute('aria-pressed', 'false'); eva?.sprint(false) }, opts)

  // --- Menú de pausa -------------------------------------------------------
  const pausa = $('pausa'), pausaOpciones = $('pausa-opciones'), pausaCreditos = $('pausa-creditos')
  function abrirPausa() {
    if (!eva || ended || pausaAbierta) return
    if (mapaAbierto) cerrarMapa()
    pausaAbierta = true
    pausaOpciones.hidden = true
    pausa.hidden = false
    $('pausa-continuar').focus()
    mix()
  }
  function cerrarPausa() {
    if (!pausaAbierta) return
    pausaAbierta = false
    pausa.hidden = true
    canvas.focus({ preventScroll: true })
    mix()
  }
  pauseButton.addEventListener('click', abrirPausa, opts)
  $('pausa-continuar').addEventListener('click', cerrarPausa, opts)
  $('pausa').querySelector('[data-cerrar-pausa]').addEventListener('click', cerrarPausa, opts)
  $('pausa-opciones-boton').addEventListener('click', () => {
    pausaCreditos.hidden = true
    pausaOpciones.hidden = false
    if ($('pausa-sonido')) $('pausa-sonido').checked = !muted
    if ($('pausa-ciencia')) $('pausa-ciencia').checked = leerPreferencias().ciencia
    if ($('pausa-rumbo')) $('pausa-rumbo').checked = leerPreferencias().rumbo
    $('pausa-sonido')?.focus()
  }, opts)
  $('pausa-opciones-volver').addEventListener('click', () => { pausaOpciones.hidden = true; $('pausa-opciones-boton').focus() }, opts)
  $('pausa-creditos-boton').addEventListener('click', () => { pausaOpciones.hidden = true; pausaCreditos.hidden = false; crearCreditosPausa() }, opts)
  $('pausa-globo').addEventListener('click', () => { cerrarPausa(); $('historia-salir').click() }, opts)
  $('pausa-sonido')?.addEventListener('change', e => cambiarSonido(e.target.checked), opts)
  $('pausa-ciencia')?.addEventListener('change', e => guardarPreferencias({ ciencia: e.target.checked }), opts)
  $('pausa-rumbo')?.addEventListener('change', e => guardarPreferencias({ rumbo: e.target.checked }), opts)
  function crearCreditosPausa() {
    if (pausaCreditos.dataset.creado === 'si') return
    pausaCreditos.dataset.creado = 'si'
    const h = document.createElement('h3'); h.textContent = 'Créditos'
    const ul = document.createElement('ul')
    for (const [titulo, detalle] of [
      ['Relieve e imagen', 'DTM y ortoimágenes HiRISE del sitio Pathfinder · NASA/JPL/University of Arizona'],
      ['Relieve global', 'MOLA · NASA/JPL/MOLA Science Team'],
      ['Globo', 'CesiumJS · Cesium GS, Apache 2.0'],
      ['Escena 3D', 'three.js · MIT'],
      ['Modelos Pathfinder y Sojourner', 'Reconstrucción original de APEX / MARS'],
      ['Agradecimientos', 'NASA, JPL, USGS Astrogeology y la misión Mars Pathfinder (1997)'],
    ]) {
      const li = document.createElement('li'), b = document.createElement('b'), s = document.createElement('small')
      b.textContent = titulo
      s.textContent = detalle
      li.append(b, s)
      ul.append(li)
    }
    const volver = document.createElement('button'); volver.type = 'button'; volver.className = 'pausa-volver'; volver.textContent = 'Volver al menú de pausa'
    volver.addEventListener('click', () => { pausaCreditos.hidden = true })
    pausaCreditos.replaceChildren(h, ul, volver)
  }

  // --- Tablet y mapa -------------------------------------------------------
  const tabletCtx = tabletCanvas?.getContext?.('2d')
  function alternarMapa() {
    if (!eva) return
    if (mapaAbierto) cerrarMapa()
    else abrirMapa()
  }
  function abrirMapa() {
    if (!tabletDialog || mapaAbierto) return
    mapaAbierto = true
    if (pausaAbierta) cerrarPausa()
    if (typeof tabletDialog.showModal === 'function' && !tabletDialog.open) tabletDialog.showModal()
    else tabletDialog.setAttribute('open', '')
    dibujarMapa()
    $('tablet-cerrar').focus()
    mix()
  }
  function cerrarMapa() {
    if (!mapaAbierto) return
    mapaAbierto = false
    if (tabletDialog.open && typeof tabletDialog.close === 'function') tabletDialog.close()
    else tabletDialog.removeAttribute('open')
    canvas.focus({ preventScroll: true })
    mix()
  }
  tabletDialog?.addEventListener('close', () => { mapaAbierto = false; canvas.focus({ preventScroll: true }); mix() }, opts)
  tabletDialog?.addEventListener('click', e => { if (e.target === tabletDialog) cerrarMapa() }, opts)
  $('tablet-cerrar').addEventListener('click', cerrarMapa, opts)
  $('tablet-alejar').addEventListener('click', () => { zoomMapa = Math.min(ZOOMS.length - 1, zoomMapa + 1); dibujarMapa() }, opts)
  $('tablet-acercar').addEventListener('click', () => { zoomMapa = Math.max(0, zoomMapa - 1); dibujarMapa() }, opts)
  $('tablet-ruta').addEventListener('click', () => {
    centroMapa = centroMapa === 'sagan' ? 'jugador' : 'sagan'
    $('tablet-ruta').textContent = centroMapa === 'sagan' ? 'Centrar en mí' : 'Centrar en Sagan'
    dibujarMapa()
  }, opts)

  const formatLat = v => {
    const ns = v >= 0 ? 'N' : 'S', a = Math.abs(v)
    const g = Math.floor(a), m = Math.floor((a - g) * 60), s = Math.round(((a - g) * 60 - m) * 60)
    return `${g}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${ns}`
  }
  const formatLon = v => {
    let lon = ((v + 180) % 360 + 360) % 360 - 180
    const ew = lon >= 0 ? 'E' : 'O', a = Math.abs(lon)
    const g = Math.floor(a), m = Math.floor((a - g) * 60), s = Math.round(((a - g) * 60 - m) * 60)
    return `${g}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${ew}`
  }
  const textoDist = d => d >= 1000 ? `${(d / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(d)} m`
  const nombreRumbo = grados => ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'][Math.round(((grados % 360) + 360) % 360 / 45) % 8]

  function dibujarMapa() {
    if (!tabletCtx) return
    const w = tabletCanvas.width, h = tabletCanvas.height
    const d = ultima
    const escala = ZOOMS[zoomMapa]
    const cx = centroMapa === 'sagan' ? SAGAN.x : d.x
    const cz = centroMapa === 'sagan' ? SAGAN.z : d.z
    const sx = x => w / 2 + (x - cx) / escala
    const sy = z => h / 2 + (z - cz) / escala
    const g = tabletCtx
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#1c1511'
    g.fillRect(0, 0, w, h)
    // Cuadrícula geográfica real (latitud/longitud) adaptada al zoom.
    const pasos = [.002, .005, .01, .02, .05, .1, .2, .5]
    const paso = pasos.find(p => p * GEO.mPorGradoLon / escala >= 66) ?? .5
    const pasoX = paso * GEO.mPorGradoLon, pasoZ = paso * GEO.mPorGradoLat
    const xMin = cx - (w / 2) * escala, xMax = cx + (w / 2) * escala
    const zMin = cz - (h / 2) * escala, zMax = cz + (h / 2) * escala
    g.strokeStyle = '#6b4f3d55'; g.lineWidth = 1
    g.fillStyle = '#b98e6d'; g.font = '11px ui-monospace, monospace'
    g.textBaseline = 'alphabetic'
    const etiqueta = (texto, px, py) => {
      const ancho = g.measureText(texto).width
      g.fillStyle = '#1c1511d9'
      g.fillRect(px - 2, py - 10, ancho + 4, 12)
      g.fillStyle = '#c6a17f'
      g.fillText(texto, px, py)
    }
    for (let x = Math.ceil(xMin / pasoX) * pasoX; x <= xMax; x += pasoX) {
      const px = sx(x)
      g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h); g.stroke()
      const lon = ORIGEN.lon + x / GEO.mPorGradoLon
      etiqueta(formatLon(lon), Math.min(w - 72, Math.max(4, px + 3)), h - 6)
    }
    for (let z = Math.ceil(zMin / pasoZ) * pasoZ; z <= zMax; z += pasoZ) {
      const py = sy(z)
      g.beginPath(); g.moveTo(0, py); g.lineTo(w, py); g.stroke()
      const lat = ORIGEN.lat - z / GEO.mPorGradoLat
      etiqueta(formatLat(lat), 6, Math.max(22, Math.min(h - 18, py + 4)))
    }
    // Área con relieve real HiRISE y límite del mundo.
    g.fillStyle = 'rgba(190,110,70,.13)'
    g.fillRect(sx(MUNDO.x0), sy(MUNDO.z0), (MUNDO.x1 - MUNDO.x0) / escala, (MUNDO.z1 - MUNDO.z0) / escala)
    g.strokeStyle = '#c98a5faa'; g.lineWidth = 1.5
    g.strokeRect(sx(MUNDO.x0), sy(MUNDO.z0), (MUNDO.x1 - MUNDO.x0) / escala, (MUNDO.z1 - MUNDO.z0) / escala)
    g.fillStyle = '#e0a878'; g.font = 'bold 11px ui-monospace, monospace'
    g.fillText('DETALLE HiRISE · 1 m', sx(MUNDO.x0) + 6, sy(MUNDO.z0) + 8)
    // La cobertura de detalle termina, el terreno transitable continúa.
    // Ruta opcional (la brújula se activa en Opciones).
    if (preferencias.rumbo) {
      g.setLineDash([8, 7]); g.strokeStyle = '#8ee6cd99'; g.lineWidth = 1.4
      g.beginPath(); g.moveTo(sx(d.x), sy(d.z)); g.lineTo(sx(SAGAN.x), sy(SAGAN.z)); g.stroke()
      g.setLineDash([])
    }
    // Nave, Sagan y jugador.
    g.fillStyle = '#f3d9b0'; g.fillRect(sx(0) - 5, sy(0) - 5, 10, 10)
    g.font = 'bold 11px ui-monospace, monospace'; g.fillText('NAVE', sx(0) + 8, sy(0) - 6)
    const saganX = sx(SAGAN.x), saganY = sy(SAGAN.z)
    const fueraX = Math.max(12, Math.min(w - 12, saganX)), fueraY = Math.max(12, Math.min(h - 12, saganY))
    g.strokeStyle = '#7ff0de'; g.fillStyle = '#7ff0de'; g.lineWidth = 2
    g.beginPath(); g.moveTo(fueraX, fueraY - 7); g.lineTo(fueraX + 7, fueraY); g.lineTo(fueraX, fueraY + 7); g.lineTo(fueraX - 7, fueraY); g.closePath(); g.stroke()
    g.font = 'bold 12px ui-monospace, monospace'; g.fillText('SAGAN', fueraX + 10, fueraY - 7)
    if(d.sitioBaliza){
      const bx=sx(d.sitioBaliza.x),by=sy(d.sitioBaliza.z)
      g.fillStyle='#ffac70';g.beginPath();g.arc(bx,by,4,0,2*Math.PI);g.fill()
      g.fillText('BALIZA',bx+7,by+15)
    }
    // Jugador: triángulo grande y halo, siempre por encima de las demás marcas.
    const px = sx(d.x), py = sy(d.z), ang = -(d.rumbo || 0) * 180 / Math.PI
    g.save(); g.translate(px, py)
    g.fillStyle = '#ffd27a2e'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill()
    g.rotate(ang * Math.PI / 180)
    g.fillStyle = '#ffd27a'; g.strokeStyle = '#2b1a10'; g.lineWidth = 2
    g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(0, 4.5); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke()
    g.restore()
    g.fillStyle = '#ffe6b0'; g.font = 'bold 10px ui-monospace, monospace'; g.fillText('TÚ', Math.min(w - 20, px + 13), Math.min(h - 8, py + 15))
    // Escala gráfica.
    const bonitas = [100, 250, 500, 1000, 2000, 5000, 10000, 25000]
    const metros = bonitas.find(m => m / escala >= 40) ?? 25000
    const largo = metros / escala
    g.fillStyle = '#f0d9bf'; g.fillRect(18, h - 28, largo, 4)
    g.fillRect(18, h - 34, 2, 11); g.fillRect(18 + largo, h - 34, 2, 11)
    g.font = '12px ui-monospace, monospace'; g.fillText(`${metros >= 1000 ? metros / 1000 + ' km' : metros + ' m'}`, 18, h - 45)
    // Brújula.
    g.strokeStyle = '#ffcf9a'; g.fillStyle = '#ffcf9a'; g.lineWidth = 1.6
    g.beginPath(); g.moveTo(w - 30, 26); g.lineTo(w - 36, 44); g.lineTo(w - 30, 39); g.lineTo(w - 24, 44); g.closePath(); g.stroke()
    g.font = 'bold 12px ui-monospace, monospace'; g.fillText('N', w - 34, 12)
    // Lectura y escala textual.
    const saganD = Math.hypot(SAGAN.x - d.x, SAGAN.z - d.z)
    const rumbo = Math.atan2(SAGAN.x - d.x, -(SAGAN.z - d.z))
    if ($('tablet-escala')) $('tablet-escala').textContent = `1 km ≈ ${Math.round(1000 / escala)} px`
    text($('tablet-lectura'), [
      `Posición  ${formatLat(ORIGEN.lat - d.z / GEO.mPorGradoLat)}  ${formatLon(ORIGEN.lon + d.x / GEO.mPorGradoLon)}`,
      `Altura ${d.y >= 0 ? '+' : ''}${(d.y || 0).toFixed(1)} m · ${d.conduciendo ? 'rover' : d.caminando ? 'a pie' : 'parado'}${d.conduciendo ? ` · ${Math.abs(d.velocidad || 0).toFixed(1)} m/s` : ''}`,
      `Sagan a ${textoDist(saganD)} al ${nombreRumbo(rumbo * 180 / Math.PI)} · rumbo ${Math.round(((rumbo * 180 / Math.PI) % 360 + 360) % 360)}°`,
      `Baliza: ${d.estadoBaliza ?? 'en la nave'}${d.sitioBaliza ? ` · a ${textoDist(Math.hypot(d.x-d.sitioBaliza.x,d.z-d.sitioBaliza.z))} de ti` : ''}`,
      `Pathfinder: ${d.estadoRadio ?? 'sin enlace'}`,
    ].join('\n'))
  }

  // Flecha de rumbo opcional sobre el HUD.
  function actualizarRuta(d) {
    const ruta = $('eva-ruta'), aguja = $('eva-ruta-aguja'), texto = $('eva-ruta-texto')
    if (!ruta) return
    const mostrar = Boolean(preferencias.rumbo) && Boolean(eva) && !ended
    ruta.hidden = !mostrar
    if (!mostrar) return
    const saganD = Math.hypot(SAGAN.x - d.x, SAGAN.z - d.z)
    const ang = Math.atan2(SAGAN.x - d.x, -(SAGAN.z - d.z)) * 180 / Math.PI
    if (aguja) aguja.style.transform = `rotate(${ang - 90}deg)`
    text(texto, `Sagan · ${textoDist(saganD)} · ${nombreRumbo(ang)}`)
  }

  function sincronizarPreferencias() {
    preferencias = leerPreferencias()
    aplicarSonido(preferencias.sonido)
    if ($('pausa-ciencia')) $('pausa-ciencia').checked = preferencias.ciencia
    if ($('pausa-rumbo')) $('pausa-rumbo').checked = preferencias.rumbo
    actualizarRuta(ultima)
  }
  document.addEventListener('apex:preferencias', sincronizarPreferencias, opts)

  document.addEventListener('visibilitychange', () => { previous = null; resetPad(); cine?.audioEnabled?.(!muted && !document.hidden); mix() }, opts)

  function wake() {
    if (ended || eva) return
    cine?.dispose(); cine = null
    scene.clear(); scene.fog = null; scene.background = null
    camera.rotation.set(0, 0, 0); camera.up.set(0, 1, 0); camera.fov = 64; camera.near = .06; camera.far = 5000; camera.updateProjectionMatrix()
    negro.hidden = true; skipButton.hidden = true; $('eva').hidden = false; caption.textContent = ''
    pauseButton.hidden = false
    panel.dataset.shot = 'exploracion'; panel.dataset.zone = 'cabina'
    title.textContent = 'ARES VALLIS / SOL 01'
    for (const id of ['eva-objetivo', 'eva-aviso', 'eva-equipo', 'eva-uso']) $(id).textContent = ''
    useButton.hidden = true
    mapaButton.hidden = true
    eva = crearExploracion(T, scene, camera, renderer, ui)
    ambiente(); canvas.focus({ preventScroll: true }); previous = null
  }

  function tick(now) {
    if (ended) return
    if (!document.hidden) {
      const dt = previous === null ? 0 : Math.max(0, (now - previous) / 1000)
      previous = now
      if (cine) {
        elapsed += Math.min(dt, .5)
        const cue = cine.update(Math.min(elapsed, DURACION)) || {}
        text(caption, cue.line); negro.hidden = !cue.black
        if (elapsed >= DURACION) wake()
      }
      if (eva) {
        eva.update(Math.min(dt, .1)); wakeTime += dt
        if (!reduced && wakeTime < 1.4) {
          // First breath after impact. Motion is applied only after the controller sets its pose.
          const f = (1 - wakeTime / 1.4) ** 2
          camera.position.y -= .34 * f; camera.rotateZ(-.045 * f)
        }
        if (messageTime > 0 && (messageTime -= dt) <= 0) text(status, '')
      }
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)
  }

  function escape() {
    if (!eva) return false
    if (mapaAbierto) { cerrarMapa(); return true }
    if (pausaAbierta) { cerrarPausa(); return true }
    abrirPausa(); return true
  }

  function dispose() {
    if (ended) return
    ended = true
    cancelAnimationFrame(raf); events.abort(); ro.disconnect(); resetPad()
    if (mapaAbierto) { mapaAbierto = false; if (tabletDialog?.open) tabletDialog.close() }
    pausaAbierta = false; pausa.hidden = true
    cine?.dispose(); eva?.dispose(); audio?.close().catch(() => {}); renderer.dispose(); renderer.forceContextLoss()
    host.replaceChildren(); host.hidden = true; negro.hidden = true; $('eva').hidden = true; audioButton.hidden = true
    pauseButton.hidden = true
    delete panel.dataset.zone
  }
  try {
    if (reduced) wake()
    else { panel.dataset.shot = 'cine'; cine = crearCine(T, scene, camera, renderer); cine.beginAudio?.(); text(caption, ''); canvas.focus({ preventScroll: true }) }
    raf = requestAnimationFrame(tick)
    return { skip: wake, dispose, escape, get simulacion() { return eva } }
  } catch (err) { dispose(); throw err }
}
