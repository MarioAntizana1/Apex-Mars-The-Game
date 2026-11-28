import test from 'node:test'
import assert from 'node:assert/strict'
import { crearReconocedor } from './reconocedor.js'

function banco(disponible = 'available') {
  const instancias = [], textos = [], estados = [], parciales = []
  class Motor {
    static async available({langs,processLocally}) { assert.deepEqual(langs,['es-ES']); assert.equal(processLocally,true); return disponible }
    processLocally = false
    constructor() { instancias.push(this) }
    start() { this.inicios = 1; this.onstart() }
    abort() { this.abortado = true }
    stop() { this.parado = true }
  }
  const api = crearReconocedor({ entorno: {webkitSpeechRecognition:Motor}, alTexto:(...args)=>textos.push(args), alParcial:t=>parciales.push(t), alEstado:e=>estados.push(e) })
  const final = (texto,isFinal=true) => ({resultIndex:0,results:[{0:{transcript:texto},isFinal}]})
  return {api,instancias,textos,parciales,estados,final}
}
const ciclo = () => new Promise(resolve=>setImmediate(resolve))

test('lo que se oye se publica como parcial y se retira al cerrar la frase', async t => {
  const {api,instancias,parciales,textos,final}=banco(); t.after(()=>api.dispose())
  api.configurar({activo:true,modo:'siempre'}); await ciclo()
  instancias[0].onresult(final('nostro',false))
  assert.equal(parciales.at(-1),'nostro'); assert.deepEqual(textos,[])
  instancias[0].onresult(final('Nostromo, estado del traje'))
  assert.equal(parciales.at(-1),''); assert.equal(textos.at(-1)[0],'Nostromo, estado del traje')
  assert.equal(instancias[0].interimResults,true)
  instancias[0].onend(); assert.equal(parciales.at(-1),'')
})

test('el estado PTT distingue solicitud, inicio y captura real', async t => {
  const {api,instancias,estados}=banco(); t.after(()=>api.dispose())
  api.configurar({modo:'ptt',activo:true}); api.pulsar(true)
  assert.equal(estados.at(-1).directo,true); assert.equal(estados.at(-1).escuchando,false)
  await ciclo(); assert.equal(estados.at(-1).escuchando,true)
  instancias[0].onaudiostart(); assert.match(estados.at(-1).mensaje,/captura de audio/i); assert.equal(estados.at(-1).directo,true)
})

test('una pulsación nueva permite reintentar red o entrada sin bucles automáticos', async t => {
  for(const error of ['network','audio-capture']) {
    const {api,instancias}=banco(); t.after(()=>api.dispose())
    api.configurar({activo:true,modo:'ptt'}); api.pulsar(true); await ciclo()
    const fin=instancias[0].onend; instancias[0].onerror({error}); fin()
    api.configurar({activo:false}); api.configurar({activo:true}); assert.equal(instancias.length,1)
    api.pulsar(true); await ciclo(); assert.equal(instancias[1]?.inicios,1)
  }
})

test('un idioma rechazado cae al español base y lo anuncia sin quedarse mudo', async t => {
  const {api,instancias,estados}=banco(); t.after(()=>api.dispose())
  api.configurar({activo:true,modo:'siempre',idioma:'es-PE'}); await ciclo()
  assert.equal(instancias[0].lang,'es-PE')
  instancias[0].onerror({error:'language-not-supported'})
  await ciclo(); await ciclo()
  assert.equal(instancias[1]?.lang,'es-ES')
  assert.match(estados.map(e=>e.mensaje).join(' '),/es-PE.*es-ES/i)
  assert.equal(estados.at(-1).error,false)
})

test('un idioma ya rechazado no se reintenta al volver a la escucha', async t => {
  const {api,instancias}=banco(); t.after(()=>api.dispose())
  api.configurar({activo:true,modo:'siempre',idioma:'es-PE'}); await ciclo()
  instancias[0].onerror({error:'language-not-supported'}); await ciclo(); await ciclo()
  api.configurar({activo:false}); api.configurar({activo:true})
  await ciclo(); await ciclo()
  const ultima=instancias.at(-1)
  assert.equal(ultima.lang,'es-ES')
})

test('un idioma rechazado no bloquea el idioma de reemplazo', async t => {
  const {api,instancias}=banco(); t.after(()=>api.dispose())
  api.configurar({activo:true,modo:'siempre'}); await ciclo(); instancias[0].onerror({error:'language-not-supported'})
  api.configurar({idioma:'es-PE'}); await ciclo(); assert.equal(instancias[1]?.lang,'es-PE'); assert.equal(instancias[1].inicios,1)
})

test('PTT espera la pulsación, usa paquete local, conserva el final al soltar', async () => {
  const {api,instancias,textos,final} = banco()
  api.configurar({modo:'ptt',activo:true}); assert.equal(instancias.length,0)
  api.pulsar(true); await ciclo(); const [rec] = instancias
  assert.equal(rec.processLocally,true); assert.equal(rec.lang,'es-ES')
  rec.onresult(final('prueba',false)); api.pulsar(false); assert.ok(rec.parado)
  rec.onresult(final(' mapa ')); rec.onresult(final(' mapa ')); rec.onend(); assert.deepEqual(textos,[['mapa',{directo:true}]])
  api.dispose()
})
test('servicio del navegador sin paquete; suspender o salir invalida eventos guardados', async () => {
  const {api,instancias,textos,final} = banco('downloadable')
  api.configurar({activo:true,modo:'siempre'}); await ciclo(); const [rec] = instancias
  assert.equal(rec.processLocally,false); rec.onresult(final('Nostromo')); const tardio = rec.onresult
  api.configurar({activo:false}); tardio(final('mapa')); assert.ok(rec.abortado)
  api.configurar({activo:true}); await ciclo(); const otro = instancias[1].onresult
  api.dispose(); otro(final('estado')); assert.deepEqual(textos,[['Nostromo',{directo:false}]])
})
test('denegar permiso bloquea reintentos incluso tras recuperar el foco', async () => {
  const {api,instancias,estados} = banco()
  api.configurar({modo:'siempre',activo:true}); await ciclo(); const [rec] = instancias, fin = rec.onend
  rec.onerror({error:'not-allowed'}); fin(); assert.match(estados.at(-1).mensaje,/denegado/)
  api.configurar({activo:false}); api.configurar({activo:true}); api.pulsar(true)
  assert.equal(instancias.length,1); api.dispose()
})
test('sin Web Speech informa alternativa escrita; cancelar mientras consulta paquete no enciende micro', async () => {
  const estados=[]; const sin = crearReconocedor({entorno:{},alEstado:e=>estados.push(e)})
  sin.configurar({modo:'siempre',activo:true}); assert.match(estados.at(-1).mensaje,/escribir/); sin.dispose()
  const {api,instancias} = banco(); api.configurar({modo:'ptt',activo:true}); api.pulsar(true); api.pulsar(false)
  await ciclo(); assert.equal(instancias[0].inicios,undefined); api.dispose()
})
