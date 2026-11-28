import test from 'node:test'
import assert from 'node:assert/strict'
import { crearRitual, normalizar, resolverComando, separarLlamada } from './voz.js'
import { COMANDOS } from './comandos.js'

const catalogo = [{ id: 'mapa', frases: ['abrir mapa', 'tabla'] }, { id: 'estado', frases: ['cómo estás', 'estado', 'tabla'] }]
function banco() {
  let tiempo = 0; const eventos = []
  const r = crearRitual({ catalogo, ahora: () => tiempo, alDespertar: () => eventos.push('wake'), alComando: id => eventos.push(id) })
  return { ...r, eventos, tick: t => tiempo += t }
}

test('normaliza acentos, mayúsculas y signos', () => {
  assert.equal(normalizar('¡NÓSTROMO, dame DIAGNÓSTICO de nave!'), 'nostromo dame diagnostico de nave')
  assert.equal(normalizar('  '), '')
})

test('la llamada funciona en cualquier posición y con las dos grafías', () => {
  assert.equal(separarLlamada('nostromo').resto, '')
  assert.deepEqual(separarLlamada('nostrosmo, abre el mapa'), { llamada: 'nostrosmo', antes: '', resto: 'abre el mapa' })
  assert.equal(separarLlamada('oye Nostromo dame diagnóstico').antes, 'oye')
  assert.equal(separarLlamada('Nostromología'), null)
  assert.equal(separarLlamada('no estromo nada'), null)
})

test('acepta el nombre partido en dos palabras por el reconocedor', () => {
  assert.deepEqual(separarLlamada('nos tomo abre el mapa'), { llamada: 'nos tomo', antes: '', resto: 'abre el mapa' })
  assert.equal(separarLlamada('nostro mo dame diagnóstico').resto, 'dame diagnostico')
  assert.equal(separarLlamada('oye nos tomo estado del traje').antes, 'oye')
  // Una negación no es una llamada, aunque suene parecido.
  assert.equal(separarLlamada('no stomo abre el mapa'), null)
})

test('despierta con «Nostromo», ignora el ruido y cierra la ventana a los siete segundos', () => {
  const r = banco()
  r.texto('Nostromología'); r.texto('abrir mapa'); r.texto('hola qué tal')
  assert.deepEqual(r.eventos, [])
  r.texto('¡Nostrosmo!'); r.tick(6999); r.texto('¿Cómo estás?'); r.texto('estado')
  assert.deepEqual(r.eventos, ['wake', 'estado'])
  r.despertar(); r.tick(7000); r.texto('estado')
  assert.deepEqual(r.eventos, ['wake', 'estado', 'wake'])
})

test('una orden en el mismo enunciado; PTT y escritura no necesitan la llamada', () => {
  const r = banco()
  r.texto('NÓSTROMO, abrir mapa por favor')
  r.texto('tabla', { directo: true })
  r.texto('no abrir mapa', { directo: true })
  r.despertar(); r.dormir(); r.texto('abrir mapa')
  assert.deepEqual(r.eventos, ['wake', 'mapa', 'ambiguo', 'desconocido', 'wake'])
})

test('una orden llamada pero incompleta o desconocida recibe la aclaración', () => {
  const eventos=[]; const r=crearRitual({alComando:id=>eventos.push(id)})
  r.texto('Oye Nostromo'); assert.deepEqual(eventos,[])
  r.texto('estado del traje'); r.texto('Nostromo, estado'); r.texto('Nostromo, diagnóstico'); r.texto('Nostromo, compra patatas')
  assert.deepEqual(eventos,['traje','ambiguo','ambiguo','desconocido'])
})

test('tolera errores habituales del reconocedor de voz', () => {
  const casos = [
    ['dame el diagnostico de la nave', 'diagnostico'],
    ['displiega el rover', 'rover'],
    ['intenta una transmision con la tierra', 'tierra'],
    ['que hago ahora', 'mision'],
    ['estado del traje', 'traje'],
    ['estado del rover', 'estadoRover'],
    ['abre el mapa', 'abrirMapa'],
    ['cierra el mapa', 'cerrarMapa'],
    ['rumbo a sagan', 'rumbo'],
    ['enciende las luces', 'lucesOn'],
    ['apaga las luces', 'lucesOff'],
    ['cómo está la baliza', 'baliza'],
  ]
  for (const [frase, esperado] of casos) assert.equal(resolverComando(frase).id, esperado, frase)
})

test('no confunde órdenes parecidas ni obedece negaciones', () => {
  assert.equal(resolverComando('no abras el mapa').id, 'desconocido')
  assert.equal(resolverComando('cierra el mapa').id, 'cerrarMapa')
  assert.equal(resolverComando('estado').id, 'ambiguo')
  assert.equal(resolverComando('estado de la misión y estado del traje').id, 'ambiguo')
  assert.equal(resolverComando('hola, qué tal').id, 'desconocido')
})

test('cada frase del catálogo real se reconoce a sí misma', () => {
  for (const c of COMANDOS) for (const frase of c.frases) {
    const { id, candidatos } = resolverComando(frase)
    assert.ok(id === c.id || (id === 'ambiguo' && candidatos.includes(c.id)), `${frase}: ${id}`)
  }
})
