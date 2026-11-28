import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { crearConsola, paginar, textoDeItem } from './consola.js'
import { conectarOBC } from './cabina-obc.js'
import { guardarPreferencias, leerPreferencias } from './preferencias.js'

class Evento {
  constructor(tipo, init = {}) {
    this.type = tipo; this.target = init.target ?? null; this.detail = init.detail
    this.defaultPrevented = false; this.propagacion = false
    this.key = init.key; this.code = init.code
  }
  preventDefault() { this.defaultPrevented = true }
  stopPropagation() { this.propagacion = true }
}
class ClaseLista {
  constructor() { this.set = new Set() }
  add(...c) { for (const x of c) this.set.add(x) }
  remove(...c) { for (const x of c) this.set.delete(x) }
  contains(c) { return this.set.has(c) }
}
class Nodo {
  constructor(id = '') {
    this.id = id; this.hidden = false; this.textContent = ''; this.value = ''; this.checked = false
    this.open = false; this.type = ''; this.disabled = false; this.dataset = {}; this.atributos = new Map()
    this.hijos = []; this.oyentes = new Map(); this.classList = new ClaseLista()
    this.style = { setProperty() {} }; this.dueno = null; this.nodeType = 1
  }
  get children() { return this.hijos }
  appendChild(nodo) { this.hijos.push(nodo); nodo.dueno = this.dueno; return nodo }
  addEventListener(tipo, fn, opciones = {}) {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, [])
    this.oyentes.get(tipo).push({ fn, opciones })
  }
  removeEventListener(tipo, fn) {
    const lista = this.oyentes.get(tipo)
    if (lista) this.oyentes.set(tipo, lista.filter(o => o.fn !== fn))
  }
  dispatchEvent(evento) {
    if (!evento.target) { try { evento.target = this } catch { /* Event nativo: target es de sólo lectura */ } }
    for (const { fn, opciones } of [...(this.oyentes.get(evento.type) ?? [])]) {
      if (opciones?.signal?.aborted) continue
      fn.call(this, evento)
    }
    return !evento.defaultPrevented
  }
  setAttribute(nombre, valor) { this.atributos.set(nombre, String(valor)) }
  getAttribute(nombre) { return this.atributos.get(nombre) ?? null }
  removeAttribute(nombre) { this.atributos.delete(nombre) }
  querySelector() { return null }
  querySelectorAll() { return [] }
  focus() { if (this.dueno) this.dueno.activeElement = this }
  select() {}
  showModal() { this.open = true }
  close() { this.open = false; this.dispatchEvent(new Evento('close')) }
}
class Documento {
  constructor() { this.nodos = new Map(); this.activeElement = null; this.oyentes = new Map(); this.lienzo = new Nodo('canvas') }
  registrar(id, tipo = '') { const nodo = new Nodo(id); nodo.type = tipo; nodo.dueno = this; this.nodos.set(id, nodo); return nodo }
  getElementById(id) { return this.nodos.get(id) ?? null }
  createElement() { const nodo = new Nodo(); nodo.dueno = this; return nodo }
  querySelector(selector) { return String(selector).includes('canvas') ? this.lienzo : null }
  querySelectorAll() { return [] }
  contains(nodo) { return [...this.nodos.values()].includes(nodo) || nodo === this.lienzo }
  addEventListener(tipo, fn, opciones = {}) {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, [])
    this.oyentes.get(tipo).push({ fn, opciones })
  }
  removeEventListener(tipo, fn) {
    const lista = this.oyentes.get(tipo)
    if (lista) this.oyentes.set(tipo, lista.filter(o => o.fn !== fn))
  }
  dispatchEvent(evento) {
    if (!evento.target) { try { evento.target = this } catch { /* Event nativo: target es de sólo lectura */ } }
    for (const { fn, opciones } of [...(this.oyentes.get(evento.type) ?? [])]) {
      if (opciones?.signal?.aborted) continue
      fn.call(this, evento)
    }
    return !evento.defaultPrevented
  }
}

