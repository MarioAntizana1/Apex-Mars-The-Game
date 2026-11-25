import * as T from './vendor/three/three.module.min.js'
import { crearCine } from './historia-cine.js'
import { crearExploracion } from './historia-explora.js'
import { DURACION, ejeTactil } from './historia-guion.js'

// A local, metre-scale stage. The globe and free-flight camera stay parked while this canvas is in use.
export function crearCampana({ reduced = false } = {}) {
  const $ = id => document.getElementById(id)
  const panel = $('historia'), host = $('historia-escena'), negro = $('historia-negro')
  const caption = $('historia-estado'), title = $('historia-titulo'), skipButton = $('historia-saltar')
  const useButton = $('eva-uso'), pad = $('eva-pad'), audioButton = $('historia-sonido')
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  const canvas = renderer.domElement
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', 'Escenario tridimensional. WASD para caminar; arrastra para mirar y usa E para interactuar.')
  host.replaceChildren(canvas)
  host.hidden = false
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(59, 1, .045, 4000)
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6, Math.sqrt(1900000 / (w*h))))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  let cine, eva, raf = 0, previous = null, elapsed = 0, ended = false, muted = false, outside = false
  let audio, filter, volume, pointer = null, wakeTime = 0, messageTime = 0
  const events = new AbortController(), opts = { signal: events.signal }
  const text = (node, value) => { const v = value || ''; if (node.textContent !== v) node.textContent = v }
  const status = $('eva-aviso')
  const ui = {
    objective: v => text($('eva-objetivo'), v), inventory: v => text($('eva-equipo'), v),
    status(v) { text(status, v); messageTime = 6 },
    prompt(v) { text(useButton, v); useButton.hidden = !v },
    exterior(v) { outside = Boolean(v); panel.dataset.zone = outside ? 'exterior' : 'cabina'; mix() },
  }
  function mix() {
    if (!audio) return
    filter.frequency.setTargetAtTime(outside ? 680 : 210, audio.currentTime, .55)
    volume.gain.setTargetAtTime(muted || document.hidden ? 0 : outside ? .085 : .033, audio.currentTime, .6)
  }
  function ambiente() {
    if (audio || muted) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      audio = new AC()
      const buffer = audio.createBuffer(1, 2 * audio.sampleRate, audio.sampleRate)
      let prev = 0; const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = prev = .55*prev + .45*(Math.random()*2-1)
      const wind = audio.createBufferSource(); wind.buffer = buffer; wind.loop = true
      filter = audio.createBiquadFilter(); filter.type = 'lowpass'
      volume = audio.createGain(); volume.gain.value = 0
      wind.connect(filter).connect(volume).connect(audio.destination); wind.start(); mix()
      audio.resume().catch(() => {})
    } catch { audio?.close().catch(() => {}); audio = null }
  }
  audioButton.hidden = false
  audioButton.setAttribute('aria-pressed', 'true')
  text(audioButton, 'Audio: sí')
  audioButton.addEventListener('click', () => {
    muted = !muted; cine?.audioEnabled?.(!muted); if (!muted) { if (cine) cine.beginAudio?.(); else ambiente(); audio?.resume().catch(() => {}) }
    audioButton.setAttribute('aria-pressed', String(!muted)); text(audioButton, muted ? 'Audio: no' : 'Audio: sí'); mix()
  }, opts)
  const resetPad = () => { pointer = null; pad.firstElementChild.style.transform = ''; eva?.move(0, 0) }
  function padTo(e) {
    const r = pad.getBoundingClientRect(), [x, z] = ejeTactil(e.clientX-r.left-r.width/2, r.top+r.height/2-e.clientY, r.width*.37)
    pad.firstElementChild.style.transform = `translate(${x*25}px,${-z*25}px)`; eva?.move(x, z)
  }
  pad.addEventListener('pointerdown', e => { if (pointer !== null) return; e.preventDefault(); pointer=e.pointerId; pad.setPointerCapture(pointer); padTo(e) }, opts)
  pad.addEventListener('pointermove', e => { if (e.pointerId === pointer) padTo(e) }, opts)
  for (const event of ['pointerup','pointercancel','lostpointercapture']) pad.addEventListener(event, e => { if (e.pointerId === pointer) resetPad() }, opts)
  useButton.addEventListener('click', () => { eva?.interact(); canvas.focus({ preventScroll: true }) }, opts)
  document.addEventListener('visibilitychange', () => { previous=null; resetPad(); cine?.audioEnabled?.(!muted && !document.hidden); mix() }, opts)
  function wake() {
    if (ended || eva) return
    cine?.dispose(); cine = null
    scene.clear(); scene.fog = null; scene.background = null
    camera.rotation.set(0,0,0); camera.up.set(0,1,0); camera.fov=64; camera.near=.045; camera.far=1600; camera.updateProjectionMatrix()
    negro.hidden=true; skipButton.hidden=true; $('eva').hidden=false; caption.textContent=''
    panel.dataset.shot='exploracion'; panel.dataset.zone='cabina'
    title.textContent='ARES VALLIS / SOL 01'
    for (const id of ['eva-objetivo','eva-aviso','eva-equipo','eva-uso']) $(id).textContent=''
    useButton.hidden=true
    eva = crearExploracion(T, scene, camera, renderer, ui)
    ambiente(); canvas.focus({ preventScroll:true }); previous=null
  }
  function tick(now) {
    if (ended) return
    if (!document.hidden) {
      const dt = previous === null ? 0 : Math.max(0, (now-previous)/1000)
      previous=now
      if (cine) {
        elapsed += Math.min(dt,.5)
        const cue = cine.update(Math.min(elapsed,DURACION)) || {}
        text(caption,cue.line); negro.hidden=!cue.black
        if (elapsed >= DURACION) wake()
      }
      if (eva) {
        eva.update(Math.min(dt,.1)); wakeTime += dt
        if (!reduced && wakeTime < 1.4) {
          // First breath after impact. Motion is applied only after the controller sets its pose.
          const f = (1 - wakeTime / 1.4)**2
          camera.position.y -= .34*f; camera.rotateZ(-.045*f)
        }
        if (messageTime > 0 && (messageTime -= dt) <= 0) text(status,'')
      }
      renderer.render(scene,camera)
    }
    raf=requestAnimationFrame(tick)
  }
  function dispose() {
    if (ended) return
    ended=true; cancelAnimationFrame(raf); events.abort(); ro.disconnect(); resetPad()
    cine?.dispose(); eva?.dispose(); audio?.close().catch(() => {}); renderer.dispose(); renderer.forceContextLoss()
    host.replaceChildren(); host.hidden=true; negro.hidden=true; $('eva').hidden=true; audioButton.hidden=true; delete panel.dataset.zone
  }
  try {
    if (reduced) wake()
    else { panel.dataset.shot='cine'; cine=crearCine(T,scene,camera,renderer); cine.beginAudio?.(); text(caption,''); canvas.focus({preventScroll:true}) }
    raf=requestAnimationFrame(tick)
    return { skip:wake, dispose }
  } catch (err) { dispose(); throw err }
}
