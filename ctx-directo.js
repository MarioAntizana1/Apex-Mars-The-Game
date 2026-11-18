const SERVICE = 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer'

export function ctxDirecto(C, viewer, scheme, below) {
  const { scene, camera } = viewer
  const toggle = document.querySelector('#activar-ctx')
  const status = document.querySelector('#fuente-directa')
  const provider = new C.UrlTemplateImageryProvider({
    url: `${SERVICE}/tile/{z}/{y}/{x}`,
    tilingScheme: scheme,
    rectangle: C.Rectangle.fromDegrees(-180, -88, 180, 88),
    tileWidth: 512,
    tileHeight: 512,
    maximumLevel: 11,
    credit: 'CTX: NASA/JPL/MSSS/Caltech Murray Lab/Esri',
  })
  const layer = new C.ImageryLayer(provider, { show: false, minimumTerrainLevel: 5 })
  const collection = scene.globe.imageryLayers
  collection.add(layer, below ? collection.indexOf(below) : collection.length)
  let remoteReady = false
  let remoteFailed = false
  const request = provider.requestImage.bind(provider)
  provider.requestImage = (...args) => request(...args)?.then(image => {
    remoteReady = true
    scene.requestRender()
    return image
  })
  provider.errorEvent.addEventListener(() => { remoteFailed = true; scene.requestRender() })
  toggle.disabled = false
  toggle.addEventListener('change', () => {
    remoteFailed = false
    scene.requestRender()
  })
  return (ground) => {
    const cameraHeight = camera.positionCartographic.height
    const clearance = cameraHeight - (ground ?? 0)
    const low = ground !== undefined && clearance < (layer.show ? 32000 : 26000)
    layer.show = toggle.checked && low
    const text = !toggle.checked ? 'CTX directo desactivado · capas locales'
      : !low ? 'CTX directo listo · entra en vuelo bajo para cargar imágenes'
      : remoteReady ? 'CTX en directo · imágenes de hasta ≈10 m/píxel'
      : remoteFailed ? 'CTX no disponible en esta vista · capas locales'
      : 'Conectando con CTX · mostrando la capa base'
    if (text !== status.textContent) status.textContent = text
  }
}