const IDS = [
  'obc', 'obc-estado', 'obc-texto', 'obc-kitt', 'obc-ayuda', 'obc-micro', 'obc-editor', 'obc-editor-form', 'obc-entrada',
  'obc-voz',
  'obc-abrir', 'tablet-obc', 'obc-cerrar-editor', 'obc-nav', 'obc-pagina-prev', 'obc-pagina-next', 'obc-pagina',
  'eva', 'eva-vehiculo', 'eva-mapa', 'eva-uso', 'eva-ayuda',
  'opcion-voz', 'opcion-idioma-voz', 'opcion-voz-hablada', 'opcion-mando',
  'pausa-voz', 'pausa-idioma-voz', 'pausa-voz-hablada', 'pausa-mando',
]
const TIPOS = {
  'opcion-voz': 'select-one', 'pausa-voz': 'select-one', 'opcion-idioma-voz': 'select-one', 'pausa-idioma-voz': 'select-one',
  'opcion-voz-hablada': 'checkbox', 'pausa-voz-hablada': 'checkbox', 'opcion-mando': 'checkbox', 'pausa-mando': 'checkbox',
}

function montar(t) {
  const documento = new Documento()
  const ventana = new Nodo('ventana')
  for (const id of IDS) documento.registrar(id, TIPOS[id] ?? '')
  documento.getElementById('obc-entrada').type = 'text'
  documento.getElementById('obc').hidden = true
  const vehiculo = documento.getElementById('eva-vehiculo'), mapa = documento.getElementById('eva-mapa')
  vehiculo.textContent = 'Desplegar vehículo · V'
  mapa.textContent = 'Tablet · M'
  const ayudaJuego = documento.getElementById('eva-ayuda')
  ayudaJuego.textContent = 'WASD mover · E usar'
  const tonos = [], enviados = [], ajustes = [], hablados = [], pulsos = [], voz = []
  ventana.speechSynthesis = { cancel() {}, speak(u) { hablados.push(u) } }
  ventana.SpeechSynthesisUtterance = class { constructor(texto) { this.text = texto } }
  const anteriorLocal = globalThis.localStorage
  const anteriorDispatch = globalThis.dispatchEvent
  const datos = new Map()
  globalThis.localStorage = { getItem: k => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)) }
  globalThis.dispatchEvent = evento => ventana.dispatchEvent(evento)
  const consola = crearConsola({
    alEnviar: texto => enviados.push(texto), alPulsar: activo => pulsos.push(activo),
    alAjustar: prefs => ajustes.push(prefs), alTono: tipo => tonos.push(tipo),
    alVozHablada: activo => voz.push(activo), documento, ventana,
  })
  t.after(() => {
    consola.dispose()
    guardarPreferencias({ voz: 'apagada', idiomaVoz: 'es-ES', vozHablada: false, mando: true })
    if (anteriorLocal === undefined) delete globalThis.localStorage
    else globalThis.localStorage = anteriorLocal
    if (anteriorDispatch === undefined) delete globalThis.dispatchEvent
    else globalThis.dispatchEvent = anteriorDispatch
  })
  const $ = id => documento.getElementById(id)
  return { documento, ventana, consola, $, ayudaJuego, vehiculo, mapa, tonos, enviados, ajustes, hablados, pulsos, voz }
}

test('despertar muestra la consola, barre la tira y pide el barrido', t => {
  const e = montar(t)
  assert.equal(e.$('obc').hidden, true)
  e.consola.despertar()
  assert.equal(e.$('obc').hidden, false)
  assert.ok(e.$('obc-kitt').classList.contains('activo'))
  assert.equal(e.$('obc-kitt').children.length, 15) // 14 segmentos + la luz que barre
  assert.deepEqual(e.tonos, ['barrido'])
  assert.equal(e.$('obc-estado').textContent, 'En línea')
})

test('responder pinta el tono, el tipo y llama al efecto correcto', t => {
  const e = montar(t)
  const salida = e.consola.responder({ texto: 'Diagnóstico APEX-04: casco estanco.', tono: 'ok' })
  assert.deepEqual(salida, { tipo: 'texto' })
  assert.equal(e.$('obc-texto').textContent, 'Diagnóstico APEX-04: casco estanco.')
  assert.equal(e.$('obc').dataset.tono, 'ok')
  assert.equal(e.$('obc').dataset.tipo, 'texto')
  assert.deepEqual(e.tonos, ['confirmar'])
  assert.equal(e.hablados.length, 0)
  assert.equal(e.consola.responder({ texto: '   ' }), null)
})

