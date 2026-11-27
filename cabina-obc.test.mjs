import test from 'node:test'
import assert from 'node:assert/strict'
import { conectarOBC, tonoOBC } from './cabina-obc.js'

// La campaña real conecta los tres adaptadores al mismo estado. En estas pruebas
// sólo sustituimos los dispositivos: el ritual y el enrutado son los de juego.
function cabina(t, prefs = {voz:'siempre',idiomaVoz:'es-PE',mando:true,sonido:true}) {
  const doc=new EventTarget(), ventana=new EventTarget(); doc.hasFocus=()=>true; doc.hidden=false
  const m={zona:'juego',ordenes:[],respuestas:[],pulsos:[],ajustes:[],voces:[],menus:[],estados:[],dispone:{micro:0,mando:0,consola:0}}
  const sim={comando:id=>{m.ordenes.push(id);return {texto:id,tono:'ok'}},ejes(){},look(){},mandoTurbo(){},frenar(){},recentrar(){},saltar(){},jump(){},interact(){m.interaccion=true}}
  const obc=conectarOBC({sim,zona:()=>m.zona,raizMenu:()=>null,accionMenu:(z,id)=>{m.menus.push([z,id]);return true},cerrarMapa:()=>{m.zona='juego'}},{
    doc,ventana,preferencias:()=>({...prefs}),
    consolaHUD:cb=>{m.hud=cb;return {despertar:()=>m.despierto=true,responder:r=>m.respuestas.push(r),dispositivo(){},estado:e=>m.estados.push(e),silenciar:v=>m.voces.push(v),sonido(){},dispose(){m.dispone.consola++}}},
    reconocimiento:cb=>{m.micro=cb;return {configurar:o=>m.ajustes.push(o),pulsar:v=>m.pulsos.push(v),dispose(){m.dispone.micro++}}},
    controlador:cb=>{m.pad=cb;return {actualizar(){},reset(){},dispose(){m.dispone.mando++}}}
  }); t.after(()=>obc.dispose()); return {...m,m,obc,doc,ventana}
}

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
  m.hud.alVozHablada(false);assert.equal(m.ajustes.at(-1).activo,true);ventana.dispatchEvent(new Event('blur'));obc.actualizar(.016);assert.equal(m.ajustes.at(-1).activo,false)
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
