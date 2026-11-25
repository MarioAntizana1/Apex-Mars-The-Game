import test from 'node:test'
import assert from 'node:assert/strict'
import { leerPreferencias, guardarPreferencias } from './preferencias.js'

test('las preferencias tienen valores seguros y se guardan sin almacenamiento', () => {
  const iniciales = leerPreferencias()
  assert.equal(typeof iniciales.sonido, 'boolean')
  assert.equal(typeof iniciales.ciencia, 'boolean')
  assert.equal(typeof iniciales.rumbo, 'boolean')
  const guardadas = guardarPreferencias({ rumbo: !iniciales.rumbo })
  assert.equal(guardadas.rumbo, !iniciales.rumbo)
  // Sin almacenamiento disponible, leer vuelve a los valores base; con él se
  // conserva el cambio. La prueba no depende de la plataforma.
  const leidas = leerPreferencias()
  assert.equal(typeof leidas.rumbo, 'boolean')
  guardarPreferencias({ rumbo: iniciales.rumbo })
})
