#!/usr/bin/env node
// Descarga los productos HiRISE del sitio Pathfinder usados por datos/ares.
// Uso: node herramientas/descargar-datos-ares.mjs [--destino CARPETA]
// Son datos públicos de NASA/JPL/University of Arizona (~450 MB en total).
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argumentos = process.argv.slice(2)
const indice = argumentos.indexOf('--destino')
const destino = resolve(indice >= 0 && argumentos[indice + 1] ? argumentos[indice + 1] : resolve(raiz, '..', 'datos-fuente-ares'))
mkdirSync(destino, { recursive: true })

const DTM = 'https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_002300_002399/PSP_002391_1995_PSP_001890_1995/'
const EXTRAS = 'https://www.uahirise.org/PDS/EXTRAS/DTM/PSP/ORB_002300_002399/PSP_002391_1995_PSP_001890_1995/'

const archivos = [
  [`${DTM}DTEEC_002391_1995_001890_1995_A01.IMG`, 'DTEEC_002391_1995_001890_1995_A01.IMG', 375739848],
  [`${DTM}PSP_002391_1995_RED_C_01_ORTHO.JP2`, 'PSP_002391_1995_RED_C_01_ORTHO.JP2', 40203404],
  [`${DTM}PSP_001890_1995_RED_C_01_ORTHO.JP2`, 'PSP_001890_1995_RED_C_01_ORTHO.JP2', 38263216],
  [`${DTM}PSP_002391_1995_RED_C_01_ORTHO.LBL`, 'PSP_002391_1995_RED_C_01_ORTHO.LBL', null],
  [`${DTM}PSP_001890_1995_RED_C_01_ORTHO.LBL`, 'PSP_001890_1995_RED_C_01_ORTHO.LBL', null],
  [`${EXTRAS}README_DTEEC_002391_1995_001890_1995_A01.TXT`, 'README_DTEEC_002391_1995_001890_1995_A01.TXT', null],
]

for (const [url, nombre, tamano] of archivos) {
  const salida = resolve(destino, nombre)
  if (existsSync(salida) && (tamano === null || statSync(salida).size === tamano)) {
    console.log('ya existe', nombre)
    continue
  }
  console.log('descargando', nombre)
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error(`${nombre}: HTTP ${respuesta.status}`)
  const total = Number(respuesta.headers.get('content-length') || tamano || 0)
  const parcial = `${salida}.part`
  let cargado = 0, ultimoAviso = 0
  const flujo = Readable.fromWeb(respuesta.body)
  flujo.on('data', bloque => {
    cargado += bloque.length
    if (cargado - ultimoAviso >= 64 * 1048576) {
      ultimoAviso = cargado
      console.log(`  ${(cargado / 1048576).toFixed(0)} de ${(total / 1048576).toFixed(0)} MB`)
    }
  })
  await pipeline(flujo, createWriteStream(parcial))
  if (total && statSync(parcial).size !== total) throw new Error(`${nombre}: descarga incompleta`)
  renameSync(parcial, salida)
  console.log('  listo', salida)
}
console.log('Datos HiRISE en', destino)
console.log('Genera el mundo con: python herramientas/datos-ares.py --fuente', destino)
