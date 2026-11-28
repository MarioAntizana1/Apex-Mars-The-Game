import test from 'node:test'
import assert from 'node:assert/strict'
import { probarMicrofono, conectarPermisoMicrofono, impedimentoMicrofono } from './microfono.js'
import { crearReconocedor } from './reconocedor.js'

const entorno = getUserMedia => ({SpeechRecognition: class {}, navigator: {mediaDevices: {getUserMedia}}})

test('la prueba explícita de permiso cierra todas las pistas sin iniciar reconocimiento', async () => {
  const cerradas = []
  const resultado = await probarMicrofono(entorno(async restricciones => {
    assert.deepEqual(restricciones, {audio:true})
    return {getTracks:()=>[1,2].map(i=>({stop:()=>cerradas.push(i)}))}
  }))
  assert.equal(resultado.ok, true); assert.deepEqual(cerradas,[1,2])
})

test('sin contexto seguro ni motor no pide permiso; denegación y fallo de entrada se distinguen', async () => {
  let llamadas = 0
  const e = entorno(async () => {llamadas++; throw Object.assign(new Error(), {name:'NotAllowedError'})})
  assert.match((await probarMicrofono({...e, isSecureContext:false})).mensaje, /HTTPS/)
  assert.match((await probarMicrofono({...e, SpeechRecognition:null})).mensaje, /no ofrece/)
  assert.equal(llamadas, 0)
  assert.match((await probarMicrofono(e)).mensaje, /denegado/)
  const fallo=entorno(async()=>{throw Object.assign(new Error(),{name:'NotReadableError'})})
  assert.match((await probarMicrofono(fallo)).mensaje, /comprueba la entrada/i)
})

for (const [prefijo, elegido] of [['opcion','ptt'], ['pausa','siempre']]) {
  test(`${prefijo}: activar voz solicita permiso en el gesto y el botón permite recuperarlo`, async () => {
    const nodos = new Map(), documento = {getElementById(id) {
      if (!nodos.has(id)) nodos.set(id, new EventTarget()); return nodos.get(id)
    }}
    let modo = 'apagada', llamadas = 0, resolver, cerradas = 0
    const e = Object.assign(new EventTarget(), entorno(() => {
      llamadas++
      return llamadas === 1 ? Promise.reject(Object.assign(new Error(), {name:'NotAllowedError'})) : new Promise(r=>resolver=r)
    }))
    const control = new AbortController()
    conectarPermisoMicrofono({documento, entorno:e, signal:control.signal, modo:()=>modo})
    const selector=nodos.get(`${prefijo}-voz`), boton=nodos.get(`${prefijo}-probar-micro`)
    assert.equal(llamadas,0); selector.value=elegido; selector.dispatchEvent(new Event('change')); modo=elegido
    assert.equal(llamadas,1); await new Promise(r=>setImmediate(r)); assert.match(impedimentoMicrofono(e),/denegado/)
    selector.dispatchEvent(new Event('change')); assert.equal(llamadas,1)
    boton.dispatchEvent(new Event('click')); boton.dispatchEvent(new Event('click')); assert.equal(llamadas,2)
    resolver({getTracks:()=>[{stop:()=>cerradas++}]}); await new Promise(r=>setImmediate(r))
    assert.equal(impedimentoMicrofono(e),''); assert.equal(cerradas,1); assert.equal(boton.disabled,false)
    control.abort()
  })
}

test('no anuncia escucha hasta onstart y recupera un bloqueo sólo tras reintento explícito', () => {
  const instancias=[], estados=[]
  class Motor { constructor(){ instancias.push(this) } start() {} abort() {} }
  const api=crearReconocedor({entorno:{SpeechRecognition:Motor},alEstado:e=>estados.push(e)})
  api.configurar({activo:true,modo:'siempre'})
  assert.equal(estados.at(-1).escuchando,false)
  instancias[0].onstart(); assert.equal(estados.at(-1).escuchando,true)
  instancias[0].onerror({error:'network'}); assert.match(estados.at(-1).mensaje,/conexión/)
  api.configurar({activo:false}); api.configurar({activo:true})
  assert.equal(instancias.length,1); assert.match(estados.at(-1).mensaje,/conexión/)
  api.configurar({activo:false}); api.reintentar(); assert.equal(instancias.length,1)
  api.configurar({activo:true}); assert.equal(instancias.length,2)
  api.dispose()
})