test('la lista de ayuda se pagina de cuatro en cuatro y conserva el tono', t => {
  const e = montar(t)
  const lista = Array.from({ length: 9 }, (_, i) => ({ frase: `di comando ${i + 1}`, descripcion: `hace ${i + 1}` }))
  const salida = e.consola.responder({ texto: 'Puedo atender 9 comandos.', tono: 'info', lista })
  assert.deepEqual(salida, { tipo: 'lista', paginas: 3, total: 9 })
  const texto = () => e.$('obc-texto').textContent
  assert.match(texto(), /Puedo atender 9 comandos/)
  assert.match(texto(), /di comando 1 — hace 1/)
  assert.match(texto(), /di comando 4 — hace 4/)
  assert.doesNotMatch(texto(), /di comando 5/)
  assert.equal(e.$('obc-nav').hidden, false)
  assert.equal(e.$('obc-pagina').textContent, '1/3')
  assert.equal(e.$('obc-pagina-prev').disabled, true)
  assert.equal(e.$('obc-pagina-next').disabled, false)

  e.$('obc-pagina-next').dispatchEvent(new Evento('click'))
  assert.match(texto(), /di comando 5 — hace 5/)
  assert.match(texto(), /di comando 8 — hace 8/)
  assert.doesNotMatch(texto(), /di comando 9/)
  assert.equal(e.$('obc-pagina').textContent, '2/3')
  assert.equal(e.$('obc-pagina-prev').disabled, false)

  e.$('obc-pagina-next').dispatchEvent(new Evento('click'))
  assert.match(texto(), /di comando 9 — hace 9/)
  assert.equal(e.$('obc-pagina').textContent, '3/3')
  assert.equal(e.$('obc-pagina-next').disabled, true)

  e.$('obc-pagina-prev').dispatchEvent(new Evento('click'))
  assert.equal(e.$('obc-pagina').textContent, '2/3')
})

test('paginar y textoDeItem preparan cualquier forma de lista', () => {
  assert.equal(textoDeItem('  hola  '), 'hola')
  assert.equal(textoDeItem({ frase: 'di rover', descripcion: 'despliega' }), 'di rover — despliega')
  assert.equal(textoDeItem({ comando: 'di rover' }), 'di rover')
  assert.equal(textoDeItem({ descripcion: 'sólo detalle' }), 'sólo detalle')
  assert.equal(textoDeItem(null), '')
  const { paginas, items } = paginar(['a', 'b', 'c', 'd', 'e'], 2)
  assert.equal(items.length, 5)
  assert.deepEqual(paginas, [['a', 'b'], ['c', 'd'], ['e']])
  assert.deepEqual(paginar([], 4).paginas, [[]])
})

test('el intercambio de tres líneas usa emisor y texto', t => {
  const e = montar(t)
  const salida = e.consola.responder({
    tono: 'ok',
    lineas: [
      { emisor: 'OBC', texto: 'Canal orbital abierto. Portadora estable.' },
      { emisor: 'Houston', texto: 'APEX-04, los recibimos. Hay retardo, pero se oyen alto y claro.' },
      { emisor: 'OBC', texto: 'Transmisión completada. Enlace con Tierra en espera.' },
    ],
  })
  assert.deepEqual(salida, { tipo: 'turnos', lineas: 3 })
  const texto = e.$('obc-texto').textContent
  assert.match(texto, /^OBC: Canal orbital abierto/)
  assert.match(texto, /Houston: APEX-04, los recibimos/)
  assert.match(texto, /OBC: Transmisión completada/)
  assert.equal(texto.split('\n').length, 3)
  assert.equal(e.$('obc').dataset.tipo, 'turnos')
  assert.equal(e.$('obc-nav').hidden, true)
})

test('las respuestas son transitorias: el texto se retira solo', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const e = montar(t)
  e.consola.responder({ texto: 'Casco estanco. Presión 72 kPa.' })
  assert.equal(e.$('obc').hidden, false)
  t.mock.timers.tick(5000)
  assert.equal(e.$('obc').hidden, false)
  t.mock.timers.tick(4500)
  assert.equal(e.$('obc').hidden, true)
  assert.equal(e.$('obc-texto').textContent, '')
})

test('una lista permanece mientras se pagina y se retira al caducar', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const e = montar(t)
  e.consola.responder({ lista: ['uno', 'dos', 'tres', 'cuatro', 'cinco'] })
  t.mock.timers.tick(25000)
  assert.equal(e.$('obc').hidden, false)
  e.$('obc-pagina-next').dispatchEvent(new Evento('click'))
  assert.equal(e.$('obc-pagina').textContent, '2/2')
  t.mock.timers.tick(31000)
  assert.equal(e.$('obc').hidden, true)
})

