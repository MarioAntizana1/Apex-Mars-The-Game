const SITIO = { lon: -33.221, lat: 19.137 }
const objetos = {
  sojourner: { offset: [6, 2, 0], range: 2.4, eye: 1.1, target: .19, name: 'Sojourner · el rover de 1997' },
  pathfinder: { offset: [0, 0, 0], range: 5.1, eye: 2.6, target: .45, name: 'Mars Pathfinder · estación Sagan' },
}

export function crearHistoria(C, viewer, detenerOtros) {
  const $ = id => document.getElementById(id)
  const { scene, camera } = viewer
  const ellipsoid = scene.globe.ellipsoid
  const controls = scene.screenSpaceCameraController
  const panel = $('historia'), menu = $('panel'), map = $('mapa')
  const title = $('historia-titulo'), status = $('historia-estado')
  const start = $('abrir-historia'), visit = $('abrir-pathfinder'), salir = $('historia-salir')
  const skip = $('historia-saltar'), visitNav = $('historia-visita')
  const sites = [...visitNav.querySelectorAll('[data-sitio]')]
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const V = C.Cartesian3
  let active, cameraState, focusReturn, frame = 0, campaign, meshes, visitFrame
  let selected = 'sojourner', azimuth = .7

  function open(mode, origin) {
    if (active) close()
    detenerOtros()
    focusReturn = origin
    cameraState = {
      destination: V.clone(camera.positionWC),
      orientation: { direction: V.clone(camera.directionWC), up: V.clone(camera.upWC) },
      loop: viewer.useDefaultRenderLoop,
      inputs: controls.enableInputs,
      collision: controls.enableCollisionDetection,
    }
    active = Symbol(mode)
    meshes = scene.primitives.add(new C.PrimitiveCollection())
    controls.enableInputs = false
    // Cinematic poses handle their own clearance; the globe's 120 m navigation guard would lift these close-ups.
    controls.enableCollisionDetection = false
    menu.inert = true
    menu.hidden = true
    map.inert = true
    panel.hidden = false
    panel.dataset.shot = 'loading'
    $('eva').hidden = true
    visitNav.hidden = true
    skip.hidden = mode !== 'caida'
    title.textContent = mode === 'caida' ? 'APEX / MARS · LA CAÍDA' : 'ARES VALLIS · ESTACIÓN SAGAN'
    status.textContent = 'Cargando Ares Vallis…'
    salir.focus()
    return active
  }

  function close() {
    if (!active) return
    active = null
    cancelAnimationFrame(frame)
    campaign?.dispose()
    campaign = null
    viewer.useDefaultRenderLoop = cameraState.loop
    viewer.resize()
    scene.primitives.remove(meshes)
    meshes = visitFrame = null
    controls.enableInputs = cameraState.inputs
    controls.enableCollisionDetection = cameraState.collision
    camera.setView(cameraState)
    map.inert = false
    menu.inert = false
    menu.hidden = false
    panel.hidden = true
    focusReturn.focus()
    scene.requestRender()
  }

  async function localFrame({ lon, lat }) {
    const coord = C.Cartographic.fromDegrees(lon, lat)
    await C.sampleTerrain(viewer.terrainProvider, 7, [coord], true)
    if (!Number.isFinite(coord.height)) throw new Error('No se encontró relieve para Ares Vallis')
    // Use the sampled global tile, not a height taken before its refinement.
    const position = ellipsoid.cartographicToCartesian(coord)
    return C.Transforms.eastNorthUpToFixedFrame(position, ellipsoid)
  }

  async function model(token, url, collection = meshes) {
    // Ares Vallis is below the reference sphere; do not horizon-cull these few nearby props.
    const asset = await C.Model.fromGltfAsync({ url, cull: false })
    if (token !== active) { asset.destroy(); return null }
    asset.show = false
    return collection.add(asset)
  }

  const world = (localFrame, x, y, z) => C.Matrix4.multiplyByPoint(localFrame, new V(x, y, z), new V())
  function look(eye, target) {
    const direction = V.normalize(V.subtract(target, eye, new V()), new V())
    const vertical = ellipsoid.geodeticSurfaceNormal(eye, new V())
    const right = V.normalize(V.cross(direction, vertical, new V()), new V())
    const up = V.normalize(V.cross(right, direction, new V()), new V())
    camera.setView({ destination: eye, orientation: { direction, up } })
    scene.requestRender()
  }

  function ajusteTerreno(base) {
    const coords = ellipsoid.cartesianToCartographic(world(base, 0, 0, 0))
    const height = scene.globe.getHeight(coords)
    return Number.isFinite(height) ? height - coords.height : 0
  }

  function parcheLocal(base) {
    // The global DEM has no sub-metre surface. Use a local display patch for
    // the historical close-ups so changing terrain LOD cannot bury the props.
    const image = document.createElement('canvas')
    image.width = image.height = 512
    const g = image.getContext('2d')
    g.fillStyle = '#aa7454'
    g.fillRect(0, 0, 512, 512)
    let seed = 1977
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < 9500; i++) {
      const x = rand() * 512, y = rand() * 512, r = rand()
      g.fillStyle = rand() < .5 ? 'rgba(60,32,23,.14)' : 'rgba(246,194,136,.17)'
      g.fillRect(x, y, 1 + r * r * 6, 1 + r * r * 4)
    }
    const mat = C.Material.fromType('Image', { image, repeat: new C.Cartesian2(5, 5) })
    return new C.Primitive({
      geometryInstances: new C.GeometryInstance({
        geometry: new C.PlaneGeometry({ vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat }),
        modelMatrix: C.Matrix4.multiplyByScale(base, new V(64, 64, 1), new C.Matrix4()),
      }),
      appearance: new C.MaterialAppearance({ material: mat, translucent: false, flat: true }),
      asynchronous: false,
    })
  }

  async function caida() {
    const token = open('caida', start)
    let skipRequested = reduced.matches
    skip.onclick = () => { skipRequested = true; campaign?.skip() }
    try {
      const { crearCampana } = await import('./historia-escena.js')
      if (active !== token) return
      viewer.useDefaultRenderLoop = false
      campaign = crearCampana({ reduced: skipRequested })
    } catch (error) {
      if (active !== token) return
      viewer.useDefaultRenderLoop = cameraState.loop
      skip.hidden = true
      status.textContent = 'No se pudo iniciar la escena 3D. Vuelve al globo y comprueba que WebGL esté habilitado.'
      console.error(error)
    }
  }

  function verSitio() {
    if (!visitFrame) return
    const { offset: [x, y, z], range, eye, target, name } = objetos[selected]
    look(world(visitFrame, x + range * Math.cos(azimuth), y + range * Math.sin(azimuth), z + eye),
      world(visitFrame, x, y, z + target))
    sites.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.sitio === selected)))
    status.textContent = name
  }

  async function visita() {
    const token = open('visita', visit)
    try {
      const [terrain, lander, rover] = await Promise.all([localFrame(SITIO),
        model(token, './modelos/pathfinder.glb'), model(token, './modelos/sojourner.glb')])
      if (active !== token || !lander || !rover) return
      visitFrame = terrain
      panel.dataset.shot = 'visita'
      visitNav.hidden = false
      selected = 'sojourner'
      azimuth = .7
      const started = performance.now()
      let previousHeight, patch
      const settle = now => {
        if (active !== token) return
        const correction = ajusteTerreno(terrain)
        if (correction !== previousHeight) {
          previousHeight = correction
          visitFrame = C.Transforms.eastNorthUpToFixedFrame(world(terrain, 0, 0, correction + 12), ellipsoid)
          if (patch) meshes.remove(patch)
          patch = meshes.add(parcheLocal(visitFrame))
          for (const [name, asset] of [['pathfinder', lander], ['sojourner', rover]]) {
            asset.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(world(visitFrame, ...objetos[name].offset), ellipsoid)
            asset.show = true
          }
          verSitio()
        }
        scene.requestRender()
        if (now - started < 3800 || ((!lander.ready || !rover.ready) && now - started < 8000)) {
          frame = requestAnimationFrame(settle)
        }
      }
      settle(started)
      sites[0].focus()
    } catch (error) {
      if (active !== token) return
      status.textContent = 'No se pudo cargar la visita histórica.'
      console.error(error)
    }
  }

  start.onclick = caida
  visit.onclick = visita
  salir.onclick = close
  sites.forEach(btn => { btn.onclick = () => { selected = btn.dataset.sitio; verSitio() } })
  $('historia-girar').onclick = () => { azimuth += Math.PI / 4; verSitio() }
  document.addEventListener('keydown', event => {
    if (active && event.key === 'Escape') close()
  })
  start.disabled = visit.disabled = false
}
