import test from 'node:test'
import assert from 'node:assert/strict'
import { conectarOBC, tonoOBC } from './cabina-obc.js'

// La campaña real conecta los tres adaptadores al mismo estado. En estas pruebas
// sólo sustituimos los dispositivos: el ritual y el enrutado son los de juego.
function cabina(t, prefs = {voz:'siempre',idiomaVoz:'es-PE',mando:true,sonido:true}, opciones = {}) {
  const doc=new EventTarget(), ventana=new EventTarget(); doc.hasFocus=()=>true; doc.hidden=false
  const m={zona:'juego',ordenes:[],respuestas:[],pulsos:[],ajustes:[],voces:[],menus:[],estados:[],niveles:[],parciales:[],escuchas:[],medidorAbierto:0,medidorCerrado:0,dispone:{micro:0,mando:0,consola:0}}
  const sim={comando:id=>{m.ordenes.push(id);return {texto:id,tono:'ok'}},ejes(){},look(){},mandoTurbo(){},frenar(){},recentrar(){},saltar(){},jump(){},interact(){m.interaccion=true}}
  const obc=conectarOBC({sim,zona:()=>m.zona,raizMenu:()=>null,accionMenu:(z,id)=>{m.menus.push([z,id]);return true},cerrarMapa:()=>{m.zona='juego'}},{
    doc,ventana,preferencias:()=>({...prefs}),
    consolaHUD:cb=>{m.hud=cb;return {despertar:()=>m.despierto=true,responder:r=>m.respuestas.push(r),dispositivo(){},estado:e=>m.estados.push(e),silenciar:v=>m.voces.push(v),sonido(){},dispose(){m.dispone.consola++},
      nivel:(n,p)=>m.niveles.push([n,p]),escucha:v=>m.escuchas.push(v),parcial:t=>m.parciales.push(t)}},
    reconocimiento:cb=>{m.micro=cb;return {configurar:o=>m.ajustes.push(o),pulsar:v=>m.pulsos.push(v),dispose(){m.dispone.micro++}}},
    medidor:()=>({abrir:async()=>{m.medidorAbierto++;return 'activo'},cerrar:()=>{m.medidorCerrado++},leer:()=>({nivel:opciones.nivel ?? .6,pico:opciones.pico ?? .7,activo:opciones.activo ?? true}),motivo:()=>'',disponible:()=>true}),    controlador:cb=>{m.pad=cb;return {actualizar(){},reset(){},dispose(){m.dispone.mando++}}}
  }); t.after(()=>obc.dispose()); return {...m,m,obc,doc,ventana}
}

test('la voz armada abre el medidor y la tira recibe el nivel en cada cuadro', async t=>{
  const {m,obc}=cabina(t)
  await new Promise(r=>setImmediate(r))
  assert.ok(m.medidorAbierto>=1);assert.deepEqual(m.escuchas.at(-1),true)
  obc.actualizar(.016)
  assert.deepEqual(m.niveles.at(-1),[.6,.7])
  m.zona='pausa';obc.actualizar(.016);await new Promise(r=>setImmediate(r))
  assert.ok(m.medidorCerrado>=1);assert.deepEqual(m.escuchas.at(-1),false)
})

test('con la voz apagada no se abre el micrófono para medir', async t=>{
  const {m}=cabina(t,{voz:'apagada',idiomaVoz:'es-ES',mando:true,sonido:true})
  await new Promise(r=>setImmediate(r))
  assert.equal(m.medidorAbierto,0);assert.deepEqual(m.escuchas.at(-1),false)
})

test('el aviso de silencio sólo aparece al hablar sin señal y no se queda pegado', async t=>{
  const {m,obc,ventana}=cabina(t,undefined,{nivel:0})
  await new Promise(r=>setImmediate(r))
  // En «Siempre escuchando» el silencio es lo normal: no hay aviso.
  for(let i=0;i<300;i++)obc.actualizar(.016)
  assert.equal(m.estados.filter(e=>/Silencio en el micrófono/.test(e.mensaje)).length,0)
  // Con F pulsado y sin señal avisa una sola vez, por mucho que se mantenga.
  ventana.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyF'}))
  for(let i=0;i<400;i++)obc.actualizar(.016)
  assert.equal(m.estados.filter(e=>/Silencio en el micrófono/.test(e.mensaje)).length,1)
})

