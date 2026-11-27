import test from 'node:test'
import assert from 'node:assert/strict'
import { leerPreferencias, guardarPreferencias, OPCIONES_VOZ, IDIOMAS_VOZ } from './preferencias.js'

test('las preferencias tienen valores seguros y se guardan sin almacenamiento', () => {
  const iniciales = leerPreferencias()
  assert.equal(typeof iniciales.sonido, 'boolean')
  assert.equal(typeof iniciales.ciencia, 'boolean')
  assert.equal(typeof iniciales.rumbo, 'boolean')
  const guardadas = guardarPreferencias({ rumbo: !iniciales.rumbo })
  assert.equal(guardadas.rumbo, !iniciales.rumbo)
  const leidas = leerPreferencias()
  assert.equal(typeof leidas.rumbo, 'boolean')
  guardarPreferencias({ rumbo: iniciales.rumbo })
})

test('voz y mando: valores base, guardado y validación', () => {
  const iniciales = leerPreferencias()
  assert.equal(iniciales.voz, 'apagada')
  assert.equal(iniciales.idiomaVoz, 'es-ES')
  assert.equal(iniciales.vozHablada, false)
  assert.equal(iniciales.mando, true)
  assert.ok(OPCIONES_VOZ.includes('siempre'))
  assert.ok(IDIOMAS_VOZ.includes('es-PE'))
  const guardadas = guardarPreferencias({ voz: 'siempre', idiomaVoz: 'es-MX', vozHablada: true, mando: false })
  assert.equal(guardadas.voz, 'siempre')
  assert.equal(guardadas.idiomaVoz, 'es-MX')
  assert.equal(guardadas.vozHablada, true)
  assert.equal(guardadas.mando, false)
  guardarPreferencias({ voz: 'apagada', idiomaVoz: 'es-ES', vozHablada: false, mando: true })
})

test('los valores inválidos vuelven a los seguros', () => {
  const anterior = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify({ voz: 'grita', idiomaVoz: 'fr-FR', mando: 'sí' }), setItem() {} }
  try {
    const prefs = leerPreferencias()
    assert.equal(prefs.voz, 'apagada')
    assert.equal(prefs.idiomaVoz, 'es-ES')
    assert.equal(prefs.mando, true)
  } finally {
    if (anterior === undefined) delete globalThis.localStorage
    else globalThis.localStorage = anterior
  }
})
