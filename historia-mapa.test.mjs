import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { geolocalizar, proyectar, dibujarPlaneta, relieveLocal } from './historia-mapa.js'

const aprox = (a,b) => assert.ok(Math.abs(a-b) < .00001, `${a} ≈ ${b}`)
test('el punto Sagan reproduce las coordenadas de Pathfinder; sur y este avanzan en el mapa', () => {
  const { lat, lon } = geolocalizar(1200, 1600)
  aprox(lat, 19.137); aprox(lon, -33.221)
  assert.deepEqual(proyectar(-180, 90, 720, 360), [0,0])
  assert.deepEqual(proyectar(180, -90, 720, 360), [720,360])
  const nave = geolocalizar(0,0); assert.ok(nave.lon < lon && nave.lat > lat)
})

test('capas locales: el detalle se dibuja sobre MOLA y respeta la escala del zoom', () => {
  const llamadas = [], g = { drawImage: (...args) => llamadas.push(args) }
  relieveLocal(g, {marte:'global', regional:'regional', ares:'local'}, x=>360+x/2, z=>240+z/2)
  assert.deepEqual(llamadas.map(c=>c[0]), ['global', 'regional', 'local'])
  assert.deepEqual(llamadas[2], ['local', 360-2048, 240-1024, 3584, 8192])
  assert.doesNotThrow(() => relieveLocal(g, {}, x=>x, z=>z))
})

test('el planisferio dibuja el planeta 2:1, ambos polos y al jugador en su posición actual', () => {
  const llamadas = [], g = new Proxy({}, {get: (_, k) => (...args) => llamadas.push([k,...args])})
  dibujarPlaneta(g, {marte:'MOLA'}, {x:1200,z:1600}, 720, 480)
  assert.deepEqual(llamadas.find(c=>c[0]==='drawImage'), ['drawImage','MOLA',0,0,696,348])
  assert.deepEqual(llamadas.filter(c=>c[0]==='fillText').map(c=>c[1]), ['NORTE · 90° N','SUR · 90° S','TÚ · ARES VALLIS'])
  const [,x,y] = llamadas.find(c=>c[0]==='arc'), [px,py] = proyectar(-33.221,19.137,696,348)
  aprox(x,px); aprox(y,py)
})

test('las tres cartas redistribuidas son imágenes WebP locales', async () => {
  for (const id of ['marte','regional','ares']) {
    const data = await readFile(new URL(`./datos/cartas/${id}.webp`, import.meta.url))
    assert.equal(data.toString('ascii',0,4),'RIFF'); assert.equal(data.toString('ascii',8,12),'WEBP')
    assert.equal(data.readUInt32LE(4),data.length-8)
  }
})