test('cuando vuelve la señal el aviso desaparece del estado', async t=>{
  let nivel=.0
  const {m,obc,ventana}=cabina(t,undefined,{get nivel(){return nivel}})
  await new Promise(r=>setImmediate(r))
  ventana.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyF'}))
  for(let i=0;i<300;i++)obc.actualizar(.016)
  const aviso=m.estados.findLast(e=>/Silencio en el micrófono/.test(e.mensaje))
  assert.ok(aviso)
  nivel=.5
  obc.actualizar(.016)
  const ultimo=m.estados.at(-1)
  assert.equal(ultimo.mensaje,undefined); assert.equal(ultimo.escuchando,true)
  nivel=0
  for(let i=0;i<300;i++)obc.actualizar(.016)
  // Un nuevo silencio tras hablar vuelve a avisar: es otro episodio.
  assert.equal(m.estados.filter(e=>/Silencio en el micrófono/.test(e.mensaje)).length,2)
})

test('si el navegador no comparte el micrófono se retira la tira y la voz sigue', async t=>{
  const {m,obc}=cabina(t)
  await new Promise(r=>setImmediate(r))
  const cerradosAntes=m.medidorCerrado
  m.micro.alEstado({error:true,escuchando:false,mensaje:'No se puede abrir el micrófono. Comprueba la entrada y si está en uso. Puedes escribir la orden.'})
  assert.ok(m.medidorCerrado>cerradosAntes)
  assert.match(m.estados.at(-1).mensaje,/tira de nivel se retira/i)
  m.zona='pausa';obc.actualizar(.016);m.zona='juego';obc.actualizar(.016)
  await new Promise(r=>setImmediate(r))
  assert.equal(m.medidorAbierto,cerradosAntes>0?m.medidorAbierto:1) // no se reabre
  assert.equal(m.escuchas.at(-1),false)
})

test('voz y consola escrita comparten destino y respetan pausa, mapa y cierre',t=>{
  const {m,obc}=cabina(t)
  m.micro.alTexto('Dame diagnóstico de nave',{directo:false});assert.deepEqual(m.ordenes,[])
  m.micro.alTexto('Nostrosmo',{directo:false});assert.equal(m.despierto,true)
  m.micro.alTexto('Dame diagnóstico de nave',{directo:false});m.hud.alEnviar('estado del traje');assert.deepEqual(m.ordenes,['diagnostico','traje'])
  m.zona='pausa';obc.actualizar(.016);assert.equal(m.ajustes.at(-1).activo,false);m.micro.alTexto('despliega el rover',{directo:true});m.pad.alAccion('confirmar');assert.deepEqual(m.menus,[['pausa','confirmar']]);assert.equal(m.ordenes.length,2)
  m.zona='mapa';obc.actualizar(.016);assert.equal(m.ajustes.at(-1).modo,'ptt');m.hud.alEnviar('despliega el rover');assert.equal(m.ordenes.length,2);m.hud.alEnviar('cierra el mapa');assert.equal(m.zona,'juego');assert.match(m.respuestas.at(-1).texto,/cerrada/)
  m.hud.alEnviar('silencio');m.hud.alEnviar('habla');assert.deepEqual(m.voces,[true,false]);m.pad.alAccion('usar');assert.ok(m.interaccion)
  obc.dispose();m.micro.alTexto('Nostromo, estado del traje',{directo:true});assert.equal(m.ordenes.length,4)
})

