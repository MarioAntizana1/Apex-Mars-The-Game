import { aboveGround, flightPhase, newFlight, stepFlight } from './flight-dynamics.js?v=crucero'

const CONTROL = new Map([
  ['KeyW', 'up'], ['ArrowUp', 'up'], ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyR', 'fast'], ['KeyF', 'slow'], ['KeyB', 'brake'],
])
const PHASE = {
  air: 'Vuelo libre · cohete',
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
  let flight, previousInputs, previousCollision

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
  function clearInputs() {
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
    heightLabel.textContent = flight.waiting ? 'Terreno sin confirmar' : `≈ ${Math.round(aboveGround(flight))} m sobre el terreno`
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
    const ground = globe.getHeight(sample)
    const safetyLift = Math.max(0, (Number.isFinite(ground) ? ground : flight.rawGround) + 2 - sample.height)
    // Lower slowly when the underlying tile changes or the camera crosses a
    // ridge; only the safety clamp can move it upward faster.
    flight.cameraLift = Math.max(flight.cameraLift - 30 * (dt ?? 0), safetyLift)
    if (flight.cameraLift > 0) {
      sample.height += flight.cameraLift
      ellipsoid.cartographicToCartesian(sample, destination)
    }
    const rad = C.Math.toRadians
    camera.setView({ destination, orientation: {
      heading,
      pitch: clamp(pitch * .55 - rad(8), rad(-30), rad(12)),
      roll: bank * .6,
    } })
    scene.requestRender()
  }

  function lead(position, heading, distance, result) {
    const step = distance / ellipsoid.maximumRadius
    const sinLat = Math.sin(position.latitude), cosLat = Math.cos(position.latitude)
    const sinStep = Math.sin(step), cosStep = Math.cos(step)
    const lat = Math.asin(clamp(sinLat * cosStep + cosLat * sinStep * Math.cos(heading), -1, 1))
    const lon = C.Math.negativePiToPi(position.longitude + Math.atan2(
      Math.sin(heading) * sinStep * cosLat, cosStep - sinLat * Math.sin(lat),
    ))
    return C.Cartographic.fromRadians(lon, lat, position.height, result)
  }
  function probe(distance, heading) {
    const position = flight.position
    return globe.getHeight(distance ? lead(position, heading, distance, probePoint) : position)
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
    const steps = Math.max(Math.ceil(dt / .03), Math.ceil((flight.speed + 24) * dt / 30))
    for (let i = 0; i < steps; i++) {
      const distance = stepFlight(flight, input, dt / steps, probe)
      if (distance) lead(flight.position, flight.heading, distance, flight.position)
      flight.position.height = flight.height
    }
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
    }
    flight = null
    panel.hidden = true
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
    controls.enableInputs = false
    // The onboard camera uses its own ground guard while piloting.
    controls.enableCollisionDetection = false
    const gap = camera.positionCartographic.height - ground
    position.height = ground + (gap >= 220 && gap <= 900 ? gap : 460)
    flight = { ...newFlight(position.height, ground, camera.heading), position,
      last: performance.now(), hudTime: 0, paused: false, cameraLift: 0 }
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
