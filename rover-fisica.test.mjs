import test from 'node:test'
import assert from 'node:assert/strict'
import { crearSuspension, GRAVEDAD_MARTE, RUEDAS } from './rover-fisica.js'

const PASO = 1 / 120

function simular(suspension, { x = 0, z = 0, yaw = 0, velocidad = 0, segundos = 1 }) {
  suspension.reiniciar(x, z, yaw)
  const muestras = []
  const pasos = Math.round(segundos / PASO)
  for (let i = 0; i < pasos; i++) {
    // Avance recto en la dirección de la proa: forward = (-sen yaw, -cos yaw).
    x += -Math.sin(yaw) * velocidad * PASO
    z += -Math.cos(yaw) * velocidad * PASO
    suspension.avanzar(x, z, yaw, PASO)
    muestras.push({ t: (i + 1) * PASO, x, z, ...suspension.estado })
  }
  return { muestras, estado: suspension.estado }
}

test('Marte tira menos que la Tierra: la constante del juego es la gravedad marciana', () => {
  assert.equal(GRAVEDAD_MARTE, 3.71)
  assert.ok(GRAVEDAD_MARTE > 3.6 && GRAVEDAD_MARTE < 3.8)
  assert.equal(RUEDAS.length, 6)
})

test('en llano el chasis se apoya en el suelo, sin hundirse ni flotar, con seis ruedas en contacto', () => {
  const suspension = crearSuspension(() => 8.9)
  const { estado, muestras } = simular(suspension, { velocidad: 6, segundos: 1.5 })
  for (const m of muestras.slice(10)) {
    assert.ok(Math.abs(m.y - 8.9) < .02, `altura ${m.y}`)
    assert.equal(m.contactos, 6)
    assert.ok(Math.abs(m.vy) < .05)
  }
  // Las seis suspensiones trabajan dentro de su recorrido, con la rueda pegada al suelo.
  for (const recorrido of estado.recorrido) assert.ok(Math.abs(recorrido) < .05, `recorrido ${recorrido}`)
})

test('un salto sin suelo acelera exactamente a la gravedad de Marte', () => {
  const suspension = crearSuspension(() => 0)
  const e = suspension.estado
  e.y = 50; e.vy = 0; e.contactos = 0
  const muestras = []
  for (let i = 0; i < 30; i++) {
    suspension.avanzar(0, 0, 0, PASO)
    muestras.push({ ...e })
  }
  assert.equal(muestras.at(-1).contactos, 0)
  const caida = muestras.slice(2)
  const t = PASO * (caida.length - 1)
  const aceleracion = (caida.at(-1).vy - caida[0].vy) / t
  assert.ok(Math.abs(aceleracion + GRAVEDAD_MARTE) < .05, `aceleración ${aceleracion}`)
  // Con gravedad marciana se cae menos de la mitad que en la Tierra: ~1,8 m/s² de diferencia.
  assert.ok(caida.at(-1).y > 50 - .5 * 3.71 * (PASO * 29) ** 2 - .01)
})

test('al coronar una loma a buena velocidad se pierde contacto y se vuela en parábola marciana', () => {
  // Loma suave de 1,2 m; se conduce hacia +X con la proa a -π/2.
  const altura = (x, z) => 1.2 * Math.exp(-((x / 3.2) ** 2))
  const suspension = crearSuspension(altura)
  const { muestras } = simular(suspension, { x: -24, yaw: -Math.PI / 2, velocidad: 14, segundos: 7 })
  const vuelo = muestras.filter(m => m.contactos < 6)
  assert.ok(vuelo.length > 6, `fotogramas sin contacto: ${vuelo.length}`)
  const despegue = vuelo[0]
  assert.ok(despegue.vy > .3, `la loma debe impulsar el chasis (${despegue.vy})`)
  assert.ok(vuelo.at(-1).t - despegue.t > .3, 'el vuelo dura más que un bache')
  // En vuelo no hay amortiguación: la aceleración medida es la gravedad marciana.
  const enVuelo = vuelo.filter((m, i) => i > 0 && i < vuelo.length - 1)
  const a = (enVuelo.at(-1).vy - enVuelo[0].vy) / (enVuelo.at(-1).t - enVuelo[0].t)
  assert.ok(Math.abs(a + GRAVEDAD_MARTE) < .35, `aceleración en vuelo ${a}`)
  assert.ok(vuelo.some(m => m.y - altura(m.x, 0) > .3), 'el chasis queda por encima del suelo')
  // Y vuelve a apoyarse: el contacto se recupera sin rebotes infinitos.
  const final = muestras.at(-1)
  assert.equal(final.contactos, 6)
  assert.ok(Math.abs(final.y - altura(final.x, 0)) < .03)
})

test('una caída rápida no atraviesa el terreno', () => {
  const suspension = crearSuspension(() => 3)
  const e = suspension.estado
  e.y = 9; e.vy = -30; e.contactos = 0
  for (let i = 0; i < 240; i++) {
    suspension.avanzar(0, 0, 0, PASO)
    assert.ok(e.y > 3 - .25, `hundido en ${e.y}`)
  }
  assert.ok(Math.abs(e.y - 3) < .03, `apoyo final ${e.y}`)
  assert.equal(e.contactos, 6)
})

test('las pendientes se leen en el marco girado del chasis', () => {
  const leer = (dhdx, dhdz, yaw) => {
    const s = crearSuspension((x, z) => dhdx * x + dhdz * z)
    s.reiniciar(0, 0, yaw)
    // Reiniciar deja las pendientes sin filtrar; un paso corto mantiene el valor.
    s.avanzar(0, 0, yaw, PASO)
    return s.estado
  }
  // Proa hacia -Z (yaw 0): la pendiente de X es lateral y la de Z es frontal.
  const rectoX = leer(.2, 0, 0)
  assert.ok(Math.abs(rectoX.lateral - .2) < .01, `lateral ${rectoX.lateral}`)
  assert.ok(Math.abs(rectoX.longitudinal) < .01)
  const rectoZ = leer(0, .2, 0)
  assert.ok(Math.abs(rectoZ.longitudinal - .2) < .01, `longitudinal ${rectoZ.longitudinal}`)
  assert.ok(Math.abs(rectoZ.lateral) < .01)
  // Con la proa hacia +X (yaw -π/2), la pendiente de X pasa a ser frontal e invertida.
  const giradoX = leer(.2, 0, -Math.PI / 2)
  assert.ok(Math.abs(giradoX.longitudinal + .2) < .01, `longitudinal ${giradoX.longitudinal}`)
  assert.ok(Math.abs(giradoX.lateral) < .01)
  // Con la proa hacia +Z (yaw π), la pendiente de X cambia de signo en el eje lateral.
  const vueltaX = leer(.2, 0, Math.PI)
  assert.ok(Math.abs(vueltaX.lateral + .2) < .01, `lateral ${vueltaX.lateral}`)
  assert.ok(Math.abs(vueltaX.longitudinal) < .01)
})
