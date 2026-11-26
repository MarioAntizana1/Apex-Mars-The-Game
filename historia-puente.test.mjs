import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from './vendor/three/three.module.min.js'
import {crearPuenteJugable,crearPuenteCine,transitablePuente,Z_INICIO_PUENTE} from './historia-puente.js'
import {crearCine} from './historia-cine.js'
import {crearNave} from './historia-nave.js'

function hits(root, origin, direction, far=20){
  root.updateMatrixWorld(true); const meshes=[]
  root.traverseVisible(o=>{if(o.isMesh) meshes.push(o)})
  return new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction).normalize(),0,far).intersectObjects(meshes,false)
}
const material=hit=>Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material

test('Puente compartido: asiento vacante en EVA, piloto en cine y tres pantallas en ambos',()=>{
  const vuelo=crearPuenteCine(T,()=>.5),eva=crearPuenteJugable(T)
  for(const n of ['Asiento de pilotaje',...Array.from({length:3},(_,i)=>`Pantalla de vuelo ${i+1}`)]){
    const a=vuelo.root.getObjectByName(n),b=eva.root.getObjectByName(n)
    assert.ok(a&&b);assert.deepEqual(a.getWorldPosition(new T.Vector3()),b.getWorldPosition(new T.Vector3()))
  }
  const asiento=set=>set.root.getObjectByName('Asiento de pilotaje')
  assert.equal(asiento(vuelo).children.find(o=>o.isGroup).visible,true)
  assert.equal(asiento(eva).children.find(o=>o.isGroup).visible,false)
})

test('Trayecto de traje desde el umbral hasta diagnóstico: libre en colisión y geometría',()=>{
  const puente=crearPuenteJugable(T), x=-.48,fin=5.28
  for(let z=Z_INICIO_PUENTE;z<=fin;z+=.015)assert.equal(transitablePuente(x,z),true,`z=${z}`)
  for(const y of [.9,1.2,1.6,2.1])for(const dx of [-.1,.1])assert.equal(hits(puente.root,[x+dx,y,Z_INICIO_PUENTE],[0,0,1],fin-Z_INICIO_PUENTE).length,0)
  assert.equal(transitablePuente(.38,3.9),false);assert.equal(transitablePuente(0,5.8),false)
  const {accion}=puente,pos=new T.Vector3(x,2.1,fin),delta=new T.Vector3(...accion.pt).sub(pos)
  assert.ok(accion.active()&&delta.length()<accion.range)
  const texture=puente.root.getObjectByName('Pantalla de vuelo 2').material.map
  assert.ok(texture.isDataTexture);const before=texture.version
  assert.match(puente.diagnosticar(),/72 kPa · radio orbital sin enlace/);assert.ok(texture.version>before)
  assert.match(puente.diagnosticar(true),/comunicación orbital establecida/)
})

test('Visión del horizonte desde los mandos: los rayos cruzan cristal, no un casco opaco',()=>{
  const ship=crearNave(T),puente=crearPuenteJugable(T),root=new T.Group();root.add(ship,puente.root)
  for(const direction of [[0,0,1],[-.16,.04,1],[.1,-.03,1]]){
    const ray=hits(root,[-.48,2.10,5.24],direction)
    assert.ok(ray.some(h=>material(h).opacity<.2),'falta cristal')
    assert.ok(ray.every(h=>material(h).transparent&&!material(h).depthWrite),'hay revestimiento opaco')
  }
})

test('Cine completo en Node sin document: encuadre dentro del set y cámara restaurada',()=>{
  assert.equal(typeof globalThis.document,'undefined')
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(57,1.6,.17,456),cine=crearCine(T,scene,camera,{})
  const set=scene.getObjectByName('Puente de vuelo APEX-04')
  for(const t of [0,2,5,9,12,18,23,28.5,34.95]){
    cine.update(t);assert.ok(camera.position.toArray().every(Number.isFinite))
    if([0,2,12,23].includes(t)){const p=set.worldToLocal(camera.position.clone());assert.ok(Math.abs(p.x)<1.8&&p.y>1.8&&p.y<3&&Math.abs(p.z)<2.2,`encuadre en ${t}`)}
  }
  cine.dispose();cine.dispose();assert.equal(scene.children.length,0);assert.deepEqual([camera.fov,camera.near,camera.far],[57,.17,456])
})
