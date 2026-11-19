import { aboveGround, flightPhase, newFlight, stepFlight, TERRAIN_FREE_ALTITUDE } from './flight-dynamics.js?v=espacio'
import { followArc } from './flight-path.js'

const CONTROL = new Map([
  ['KeyW', 'up'], ['ArrowUp', 'up'], ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyR', 'fast'], ['KeyF', 'slow'], ['KeyB', 'brake'],
])
const PHASE = {
  air: 'Vuelo libre · cohete',
  space: 'Espacio · sobre Marte',
  landing: 'Aproximación · frena, baja y nivela las alas',
  ground: 'En tierra · alinea y mantén acelerar + subir para despegar',
  recovery: 'Recuperando altura · frena antes de volver a bajar',
  waiting: 'Esperando terreno · puedes girar o subir',
}

export function crearVuelo(C, viewer, status, stopFlyover) {
  const { scene, camera } = viewer
  const { globe, screenSpaceCameraController: controls } = scene
  const { ellipsoid } = globe
  const start = document.querySelector('#pilotaje')
  const panel = document.querySelector('#vuelo-panel')
  const pause = document.querySelector('#pausar-vuelo')
  const exit = document.querySelector('#salir-vuelo')
  const recenter = document.querySelector('#vuelo-recentrar')
  const motionMarker = document.querySelector('#vuelo-vector')
  const canvas = scene.canvas
  const speedLabel = document.querySelector('#velocidad-nave')
  const headingLabel = document.querySelector('#rumbo-nave')
  const heightLabel = document.querySelector('#altura-nave')
  const positionLabel = document.querySelector('#posicion-nave')
  const buttons = [...panel.querySelectorAll('[data-flight-control]')]
  const keys = new Set()
  const pointers = new Map()
  const buttonKeys = new Map()
  const origin = new C.Cartesian3()
  const destination = new C.Cartesian3()
  const forward = new C.Cartesian3()
  const bodyUp = new C.Cartesian3()
  const offset = new C.Cartesian3()
  const frame = new C.Matrix4()
  const speedFormat = new Intl.NumberFormat('es', { maximumFractionDigits: 0 })
  const attitude = new C.HeadingPitchRoll()
  const sample = new C.Cartographic()
  const probePoint = new C.Cartographic()
  const arc = { latitude: 0, longitude: 0, heading: 0 }
  const markerPoint = new C.Cartesian3()
  const markerNormal = new C.Cartesian3()
  const look = { yaw: 0, pitch: 0, pointer: null, x: 0, y: 0 }
  let flight, previousInputs, previousCollision, previousTouchAction

  const clamp = C.Math.clamp
  const deg = C.Math.toDegrees
  const active = () => flight && !flight.paused
  const refreshButtons = () => {
    const held = new Set([...pointers.values(), ...buttonKeys.values()].map(button => button.dataset.flightControl))
    for (const code of keys) held.add(CONTROL.get(code))
    for (const button of buttons) button.classList.toggle('is-pressed', held.has(button.dataset.flightControl))
    return held
  }
  let held = new Set()
  const refreshInputs = () => { held = refreshButtons() }
  function releaseLook() {
    const pointer = look.pointer
    look.pointer = null
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer)
  }
  function centerLook() {
    look.yaw = look.pitch = 0
    if (flight) place()
  }
  function clearInputs() {
    releaseLook()
    keys.clear()
    const captures = [...pointers]
    pointers.clear()
    buttonKeys.clear()
    for (const [id, button] of captures) if (button.hasPointerCapture(id)) button.releasePointerCapture(id)
    refreshInputs()
  }
  function announce() {
    const phase = flightPhase(flight)
    if (panel.dataset.flightPhase !== phase) panel.dataset.flightPhase = phase
    const message = flight.paused ? 'Vuelo en pausa' : PHASE[phase]
    if (status.textContent !== message) status.textContent = message
  }
  function hud() {
    speedLabel.textContent = `${speedFormat.format(flight.speed * 3.6)} km/h`
    headingLabel.textContent = `${Math.round(deg(flight.heading)) % 360}°`
    heightLabel.textContent = flight.height > TERRAIN_FREE_ALTITUDE ? `${(flight.height / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} km sobre la referencia`
      : flight.waiting ? 'Terreno sin confirmar' : `≈ ${speedFormat.format(aboveGround(flight))} m sobre el terreno`
    positionLabel.textContent = `${deg(flight.position.latitude).toFixed(5)}°, ${deg(flight.position.longitude).toFixed(5)}°`
  }

  function place(dt) {
    const { position, heading, pitch, bank } = flight
    const v = C.Cartesian3
    ellipsoid.cartographicToCartesian(position, origin)
    // Keep the camera onboard while giving the pilot a clear view ahead.
    attitude.heading = heading - C.Math.PI_OVER_TWO
    attitude.pitch = pitch
    attitude.roll = bank
    C.Transforms.headingPitchRollToFixedFrame(origin, attitude, ellipsoid, undefined, frame)
    C.Matrix4.multiplyByPointAsVector(frame, v.UNIT_X, forward)
    C.Matrix4.multiplyByPointAsVector(frame, v.UNIT_Z, bodyUp)
    v.multiplyByScalar(forward, 6, offset)
    v.add(origin, offset, destination)
    v.multiplyByScalar(bodyUp, 2.5, offset)
    v.add(destination, offset, destination)
    ellipsoid.cartesianToCartographic(destination, sample)
    const ground = sample.height <= TERRAIN_FREE_ALTITUDE ? globe.getHeight(sample) : undefined
    const safetyLift = Math.max(0, (Number.isFinite(ground) ? ground : flight.rawGround) + 2 - sample.height)
    // Lower slowly when the underlying tile changes or the camera crosses a
    // ridge; only the safety clamp can move it upward faster.
    flight.cameraLift = Math.max(flight.cameraLift - 30 * (dt ?? 0), safetyLift)
    if (flight.cameraLift > 0) {
      sample.height += flight.cameraLift
      ellipsoid.cartographicToCartesian(sample, destination)
    }
    const rad = C.Math.toRadians
    const highView = clamp((position.height - 25000) / 75000, 0, 1)
    const horizontal = flight.speed * Math.cos(pitch)
    const pathPitch = horizontal > 0 ? Math.atan2(flight.verticalRate, horizontal) : 0
    const defaultPitch = (1 - highView) * (pitch * .55 - rad(8)) + highView * pathPitch
    camera.setView({ destination, orientation: {
      heading: C.Math.zeroToTwoPi(heading + look.yaw),
      pitch: clamp(defaultPitch + look.pitch, rad(-88), rad(88)),
      roll: bank * .6,
    } })
    const view = Math.abs(look.yaw) + Math.abs(look.pitch) > .001 ? 'free' : 'forward'
    if (panel.dataset.view !== view) panel.dataset.view = view
    drawMotionMarker(horizontal, v)
    scene.requestRender()
  }

  function drawMotionMarker(horizontal, v) {
    if (!motionMarker) return
    if (horizontal <= 1 || flight.waiting) { motionMarker.setAttribute('hidden', ''); return }
    ellipsoid.geodeticSurfaceNormal(origin, markerNormal)
    v.multiplyByScalar(markerNormal, v.dot(markerNormal, forward), markerPoint)
    v.normalize(v.subtract(forward, markerPoint, markerPoint), markerPoint)
    v.multiplyByScalar(markerNormal, flight.verticalRate / horizontal, markerNormal)
    v.add(markerPoint, markerNormal, markerPoint)
    const depth = v.dot(markerPoint, camera.directionWC)
    if (depth <= .05) { motionMarker.setAttribute('hidden', ''); return }
    const width = canvas.clientWidth, height = canvas.clientHeight
    // Project the direction at infinity using the current camera, before render.
    const scale = height / (2 * Math.tan(camera.frustum.fovy / 2) * depth)
    const x = width / 2 + scale * v.dot(markerPoint, camera.rightWC)
    const y = height / 2 - scale * v.dot(markerPoint, camera.upWC)
    const visible = x >= 16 && y >= 16 && x <= width - 16 && y <= height - 16
    motionMarker.toggleAttribute('hidden', !visible)
    if (visible) {
      const rect = canvas.getBoundingClientRect()
      motionMarker.style.left = `${rect.left + x}px`
      motionMarker.style.top = `${rect.top + y}px`
    }
  }

  function trace(position, heading, distance) {
    return followArc(position.latitude, position.longitude, heading, distance / (ellipsoid.maximumRadius + position.height), arc)
  }
  function probe(distance, heading) {
    const position = flight.position
    if (!distance) return globe.getHeight(position)
    const point = trace(position, heading, distance)
    return globe.getHeight(C.Cartographic.fromRadians(point.longitude, point.latitude, position.height, probePoint))
  }

  scene.preUpdate.addEventListener(() => {
    if (!active()) return
    const now = performance.now()
    const dt = clamp((now - flight.last) / 1000, 0, .09)
    flight.last = now
    if (!dt) return
    const input = {
      pitch: Number(held.has('up')) - Number(held.has('down')),
      steer: Number(held.has('right')) - Number(held.has('left')),
      throttle: Number(held.has('fast')) - Number(held.has('slow')),
      brake: held.has('brake'),
    }
    const checkTerrain = flight.height <= TERRAIN_FREE_ALTITUDE + 1000
    const steps = Math.max(Math.ceil(dt / .03), checkTerrain ? Math.ceil((flight.speed + 24) * dt / 30) : 1)
    const previousHeight = flight.height
    for (let i = 0; i < steps; i++) {
      const distance = stepFlight(flight, input, dt / steps, probe)
      if (distance) {
        const point = trace(flight.position, flight.heading, distance)
        flight.position.latitude = point.latitude
        flight.position.longitude = point.longitude
        flight.heading = point.heading
      }
      flight.position.height = flight.height
    }
    flight.verticalRate = (flight.height - previousHeight) / dt
    place(dt)
    announce()
    if (now - flight.hudTime > 120) {
      flight.hudTime = now
      hud()
    }
  })

  function stop() {
    const wasActive = Boolean(flight)
    clearInputs()
    if (flight) {
      controls.enableInputs = previousInputs
      controls.enableCollisionDetection = previousCollision
      canvas.style.touchAction = previousTouchAction
      canvas.classList.remove('cabina-activa')
    }
    flight = null
    panel.hidden = true
    delete panel.dataset.view
    motionMarker?.setAttribute('hidden', '')
    delete panel.dataset.flightPhase
    start.hidden = false
    start.disabled = false
    if (wasActive) scene.requestRender()
    return wasActive
  }

  function togglePause() {
    if (!flight) return
    flight.paused = !flight.paused
    flight.last = performance.now()
    clearInputs()
    pause.textContent = flight.paused ? 'Reanudar vuelo' : 'Pausar vuelo'
    announce()
    scene.requestRender()
  }

  start.addEventListener('click', () => {
    if (flight) return
    stopFlyover()
    const center = new C.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2)
    const ray = camera.getPickRay(center)
    const hit = ray && globe.pick(ray, scene)
    const position = hit ? ellipsoid.cartesianToCartographic(hit) : C.Cartographic.clone(camera.positionCartographic)
    const ground = globe.getHeight(position)
    if (!Number.isFinite(ground)) {
      status.textContent = 'Espera a que cargue el terreno o elige un destino.'
      return
    }
    previousInputs = controls.enableInputs
    previousCollision = controls.enableCollisionDetection
    previousTouchAction = canvas.style.touchAction
    canvas.style.touchAction = 'none'
    canvas.classList.add('cabina-activa')
    look.yaw = look.pitch = 0
    controls.enableInputs = false
    // The onboard camera uses its own ground guard while piloting.
    controls.enableCollisionDetection = false
    const gap = camera.positionCartographic.height - ground
    position.height = ground + (gap >= 220 && gap <= 900 ? gap : 460)
    flight = { ...newFlight(position.height, ground, camera.heading), position,
      last: performance.now(), hudTime: 0, paused: false, cameraLift: 0, verticalRate: 0 }
    start.hidden = true
    panel.hidden = false
    pause.textContent = 'Pausar vuelo'
    announce()
    hud()
    place()
    exit.focus({ preventScroll: true })
  })

  const finish = () => {
    if (!stop()) return
    status.textContent = 'Vuelo terminado · exploración del mapa'
    start.focus({ preventScroll: true })
  }
  pause.addEventListener('click', togglePause)
  exit.addEventListener('click', finish)
  recenter?.addEventListener('click', centerLook)
  canvas.addEventListener('pointerdown', event => {
    if (!flight || event.button !== 0 || look.pointer !== null) return
    event.preventDefault()
    look.pointer = event.pointerId
    look.x = event.clientX
    look.y = event.clientY
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', event => {
    if (!flight || look.pointer !== event.pointerId) return
    event.preventDefault()
    const sensitivity = event.pointerType === 'touch' ? .006 : .004
    look.yaw = clamp(look.yaw + (event.clientX - look.x) * sensitivity, -Math.PI, Math.PI)
    look.pitch = clamp(look.pitch + (look.y - event.clientY) * sensitivity, -Math.PI / 2, Math.PI / 2)
    look.x = event.clientX
    look.y = event.clientY
    place()
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => { if (look.pointer === event.pointerId) releaseLook() })
  }
  canvas.addEventListener('dblclick', event => {
    if (flight && event.button === 0) { event.preventDefault(); centerLook() }
  })
  window.addEventListener('blur', clearInputs)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return
    if (active()) togglePause()
    else clearInputs()
  })
  window.addEventListener('keydown', event => {
    if (!flight) return
    if (event.code === 'Escape') { event.preventDefault(); finish(); return }
    if (event.code === 'KeyP' && !event.repeat) { event.preventDefault(); togglePause(); return }
    if (event.code === 'KeyC' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      if (!event.repeat) centerLook()
      return
    }
    if (!CONTROL.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return
    event.preventDefault()
    if (active() && !keys.has(event.code)) {
      keys.add(event.code)
      refreshInputs()
    }
  })
  window.addEventListener('keyup', event => {
    if (keys.delete(event.code)) refreshInputs()
  })
  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (!active() || event.button !== 0) return
      event.preventDefault()
      pointers.set(event.pointerId, button)
      button.setPointerCapture(event.pointerId)
      refreshInputs()
    })
    const release = event => {
      if (pointers.get(event.pointerId) === button) {
        pointers.delete(event.pointerId)
        refreshInputs()
      }
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release)
    button.addEventListener('keydown', event => {
      if (event.code !== 'Space' && event.code !== 'Enter') return
      event.preventDefault()
      if (active() && !event.repeat) {
        buttonKeys.set(event.code, button)
        refreshInputs()
      }
    })
    button.addEventListener('keyup', event => {
      if (event.code === 'Space' || event.code === 'Enter') event.preventDefault()
      if (buttonKeys.delete(event.code)) refreshInputs()
    })
    button.addEventListener('blur', () => {
      for (const [code, target] of buttonKeys) if (target === button) buttonKeys.delete(code)
      refreshInputs()
    })
  }
  start.disabled = false
  return stop
}
