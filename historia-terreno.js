// One analytic height field shared by terrain, props, physics and the tablet map.
// Metres, +X east, +Z south: yaw 0 in the EVA camera looks towards -Z (north).
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)

export const SAGAN = Object.freeze({ x: 180, z: -340 })
export const LIMITE = 1150

export function height(x, z) {
  const r = Math.hypot(x, z)
  // The impact site keeps a natural flat apron around the hull (r < 13 m).
  const near = smooth((r - 13) / 35)
  let h = near * (1.06 * Math.sin(x * .083 + z * .027) + .72 * Math.sin(z * .137 - x * .031) + .32 * Math.sin(x * .22 + z * .11))
  // Open-world relief fades in past the crater rim.
  const far = smooth((r - 90) / 240)
  h += far * (11 * Math.sin(x * .0057 + z * .0033) + 7 * Math.cos(z * .0081 - x * .0042) + 4.5 * Math.sin(x * .014 + z * .011) * Math.cos(z * .006))
  // Flatten a science pad under the Sagan station so both rovers sit level.
  const pad = 1 - smooth((Math.hypot(x - SAGAN.x, z - SAGAN.z) - 20) / 46)
  return h * (1 - pad)
}

export function normal(x, z, target) {
  const e = 1.5
  const dx = (height(x + e, z) - height(x - e, z)) / (2 * e)
  const dz = (height(x, z + e) - height(x, z - e)) / (2 * e)
  const k = 1 / Math.hypot(dx, 1, dz)
  return target.set(-dx * k, k, -dz * k)
}

// Streamed 96 m tiles centred on the explorer; fog hides the outer ring.
const TILE = 96, DIV = 48, SPAN = 5, ROCAS = 26
const hash = (x, z) => {
  const n = Math.imul(x | 0, 73856093) ^ Math.imul(z | 0, 19349663)
  return (Math.imul(n ^ (n >>> 16), 2246822519) >>> 0) / 4294967296
}

export function crearSuperficie(T, world, polvo) {
  const suelo = new T.MeshStandardMaterial({ vertexColors: true, map: polvo, roughness: 1 })
  const piedra = new T.MeshStandardMaterial({ color: 0x8e614c, roughness: 1, flatShading: true })
  const forma = new T.IcosahedronGeometry(1, 0)
  const dummy = new T.Object3D(), color = new T.Color(), n = new T.Vector3()
  const slots = Array.from({ length: SPAN * SPAN }, () => {
    const g = new T.PlaneGeometry(TILE, TILE, DIV, DIV)
    g.rotateX(-Math.PI / 2)
    g.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3))
    const ground = new T.Mesh(g, suelo)
    const rocks = new T.InstancedMesh(forma, piedra, ROCAS)
    rocks.frustumCulled = true
    world.add(ground, rocks)
    return { g, ground, rocks, ix: Infinity, iz: Infinity }
  })
  let lastX = Infinity, lastZ = Infinity

  function pintar(tile, ix, iz) {
    const { g, ground, rocks } = tile
    const ox = ix * TILE, oz = iz * TILE
    ground.position.set(ox, 0, oz)
    rocks.position.set(ox, 0, oz)
    const p = g.attributes.position, c = g.attributes.color, nr = g.attributes.normal
    for (let i = 0; i < p.count; i++) {
      const x = ox + p.getX(i), z = oz + p.getZ(i), h = height(x, z)
      p.setY(i, h)
      const slope = normal(x, z, n)
      nr.setXYZ(i, slope.x, slope.y, slope.z)
      const grain = hash(Math.round(x * .5), Math.round(z * .5))
      color.setHex(0xb47651).multiplyScalar((.86 + .16 * grain) * (.9 + .14 * slope.y))
      c.setXYZ(i, color.r, color.g, color.b)
    }
    p.needsUpdate = nr.needsUpdate = c.needsUpdate = true
    g.computeBoundingSphere()
    let count = 0
    for (let i = 0; i < ROCAS; i++) {
      const wx = ox + (hash(ix * 79 + i, iz) - .5) * TILE
      const wz = oz + (hash(ix, iz * 79 + i + 421) - .5) * TILE
      const size = .06 + hash(ix * 85 + i + 67, iz + 42) ** 4 * 1.5
      if (Math.hypot(wx, wz) < 72 || Math.hypot(wx - SAGAN.x, wz - SAGAN.z) < 30) continue
      dummy.position.set(wx - ox, height(wx, wz) + size * .07, wz - oz)
      dummy.rotation.set(.2, i * 2.39, .1)
      dummy.scale.set(size * 1.25, size * .5, size)
      dummy.updateMatrix()
      rocks.setMatrixAt(count++, dummy.matrix)
    }
    rocks.count = count
    rocks.instanceMatrix.needsUpdate = true
    rocks.computeBoundingSphere()
  }

  function update(x, z) {
    const cx = Math.floor(x / TILE + .5), cz = Math.floor(z / TILE + .5)
    if (cx === lastX && cz === lastZ) return
    lastX = cx
    lastZ = cz
    for (let iz = cz - 2; iz <= cz + 2; iz++) {
      for (let ix = cx - 2; ix <= cx + 2; ix++) {
        const tile = slots[((iz % SPAN + SPAN) % SPAN) * SPAN + (ix % SPAN + SPAN) % SPAN]
        if (tile.ix === ix && tile.iz === iz) continue
        tile.ix = ix
        tile.iz = iz
        pintar(tile, ix, iz)
      }
    }
  }

  function dispose() {
    for (const { g } of slots) g.dispose()
    suelo.dispose()
    piedra.dispose()
  }

  update(0, 0)
  return { update, dispose }
}
