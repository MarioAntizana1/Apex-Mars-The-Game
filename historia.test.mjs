import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DURACION, ejeTactil } from './historia-guion.js'

test('el mando táctil conserva fuerza analógica sin acelerar en diagonal', () => {
  assert.deepEqual(ejeTactil(.4,.4,10), [0,0])
  assert.deepEqual(ejeTactil(0,5,10), [0,.5])
  const [x,z] = ejeTactil(60,-80,10)
  assert.equal(x,.6); assert.equal(z,-.8)
  assert.deepEqual(ejeTactil(NaN,1,5), [0,0])
  assert.equal(DURACION,35)
})

for (const name of ['pathfinder', 'sojourner']) {
  test(`${name} es un GLB autocontenido`, () => {
    const glb = readFileSync(new URL(`./modelos/${name}.glb`, import.meta.url))
    assert.equal(glb.toString('ascii', 0, 4), 'glTF')
    assert.equal(glb.readUInt32LE(4), 2)
    assert.equal(glb.readUInt32LE(8), glb.length)
    const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)))
    assert.ok(json.meshes.length)
    assert.ok(json.buffers.every(buffer => !buffer.uri))
    assert.ok((json.images ?? []).every(image => !image.uri))
  })
}
