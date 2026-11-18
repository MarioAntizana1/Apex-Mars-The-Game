export function marinerisViews(C, viewer, trial, addImagery, showView) {
  const panel = document.querySelector('#marineris')
  const info = document.querySelector('#marineris-detalle')
  const [lon, lat, ground] = trial.sitio
  const site = C.Cartesian3.fromDegrees(lon, lat, ground, viewer.scene.globe.ellipsoid)
  const layers = trial.imagenes.map(layer => addImagery(layer, 'marineris/', false))
  const views = {
    panorama: [lon, lat, 320_000, -80, 'Panorámica de Ius Chasma'],
    vuelo: [lon, lat, ground + 1400, -58, 'Ius Chasma · vuelo bajo'],
    aproximacion: [lon, lat, ground + 140, -82, 'Ius Chasma · aproximación'],
  }
  let selected = 'panorama'
  const buttons = Array.from(panel.querySelectorAll('button[data-vista]'))
  viewer.scene.preRender.addEventListener(() => {
    const distance = C.Cartesian3.distance(viewer.camera.positionWC, site)
    const aboveSite = viewer.camera.positionCartographic.height - ground
    const [flight, approach] = layers
    flight.show = distance < (flight.show ? 14000 : 12000) && aboveSite < (flight.show ? 5000 : 4200)
    approach.show = selected === 'aproximacion' && distance < (approach.show ? 1100 : 850)
    const text = approach.show
      ? 'Aproximación: ortofoto HiRISE de 25 cm/píxel, malla de ≈1,3 m.'
      : flight.show ? 'Vuelo: imagen HiRISE limitada a 10 m/píxel.' : 'Vista lejana: sin descargar imágenes HiRISE.'
    if (info.textContent !== text) info.textContent = text
  })
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.vista === selected))
    button.onclick = () => {
      selected = button.dataset.vista
      for (const option of buttons) option.setAttribute('aria-pressed', String(option === button))
      showView(views[selected], selected === 'aproximacion' ? 2.5 : 3)
    }
  }
  panel.hidden = false
  return { initialView: views.panorama, fineTerrain: () => layers[1].show }
}
