// Circuito sobre Ius Chasma, en el relieve MOLA que ya carga el globo.
const VUELTA = 145 // segundos; no depende del reloj de simulación de Cesium
const DESPEJE = 240 // metros sobre la malla visible
const RAD = Math.PI / 180

export function iniciarVueloCreditos(C, viewer, ellipsoid, opciones = {}) {
  const { camera, scene } = viewer
  const fijo = opciones === true || opciones.reducido === true
  let fase = Math.PI / 2 // cresta oriental: una buena panorámica incluso sin movimiento
  let anterior, altura, frame
  let activo = true
  const punto = new C.Cartographic()
  const destino = new C.Cartesian3()

  function situar(dt) {
    const seno = Math.sin(fase), coseno = Math.cos(fase)
    const lon = -83.12 + 0.45 * seno
    const lat = -7.42 + 0.18 * coseno - 0.10 * seno
    punto.longitude = lon * RAD
    punto.latitude = lat * RAD
    const terreno = scene.globe.getHeight(punto)
    // Si aún no hay una tesela, la cresta más alta del recorrido MOLA está a ~200 m.
    const objetivo = (Number.isFinite(terreno) ? terreno : 500) + DESPEJE
    // Subir sin demora ante una pared; amortiguar descensos y cambios de nivel de detalle.
    altura = altura === undefined || objetivo >= altura ? objetivo : Math.max(objetivo, altura - dt * 700)
    const este = 0.45 * coseno * Math.cos(punto.latitude)
    const norte = -0.18 * seno - 0.10 * coseno
    camera.setView({
      destination: C.Cartesian3.fromDegrees(lon, lat, altura, ellipsoid, destino),
      orientation: { heading: Math.atan2(este, norte), pitch: -13 * RAD, roll: 0 },
    })
    scene.requestRender()
  }

  function avanzar(ahora) {
    if (!activo) return
    const dt = anterior === undefined ? 0 : Math.min(0.1, (ahora - anterior) / 1000)
    anterior = ahora
    fase = (fase + dt * 2 * Math.PI / VUELTA) % (2 * Math.PI)
    situar(dt)
    frame = requestAnimationFrame(avanzar)
  }

  camera.cancelFlight()
  situar(0)
  if (!fijo) frame = requestAnimationFrame(avanzar)
  return () => {
    activo = false
    if (frame !== undefined) cancelAnimationFrame(frame)
  }
}