test('escuchar actualiza el indicador sin abrir la consola; el aviso importante sí la abre', t => {
  const e = montar(t)
  e.consola.estado({ escuchando: true })
  assert.equal(e.$('obc').hidden, true)
  assert.equal(e.$('obc-micro').getAttribute('aria-pressed'), 'true')
  assert.equal(e.$('obc-estado').textContent, 'Escuchando…')
  e.consola.estado({ escuchando: false, mensaje: 'Micrófono apagado.' })
  assert.equal(e.$('obc').hidden, true)
  e.consola.estado({ escuchando: false, mensaje: 'Permiso de micrófono denegado. Puedes escribir la orden.' })
  assert.equal(e.$('obc').hidden, false)
  assert.match(e.$('obc-estado').textContent, /Permiso de micrófono denegado/)
  assert.equal(e.$('obc-micro').getAttribute('aria-pressed'), 'false')
})

test('la escucha directa se ve mientras se habla y se retira al terminar', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const e = montar(t)
  e.consola.estado({ directo: true, escuchando: true, mensaje: 'Escuchando…' })
  t.mock.timers.tick(4000)
  assert.equal(e.$('obc').hidden, false)
  assert.equal(e.$('obc-micro').getAttribute('aria-pressed'), 'true')
  e.consola.estado({ escuchando: false, mensaje: 'Mantén pulsado para hablar.' })
  t.mock.timers.tick(3000)
  assert.equal(e.$('obc').hidden, true)
})

test('la tira KITT enciende los segmentos que marca el micrófono', t => {
  const e = montar(t)
  e.consola.escucha(true)
  assert.equal(e.$('obc').hidden, false)
  assert.equal(e.$('obc').dataset.modo, 'escucha')
  const segmentos = e.$('obc-kitt').children.filter(n => n.id !== 'nada')
  e.consola.nivel(.5)
  const encendidos = e.$('obc-kitt').children.filter(n => n.dataset.on === 'si')
  assert.equal(encendidos.length, 7) // 14 segmentos · mitad
  assert.equal(segmentos.length, 15) // 14 + la luz de barrido
  e.consola.nivel(0)
  assert.equal(e.$('obc-kitt').children.filter(n => n.dataset.on === 'si').length, 0)
  e.consola.escucha(false)
  assert.equal(e.$('obc').hidden, true)
  assert.equal(e.$('obc').dataset.modo, undefined)
})

test('una respuesta devuelve la barra a su tamaño normal tras el modo escucha', t => {
  const e = montar(t)
  e.consola.escucha(true)
  assert.equal(e.$('obc').dataset.modo, 'escucha')
  e.consola.responder({ texto: 'Estado del traje: sellado.', tono: 'ok' })
  assert.equal(e.$('obc').dataset.modo, undefined)
  assert.equal(e.$('obc-texto').textContent, 'Estado del traje: sellado.')
  e.consola.escucha(false)
  assert.equal(e.$('obc').hidden, false) // la respuesta sigue a la vista
})

test('el reconocedor muestra lo que oye antes de decidir la orden', t => {
  const e = montar(t)
  e.consola.parcial('noso tro mo')
  assert.equal(e.$('obc-estado').textContent, 'Oigo: noso tro mo')
  assert.equal(e.$('obc').dataset.modo, 'escucha')
  e.consola.parcial('')
  e.consola.estado({ escuchando: true })
  assert.equal(e.$('obc-estado').textContent, 'Escuchando…')
})

test('lo que se oye se subtitula: parcial en vivo y final que se retira solo', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const e = montar(t)
  const voz = e.$('obc-voz')
  e.consola.parcial('noso tro mo')
  assert.equal(voz.hidden, false)
  assert.equal(voz.textContent, 'noso tro mo')
  assert.equal(voz.dataset.parcial, 'si')
  e.consola.parcial('Nostromo, estado del traje')
  assert.equal(voz.textContent, 'Nostromo, estado del traje')
  e.consola.parcial('')
  assert.equal(voz.hidden, true) // se retira la vista provisional
  e.consola.subtitulo('Nostromo, estado del traje')
  assert.equal(voz.hidden, false)
  assert.equal(voz.dataset.parcial, undefined)
  t.mock.timers.tick(2700)
  assert.equal(voz.hidden, true)
})

