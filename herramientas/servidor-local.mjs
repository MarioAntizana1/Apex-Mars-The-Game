#!/usr/bin/env node
// Servidor estático mínimo para jugar en local (módulos ES, wasm, glb y datos).
// Uso: node herramientas/servidor-local.mjs [puerto]
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const puerto = Number(process.argv[2] || 8123)
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.bin': 'application/octet-stream', '.pack': 'application/octet-stream',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
}

createServer((peticion, respuesta) => {
  try {
    const ruta = decodeURIComponent(new URL(peticion.url, 'http://localhost').pathname)
    let archivo = normalize(join(raiz, ruta))
    if (!archivo.startsWith(raiz)) { respuesta.writeHead(403).end(); return }
    if (existsSync(archivo) && statSync(archivo).isDirectory()) archivo = join(archivo, 'index.html')
    if (!existsSync(archivo)) { respuesta.writeHead(404).end('404'); return }
    const datos = statSync(archivo)
    respuesta.writeHead(200, {
      'Content-Type': tipos[extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Content-Length': datos.size,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    })
    createReadStream(archivo).pipe(respuesta)
  } catch (error) {
    respuesta.writeHead(500).end(String(error))
  }
}).listen(puerto, '127.0.0.1', () => console.log(`APEX / MARS en http://127.0.0.1:${puerto}/`))
