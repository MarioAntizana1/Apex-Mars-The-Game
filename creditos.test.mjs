import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CREDITOS, EQUIPO, crearListaCreditos } from './creditos.js'

const NOMBRES = [
  'Mario Manuel Antizana Ponce de Leon',
  'Esther Mamani Condor',
  'Diego Bellido Tello',
]

function nodo(etiqueta) {
  return {
    etiqueta,
    hijos: [],
    texto: '',
    get textContent() { return this.texto },
    set textContent(valor) { this.texto = valor },
    append(...nuevos) { this.hijos.push(...nuevos) },
  }
}

function textoCreditos() {
  return CREDITOS.map(({ titulo, detalle }) => `${titulo}: ${detalle}`).join('\n')
}

test('el equipo del proyecto encabeza la lista compartida', () => {
  assert.deepEqual(EQUIPO, NOMBRES)
  for (const nombre of NOMBRES) {
    assert.equal(CREDITOS.filter(credito => credito.titulo === nombre).length, 1, nombre)
  }
})

test('la lista acredita fuentes, recursos y tipografías', () => {
  const texto = textoCreditos()
  for (const clave of ['HiRISE', 'MOLA', 'CTX', 'Viking', 'CesiumJS', 'three.js', 'glTF', 'Web Audio', 'WebP', 'Pathfinder']) {
    assert.ok(texto.includes(clave), clave)
  }
  const tipografias = CREDITOS.find(credito => credito.titulo === 'Tipografías')
  assert.ok(tipografias, 'falta la entrada de tipografías')
  assert.match(tipografias.detalle, /sin fuentes externas/)
})

test('la música local de los créditos se acredita al final', async () => {
  const { titulo, detalle } = CREDITOS.at(-1)
  assert.equal(titulo, 'Engel Retro')
  assert.equal(detalle, 'Cristian Castro - Azul [8-Bit Version]')
  const documento = await readFile(new URL('./documentacion/12-creditos.md', import.meta.url), 'utf8')
  assert.ok(documento.includes(`${titulo} · ${detalle}`))
  const pista = await readFile(new URL('./cancion8bits.mp3', import.meta.url))
  assert.ok(pista.length > 0, 'falta la pista de los créditos')
})

test('la lista se renderiza igual en cualquier contenedor', () => {
  const documento = { createElement: etiqueta => nodo(etiqueta) }
  const lista = documento.createElement('ul')
  crearListaCreditos(documento, lista)
  assert.equal(lista.hijos.length, CREDITOS.length)
  const primero = lista.hijos[0]
  assert.equal(primero.etiqueta, 'li')
  assert.equal(primero.hijos[0].textContent, CREDITOS[0].titulo)
  assert.equal(primero.hijos[1].textContent, CREDITOS[0].detalle)
  for (const nombre of NOMBRES) {
    assert.ok(lista.hijos.some(item => item.hijos[0].textContent === nombre), nombre)
  }
})

test('menú, pausa y documentación usan los mismos créditos', async () => {
  const [menu, escena, documento] = await Promise.all([
    readFile(new URL('./menu.js', import.meta.url), 'utf8'),
    readFile(new URL('./historia-escena.js', import.meta.url), 'utf8'),
    readFile(new URL('./documentacion/12-creditos.md', import.meta.url), 'utf8'),
  ])
  assert.match(menu, /from '\.\/creditos\.js'/)
  assert.match(escena, /from '\.\/creditos\.js'/)
  assert.doesNotMatch(menu, /Relieve e imagen de Ares Vallis/)
  assert.doesNotMatch(escena, /Reconstrucción original de APEX \/ MARS/)
  for (const nombre of NOMBRES) assert.ok(documento.includes(nombre), nombre)
  for (const clave of ['HiRISE', 'MOLA', 'CTX', 'Viking', 'CesiumJS', 'three.js', 'Tipografías', 'Web Audio', 'MIT']) {
    assert.ok(documento.includes(clave), clave)
  }
})