test('apagar la voz retira el subtítulo pendiente', t => {
  const e = montar(t)
  e.consola.subtitulo('dame diagnóstico de nave')
  assert.equal(e.$('obc-voz').hidden, false)
  e.consola.escucha(true)
  e.consola.escucha(false)
  assert.equal(e.$('obc-voz').hidden, true)
})

test('un aviso importante no lo pisa otro adaptador, pero un error sí manda', t => {
  const e = montar(t)
  e.consola.estado({ escuchando: true, mensaje: 'Tira de nivel: permiso denegado para medir la entrada.' })
  assert.match(e.$('obc-estado').textContent, /Tira de nivel/)
  e.consola.estado({ escuchando: false, error: true, mensaje: 'Permiso de micrófono denegado. Puedes escribir la orden.' })
  assert.match(e.$('obc-estado').textContent, /Permiso de micrófono denegado/)
  e.consola.estado({ escuchando: true, mensaje: 'Captura de audio iniciada.' })
  assert.match(e.$('obc-estado').textContent, /Permiso de micrófono denegado/)
  // Al apagarse la escucha el aviso puede retirarse: ya no hay nada que proteger.
  e.consola.estado({ escuchando: false })
  assert.match(e.$('obc-estado').textContent, /En espera/)
})

test('el editor envía una vez después de cerrarse, no envía vacío y devuelve el foco', t => {
  const e = montar(t)
  const entrada = e.$('obc-entrada')
  const abrir = e.$('obc-abrir')
  e.documento.activeElement = abrir
  abrir.dispatchEvent(new Evento('click'))
  const editor = e.$('obc-editor')
  assert.equal(editor.open, true)
  entrada.value = '  Nostromo, dame diagnóstico de nave  '
  e.$('obc-editor-form').dispatchEvent(new Evento('submit'))
  assert.equal(editor.open, false)
  assert.deepEqual(e.enviados, ['Nostromo, dame diagnóstico de nave'])
  assert.equal(entrada.value, '')
  assert.equal(e.documento.activeElement, abrir)
  abrir.dispatchEvent(new Evento('click'))
  entrada.value = '   '
  e.$('obc-editor-form').dispatchEvent(new Evento('submit'))
  assert.equal(editor.open, true)
  assert.deepEqual(e.enviados, ['Nostromo, dame diagnóstico de nave'])
})

test('el editor detiene la propagación, se cierra con cancelar y no envía', t => {
  const e = montar(t)
  e.consola.abrirEditor()
  const evento = new Evento('keydown')
  e.$('obc-editor').dispatchEvent(evento)
  assert.equal(evento.propagacion, true)
  e.$('obc-editor').dispatchEvent(new Evento('cancel'))
  assert.equal(e.$('obc-editor').open, false)
  assert.deepEqual(e.enviados, [])
})

test('la tablet abre el mismo editor y conserva su foco', t => {
  const e = montar(t)
  const tablet = e.$('tablet-obc')
  e.documento.activeElement = tablet
  tablet.dispatchEvent(new Evento('click'))
  assert.equal(e.$('obc-editor').open, true)
  e.$('obc-entrada').value = 'Nostromo, cierra el mapa'
  e.$('obc-editor-form').dispatchEvent(new Evento('submit'))
  assert.equal(e.$('obc-editor').open, false)
  assert.equal(e.documento.activeElement, tablet)
})

test('los ajustes de pausa guardan y sincronizan ambos menús', t => {
  const e = montar(t)
  const pausa = e.$('pausa-voz')
  pausa.value = 'siempre'
  e.documento.dispatchEvent(new Evento('change', { target: pausa }))
  assert.equal(leerPreferencias().voz, 'siempre')
  assert.equal(e.$('opcion-voz').value, 'siempre')
  assert.equal(e.ajustes.at(-1).voz, 'siempre')
  const casilla = e.$('pausa-voz-hablada')
  casilla.checked = true
  e.documento.dispatchEvent(new Evento('change', { target: casilla }))
  assert.equal(leerPreferencias().vozHablada, true)
  assert.equal(e.$('opcion-voz-hablada').checked, true)
  const mando = e.$('pausa-mando')
  mando.checked = false
  e.documento.dispatchEvent(new Evento('change', { target: mando }))
  assert.equal(leerPreferencias().mando, false)
  assert.equal(e.$('opcion-mando').checked, false)
})

