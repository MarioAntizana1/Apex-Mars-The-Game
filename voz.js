import { AMBIGUOS, COMANDOS } from './comandos.js'

// La transcripción del navegador no es estable: el emparejador trabaja por
// palabras, tolera errores de una letra y exige que aparezcan todas las palabras
// de la orden. Una negación («no abras el mapa») nunca ejecuta nada.
export function normalizar(frase) {
  return String(frase ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

const CORTESIA = /^(?:(?:por favor|oye|hola|eh)(?: |$))+/
const ambiguos = new Set(AMBIGUOS.map(normalizar))
const NEGACION = new Set(['no', 'nunca', 'jamas'])
const NOMBRES = ['nostromo', 'nostrosmo']

function distancia(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 3
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let previa = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardada = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previa + (a[i - 1] === b[j - 1] ? 0 : 1))
      previa = guardada
    }
  }
  return fila[b.length]
}

function parecido(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  const largo = Math.max(a.length, b.length)
  const tolerancia = largo >= 8 ? 2 : largo >= 4 ? 1 : 0
  return distancia(a, b) <= tolerancia
}

// El nombre es corto y suena a muchas frases: sólo una errata de una letra.
const esNombre = token => NOMBRES.some(nombre => distancia(token, nombre) <= 1)

// El reconocedor parte a veces el nombre en dos palabras («nos tomo», «nostro
// mo»). Se acepta entonces el par contiguo, nunca detrás de una negación.
function esNombreCompuesto(a, b) {
  if (!a || !b || NEGACION.has(a)) return false
  const junto = a + b
  if (junto.length < 7) return false
  return NOMBRES.some(nombre => distancia(junto, nombre) <= 1)
}

// Todas las palabras de la frase deben aparecer, en orden, en el enunciado.
// Devuelve cuántas palabras sobran (0 es la coincidencia exacta) o -1.
function sobrantes(frase, enunciado) {
  const esperadas = frase.split(' ')
  let i = 0
  let extras = 0
  for (const token of enunciado.split(' ')) {
    if (i < esperadas.length && parecido(token, esperadas[i])) i++
    else extras++
  }
  return i === esperadas.length ? extras : -1
}

export function separarLlamada(frase) {
  const tokens = normalizar(frase).split(' ')
  let indice = tokens.findIndex(esNombre)
  let largo = 1
  if (indice < 0) {
    for (let i = 0; i < tokens.length - 1; i++) {
      if (esNombreCompuesto(tokens[i], tokens[i + 1])) { indice = i; largo = 2; break }
    }
  }
  if (indice < 0) return null
  return {
    llamada: tokens.slice(indice, indice + largo).join(' '),
    antes: tokens.slice(0, indice).join(' '),
    resto: tokens.slice(indice + largo).join(' '),
  }
}

export function resolverComando(frase, catalogo = COMANDOS) {
  const texto = normalizar(frase).replace(CORTESIA, '').trim()
  if (!texto) return { id: 'desconocido' }
  const tokens = texto.split(' ')
  if (tokens.length === 1 && ambiguos.has(tokens[0])) return { id: 'ambiguo', candidatos: [] }

  // Dos órdenes en un mismo enunciado («estado del traje y estado del rover»)
  // son una pregunta: se responde pidiendo una sola, nunca ejecutando dos.
  const partes = texto.split(/ (?:y|o|luego|despues) /)
  if (partes.length > 1) {
    const ids = new Set()
    for (const parte of partes) {
      const r = resolverSimple(parte, catalogo)
      if (r.id !== 'desconocido') ids.add(r.id)
    }
    if (ids.size > 1) return { id: 'ambiguo', candidatos: [...ids] }
  }

  // Frases que llevan el nombre dentro («hola Nostromo») se resuelven enteras.
  const completa = resolverSimple(texto, catalogo)
  if (completa.id !== 'desconocido') return completa

  const llamada = separarLlamada(texto)
  const limpio = llamada ? `${llamada.antes} ${llamada.resto}`.trim() : texto
  if (!limpio) return { id: 'desconocido' }
  if (ambiguos.has(limpio)) return { id: 'ambiguo', candidatos: [] }
  return resolverSimple(limpio, catalogo)
}

function resolverSimple(texto, catalogo) {
  const negado = texto.split(' ').some(token => NEGACION.has(token))
  let mejor = -1
  let ids = new Set()
  for (const { id, frases } of catalogo) {
    for (const frase of frases) {
      const limpia = normalizar(frase)
      // «No abras el mapa» no obedece; «no hables» sí es una orden del catálogo.
      if (negado && !limpia.split(' ').some(token => NEGACION.has(token))) continue
      const extra = sobrantes(limpia, texto)
      if (extra < 0) continue
      if (mejor < 0 || extra < mejor) { mejor = extra; ids = new Set([id]) }
      else if (extra === mejor) ids.add(id)
    }
  }
  if (ids.size === 1) return { id: [...ids][0] }
  if (ids.size > 1) return { id: 'ambiguo', candidatos: [...ids] }
  return { id: 'desconocido' }
}

export function crearRitual({ alDespertar = () => {}, alComando = () => {}, ahora = () => Date.now(), catalogo = COMANDOS, ventana = 7000 } = {}) {
  let hasta = -Infinity
  function despertar() { hasta = ahora() + ventana; alDespertar() }
  function dormir() { hasta = -Infinity }
  function texto(frase, { directo = false } = {}) {
    const normal = normalizar(frase)
    if (!normal) return
    const llamada = separarLlamada(normal)
    const despierto = ahora() < hasta
    if (!llamada && !directo && !despierto) return
    if (llamada) despertar()
    // «Nostromo» a secas despierta: no hay orden que ejecutar.
    if (llamada && !`${llamada.antes} ${llamada.resto}`.trim().replace(CORTESIA, '')) return
    const resultado = resolverComando(normal, catalogo)
    dormir()
    alComando(resultado.id)
    return resultado
  }
  return { texto, despertar, dormir }
}
