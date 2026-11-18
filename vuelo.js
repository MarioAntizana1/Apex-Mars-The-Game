const CONTROL = new Map([
  ['KeyW', 'up'], ['ArrowUp', 'up'], ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyR', 'fast'], ['KeyF', 'slow'],
])

// shortcut: flight is arcade movement with clearance over the rendered DEM; landing needs a separate collision model.
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
  const keys = new Set()
  const origin = new C.Cartesian3()
  const destination = new C.Cartesian3()
  const direction = new C.Cartesian3()
  const forward = new C.Cartesian3()
  const up = new C.Cartesian3()
  const right = new C.Cartesian3()
  const frame = new C.Matrix4()
  const local = new C.Cartesian3()
  const attitude = new C.HeadingPitchRoll()
  const sample = new C.Cartographic()
  const clearanceMin = 180
  let model, loading, flight, previousInputs

  const clamp = C.Math.clamp
  const rad = C.Math.toRadians
  const deg = C.Math.toDegrees
  const pressed = name => [...keys].some(key => CONTROL.get(key) === name)

  function hud(ground) {
    speedLabel.textContent = `${Math.round(flight.speed * 3.6)} km/h`
    headingLabel.textContent = `${Math.round(deg(flight.heading)) % 360}°`
    heightLabel.textContent = `≈ ${Math.round(flight.position.height - ground)} m sobre el terreno`
    positionLabel.textContent = `${deg(flight.position.latitude).toFixed(5)}°, ${deg(flight.position.longitude).toFixed(5)}°`
  }

  function place() {
    const { position, heading, pitch, bank } = flight
    ellipsoid.cartographicToCartesian(position, origin)
    C.Transforms.eastNorthUpToFixedFrame(origin, ellipsoid, frame)
    // Cesium's model X is forward; ENU heading is measured clockwise from east here.
    attitude.heading = heading - C.Math.PI_OVER_TWO
    attitude.pitch = pitch
    attitude.roll = bank
    C.Transforms.headingPitchRollToFixedFrame(origin, attitude, ellipsoid, undefined, model.modelMatrix)

    local.x = -Math.sin(heading) * 84
    local.y = -Math.cos(heading) * 84
    local.z = 32
    C.Matrix4.multiplyByPoint(frame, local, destination)
    const cameraGround = globe.getHeight(ellipsoid.cartesianToCartographic(destination, sample))
    if (cameraGround !== undefined && sample.height < cameraGround + 22) {
      sample.height = cameraGround + 22
      ellipsoid.cartographicToCartesian(sample, destination)
    }
    C.Cartesian3.subtract(origin, destination, direction)
    ellipsoid.geodeticSurfaceNormal(origin, up)
    C.Cartesian3.multiplyByScalar(up, 6, right)
    C.Cartesian3.add(direction, right, direction)
    C.Cartesian3.normalize(direction, direction)
    C.Cartesian3.normalize(C.Cartesian3.cross(direction, up, right), right)
    C.Cartesian3.normalize(C.Cartesian3.cross(right, direction, forward), up)
    camera.setView({ destination, orientation: { direction, up } })
    scene.requestRender()
  }

  function lead(position, heading, distance) {
    const step = distance / ellipsoid.maximumRadius
    const sinLat = Math.sin(position.latitude), cosLat = Math.cos(position.latitude)
    const sinStep = Math.sin(step), cosStep = Math.cos(step)
    const lat = Math.asin(clamp(sinLat * cosStep + cosLat * sinStep * Math.cos(heading), -1, 1))
    const lon = C.Math.negativePiToPi(position.longitude + Math.atan2(
      Math.sin(heading) * sinStep * cosLat, cosStep - sinLat * Math.sin(lat),
    ))
    return C.Cartographic.fromRadians(lon, lat, position.height)
  }

  scene.preUpdate.addEventListener(() => {
    if (!flight || flight.paused) return
    const now = performance.now()
    const dt = Math.min(.09, (now - flight.last) / 1000)
    flight.last = now
    const turn = Number(pressed('right')) - Number(pressed('left'))
    const climb = Number(pressed('up')) - Number(pressed('down'))
    const thrust = Number(pressed('fast')) - Number(pressed('slow'))
    flight.heading = C.Math.zeroToTwoPi(flight.heading + turn * rad(53) * dt)
    flight.pitch += (climb * rad(27) - flight.pitch) * Math.min(1, 4 * dt)
    flight.bank += (turn * rad(25) - flight.bank) * Math.min(1, 4 * dt)
    flight.speed = clamp(flight.speed + thrust * 66 * dt, 38, 280)
    const next = lead(flight.position, flight.heading, flight.speed * Math.cos(flight.pitch) * dt)
    const ground = globe.getHeight(next)
    if (ground !== undefined) {
      flight.ground = ground
      const desired = flight.position.height + Math.sin(flight.pitch) * flight.speed * dt
      const floor = Math.max(ground + clearanceMin, flight.floor - 35 * dt)
      next.height = clamp(desired, floor, ground + 12000)
      flight.floor = floor
      flight.position = next
    }
    place()
    if (now - flight.hudTime > 120) {
      flight.hudTime = now
      hud(flight.ground)
    }
  })

  function stop() {
    const wasActive = Boolean(flight || loading)
    loading = null
    keys.clear()
    if (flight) controls.enableInputs = previousInputs
    flight = null
    if (model) model.show = false
    panel.hidden = true
    start.hidden = false
    start.disabled = false
    if (wasActive) scene.requestRender()
    return wasActive
  }

  function togglePause() {
    if (!flight) return
    flight.paused = !flight.paused
    flight.last = performance.now()
    keys.clear()
    pause.textContent = flight.paused ? 'Reanudar vuelo' : 'Pausar vuelo'
    status.textContent = flight.paused ? 'Vuelo en pausa' : 'Vuelo libre · cohete'
    scene.requestRender()
  }

  start.addEventListener('click', async () => {
    if (flight || loading) return
    stopFlyover()
    const center = new C.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2)
    const hit = globe.pick(camera.getPickRay(center), scene)
    const position = hit ? ellipsoid.cartesianToCartographic(hit) : C.Cartographic.clone(camera.positionCartographic)
    const ground = globe.getHeight(position)
    if (!Number.isFinite(ground)) {
      status.textContent = 'Espera a que cargue el terreno o elige un destino.'
      return
    }
    const ticket = loading = Symbol()
    start.disabled = true
    status.textContent = 'Preparando el cohete…'
    try {
      if (!model) {
        const rocket = await C.Model.fromGltfAsync({ url: './modelos/cohete.glb', show: false, cull: false })
        if (loading !== ticket) { rocket.destroy(); return }
        model = scene.primitives.add(rocket)
      }
    } catch {
      if (loading === ticket) {
        stop()
        status.textContent = 'No se pudo cargar el cohete. Intenta de nuevo.'
      }
      return
    }
    if (loading !== ticket) return
    loading = null
    previousInputs = controls.enableInputs
    controls.enableInputs = false
    const gap = camera.positionCartographic.height - ground
    position.height = ground + (gap >= 400 && gap <= 2800 ? gap : 1550)
    flight = { position, ground, floor: ground + clearanceMin, heading: camera.heading, pitch: 0,
      bank: 0, speed: 112, last: performance.now(), hudTime: 0, paused: false }
    model.show = true
    start.hidden = true
    panel.hidden = false
    pause.textContent = 'Pausar vuelo'
    status.textContent = 'Vuelo libre · cohete'
    hud(ground)
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
  window.addEventListener('blur', () => keys.clear())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && flight && !flight.paused) togglePause()
  })
  window.addEventListener('keydown', event => {
    if (!flight && !loading) return
    if (event.code === 'Escape') { event.preventDefault(); finish(); return }
    if (event.code === 'KeyP' && !event.repeat) { event.preventDefault(); togglePause(); return }
    if (!CONTROL.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return
    event.preventDefault()
    if (flight && !flight.paused) keys.add(event.code)
  })
  window.addEventListener('keyup', event => keys.delete(event.code))
  start.disabled = false
  return stop
}