test('alVozHablada avisa al empezar y al terminar la voz', t => {
  const e = montar(t)
  guardarPreferencias({ vozHablada: true })
  e.consola.responder({ texto: 'Canal orbital abierto.', tono: 'ok' })
  assert.deepEqual(e.voz, [true])
  assert.equal(e.hablados[0].lang, 'es-ES')
  e.hablados[0].onend()
  assert.deepEqual(e.voz, [true, false])
  e.consola.responder({ texto: 'Segundo mensaje.', tono: 'info' })
  e.consola.silenciar(true)
  assert.deepEqual(e.voz, [true, false, true, false])
})

test('Nostromo habla grave y pausado con una voz del idioma elegido si está disponible', t => {
  const e = montar(t)
  guardarPreferencias({ vozHablada: true, idiomaVoz: 'es-PE' })
  const alonso = { name: 'Microsoft Alonso', lang: 'es-PE' }
  const voces = [{ name: 'Alex', lang: 'en-US' }]
  e.ventana.speechSynthesis.getVoices = () => voces
  e.consola.responder({ texto: 'Te escucho.' })
  assert.equal(e.hablados[0].lang, 'es-PE')
  assert.equal(e.hablados[0].voice, undefined)
  voces.push({ name: 'Pablo', lang: 'es-ES' }, { name: 'Voz local', lang: 'es-PE' }, alonso)
  e.consola.responder({ texto: 'Todo en orden.' })
  const respuesta = e.hablados[1]
  assert.equal(respuesta.voice, alonso)
  assert.ok(respuesta.rate < 1 && respuesta.pitch < 1)
})

test('dispositivo enciende los glifos del juego y retira las teclas de los botones', t => {
  const e = montar(t)
  e.consola.dispositivo(true)
  assert.equal(e.$('eva').getAttribute('data-dispositivo'), 'mando')
  assert.equal(e.vehiculo.textContent, 'Desplegar vehículo')
  assert.equal(e.mapa.textContent, 'Tablet')
  assert.match(e.$('obc-ayuda').textContent, /LB/)
  assert.match(e.ayudaJuego.textContent, /A usar/)
  e.consola.dispositivo(false)
  assert.equal(e.$('eva').getAttribute('data-dispositivo'), 'teclado')
  assert.equal(e.vehiculo.textContent, 'Desplegar vehículo · V')
  assert.equal(e.mapa.textContent, 'Tablet · M')
  assert.match(e.$('obc-ayuda').textContent, /F para hablar/)
  assert.match(e.ayudaJuego.textContent, /WASD mover/)
})

test('dispose apaga el reloj, la voz y los escuchas', t => {
  const e = montar(t)
  e.consola.despertar()
  e.consola.dispose()
  assert.equal(e.$('obc').hidden, true)
  e.$('obc-abrir').dispatchEvent(new Evento('click'))
  assert.equal(e.$('obc-editor').open, false)
})

