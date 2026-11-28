import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnosticarSenal, probarMicrofono, conectarPermisoMicrofono } from './microfono.js'
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

test('un fallo de entrada no impide dar órdenes; sólo la denegación bloquea el motor', async () => {
  const armar = async (nombre) => {
    const nodos = new Map(), documento = {getElementById(id) {
      if (!nodos.has(id)) nodos.set(id, new EventTarget()); return nodos.get(id)
    }}
    const e = Object.assign(new EventTarget(), entorno(async () => {
      if (nombre) throw Object.assign(new Error(), {name:nombre})
      return {getTracks:()=>[{stop(){}}]}
    }))
    const control = new AbortController()
    conectarPermisoMicrofono({documento, entorno:e, signal:control.signal, modo:()=>'apagada'})
    nodos.get('opcion-probar-micro').dispatchEvent(new Event('click'))
    await new Promise(r=>setImmediate(r)); await new Promise(r=>setImmediate(r))
    control.abort()
    return { e, salida: nodos.get('opcion-estado-micro').textContent }
  }
  const ocupado = await armar('NotReadableError')
  assert.match(ocupado.salida, /comprueba la entrada/i)
  const denegado = await armar('NotAllowedError')
  assert.match(denegado.salida, /denegado/i)
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
    const selector=nodos.get(`${prefijo}-voz`), boton=nodos.get(`${prefijo}-probar-micro`), salida=nodos.get(`${prefijo}-estado-micro`)
    assert.equal(llamadas,0); selector.value=elegido; selector.dispatchEvent(new Event('change')); modo=elegido
    assert.equal(llamadas,1); await new Promise(r=>setImmediate(r)); assert.match(salida.textContent,/denegado/i)
    selector.dispatchEvent(new Event('change')); assert.equal(llamadas,1)
    boton.dispatchEvent(new Event('click')); boton.dispatchEvent(new Event('click')); assert.equal(llamadas,2)
    resolver({getTracks:()=>[{stop:()=>cerradas++}]}); await new Promise(r=>setImmediate(r))
    assert.match(salida.textContent,/confirmado/i); assert.equal(cerradas,1); assert.equal(boton.disabled,false)
    control.abort()
  })
}

// Reloj manual y muestras en el dominio temporal, sin hardware ni esperas de 4 s.
const turno = () => new Promise(r => setImmediate(r))
function banco() {
  const b = { timers: new Map(), paradas:0, cierres:0, desconexiones:0, caso:'silencio',
    pista:{label:'USB de prueba', enabled:true, stop:() => b.paradas++} }
  const flujo = {getAudioTracks:()=>[b.pista], getTracks:()=>[b.pista]}
  const nodo = () => ({disconnect:()=>b.desconexiones++})
  const timer = (fn, ms) => { b.timers.set(ms, fn); return ms }
  b.e = Object.assign(new EventTarget(), {navigator:{mediaDevices:{getUserMedia:async()=>flujo}},
    setInterval:timer, setTimeout:timer, clearInterval:k=>b.timers.delete(k), clearTimeout:k=>b.timers.delete(k),
    AudioContext:class {
      state='running'; close=async()=>{b.cierres++}
      createMediaStreamSource=()=>({...nodo(),connect:a=>assert.equal(a,b.analizador)})
      createAnalyser=()=> b.analizador = {...nodo(),getFloatTimeDomainData(datos){
        if (b.caso==='error') throw new Error('dispositivo perdido')
        for(let i=0;i<datos.length;i++) datos[i] = b.caso==='tono' ? .07*Math.sin(i) : .05
      }}
    }})
  return {b, flujo}
}
function limpio(b) {
  assert.equal(b.paradas,1); assert.equal(b.cierres,1); assert.equal(b.timers.size,0)
}
for (const tono of [true,false]) test(`diagnóstico sin Web Speech: ${tono?'tono y luego silencio':'sólo silencio'}`, async()=>{
  const {b}=banco(), estados=[]
  const fin=diagnosticarSenal(b.e,{alEstado:t=>estados.push(t)})
  await turno(); assert.match(estados.at(-1),/USB de prueba.*Silencio/)
  if(tono){ b.caso='tono'; b.timers.get(50)(); assert.match(estados.at(-1),/Señal audible/)
    b.pista.muted=true; b.timers.get(50)(); assert.match(estados.at(-1),/Silencio/) }
  b.timers.get(4000)(); assert.match(await fin,tono?/Se detectó señal audible/:/no se detectó señal audible/)
  limpio(b); assert.equal(b.desconexiones,2)
})
test('un fallo de lectura termina y libera la captura sin anunciar silencio',async()=>{
  const {b}=banco(), fin=diagnosticarSenal(b.e); await turno()
  b.caso='error'; b.timers.get(50)(); assert.match(await fin,/No se pudo medir/); limpio(b)
})
test('una concesión tardía después de cancelar también libera su pista',async()=>{
  const {b,flujo}=banco(), control=new AbortController(); let entregar
  b.e.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>entregar=r)
  const fin=diagnosticarSenal(b.e,{signal:control.signal}); control.abort()
  assert.match(await fin,/cancelada/); assert.equal(b.cierres,1)
  entregar(flujo); await turno(); limpio(b); assert.equal(b.desconexiones,0)
})
for (const p of ['opcion','pausa']) test(`${p}: diagnóstico manual independiente del permiso y cancelable`,async()=>{
  const {b}=banco(), control=new AbortController(), nodos=new Map()
  const documento=Object.assign(new EventTarget(),{getElementById(id){
    if(!nodos.has(id)) nodos.set(id,new EventTarget()); return nodos.get(id)
  }})
  let reintentos=0; b.e.addEventListener('apex:micro-comprobado',()=>reintentos++)
  conectarPermisoMicrofono({documento,entorno:b.e,signal:control.signal,modo:()=>'apagada'})
  const boton=nodos.get(`${p}-probar-senal`), salida=nodos.get(`${p}-estado-senal`)
  boton.dispatchEvent(new Event('click')); await turno(); assert.match(salida.textContent,/Silencio/)
  boton.dispatchEvent(new Event('click')); await turno(); assert.match(salida.textContent,/cancelada/)
  limpio(b); assert.equal(reintentos,0); control.abort()
})

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
