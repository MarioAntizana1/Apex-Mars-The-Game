import test from 'node:test'
import assert from 'node:assert/strict'
import {crearMando,navegarMando} from './mando.js'

function banco(n=2){
  const pads=Array.from({length:n},(_,index)=>({index,mapping:'standard',axes:[0,0,0,0],buttons:Array(17).fill(0)}))
  const resultados={eje:[],mirar:[],turbo:[],freno:[],hablar:[],accion:[],disp:[]}, ventana=new EventTarget()
  const b={pads,ventana,...resultados,modo:'juego'}
  const registrar=k=>(...v)=>b[k].push(v.length===1?v[0]:v)
  const m=crearMando({obtenerPads:()=>pads,ventana,contexto:()=>b.modo,alEje:registrar('eje'),alMirar:registrar('mirar'),alTurbo:registrar('turbo'),alFreno:registrar('freno'),alHablar:registrar('hablar'),alAccion:registrar('accion'),alDispositivo:registrar('disp')})
  Object.assign(b,m,{tick:(dt=1/60)=>m.actualizar(dt),boton:(i,v=1,p=0)=>{pads[p].buttons[i]=v;b.tick()}});b.tick();return b
}

test('acciones de juego y de menú, sólo por flanco',()=>{
  const b=banco();for(const [modo,botones,ids] of [
    ['juego',[0,1,2,3,5,8,9],['usar','saltar','vehiculo','mapa','recentrar','guia','pausa']],
    ['menu',[0,1,8,9,12,13,14,15],['confirmar','volver','guia','pausa','arriba','abajo','izquierda','derecha']]
  ]){b.modo=modo;b.tick();b.accion.length=0;for(const i of botones){b.boton(i);b.tick();b.boton(i,0)}assert.deepEqual(b.accion,ids)}
})
test('zona muerta, avance positivo y mirada proporcional al tiempo',()=>{
  const b=banco(),p=b.pads[0];p.axes=[.08,-.1,0,.1];b.tick();assert.deepEqual([b.eje,b.mirar,b.disp],[[],[],[]]);p.axes=[0,-1,1,0];b.tick(.02);b.tick(.01);assert.deepEqual(b.eje,[[0,1]]);assert.deepEqual(b.mirar,[[18,0],[9,0]]);assert.equal(b.disp[0],true)
})
test('el último cambio dirige un solo jugador sin repetir botones al transferir',()=>{
  const b=banco(),[p,q]=b.pads;b.boton(0);q.axes[0]=1;b.tick();p.axes[1]=-1;b.tick();assert.deepEqual(b.accion,['usar']);assert.deepEqual(b.eje.slice(-2),[[1,0],[0,1]]);q.buttons[1]=1;b.tick();b.boton(0,0,0);assert.deepEqual(b.eje.at(-1),[1,0]);assert.deepEqual(b.accion,['usar','saltar'])
})
test('Gamepad.timestamp desempata cambios simultáneos',()=>{
  const b=banco(),[p,q]=b.pads;p.buttons[0]=q.buttons[1]=1;p.timestamp=22;q.timestamp=11;b.tick();assert.deepEqual(b.accion,['usar']);b.tick();assert.deepEqual(b.accion,['usar'])
})
test('transferencia no reabre un PTT retenido en el mando inactivo',()=>{
  const b=banco();b.boton(4);b.boton(1,1,1);b.boton(2);assert.deepEqual(b.hablar,[true,false]);b.boton(4,0);b.boton(4);assert.equal(b.hablar.at(-1),true)
})
test('menú neutraliza marcha/gatillos; LB se rearma tras soltar',()=>{
  const b=banco(),p=b.pads[0];p.axes[1]=-1;p.buttons[6]=.7;p.buttons[7]=1;b.boton(4);b.boton(0);b.modo='menu';b.tick();assert.deepEqual(b.accion,['usar']);assert.deepEqual(b.hablar,[true,false]);assert.deepEqual(b.turbo,[true,false]);assert.deepEqual(b.freno,[.7,0]);assert.deepEqual(b.eje,[[0,1],[0,0]]);b.boton(4,0);b.boton(4);assert.equal(b.hablar.at(-1),true);b.modo='bloqueado';b.tick();assert.equal(b.hablar.at(-1),false);b.boton(3);b.modo='juego';b.tick();assert.deepEqual(b.accion,['usar'])
})
test('desconexión, reconexión, reset y dispose no disparan flancos',()=>{
  const b=banco(),p=b.pads[0];p.buttons[7]=1;b.boton(0);b.pads[0]=null;b.ventana.dispatchEvent(Object.assign(new Event('gamepaddisconnected'),{gamepad:p}));assert.equal(b.turbo.at(-1),false);assert.equal(b.disp.at(-1),false);b.tick();b.pads[0]=p;b.tick();b.reset();b.tick();assert.deepEqual(b.accion,['usar']);b.boton(0,0);b.boton(0);b.dispose();b.boton(1);assert.deepEqual(b.accion,['usar','usar'])
})
test('sondeo tolera API no disponible y omite mandos sin mapeo estándar',()=>{
  const m=crearMando({obtenerPads(){throw Error('SecurityError')}});m.actualizar();m.reset();m.dispose();const b=banco(3);b.pads[2].buttons[0]=1;b.tick();assert.deepEqual(b.accion,[]);b.pads[0].mapping='';b.boton(0);assert.deepEqual(b.accion,[])
})
test('navegación omite controles ocultos y deshabilitados; select editable sin atrapar el foco',()=>{
  const doc={},el=(tagName='BUTTON')=>({tagName,tabIndex:0,matches(){return !!this.disabled},closest(){return this.hidden},getClientRects:()=>[{}],focus(){doc.activeElement=this},click(){this.clicked=true}})
  const a=el(),s=el('SELECT'),c=el(),oculto=el(),off=el();oculto.hidden=true;off.disabled=true;const raiz={ownerDocument:doc,querySelectorAll:()=>[a,oculto,off,s,c]},eventos=[];s.options=[el(),off,el()];s.selectedIndex=0;s.dispatchEvent=e=>eventos.push(e.type)
  const nav=id=>navegarMando(raiz,id);nav('abajo');assert.equal(doc.activeElement,a);nav('confirmar');assert.ok(a.clicked);nav('abajo');assert.equal(doc.activeElement,s);nav('derecha');assert.equal(s.selectedIndex,2);assert.deepEqual(eventos,['input','change']);nav('abajo');assert.equal(doc.activeElement,c);assert.equal(nav('volver'),false)
})
