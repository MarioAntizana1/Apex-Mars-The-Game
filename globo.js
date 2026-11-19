import { preloadBase } from './base-global.js?v=olimpo'
import { marinerisViews } from './marineris.js?v=color'
import { ctxDirecto } from './ctx-directo.js?v=color'
import { crearVuelo } from './vuelo.js?v=cabina'
import { atmosferaMarciana, stylishTiles } from './imagen-marciana.js'

const C = window.Cesium
const status = document.querySelector('#estado')
const altitude = document.querySelector('#altura')

async function load(path) {
  const response = await fetch(`./datos/${path}`)
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`)
  return response
}

async function start() {
  const params = new URLSearchParams(location.search)
  const trial = params.get('marineris') === '1' ? await (await load('bloques/marineris/indice.json')).json() : null
  const { relieve, imagenes, destinos } = await (await load('bloques/indice.json?v=caldera')).json()
  const ellipsoid = new C.Ellipsoid(3396190, 3396190, 3396190)
  C.Ellipsoid.default = ellipsoid
  const scheme = new C.GeographicTilingScheme({ ellipsoid })
  const size = relieve.tamano
  const globalDetailLevel = 7
  const region = (zone, path) => ({ path, level: zone.nivel, rect: C.Rectangle.fromDegrees(...zone.bbox) })
  const regions = relieve.zonas.map(zone => region(zone, 'relieve'))
  const marineris = (trial?.relieve ?? []).map(zone => region(zone, 'marineris/relieve'))
  function regional(x, y, level) {
    const tile = scheme.tileXYToRectangle(x, y, level)
    const overlaps = ({ level: max, rect }) => level <= max &&
      tile.west < rect.east && tile.east > rect.west && tile.south < rect.north && tile.north > rect.south
    return (level >= 8 && marineris.find(overlaps)) || regions.find(overlaps)
  }
  const available = (x, y, level) => level <= globalDetailLevel || Boolean(regional(x, y, level))
  const packs = new Map()
  function globalBlock(x, y, level) {
    const side = 1 << (level - 4)
    const key = `${Math.floor(x / side)}/${Math.floor(y / side)}`
    let pack = packs.get(key)
    if (!pack) {
      const resource = new C.Resource({
        url: `./datos/bloques/mola-global-v1/${key}.bin`,
        request: new C.Request({ throttle: true, throttleByServer: true, type: C.RequestType.TERRAIN }),
      })
      const download = resource.fetchArrayBuffer()
      if (!download) return undefined
      pack = download.then(buffer => {
        if (buffer.byteLength !== (16 + 64) * size * size * 2) throw new Error('Paquete MOLA incompleto')
        return buffer
      }).catch(error => {
        packs.delete(key)
        throw error
      })
    }
    packs.delete(key)
    packs.set(key, pack)
    if (packs.size > 16) packs.delete(packs.keys().next().value)
    const stride = size * size * 2
    const index = (level === 7 ? 16 : 0) + (y % side) * side + x % side
    return pack.then(buffer => new DataView(buffer, index * stride, stride))
  }
  const provider = new C.CustomHeightmapTerrainProvider({
    tilingScheme: scheme, width: size, height: size, callback: () => undefined,
  })
  provider.getTileDataAvailable = available
  let cachedHeight
  provider.requestTileGeometry = (x, y, level, request) => {
    function decode(view) {
      if (view.byteLength !== 2 * size * size) throw new Error('Bloque de relieve inválido')
      const heights = new Int16Array(size * size)
      for (let i = 0; i < heights.length; i++) heights[i] = view.getInt16(i * 2, true)
      let childTileMask = 0
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (available(2 * x + dx, 2 * y + dy, level + 1)) childTileMask |= 1 << (2 * (1 - dy) + dx)
        }
      }
      return new C.HeightmapTerrainData({ buffer: heights, width: size, height: size, childTileMask })
    }
    const local = cachedHeight?.(x, y, level)
    if (local) return Promise.resolve(decode(local))
    if (level > relieve.global && level <= globalDetailLevel && !regional(x, y, level)) {
      return globalBlock(x, y, level)?.then(decode)
    }
    const folder = regional(x, y, level)?.path ?? 'relieve'
    const resource = new C.Resource({ url: `./datos/bloques/${folder}/${level}/${x}/${y}.bin`, request })
    return resource.fetchArrayBuffer()?.then(buffer => decode(new DataView(buffer)))
  }
  const globe = new C.Globe(ellipsoid)
  globe.depthTestAgainstTerrain = true
  globe.tileCacheSize = 160
  globe.preloadAncestors = true
  globe.preloadSiblings = true
  globe.loadingDescendantLimit = 6
  globe.baseColor = C.Color.fromCssColorString('#a7755b')
  const viewer = new C.CesiumWidget('mapa', {
    ellipsoid, globe, terrainProvider: provider, baseLayer: false, skyBox: false,
    skyAtmosphere: false, shadows: false, requestRenderMode: true,
  })
  viewer.scene.backgroundColor = C.Color.fromCssColorString('#100c0b')
  const starFace = face => `${window.CESIUM_BASE_URL}Assets/Textures/SkyBox/tycho2t3_80_${face}.jpg`
  const stars = viewer.scene.skyBox = new C.SkyBox({ show: false, sources: {
    positiveX: starFace('px'), negativeX: starFace('mx'),
    positiveY: starFace('py'), negativeY: starFace('my'),
    positiveZ: starFace('pz'), negativeZ: starFace('mz'),
  } })
  viewer.scene.preRender.addEventListener(() => {
    stars.show = viewer.camera.positionCartographic.height > 65000
  })
  atmosferaMarciana(C, viewer.scene, globe)
  const controls = viewer.scene.screenSpaceCameraController
  controls.minimumZoomDistance = 120
  controls.maximumZoomDistance = 16000000
  const readout = document.querySelector('#altitud-camara')
  const meters = new Intl.NumberFormat('es', { maximumFractionDigits: 0 })
  viewer.scene.postRender.addEventListener(() => {
    const position = viewer.camera.positionCartographic
    const ground = globe.getHeight(position)
    const height = ground === undefined ? 'Calculando altura sobre el terreno…'
      : `≈ ${meters.format(position.height - ground)} m sobre el terreno`
    const text = `${height} · ${meters.format(position.height)} m respecto a la referencia`
    if (text !== readout.textContent) readout.textContent = text
  })
  function addImagery({ id, bbox, nivel, columnas, filas = 1 }, prefix = '', show = true) {
    const rectangle = C.Rectangle.fromDegrees(...bbox)
    const url = `./datos/bloques/${prefix}imagen/${id}/{z}/{x}/{y}.webp`
    const imagery = new C.UrlTemplateImageryProvider({
      url, rectangle, maximumLevel: nivel,
      tilingScheme: new C.GeographicTilingScheme({
        ellipsoid, rectangle, numberOfLevelZeroTilesX: columnas, numberOfLevelZeroTilesY: filas,
      }),
    })
    if (prefix === 'marineris/') stylishTiles(C, imagery, url, {
      look: 'hirise', feather: id === 'vuelo' ? .13 : .045, transparentBlack: id === 'vuelo',
    })
    else if (id === 'olimpo') stylishTiles(C, imagery, url, { feather: .22 })
    else if (id === 'jezero' || id === 'alrededores') stylishTiles(C, imagery, url, {
      look: 'ctx', feather: .12, transparentBlack: true,
    })
    const layer = new C.ImageryLayer(imagery, { show })
    globe.imageryLayers.add(layer)
    return layer
  }
  imagenes.forEach(layer => addImagery(layer))
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const views = {
    global: [73, 16, 8400000, -90, 'Marte global · relieve MOLA'],
    jezero: [77.46, 18.35, 16500, -68, 'Jezero · relieve CTX'],
    borde: [77.96, 18.35, 16500, -68, 'Alrededores de Jezero · relieve MOLA'],
  }
  const flyButton = document.querySelector('#sobrevuelo')
  let flyover = false
  function stopFlyover() {
    flyover = false
    flyButton.textContent = 'Sobrevolar Jezero'
    altitude.hidden = true
    viewer.camera.cancelFlight()
  }
  const stopPilot = crearVuelo(C, viewer, status, stopFlyover)
  viewer.scene.postRender.addEventListener(() => {
    if (!flyover) return
    const position = viewer.camera.positionCartographic
    const ground = globe.getHeight(position)
    altitude.hidden = ground === undefined
    if (ground !== undefined) {
      const gap = Math.round((position.height - ground) / 100) * 100
      const text = `Altura aprox. ${gap.toLocaleString('es-ES')} m sobre el terreno`
      if (altitude.textContent !== text) altitude.textContent = text
    }
  })
  flyButton.onclick = () => {
    stopPilot()
    if (flyover) {
      stopFlyover()
      status.textContent = 'Sobrevuelo detenido'
      return
    }
    viewer.camera.cancelFlight()
    if (reduced.matches) {
      go('jezero', 0)
      return
    }
    flyover = true
    flyButton.textContent = 'Detener sobrevuelo'
    status.textContent = 'Aproximación a Jezero…'
    function leg(lon, lat, height, duration, complete) {
      viewer.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(lon, lat, height, ellipsoid),
        orientation: { heading: C.Math.PI_OVER_TWO, pitch: C.Math.toRadians(-22), roll: 0 },
        maximumHeight: Math.max(height, viewer.camera.positionCartographic.height),
        duration, complete,
      })
    }
    leg(77.22, 18.44, 4500, 4, () => {
      status.textContent = 'Sobrevuelo en curso'
      leg(77.91, 18.44, 3500, 8, () => {
        stopFlyover()
        status.textContent = 'Sobrevuelo completo · alrededores de Jezero'
      })
    })
  }
  function go(view, duration) {
    showView(views[view], duration, view === 'borde')
  }
  function showView([lon, lat, height, pitch, label], duration, crossBoundary = false) {
    stopPilot()
    stopFlyover()
    status.textContent = 'Moviendo cámara…'
    const options = {
      destination: C.Cartesian3.fromDegrees(lon, lat, height, ellipsoid),
      orientation: { heading: 0, pitch: C.Math.toRadians(pitch), roll: 0 },
    }
    const finish = () => { status.textContent = label }
    if (duration === 0 || reduced.matches) {
      viewer.camera.setView(options)
      finish()
    } else {
      viewer.camera.flyTo({ ...options, duration, complete: finish,
        ...(crossBoundary && viewer.camera.positionCartographic.height < 60000 ? { maximumHeight: height } : {}),
      })
    }
  }
  for (const view of Object.keys(views)) {
    document.getElementById(view).onclick = () => go(view, view === 'global' ? 2.8 : view === 'jezero' ? 4.2 : 2.6)
  }
  const pins = viewer.scene.primitives.add(new C.PointPrimitiveCollection())
  const distance = new C.DistanceDisplayCondition(90000, 16000000)
  for (const { id, nombre, lon, lat } of destinos) {
    if (id !== 'jezero') views[id] = id === 'olimpo'
      ? [-133.2, 18.31, 175000, -90, 'Monte Olimpo · caldera']
      : [lon, lat, 420000, -80, nombre]
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = nombre
    button.onclick = () => go(id, 3.1)
    document.querySelector('#destinos').append(button)
    pins.add({
      id, position: C.Cartesian3.fromDegrees(lon, lat, 25000, ellipsoid),
      pixelSize: 9, color: C.Color.fromCssColorString('#ffd19c'),
      outlineColor: C.Color.fromCssColorString('#392318'), outlineWidth: 2,
      distanceDisplayCondition: distance,
    })
  }
  viewer.screenSpaceEventHandler.setInputAction(({ position }) => {
    if (!document.querySelector('#vuelo-panel').hidden) return
    const picked = viewer.scene.pick(position)
    if (picked?.collection === pins || picked?.primitive instanceof C.PointPrimitive) go(picked.id, 3.1)
  }, C.ScreenSpaceEventType.LEFT_CLICK)
  go('global', 0)
  let firstLocalDetail
  if (trial) {
    const experiment = marinerisViews(C, viewer, trial, addImagery, showView)
    firstLocalDetail = experiment.firstLayer
    const geometricError = provider.getLevelMaximumGeometricError.bind(provider)
    // Above level 15 the samples are the landing patch, not normal flight terrain.
    provider.getLevelMaximumGeometricError = level => level >= 15 && !experiment.fineTerrain()
      ? 1e-6 : geometricError(level)
    showView(experiment.initialView, 0)
  }
  const updateCtx = ctxDirecto(C, viewer, scheme, firstLocalDetail)
  viewer.scene.preRender.addEventListener(() => updateCtx(globe.getHeight(viewer.camera.positionCartographic)))
  if (['lon', 'lat', 'altura'].every(key => params.has(key) && params.get(key).trim())) {
    const [lon, lat, height] = ['lon', 'lat', 'altura'].map(key => Number(params.get(key)))
    if (Math.abs(lon) <= 180 && Math.abs(lat) <= 90 && height >= 3000 && height <= 16_000_000) {
      views.coords = [lon, lat, height, -80, 'Vista de coordenadas']
      go('coords', 0)
    }
  }
  flyButton.disabled = false
  const preloading = document.querySelector('#precarga')
  const detail = document.querySelector('#detalle')
  detail.textContent = 'Detalle dinámico activo'
  globe.tileLoadProgressEvent.addEventListener(remaining => {
    detail.textContent = remaining ? 'Detalle dinámico activo · cargando bloques de la vista' : 'Detalle dinámico activo'
  })
  // Start after the lightweight global view has rendered; navigation is never blocked.
  const stopWaiting = globe.tileLoadProgressEvent.addEventListener(remaining => {
    if (remaining !== 0) return
    stopWaiting()
    preloading.textContent = 'Descargando base global…'
    preloadBase(C, size, relieve.global, scheme, (read, imagery) => {
      cachedHeight = read
      globe.imageryLayers.addImageryProvider(imagery, 1)
      viewer.scene.requestRender()
    }).then(() => {
      preloading.textContent = 'Base global lista'
    }).catch(() => {
      preloading.textContent = 'Base global no disponible · descarga por bloques activa'
    })
  })
}

start().catch(error => {
  status.textContent = `El visor no pudo iniciar: ${error.message}`
  console.error(error)
})
