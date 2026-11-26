import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { conectarGuiaControles } from './guia-controles.js'

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
test('inicio y pausa ofrecen botones que apuntan al mismo diálogo accesible', () => {
  const selector = /<button\b[^>]*data-guia-controles[^>]*>/g
  for (const menu of [/<nav id="menu"[\s\S]*?<\/nav>/, /<nav class="pausa-lista"[\s\S]*?<\/nav>/]) {
    const [boton] = html.match(menu)[0].match(selector)
    assert.match(boton, /aria-haspopup="dialog"/)
    assert.match(boton, /aria-controls="guia-controles"/)
  }
  const [guia] = html.match(/<dialog id="guia-controles"[\s\S]*?<\/dialog>/)
  assert.match(guia, /aria-labelledby="guia-titulo"/)
  assert.match(guia, /id="guia-titulo"[^>]*autofocus/)
  assert.match(guia, /<form method="dialog">[\s\S]*?Cerrar guía/)
})

test('abrir y cerrar desde cualquiera de los menús devuelve el foco al origen correcto', () => {
  const botones = [new EventTarget(), new EventTarget()]
  const guia = new EventTarget()
  let aperturas = 0, foco
  guia.showModal = () => { aperturas++ }
  botones.forEach(boton => { boton.focus = () => { foco = boton } })
  conectarGuiaControles(guia, botones)
  for (const boton of botones) {
    guia.scrollTop = 50
    boton.dispatchEvent(new Event('click'))
    assert.equal(guia.scrollTop, 0)
    guia.dispatchEvent(new Event('close'))
    assert.equal(foco, boton)
  }
  assert.equal(aperturas, 2)
})

test('los atajos de la escena no consumen las teclas de la guía ni la activación con espacio', () => {
  const guia = new EventTarget(), boton = new EventTarget()
  conectarGuiaControles(guia, [boton])
  for (const [destino, code] of [[boton, 'Space'], [guia, 'Escape'], [guia, 'KeyM'], [guia, 'Tab']]) {
    const evento = Object.assign(new Event('keydown', { bubbles: true, cancelable: true }), { code })
    destino.dispatchEvent(evento)
    assert.equal(evento.cancelBubble, true)
    assert.equal(evento.defaultPrevented, false)
  }
})
