import test from 'node:test'
import assert from 'node:assert/strict'
import { crearMedidorVoz } from './medidor-voz.js'

// AudioContext simulado: entrega muestras del dominio temporal sin hardware.
function entorno({ caso = 'tono', guma } = {}) {
  const banco = { paradas: 0, cierres: 0, aperturas: 0, caso }
  const pista = { stop: () => banco.paradas++ }
  const flujo = { getTracks: () => [pista], getAudioTracks: () => [pista] }
  banco.e = {
    navigator: { mediaDevices: { getUserMedia: guma ?? (async () => { banco.aperturas++; return flujo }) } },
    AudioContext: class {
      state = 'running'
      close = async () => { banco.cierres++ }
      createMediaStreamSource = () => ({ connect() {}, disconnect() {} })
      createAnalyser = () => ({
        fftSize: 1024, smoothingTimeConstant: 0,
        getFloatTimeDomainData: datos => {
          for (let i = 0; i < datos.length; i++) datos[i] = banco.caso === 'tono' ? .12 * Math.sin(i / 3) : .02
        },
      })
    },
  }
  return banco
}

const asentar = () => new Promise(r => setImmediate(r))
const tras = async (medidor, veces = 3) => { for (let i = 0; i < veces; i++) await asentar(); return medidor }

test('el nivel sigue la voz y cae al dejar de hablar', async () => {
  const banco = entorno()
  const medidor = crearMedidorVoz({ entorno: banco.e })
  assert.equal(await medidor.abrir(), 'activo')
  let lectura = medidor.leer()
  assert.ok(lectura.activo)
  assert.ok(lectura.nivel > .3 && lectura.nivel <= 1, `nivel ${lectura.nivel}`)
  banco.caso = 'silencio'
  for (let i = 0; i < 12; i++) lectura = medidor.leer()
  assert.ok(lectura.nivel < .1, `nivel tras silencio ${lectura.nivel}`)
  assert.ok(lectura.pico >= lectura.nivel)
  medidor.cerrar()
  assert.equal(banco.paradas, 1)
  assert.equal(banco.cierres, 1)
})

test('abrir dos veces comparte una sola captura y el cierre la libera', async () => {
  const banco = entorno()
  const medidor = crearMedidorVoz({ entorno: banco.e })
  await medidor.abrir(); await medidor.abrir()
  assert.equal(banco.aperturas, 1)
  medidor.cerrar(); medidor.cerrar()
  assert.equal(banco.paradas, 1)
  assert.equal(medidor.leer().activo, false)
})

test('un permiso denegado informa el motivo y no deja la tira encendida', async () => {
  const banco = entorno({ guma: async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }) } })
  const medidor = crearMedidorVoz({ entorno: banco.e })
  assert.equal(await medidor.abrir(), 'error')
  assert.match(medidor.motivo(), /denegado/i)
  assert.match(medidor.motivo(), /la voz sigue activa/i)
  assert.equal(medidor.leer().nivel, 0)
})

test('una concesión tardía tras cerrar libera su pista', async () => {
  const banco = entorno()
  let entregar
  banco.e.navigator.mediaDevices.getUserMedia = () => new Promise(r => { entregar = r })
  const medidor = crearMedidorVoz({ entorno: banco.e })
  const abriendo = medidor.abrir()
  await asentar(); medidor.cerrar()
  entregar({ getTracks: () => [{ stop: () => banco.paradas++ }] })
  await abriendo; await tras(medidor)
  assert.equal(medidor.estado(), 'parado')
  assert.equal(banco.paradas, 1)
})

test('sin getUserMedia ni AudioContext el medidor lo declara', async () => {
  const medidor = crearMedidorVoz({ entorno: {} })
  assert.equal(medidor.disponible(), false)
  assert.equal(await medidor.abrir(), 'sin-soporte')
  assert.match(medidor.motivo(), /no permite medir/i)
})
