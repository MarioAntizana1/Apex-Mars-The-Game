import { SAGAN } from './historia-terreno.js'

// Estación científica Sagan: el sitio histórico de Mars Pathfinder (1997).
// Solo lander, rover y cartel; sin edificios. Los modelos GLB se cargan al
// acercarse y el suelo lo aporta el terreno real de Ares Vallis.
const LANDER = { x: 0, z: 0 }
const ROVER = { x: 2.5, z: -1.5 }
const SIGN = { x: -5.5, z: -4 }

const metal = (T, color, roughness = .62, metalness = .32) => new T.MeshStandardMaterial({ color, roughness, metalness })

function cartel(T, titulo, linea, sub) {
  const c = globalThis.document?.createElement?.('canvas')
  const g = c?.getContext?.('2d')
  if (!g) return null
  c.width = 1024
  c.height = 256
  g.fillStyle = '#16262b'
  g.fillRect(0, 0, 1024, 256)
  g.fillStyle = '#a9f0df'
  g.fillRect(34, 30, 150, 7)
  g.font = 'bold 30px monospace'
  g.fillText(titulo, 36, 84)
  g.font = 'bold 62px sans-serif'
  g.fillText(linea, 34, 150, 940)
  g.fillStyle = '#243a40'
  g.fillRect(36, 172, 952, 3)
  g.fillStyle = '#bde3d8'
  g.font = '27px monospace'
  g.fillText(sub, 36, 214, 940)
  for (const [x, y] of [[20, 20], [997, 20], [20, 231], [997, 231]]) {
    g.fillStyle = '#5a6a66'
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill()
  }
  const tex = new T.CanvasTexture(c)
  tex.colorSpace = T.SRGBColorSpace
  return new T.MeshBasicMaterial({ map: tex })
}

// Lector mínimo de glTF 2.0 binario: los modelos del proyecto no usan texturas
// ni transformaciones de nodo (los genera modelos/generar.py).
export async function cargarGlb(T, url) {
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error(`${url}: HTTP ${respuesta.status}`)
  const buffer = await respuesta.arrayBuffer()
  const vista = new DataView(buffer)
  if (vista.getUint32(0, true) !== 0x46546c67) throw new Error(`${url}: no es GLB`)
  const total = Math.min(vista.getUint32(8, true), buffer.byteLength)
  let offset = 12, doc, bin
  const texto = new TextDecoder()
  while (offset + 8 <= total) {
    const largo = vista.getUint32(offset, true)
    const tipo = vista.getUint32(offset + 4, true)
    const cuerpo = buffer.slice(offset + 8, offset + 8 + largo)
    if (tipo === 0x4e4f534a) doc = JSON.parse(texto.decode(new Uint8Array(cuerpo)))
    else if (tipo === 0x004e4942) bin = cuerpo
    offset += 8 + largo
  }
  if (!doc?.meshes) throw new Error(`${url}: glTF inválido`)
  const tipos = { SCALAR: 1, VEC2: 2, VEC3: 3 }
  const leer = index => {
    const accessor = doc.accessors[index]
    const view = doc.bufferViews[accessor.bufferView]
    const componente = accessor.componentType === 5126 ? 4 : 2
    const componentes = tipos[accessor.type]
    const inicio = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const copia = bin.slice(inicio, inicio + accessor.count * componentes * componente)
    return accessor.componentType === 5126 ? new Float32Array(copia) : new Uint16Array(copia)
  }
  const grupo = new T.Group()
  const cache = new Map()
  const material = index => {
    if (cache.has(index)) return cache.get(index)
    const pbr = doc.materials?.[index]?.pbrMetallicRoughness ?? {}
    const [r, g, b] = pbr.baseColorFactor ?? [1, 1, 1, 1]
    const m = new T.MeshStandardMaterial({
      color: new T.Color().setRGB(r, g, b),
      metalness: pbr.metallicFactor ?? 0,
      roughness: pbr.roughnessFactor ?? 1,
    })
    m.name=doc.materials?.[index]?.name ?? ''
    cache.set(index, m)
    return m
  }
  for (const malla of doc.meshes) {
    for (const primitiva of malla.primitives ?? []) {
      const geometry = new T.BufferGeometry()
      const attrs = primitiva.attributes
      geometry.setAttribute('position', new T.BufferAttribute(leer(attrs.POSITION), 3))
      if (attrs.NORMAL !== undefined) geometry.setAttribute('normal', new T.BufferAttribute(leer(attrs.NORMAL), 3))
      if (primitiva.indices !== undefined) geometry.setIndex(new T.BufferAttribute(leer(primitiva.indices), 1))
      if (attrs.NORMAL === undefined) geometry.computeVertexNormals()
      grupo.add(new T.Mesh(geometry, material(primitiva.material ?? 0)))
    }
  }
  return grupo
}

