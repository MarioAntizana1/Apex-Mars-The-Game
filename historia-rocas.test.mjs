import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from './vendor/three/three.module.min.js'
import { crearDepositos } from './historia-rocas.js'

const sagan = {x:1200,z:1600}

test('el depósito diferencia seis siluetas y conserva un acceso despejado', () => {
  const raiz = new T.Group(), campo = crearDepositos(T,raiz), lotes = raiz.children[0].children
  assert.equal(new Set(lotes.map(l => l.geometry)).size,6)
  assert.equal(lotes.reduce((n,l)=>n+l.count,0),campo.limites.length)
  assert.ok(campo.limites.every(([x,z,r]) => r>0 && (Math.abs(x)>=4.5 || Math.abs(z)>=14)))
  const espesores = lotes.map(({geometry:g}) => {
    g.computeBoundingBox()
    const v=g.boundingBox.getSize(new T.Vector3()); return v.y/v.x
  })
  assert.ok(Math.max(...espesores) / Math.min(...espesores) > 2)
  campo.dispose(); assert.equal(raiz.children.length,0)
})

test('recargar un sector reproduce la grava y asienta las piedras en su DTM', () => {
  const raiz=new T.Group(), campo=crearDepositos(T,raiz), altura=(x,z)=>3+x*.01-z*.015
  const sector=()=>{const g=new T.Group(); campo.sector(g,4,2,1024,altura,sagan); return g}
  const a=sector(), b=sector(), m=new T.Matrix4()
  assert.equal(a.children.length,17) // un lote de bloques + 16 parches de cantos
  for (const [i,l] of a.children.entries()) assert.deepEqual(l.instanceMatrix.array,b.children[i].instanceMatrix.array)
  for (const l of [...a.children,...raiz.children[0].children]) for (let i=0;i<l.count;i++) {
    l.getMatrixAt(i,m); const [x,y,z]=m.elements.slice(12,15)
    assert.ok(Math.abs(y-altura(x,z))<2e-6)
  }
  campo.liberarSector(a); campo.liberarSector(b); campo.dispose()
})

test('los campos respetan los perímetros de la nave y del aterrizador', () => {
  const raiz=new T.Group(), campo=crearDepositos(T,raiz), m=new T.Matrix4()
  for (const [cx,cz,r] of [[0,0,68],[sagan.x,sagan.z,20]]) {
    const g=new T.Group(); g.position.set(cx,0,cz)
    campo.sector(g,0,1,1024,()=>0,sagan)
    for(const lote of g.children) for(let i=0;i<lote.count;i++) {
      lote.getMatrixAt(i,m)
      assert.ok(Math.hypot(m.elements[12],m.elements[14])>r+2*m.elements[5])
    }
    campo.liberarSector(g)
  }
  campo.dispose()
})

test('un rover exterior encuentra bloques y campos sin dibujar toda la ventana de carga', t => {
  const raiz=new T.Group(), campo=crearDepositos(T,raiz), m=new T.Matrix4()
  const formas=new Set(raiz.children[0].children.map(l=>l.geometry)), sectores=[]
  const px=-41000, pz=23000
  let maxDist=0, total=0
  for(let j=-2;j<=2;j++) for(let i=-2;i<=2;i++) {
    const g=new T.Group(); g.position.set(px+i*1024,0,pz+j*1024)
    campo.sector(g,-40+i,22+j,1024,()=>7,sagan); sectores.push(g)
    const bloques=g.children.at(-1); assert.equal(bloques.count,96)
    const centros=[], grandes=[]
    for(const lote of g.children) {
      assert.ok(formas.has(lote.geometry)); total+=lote.count
      for(let k=0;k<lote.count;k++) {
        lote.getMatrixAt(k,m); const [x,y,z]=m.elements.slice(12,15)
        assert.ok(Math.abs(x)<512 && Math.abs(z)<512 && y===7)
        if(lote===bloques) { centros.push([x,z]); if(m.elements[5]>3) grandes.push(k) }
      }
    }
    assert.ok(grandes.length>=10); assert.ok(g.children.slice(0,-1).every(l=>l.count>=20))
    for(let x=-512;x<=512;x+=64) for(let z=-512;z<=512;z+=64) {
      maxDist=Math.max(maxDist,Math.min(...centros.map(([cx,cz])=>Math.hypot(cx-x,cz-z))))
    }
  }
  assert.ok(maxDist<150)
  let maxCalls=0,maxTri=0
  for(let x=-512;x<=512;x+=64) for(let z=-512;z<=512;z+=64) {
    campo.actualizar(px+x,pz+z)
    const visibles=sectores.flatMap(g=>g.children.filter(l=>l.visible))
    maxCalls=Math.max(maxCalls,visibles.length)
    maxTri=Math.max(maxTri,visibles.reduce((a,l)=>a+l.count*l.geometry.attributes.position.count/3,0))
  }
  assert.ok(maxCalls<=25); assert.ok(maxTri<240000)
  t.diagnostic(`25 sectores: ${total} instancias; peor muestra ${maxCalls} lotes y ${maxTri} triángulos antes de frustum; bloque a ≤${Math.ceil(maxDist)} m`)
  for(const g of sectores) campo.liberarSector(g)
  campo.dispose()
})
