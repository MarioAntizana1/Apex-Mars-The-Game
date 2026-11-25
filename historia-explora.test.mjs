import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from './vendor/three/three.module.min.js'
import { crearNave } from './historia-nave.js'
import { crearExploracion } from './historia-explora.js'

function simulation(){
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(54,1.5,.3,1000),canvas=new EventTarget();canvas.style={touchAction:'pan-y'}
  const hud={},zone=[],ui={exterior:v=>zone.push(v)};for(const type of ['objective','prompt','status','inventory'])ui[type]=v=>hud[type]=v
  const sim=crearExploracion(T,scene,camera,{domElement:canvas},ui)
  function walk(x,z,secs){sim.move(x,z);for(let i=0;i<Math.round(secs*60);i++)sim.update(1/60);sim.move(0,0);sim.update(0)}
  function aim(x,y,z){const d=new T.Vector3(x,y,z).sub(camera.position).normalize();const yaw=Math.atan2(-d.x,-d.z),pitch=Math.asin(d.y);sim.look((camera.rotation.y-yaw)/.0042,(camera.rotation.x-pitch)/.0038)}
  return {scene,camera,sim,walk,aim,hud,zone,canvas}
}
test('el modelo compartido usa +Z proa y apoya sus patas en y=0',()=>{
  const ship=crearNave(T),bounds=new T.Box3().setFromObject(ship);assert.equal(T.REVISION,'160');assert.equal(bounds.min.y,0);assert.ok(bounds.max.z>4.3);assert.ok(bounds.max.y>3.7&&bounds.max.y<4.2);assert.ok(bounds.max.x>2.9&&bounds.max.x<3.4);assert.ok(ship.getObjectByName('escotilla').position.z< -3.9)
})
function vista(s,x,y,z){s.aim(x,y,z);s.sim.update(0)}
function ir(s,tx,tz){const dx=tx-s.camera.position.x,dz=tz-s.camera.position.z;vista(s,tx,s.camera.position.y,tz);const fuera=s.zone.at(-1)===true;s.walk(0,1,Math.hypot(dx,dz)/(fuera?2.85:2.02))}
function mando(s,pt,label){vista(s,...pt);assert.match(s.hud.prompt,label);s.sim.interact();s.walk(0,0,.95)}
const aCab=[1.14,1.73,-1.95],aCam=[1.14,1.73,-2.29],bCam=[1.16,1.73,-3.77],bMar=[1.16,1.73,-4.22],aire=[-1.71,1.72,-3.02]
function salir(s){ir(s,0,-1.43);mando(s,aCab,/Abrir puerta A/);ir(s,0,-3.03);mando(s,aCam,/Cerrar puerta A/);mando(s,aire,/Despresurizar/);s.walk(0,0,4);mando(s,bCam,/Abrir puerta B/);ir(s,0,-4.9);ir(s,0,-7.5);assert.equal(s.zone.at(-1),true)}
test('se explora el puente desde el pasillo y funciona su consola',()=>{
 const s=simulation();ir(s,0,2.55);ir(s,-.48,2.55);ir(s,-.48,5.22);assert.ok(s.camera.position.z>5);vista(s,0,1.55,5.72);assert.ok(s.hud.prompt);s.sim.interact();assert.match(s.hud.status,/comunic|enlace|antena/i);assert.deepEqual(s.zone,[false]);s.sim.dispose()
})
test('la esclusa exige igualar al salir y al regresar, sin exigir recoger equipo',()=>{
 const s=simulation();salir(s);ir(s,0,-4.9);mando(s,bMar,/Cerrar puerta B/);mando(s,bMar,/Abrir puerta B/);ir(s,0,-3.03);mando(s,bCam,/Cerrar puerta B/);mando(s,aCam,/Abrir puerta A/);assert.match(s.hud.status,/Presión incompatible/);mando(s,aire,/Presurizar/);s.walk(0,0,4);mando(s,aCam,/Abrir puerta A/);ir(s,0,0);assert.ok(s.camera.position.z>-.1);assert.equal(s.hud.inventory,'Sin equipo recogido');s.sim.dispose();s.sim.dispose();assert.equal(s.scene.children.length,0);assert.equal(s.canvas.style.touchAction,'pan-y')
})
test('el kit se transporta y el jugador elige dónde montar cada pieza',()=>{
 const s=simulation(),base=s.scene.getObjectByName('baliza de campo'),mast=s.scene.getObjectByName('antena ensamblada');assert.equal(base.visible,false);ir(s,0,-.94);mando(s,[1.53,1.66,-.94],/kit/);assert.equal(s.scene.getObjectByName('maletín en mano').visible,true);assert.equal(s.scene.getObjectByName('kit de antena').visible,false);salir(s);vista(s,0,0,-9.2);assert.match(s.hud.prompt,/Anclar/);s.sim.interact();s.walk(0,0,1);assert.equal(base.visible,true);assert.ok(Math.abs(base.position.z+9.2)<.35);assert.equal(mast.visible,false);ir(s,base.position.x,base.position.z+1.25);mando(s,[base.position.x,base.position.y+.55,base.position.z],/Acoplar/);assert.equal(mast.parent,base);assert.equal(mast.visible,true);assert.match(s.hud.status,/sin enlace orbital/);s.sim.dispose()
})
test('movimiento x positivo va a la derecha y drag horizontal gira sin pointer lock',()=>{
  const {sim,camera,walk,canvas}=simulation();walk(1,0,.25);assert.ok(camera.position.x>.45);const fire=(type,x,y)=>{const e=new Event(type);Object.assign(e,{clientX:x,clientY:y,button:0,pointerId:1});canvas.dispatchEvent(e)};fire('pointerdown',0,0);fire('pointermove',120,20);assert.ok(camera.rotation.y<-.45);fire('pointerup',120,20);const last=camera.rotation.y;fire('pointermove',20,20);assert.equal(camera.rotation.y,last);sim.dispose()
})
