import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from './vendor/three/three.module.min.js'
import {crearEsclusa} from './historia-esclusa.js'

function cabina(){
  const world=new T.Group(),hatch=new T.Object3D(),door=new T.Group(),p={x:0,z:-1.3},mensajes=[]
  const e=crearEsclusa(T,world,{hatch,door,position:()=>p,notify:m=>mensajes.push(m)})
  const mando=id=>e.actions.find(a=>a.id==='esclusa-'+id)
  function usar(id){const a=mando(id);assert.ok(a.active(),`cara visible: ${id}`);assert.ok(Math.hypot(a.pt[0]-p.x,a.pt[1]-2.1,a.pt[2]-p.z)<=a.range,`alcance físico: ${id}`);a.run()}
  function avanzar(z){for(let i=0;Math.abs(z-p.z)>.001&&i<2000;i++){const nz=p.z+Math.sign(z-p.z)*Math.min(.02,Math.abs(z-p.z));if(!e.permite(p.x,nz))return false;p.z=nz}return true}
  function tiempo(t){for(let i=0;i<Math.ceil(t*100);i++){e.update(.01);const s=e.estado();assert.ok(s.interior===0||s.exterior===0);if(s.ciclo)assert.equal(s.interior+s.exterior,0)}}
  return {e,world,hatch,door,p,mensajes,mando,usar,avanzar,tiempo}
}
test('ida y vuelta por las dos puertas, también tras una espera prolongada en Marte',()=>{
  const {e,hatch,door,p,usar,avanzar,tiempo}=cabina()
  assert.ok(!avanzar(-3));p.z=-1.3;usar('aCab');tiempo(.4);assert.ok(!e.permite(0,-2.12));tiempo(.5);assert.ok(avanzar(-3.02));tiempo(60);assert.equal(e.estado().interior,1)
  usar('aCam');tiempo(.9);usar('aire');tiempo(2);assert.ok(e.estado().presion>49&&e.estado().presion<52);assert.match(e.resumen(),/despresurizando/)
  tiempo(2.1);assert.equal(e.estado().presion,.6);assert.equal(e.estado().exterior,0);usar('bCam');tiempo(.5);assert.ok(!e.permite(0,-4.03));assert.ok(hatch.position.x<0);assert.equal(hatch.position.x,door.position.x);tiempo(.4);assert.ok(avanzar(-4.90));usar('bMar');tiempo(90);assert.equal(e.estado().exterior,0)
  usar('bMar');tiempo(.9);assert.ok(avanzar(-3.02));usar('bCam');tiempo(.9);usar('aire');tiempo(2);assert.match(e.resumen(),/presurizando/);tiempo(2.1);assert.equal(e.estado().presion,101);usar('aCam');tiempo(.9);assert.ok(avanzar(-1.30));usar('aCab');tiempo(.9);assert.deepEqual(e.estado(),{interior:0,exterior:0,ciclo:null,presion:101})
})
test('sensores de umbral, enclavamiento desde la primera orden hasta el sello y veto por presión',()=>{
  const {e,p,usar,avanzar,tiempo,mensajes}=cabina();usar('aCab');tiempo(1);avanzar(-2.18);usar('aCam');assert.match(mensajes.at(-1),/Umbral ocupado/);assert.ok(e.permite(0,-2.12));avanzar(-3.02)
  usar('aire');assert.equal(e.estado().ciclo,null);usar('bCam');assert.match(mensajes.at(-1),/Interbloqueo/);usar('aCam');assert.ok(!e.permite(0,-2.12));usar('bCam');assert.match(mensajes.at(-1),/Interbloqueo/);tiempo(.86);usar('aire');assert.equal(e.estado().ciclo,null);tiempo(.02);usar('bCam');assert.match(mensajes.at(-1),/incompatible/)
  usar('aire');usar('aCam');assert.match(mensajes.at(-1),/en curso/);usar('aire');tiempo(4.1);usar('aCam');assert.match(mensajes.at(-1),/incompatible/);usar('bCam');tiempo(1);avanzar(-4.09);usar('bMar');assert.match(mensajes.at(-1),/Umbral ocupado/);assert.equal(e.estado().exterior,1)
})
test('caras seleccionables y modelo físico; esperar nunca arranca un ciclo ni mueve una puerta',()=>{
  const {e,world,mando,p,tiempo}=cabina();const activos=()=>e.actions.filter(a=>a.active()).map(a=>a.id)
  assert.deepEqual(activos(),['esclusa-aCab']);p.z=-3.02;assert.equal(activos().length,3);mando('bMar').run();p.z=-4.90;assert.deepEqual(activos(),['esclusa-bMar']);tiempo(10);assert.equal(e.estado().presion,101);assert.equal(e.estado().interior+e.estado().exterior,0);assert.ok(world.getObjectByName('Hoja interior derecha'));assert.ok(world.getObjectByName('Control de presión'));assert.match(e.resumen(),/101 kPa.*A sellada \/ B sellada/)
})
