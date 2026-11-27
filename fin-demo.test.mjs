import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { crearFinDemo } from './fin-demo.js'

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
const css = readFileSync(new URL('./historia.css', import.meta.url), 'utf8')
const escena = readFileSync(new URL('./historia-escena.js', import.meta.url), 'utf8')

function dialogoFalso() {
  const dialogo = new EventTarget()
  dialogo.open = false
  dialogo.aperturas = 0
  dialogo.cierres = 0
  dialogo.showModal = () => { dialogo.aperturas++; dialogo.open = true }
  dialogo.close = () => { dialogo.cierres++; dialogo.open = false }
  return dialogo
}

function montar() {
  const dialogo = dialogoFalso(), seguir = new EventTarget(), salir = new EventTarget()
  let foco, abierto = 0, seguido = 0, salido = 0
  seguir.focus = () => { foco = 'seguir' }
  const fin = crearFinDemo({
    dialogo, botonSeguir: seguir, botonSalir: salir,
    alAbrir: () => { abierto++ }, alSeguir: () => { seguido++ }, alSalir: () => { salido++ },
  })
  return { fin, dialogo, seguir, salir, contar: () => ({ abierto, seguido, salido, foco }) }
}

test('el cierre de la demo explica el final y ofrece las dos salidas', () => {
  const [bloque] = html.match(/<dialog id="fin-demo"[\s\S]*?<\/dialog>/)
  assert.ok(bloque)
  assert.match(bloque, /aria-labelledby="fin-demo-titulo"/)
  assert.match(bloque, /aria-describedby="fin-demo-pregunta"/)
  assert.match(bloque, /<h2 id="fin-demo-titulo">Fin de la demo<\/h2>/)
  assert.match(bloque, /¿Quieres seguir explorando Marte/)
  assert.match(bloque, /<button id="fin-demo-explorar" type="button" autofocus>Seguir explorando<\/button>/)
  assert.match(bloque, /<button id="fin-demo-salir" type="button">Terminar y volver al globo<\/button>/)
  // El fundido a negro y la aparición del texto son CSS, no un temporizador que pueda quedarse colgado.
  assert.match(css, /#fin-demo::backdrop \{[^}]*animation:fin-demo-negro/)
  assert.match(css, /#fin-demo\[open\] \{[^}]*animation:fin-demo-texto/)
  assert.match(css, /@keyframes fin-demo-negro/)
  assert.match(css, /prefers-reduced-motion:reduce\)\{#fin-demo\[open\],#fin-demo::backdrop\{animation:none\}\}/)
})

test('se abre una sola vez, enfoca seguir y no deja que Esc decida por el jugador', () => {
  const { fin, dialogo, seguir, contar } = montar()
  assert.equal(fin.abierto, false)
  fin.abrir()
  assert.equal(fin.abierto, true)
  assert.equal(dialogo.aperturas, 1)
  assert.deepEqual(contar(), { abierto: 1, seguido: 0, salido: 0, foco: 'seguir' })
  fin.abrir()
  assert.equal(dialogo.aperturas, 1, 'no reabre ni reinicia la animación')
  const escape = new Event('cancel', { cancelable: true })
  dialogo.dispatchEvent(escape)
  assert.equal(escape.defaultPrevented, true)
  assert.equal(fin.abierto, true)
  for (const code of ['KeyM', 'KeyE', 'Escape', 'Space']) {
    const evento = Object.assign(new Event('keydown', { bubbles: true }), { code })
    dialogo.dispatchEvent(evento)
    assert.equal(evento.cancelBubble, true, code)
  }
  assert.equal(seguir.focus !== undefined, true)
})

test('seguir explorando reanuda la partida y terminar devuelve al globo', () => {
  const primero = montar()
  primero.fin.abrir()
  primero.seguir.dispatchEvent(new Event('click'))
  assert.equal(primero.fin.abierto, false)
  assert.equal(primero.dialogo.cierres, 1)
  assert.deepEqual(primero.contar(), { abierto: 1, seguido: 1, salido: 0, foco: 'seguir' })
  primero.fin.cerrar()
  assert.equal(primero.dialogo.cierres, 1, 'cerrar dos veces no dispara otro cierre')
  const segundo = montar()
  segundo.fin.abrir()
  segundo.salir.dispatchEvent(new Event('click'))
  assert.equal(segundo.contar().salido, 1)
  assert.equal(segundo.contar().seguido, 0)
})

test('la escena pausa la simulación y desconecta los diálogos al cerrarse', () => {
  assert.match(escena, /finDemo\(\) \{ final\.abrir\(\) \}/)
  assert.match(escena, /paused\(\) \{ return final\.abierto \|\| mapaAbierto \|\| pausaAbierta \|\| \$\('obc-editor'\)\?\.open/)
  assert.match(escena, /if \(final\.abierto \|\| radio\.open\) return true/)
  assert.match(escena, /if \(final\.abierto\) final\.cerrar\(\)/)
  assert.match(escena, /alSalir\(\) \{ \$\('historia-salir'\)\.click\(\) \}/)
})