test('F y LB se agregan, la locución no puede darse órdenes a sí misma', t=>{
  const {m,obc,ventana}=cabina(t); m.pulsos.length=0
  const f=tipo=>ventana.dispatchEvent(Object.assign(new Event(tipo),{code:'KeyF'}))
  f('keydown');m.pad.alHablar(true);f('keyup');assert.deepEqual(m.pulsos,[true]);m.pad.alHablar(false);assert.deepEqual(m.pulsos,[true,false])
  m.hud.alVozHablada(true);m.micro.alTexto('Nostromo, apaga las luces',{directo:true});assert.deepEqual(m.ordenes,[]);assert.equal(m.ajustes.at(-1).activo,false)
  m.hud.alVozHablada(false);assert.equal(m.ajustes.at(-1).activo,true);ventana.dispatchEvent(new Event('blur'));obc.actualizar(.016);assert.equal(m.ajustes.at(-1).activo,true)
})

test('perder el foco no silencia la escucha ni descarta la frase en camino', t=>{
  const {m,obc,ventana}=cabina(t)
  ventana.dispatchEvent(new Event('blur'));obc.actualizar(.016)
  assert.equal(m.ajustes.at(-1).activo,true);assert.equal(m.ajustes.at(-1).modo,'siempre')
  m.micro.alTexto('Nostromo, estado del traje',{directo:true});assert.deepEqual(m.ordenes,['traje'])
  ventana.dispatchEvent(new Event('focus'));ventana.dispatchEvent(new Event('blur'))
  m.micro.alTexto('abre el mapa',{directo:true});assert.deepEqual(m.ordenes,['traje','abrirMapa'])
})

test('F sin code se reanuda al acabar la locución y el blur suelta la pulsación', t=>{
  const {m,ventana}=cabina(t,{voz:'ptt',mando:true})
  const f=tipo=>ventana.dispatchEvent(Object.assign(new Event(tipo),{key:'F'}))
  m.hud.alVozHablada(true); f('keydown'); m.hud.alVozHablada(false); assert.equal(m.pulsos.at(-1),true)
  m.hud.alVozHablada(true); f('keyup'); m.hud.alVozHablada(false); assert.equal(m.pulsos.at(-1),false)
  f('keydown'); assert.equal(m.pulsos.at(-1),true)
  ventana.dispatchEvent(new Event('blur')); assert.equal(m.pulsos.at(-1),false)
  m.micro.alTexto('estado del traje',{directo:true}); assert.deepEqual(m.ordenes,['traje'])
})

test('la voz nace apagada y el cierre libera micrófono, consola y mando', t=>{
  const {m,obc}=cabina(t,{voz:'apagada',idiomaVoz:'es-ES',mando:true,sonido:true})
  assert.equal(m.ajustes.at(-1).modo,'apagada')
  m.hud.alEnviar('estado del traje');assert.deepEqual(m.ordenes,['traje'])
  obc.dispose()
  assert.deepEqual(m.dispone,{micro:1,mando:1,consola:1})
})


test('los avisos del OBC son sintetizados y sobreviven sin audio', () => {
  assert.doesNotThrow(() => tonoOBC(null, null, 'barrido'))
  const osciladores = []
  const audio = {
    state: 'running', currentTime: 1.5,
    createOscillator() {
      const o = { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(n) { return n }, disconnect() {}, start(t) { this.inicio = t }, stop(t) { this.fin = t } }
      osciladores.push(o); return o
    },
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } },
  }
  const salida = {}
  tonoOBC(audio, salida, 'barrido')
  assert.equal(osciladores.length, 3)
  assert.ok(osciladores.every(o => o.type === 'sine' && o.inicio >= 1.5 && o.fin > o.inicio))
  osciladores.length = 0; tonoOBC(audio, salida, 'negativa')
  assert.equal(osciladores.length, 2); assert.ok(osciladores.every(o => o.type === 'triangle'))
  osciladores.length = 0; tonoOBC(audio, salida, 'confirmar'); assert.equal(osciladores.length, 2)
  osciladores.length = 0; tonoOBC(audio, salida, 'info'); assert.equal(osciladores.length, 1)
})
