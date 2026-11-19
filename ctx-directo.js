import { stylishTiles } from './imagen-marciana.js'

const SERVICE = 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer'

export function ctxDirecto(C, viewer, scheme, below) {
  const { scene, camera } = viewer
  const toggle = document.querySelector('#activar-ctx')
  const status = document.querySelector('#fuente-directa')
  const url = `${SERVICE}/tile/{z}/{y}/{x}`
  const provider = new C.UrlTemplateImageryProvider({
    url, tilingScheme: scheme,
    rectangle: C.Rectangle.fromDegrees(-180, -88, 180, 88),
    tileWidth: 512, tileHeight: 512, maximumLevel: 11,
    credit: 'CTX (color aplicado): NASA/JPL/MSSS/Caltech Murray Lab/Esri',
  })
  stylishTiles(C, provider, url, { look: 'ctx' })
  const layer = new C.ImageryLayer(provider, { show: false, minimumTerrainLevel: 4 })
  const collection = scene.globe.imageryLayers
  collection.add(layer, below ? collection.indexOf(below) : collection.length)
  let remoteReady = false
  let remoteFailed = false
  const request = provider.requestImage.bind(provider)
  provider.requestImage = (...args) => request(...args)?.then(image => {
    if (!remoteReady) { remoteReady = true; scene.requestRender() }
    return image
  })
  provider.errorEvent.addEventListener(() => { remoteFailed = true; scene.requestRender() })
  toggle.disabled = false
  toggle.addEventListener('change', () => { remoteFailed = false; scene.requestRender() })
  return ground => {
    const clearance = camera.positionCartographic.height - (ground ?? 0)
    const low = clearance < (layer.show ? 580000 : 535000)
    layer.show = toggle.checked && low
    const blend = C.Math.clamp((535000 - clearance) / 220000, 0, 1)
    layer.alpha = blend * blend * (3 - 2 * blend)
    const text = !toggle.checked ? 'CTX desactivado · capas locales'
      : !low ? 'CTX disponible al acercarte'
      : remoteReady ? 'CTX · color aplicado a imágenes en gris'
      : remoteFailed ? 'CTX no disponible · capas locales'
      : 'Cargando CTX · mostrando las capas locales'
    if (text !== status.textContent) status.textContent = text
  }
}