export function crearEstacionSagan(T, world, height) {
  const grupo = new T.Group()
  grupo.name = 'estación científica Sagan'
  grupo.position.set(SAGAN.x, height(SAGAN.x, SAGAN.z), SAGAN.z)
  world.add(grupo)
  const gris = metal(T, 0x8a9094, .6, .45)

  // Cartel de campaña, orientado a la entrada desde el punto de impacto.
  const panel = cartel(T, 'CIENCIA / 1997', 'ESTACIÓN SAGAN', 'MARS PATHFINDER · SOJOURNER · ARES VALLIS')
  const poste = new T.Mesh(new T.CylinderGeometry(.09, .11, 2.5, 8), gris)
  poste.position.set(SIGN.x, 1.25, SIGN.z)
  grupo.add(poste)
  if (panel) {
    const letrero = new T.Mesh(new T.PlaneGeometry(3.4, .85), panel)
    letrero.position.set(SIGN.x, 2.25, SIGN.z)
    letrero.rotation.y = Math.atan2(-1200, -1600)
    grupo.add(letrero)
  }

  let cargando = false, cargado = false, disposed = false
  let ultimaAltura = grupo.position.y
  // Conservar los tonos originales del GLB; restaurarlos al retirar el polvo.
  const celdas=new Map(), polvo=new T.Color(0xb5825d)
  let sistemas={}
  const testigo=new T.Mesh(new T.SphereGeometry(.055,12,8),new T.MeshBasicMaterial())
  testigo.name='testigo de radio Pathfinder';testigo.position.set(.17,.48,-.14);testigo.visible=false;grupo.add(testigo)
  function telemetria(estado){
    sistemas=estado
    for(const [mat,limpio] of celdas)mat.color.copy(limpio).lerp(polvo,estado.panelesLimpios?0:.86)
    testigo.visible=Boolean(estado.encendidoIntentado)
    testigo.material.color.setHex(estado.comunicacionesActivas?0x7bf8a6:estado.balizaConectada?0x8adeff:0xffaa50)
  }

  async function cargarModelos() {
    if (cargando || cargado || typeof fetch !== 'function') return
    cargando = true
    try {
      const [lander, rover] = await Promise.all([
        cargarGlb(T, './modelos/pathfinder.glb'),
        cargarGlb(T, './modelos/sojourner.glb'),
      ])
      if (disposed) {
        for (const modelo of [lander, rover]) modelo.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.() })
        return
      }
      lander.position.set(LANDER.x, 0, LANDER.z)
      lander.rotation.y = .62
      lander.traverse(o=>{const m=o.material;if(m&&/^(Celdas|Retícula solar)/.test(m.name))celdas.set(m,m.color.clone())})
      telemetria(sistemas);grupo.add(lander)
      rover.position.set(ROVER.x, .02, ROVER.z)
      rover.rotation.y = .2
      rover.scale.setScalar(1.6)
      grupo.add(rover)
      cargado = true
    } catch (error) {
      console.warn('No se pudieron cargar los modelos de Sagan:', error)
    } finally { cargando = false }
  }

  const choques = [
    { x: LANDER.x, z: LANDER.z, r: 2.2 },
    { x: ROVER.x, z: ROVER.z, r: 1.3 },
    { x: SIGN.x, z: SIGN.z, r: .6 },
  ]
  function permite(x, z, radio = 0) {
    const dx = x - SAGAN.x, dz = z - SAGAN.z
    return !choques.some(c => Math.hypot(dx - c.x, dz - c.z) < c.r + radio)
  }
  function update(dt, pos) {
    const nueva = height(SAGAN.x, SAGAN.z)
    if (Math.abs(nueva - ultimaAltura) > .005) {
      ultimaAltura = nueva
      grupo.position.y = nueva
      grupo.updateMatrixWorld(true)
    }
    if (!cargado && !cargando && pos && Math.hypot(pos.x - SAGAN.x, pos.z - SAGAN.z) < 260) cargarModelos()
  }
  function dispose() {
    if (disposed) return
    disposed = true
    grupo.removeFromParent?.()
    grupo.traverse(o => {
      if (o.geometry) o.geometry.dispose()
      const mats = o.material ? [].concat(o.material) : []
      for (const m of mats) { m.map?.dispose?.(); m.dispose?.() }
    })
  }
  return { permite, update, dispose, telemetria, grupo, SAGAN }
}