test('el CSS mantiene el barrido KITT de ida y vuelta y la oclusión móvil', () => {
  const css = readFileSync(new URL('./historia.css', import.meta.url), 'utf8')
  assert.match(css, /@keyframes obc-barrido\s*\{[^}]*from\s*\{[^}]*left:-15%/s)
  assert.match(css, /animation:obc-barrido[^;]*alternate/)
  assert.match(css, /@media \(pointer:coarse\)/)
  assert.match(css, /#eva\[data-obc\] #eva-aviso/)
  assert.match(css, /#obc-kitt\.activo \.obc-kitt-luz/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /#eva\[data-dispositivo=mando\] #eva-vehiculo::before/)
})

test('la ayuda y la Tierra recorren el ritual real y la consola real', t => {
  const documento = new Documento()
  const ventana = new Nodo('ventana')
  for (const id of IDS) documento.registrar(id, TIPOS[id] ?? '')
  documento.getElementById('obc-entrada').type = 'text'
  documento.getElementById('obc').hidden = true
  documento.hasFocus = () => true
  documento.hidden = false
  documento.getElementById('eva-vehiculo').textContent = 'Desplegar vehículo · V'
  documento.getElementById('eva-mapa').textContent = 'Tablet · M'
  documento.getElementById('eva-ayuda').textContent = 'WASD mover'
  ventana.SpeechSynthesisUtterance = class { constructor(texto) { this.text = texto } }
  ventana.speechSynthesis = { cancel() {}, speak() {} }
  const guion = {
    ayuda: {
      id: 'ayuda', texto: 'Puedo atender 9 comandos. Pide uno por su frase.', tono: 'info',
      lista: Array.from({ length: 9 }, (_, i) => ({ frase: `di comando ${i + 1}`, descripcion: `hace ${i + 1}` })),
    },
    tierra: {
      id: 'tierra', texto: 'Canal abierto. Los recibimos.', tono: 'ok',
      lineas: [
        { emisor: 'OBC', texto: 'Canal orbital abierto. Portadora estable.' },
        { emisor: 'Houston', texto: 'APEX-04, los recibimos. Hay retardo.' },
        { emisor: 'OBC', texto: 'Transmisión completada. Enlace con Tierra en espera.' },
      ],
    },
  }
  let micro
  const sim = {
    comando: id => guion[id] ?? { id, texto: 'ok', tono: 'ok' },
    ejes() {}, look() {}, mandoTurbo() {}, frenar() {}, recentrar() {}, vehicle() {}, mapa() {}, interact() {}, jump() {},
  }
  const obc = conectarOBC({
    sim, zona: () => 'juego', raizMenu: () => null, accionMenu: () => true, cerrarMapa: () => {},
  }, {
    doc: documento, ventana,
    preferencias: () => ({ voz: 'siempre', idiomaVoz: 'es-ES', mando: true, sonido: true }),
    consolaHUD: cb => crearConsola({ ...cb, documento, ventana }),
    reconocimiento: cb => { micro = cb; return { configurar() {}, pulsar() {}, dispose() {} } },
    controlador: () => ({ actualizar() {}, reset() {}, dispose() {} }),
  })
  t.after(() => obc.dispose())

  micro.alTexto('Nostromo, comandos', { directo: true })
  const barra = documento.getElementById('obc'), texto = documento.getElementById('obc-texto')
  assert.equal(barra.hidden, false)
  assert.match(texto.textContent, /di comando 1 — hace 1/)
  assert.match(texto.textContent, /di comando 4 — hace 4/)
  assert.doesNotMatch(texto.textContent, /di comando 5/)
  assert.equal(documento.getElementById('obc-nav').hidden, false)
  assert.equal(documento.getElementById('obc-pagina').textContent, '1/3')
  documento.getElementById('obc-pagina-next').dispatchEvent(new Evento('click'))
  assert.match(texto.textContent, /di comando 5 — hace 5/)
  assert.equal(documento.getElementById('obc-pagina').textContent, '2/3')

  micro.alTexto('Nostromo, intenta transmisión con la Tierra', { directo: true })
  assert.match(texto.textContent, /OBC: Canal orbital abierto/)
  assert.match(texto.textContent, /Houston: APEX-04/)
  assert.match(texto.textContent, /OBC: Transmisión completada/)
  assert.equal(texto.textContent.split('\n').length, 3)
  assert.equal(documento.getElementById('obc-nav').hidden, true)
})

test('index.html y menu.js exponen los formularios de voz y mando en ambos menús', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
  const menu = readFileSync(new URL('./menu.js', import.meta.url), 'utf8')
  for (const id of ['obc', 'obc-texto', 'obc-kitt', 'obc-nav', 'obc-editor', 'obc-abrir', 'tablet-obc', 'obc-voz',
    'opcion-voz', 'opcion-idioma-voz', 'opcion-voz-hablada', 'opcion-mando', 'opcion-voz-privacidad',
    'pausa-voz', 'pausa-idioma-voz', 'pausa-voz-hablada', 'pausa-mando', 'pausa-voz-privacidad', 'eva-ayuda']) {
    assert.match(html, new RegExp(`id="${id}"`), id)
  }
  assert.match(html, /<option value="apagada">/)
  assert.match(html, /<option value="siempre">/)
  assert.match(html, /<option value="es-PE">/)
  assert.match(html, /data-obc-ejemplo="Nostromo, dame diagnóstico de nave"/)
  assert.match(menu, /sincronizarControles/)
  assert.match(menu, /guardarPreferencias\(\{ voz: voz\.value \}\)/)
  assert.match(menu, /guardarPreferencias\(\{ vozHablada: Boolean\(vozHablada\.checked\) \}\)/)
  assert.match(menu, /guardarPreferencias\(\{ mando: Boolean\(mando\.checked\) \}\)/)
})
