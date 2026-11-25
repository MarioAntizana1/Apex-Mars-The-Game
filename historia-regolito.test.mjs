import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from './vendor/three/three.module.min.js'
import { crearRegolito } from './historia-regolito.js'

test('el detalle del suelo es repetible, filtrado y sin un salto visible al cerrar la baldosa', () => {
  const tile = crearRegolito(T), copia = crearRegolito(T)
  const { data, width, height } = tile.image
  assert.deepEqual(data, copia.image.data)
  assert.equal(tile.wrapS, T.RepeatWrapping); assert.equal(tile.wrapT, tile.wrapS)
  assert.equal(tile.generateMipmaps, true); assert.equal(tile.magFilter, T.LinearFilter)
  // Comparar discontinuidades medias del tono tanto dentro como en las costuras.
  const tono = (x,y) => data[(y*width+x)*4+1]
  let interno=0, bordeX=0, bordeY=0
  for(let y=0;y<height;y++) {
    bordeX += Math.abs(tono(0,y)-tono(width-1,y))
    for(let x=1;x<width;x++) interno += Math.abs(tono(x,y)-tono(x-1,y))
  }
  for(let x=0;x<width;x++) bordeY += Math.abs(tono(x,0)-tono(x,height-1))
  interno /= (width-1)*height
  assert.ok(interno>1); assert.ok(bordeX/height < interno*1.6 && bordeY/width < interno*1.6)
  tile.dispose(); copia.dispose()
})
