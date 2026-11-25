// Depósitos de Ares Vallis. Una semilla por sector: cargar el mapa en otro
// orden no mueve las piedras ni consume el generador de la escena jugable.
const TAU = 2 * Math.PI
const paleta = [0x5c4a3e, 0x50433e, 0x715745, 0x6a4d3e, 0x4d443e, 0x7a5c47]
function azar(semilla) {
  return () => ((semilla = (Math.imul(1664525, semilla) + 1013904223) >>> 0) / 4294967296)
}

// Forma radial continua: ondulaciones grandes de erosión y planos oblicuos
// de fractura. Los vértices coincidentes reciben la misma deformación.
function clasto(T, tipo) {
  const rand = azar(0x4183 + tipo * 491)
  const g = new T.IcosahedronGeometry(1, 2), p = g.attributes.position
  const fase = Array.from({length: 4}, () => rand() * TAU)
  const cortes = Array.from({length: 4 + tipo % 3}, (_, i) => {
    const a = rand() * TAU, y = i === 0 ? .93 : rand() * 1.5 - .7, r = Math.sqrt(1-y*y)
    return [Math.cos(a)*r, y, Math.sin(a)*r, .64 + rand()*.23]
  })
  const espesor = [.72, .29, .9, .64, .58, .82][tipo]
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    let radio = 1 + .14*Math.sin(x*3 + z*2 + fase[0]) + .09*Math.cos(y*4 - z*2 + fase[1]) + .05*Math.sin(x*6 - y*2 + fase[2])
    for (const [nx,ny,nz,d] of cortes) {
      const dot = x*nx + y*ny + z*nz
      if (dot > 0) radio = Math.min(radio, d/dot)
    }
    p.setXYZ(i, (x + y*.18)*radio, (y + x*.16)*radio*espesor, z*radio*(.73 + .15*Math.sin(fase[3])))
  }
  g.computeVertexNormals(); g.computeBoundingSphere()
  g.name = 'Clasto erosionado ' + tipo
  return g
}

