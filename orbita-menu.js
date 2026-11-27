// La fase usa tiempo real, no el reloj de simulación ni el número de cuadros.
const VUELTA_MS = 20_000

export function crearOrbitaMenu(C, viewer, ellipsoid) {
  const { camera, scene } = viewer
  const { globe } = scene
  let restaurar = null
  let frame = 0

  function detener() {
    if (!restaurar) return
    cancelAnimationFrame(frame)
    restaurar()
    restaurar = null
    scene.requestRender()
  }

  function iniciar(reducido = false) {
    detener()
    camera.cancelFlight()
    const anterior = { luz: scene.light, sol: scene.sun, visible: scene.sun?.show,
      iluminado: globe.enableLighting, atmosfera: globe.dynamicAtmosphereLighting,
      solar: globe.dynamicAtmosphereLightingFromSun }
    if (!scene.sun) scene.sun = new C.Sun()
    scene.sun.show = true
    scene.light = new C.SunLight()
    globe.enableLighting = true
    globe.dynamicAtmosphereLighting = true
    globe.dynamicAtmosphereLightingFromSun = true
    restaurar = () => {
      if (anterior.sol) anterior.sol.show = anterior.visible
      else scene.sun = undefined
      scene.light = anterior.luz
      globe.enableLighting = anterior.iluminado
      globe.dynamicAtmosphereLighting = anterior.atmosfera
      globe.dynamicAtmosphereLightingFromSun = anterior.solar
    }

    // Mismo astro y transformación que el disco solar y la SunLight de Cesium.
    // Se empieza junto al limbo; en la cara diurna el Sol queda tras la cámara.
    const t = viewer.clock.currentTime
    const matriz = C.Transforms.computeIcrfToCentralBodyFixedMatrix(t) ?? C.Transforms.computeTemeToPseudoFixedMatrix(t)
    const sol = C.Matrix3.multiplyByVector(matriz, C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(t), new C.Cartesian3())
    const lat = -Math.atan2(sol.z, Math.hypot(sol.x, sol.y))
    const lon = Math.atan2(-sol.y, -sol.x)
    const comienzo = performance.now()
    const destino = new C.Cartesian3()
    const orientation = { heading: 0, pitch: -Math.PI / 2, roll: 0 }
    function situar(ahora) {
      const vertical = camera.frustum.fovy / 2
      const horizontal = Math.atan(Math.tan(vertical) * camera.frustum.aspectRatio)
      const apertura = Math.min(vertical, horizontal)
      const radio = ellipsoid.maximumRadius
      const altura = radio / Math.sin(apertura * .68) - radio
      const margenSolar = apertura * .86 / Math.cos(lat)
      const fase = ((ahora - comienzo) % VUELTA_MS) * 2 * Math.PI / VUELTA_MS
      C.Cartesian3.fromRadians(lon + margenSolar + fase, lat, altura, ellipsoid, destino)
      camera.setView({ destination: destino, orientation })
      scene.requestRender()
      if (!reducido) frame = requestAnimationFrame(situar)
    }
    situar(comienzo)
  }
  return { iniciar, detener }
}