export function crearDepositos(T, parent) {
  const formas = Array.from({length: 6}, (_, i) => clasto(T, i))
  const material = new T.MeshStandardMaterial({roughness: 1, metalness: 0})
  const dummy = new T.Object3D(), color = new T.Color(), matriz = new T.Matrix4()
  const limites = [], cercanas = []
  // Descartar lotes por distancia al rectángulo (no sólo a su centro), para
  // que una frontera entre sectores no abra una franja sin piedras.
  const activos = new Map()
  let visorX = 0, visorZ = 0
  function mostrar(lote, zona) {
    const dx = Math.max(0, Math.abs(visorX-zona.x)-zona.mitad)
    const dz = Math.max(0, Math.abs(visorZ-zona.z)-zona.mitad)
    lote.visible = dx*dx + dz*dz <= zona.alcance*zona.alcance
  }
  function actualizar(x,z) {
    if (Math.abs(x-visorX)<12 && Math.abs(z-visorZ)<12) return
    visorX=x; visorZ=z
    for (const [lote,zona] of activos) mostrar(lote,zona)
  }
  function montar(padre, listas, cerca, zona) {
    for (let tipo = 0; tipo < listas.length; tipo++) {
      const lista = listas[tipo]
      if (!lista.length) continue
      const lote = new T.InstancedMesh(formas[tipo], material, lista.length)
      lote.name = 'Piedras de Ares Vallis'
      for (const [i, v] of lista.entries()) {
        const {x,y,z,tam,ancho,giro,tinte,valor} = v
        dummy.rotation.set(0,giro,0); dummy.scale.set(tam*ancho,tam*1.3,tam)
        dummy.position.set(x,y,z); dummy.updateMatrix(); lote.setMatrixAt(i,dummy.matrix)
        lote.setColorAt(i,color.setHex(tinte).multiplyScalar(valor))
        if (cerca) {
          const p = formas[tipo].attributes.position
          let radio = 0
          for (let j = 0; j < p.count; j++) radio = Math.max(radio, Math.hypot(p.getX(j)*ancho,p.getZ(j)))
          limites.push([x,z,radio*tam]); cercanas.push({x,z,lote,i})
        }
      }
      lote.computeBoundingSphere(); padre.add(lote)
      if (zona) { activos.set(lote,zona); mostrar(lote,zona) }
    }
  }
  const listas = () => formas.map(() => [])
  function agregar(ls, tipo, x, y, z, tam, rand) {
    ls[tipo].push({x,y,z,tam,ancho:.9 + rand()*.55,giro:rand()*TAU,tinte:paleta[Math.floor(rand()*paleta.length)],valor:.83+rand()*.31})
  }
  const impacto = new T.Group(), local = listas(), rand = azar(19760720)
  for (let i = 0; i < 740; i++) {
    const a = rand()*TAU, r = 6 + rand()**1.4*62, x = Math.cos(a)*r, z = Math.sin(a)*r
    if (Math.abs(x) < 4.5 && Math.abs(z) < 14) continue // casco, rampa y salida
    agregar(local,i%6,x,0,z,.045+rand()**4*(r>16?1.9:.44),rand)
  }
  montar(impacto,local,true); parent.add(impacto)

  function sector(malla,col,fila,lado,altura,sagan) {
    const rand = azar(Math.imul(col+1,73856093) ^ Math.imul(fila+1,19349663)), ls = listas()
    const {x:cx,z:cz} = malla.position, mitad = lado/2
    // Un afloramiento por celda de 128 m, desplazado para evitar un patrón
    // regular. Bloques de escala métrica sirven de referencia desde el rover;
    // los campos de fragmentos sólo se dibujan en los parches cercanos.
    const variante = [2,5,0,3][Math.floor(rand()*4)], celda=lado/8, parche=lado/4
    const libre = (lx,lz,tam) => Math.hypot(cx+lx,cz+lz)>68+2.6*tam && Math.hypot(cx+lx-sagan.x,cz+lz-sagan.z)>20+2.6*tam
    for (let qz=0;qz<4;qz++) for (let qx=0;qx<4;qx++) {
      const finas=listas(), tipo=(variante+1+Math.floor(rand()*5))%6
      const ox=qx*parche-mitad, oz=qz*parche-mitad
      for (let j=0;j<6;j++) {
        // Retícula 3x2 con jitter: cubre las esquinas del parche sin dejar
        // claros largos en llano, pero sin repetir un patrón visible.
        const x=ox+parche*((j%3+.5)/3+.22*(rand()-.5)), z=oz+parche*((Math.floor(j/3)+.5)/2+.22*(rand()-.5))
        const tam=1.8+rand()**2*6.2, eje=rand()*TAU, n=4+Math.floor(rand()*4)
        if (libre(x,z,tam)) agregar(ls,variante,x,altura(x,z),z,tam,rand)
        for (let k=0;k<n;k++) {
          const t=(rand()-.5)*celda*.32, v=(rand()-.5)*celda*.12
          const lx=Math.max(-mitad+1,Math.min(mitad-1,x+t*Math.cos(eje)-v*Math.sin(eje)))
          const lz=Math.max(-mitad+1,Math.min(mitad-1,z+t*Math.sin(eje)+v*Math.cos(eje)))
          const s=.19+rand()**2.4*1.55
          if (libre(lx,lz,s)) agregar(finas,tipo,lx,altura(lx,lz),lz,s,rand)
        }
      }
      montar(malla,finas,false,{x:cx+ox+parche/2,z:cz+oz+parche/2,mitad:parche/2,alcance:190})
    }
    montar(malla,ls,false,{x:cx,z:cz,mitad,alcance:1050})
    // El impacto se ve antes de cargar HiRISE. Reasentar sus piedras sólo
    // cuando llega su sector real, sin muestrear cientos de alturas por frame.
    if (Math.abs(cx)<mitad+68 && Math.abs(cz)<mitad+68) {
      const cambiados = new Set()
      for (const {x,z,lote,i} of cercanas) {
        const lx=x-cx, lz=z-cz
        if (lx < -mitad || lx >= mitad || lz < -mitad || lz >= mitad) continue
        lote.getMatrixAt(i,matriz); matriz.elements[13]=altura(lx,lz); lote.setMatrixAt(i,matriz); cambiados.add(lote)
      }
      for (const lote of cambiados) { lote.instanceMatrix.needsUpdate=true; lote.computeBoundingSphere() }
    }
  }
  function liberarSector(malla) {
    for (const lote of malla.children) if (lote.isInstancedMesh && lote.material === material) {
      activos.delete(lote); lote.dispose()
    }
  }
  function dispose() {
    for (const lote of activos.keys()) lote.dispose()
    activos.clear()
    liberarSector(impacto); parent.remove(impacto); formas.forEach(g => g.dispose()); material.dispose()
  }
  return {limites,sector,actualizar,liberarSector,dispose}
}
