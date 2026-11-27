import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from './vendor/three/three.module.min.js'
import { crearExploracion } from './historia-explora.js'
import { COMANDOS, IDS, RESERVADOS, TONOS } from './comandos.js'

const IDS_ESPERADOS = ['diagnostico', 'rover', 'tierra', 'mision', 'traje', 'estadoRover', 'abrirMapa', 'cerrarMapa', 'rumbo', 'silencio', 'habla', 'baliza', 'esclusa', 'lucesOn', 'lucesOff', 'tormenta', 'ayuda', 'presente', 'hangar', 'ambiguo', 'desconocido']

function simulation() {
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(54, 1.5, .3, 1000), canvas = new EventTarget()
  canvas.style = { touchAction: 'pan-y' }
  const hud = { mapas: 0, finales: 0 }, zone = [], vista = { mapaAbierto: false }
  const ui = {
    exterior: v => { zone.push(v) }, tablet: () => {},
    mapa: () => { hud.mapas++; vista.mapaAbierto = true }, mapaAbierto: () => vista.mapaAbierto,
    radio: () => {}, finDemo: () => { hud.finales++ }, vehiculo: () => {}, position: () => {}, paused: () => false,
  }
  for (const tipo of ['objective', 'prompt', 'status', 'inventory']) ui[tipo] = v => { hud[tipo] = v }
  const sim = crearExploracion(T, scene, camera, { domElement: canvas }, ui)
  const walk = (x, z, seg) => { sim.move(x, z); for (let i = 0; i < Math.round(seg * 60); i++) sim.update(1 / 60); sim.move(0, 0); sim.update(0) }
  const aim = (x, y, z) => { const d = new T.Vector3(x, y, z).sub(camera.position).normalize(); const yaw = Math.atan2(-d.x, -d.z), pitch = Math.asin(d.y); sim.look((camera.rotation.y - yaw) / .0042, (camera.rotation.x - pitch) / .0038) }
  return { scene, camera, sim, hud, zone, vista, walk, aim }
}

function salirPorEsclusa(s) {
  const aCab = [1.14, 1.73, -1.95], aCam = [1.14, 1.73, -2.29], bCam = [1.16, 1.73, -3.77], aire = [-1.71, 1.72, -3.02]
  const ir = (tx, tz) => { const dx = tx - s.camera.position.x, dz = tz - s.camera.position.z; s.aim(tx, s.camera.position.y, tz); s.walk(0, 1, Math.hypot(dx, dz) / (s.zone.at(-1) === true ? 2.85 : 2.02)) }
  const mando = (pt, label) => { s.aim(...pt); assert.match(s.hud.prompt, label); s.sim.interact(); s.walk(0, 0, .95) }
  ir(0, -1.43); mando(aCab, /Abrir puerta A/)
  ir(0, -3.03); mando(aCam, /Cerrar puerta A/); mando(aire, /Despresurizar/); s.walk(0, 0, 4)
  mando(bCam, /Abrir puerta B/); ir(0, -4.9); ir(0, -7.5)
  assert.equal(s.zone.at(-1), true)
  return ir
}

test('el catálogo de voz cubre los 21 ids acordados', () => {
  assert.deepEqual([...IDS], IDS_ESPERADOS)
  assert.equal(COMANDOS.length, 19)
  assert.equal(new Set(COMANDOS.map(c => c.id)).size, 19)
  assert.deepEqual([...RESERVADOS], ['ambiguo', 'desconocido'])
  assert.deepEqual([...TONOS], ['ok', 'aviso', 'error', 'info', 'pregunta'])
  for (const c of COMANDOS) { assert.ok(c.frases.length > 0, c.id); assert.ok(c.descripcion.length > 8, c.id) }
})

test('las consultas dentro de la nave responden sin tocar la misión', () => {
  const s = simulation(), { sim } = s
  const d = sim.comando('diagnostico')
  assert.match(d.texto, /Diagnóstico APEX-04/)
  assert.equal(d.tono, 'info'); assert.equal(d.finDemo, false); assert.equal(s.hud.finales, 0)
  assert.match(sim.comando('mision').texto, /Objetivo actual/)
  const traje = sim.comando('traje')
  assert.match(traje.texto, /traje/i)
  assert.doesNotMatch(traje.texto, /temperatura de\s*-?\d|°C/)
  assert.match(sim.comando('estadoRover').texto, /guardado/)
  assert.match(sim.comando('rumbo').texto, /Sagan/)
  assert.match(sim.comando('baliza').texto, /en la nave/)
  assert.match(sim.comando('esclusa').texto, /Esclusa:/)
  assert.match(sim.comando('tormenta').texto, /Sin tormenta/)
  sim.dispose()
})

test('mapa, luces y enlace con Tierra respetan el contexto', () => {
  const s = simulation(), { sim } = s
  assert.match(sim.comando('abrirMapa').texto, /tablet/); assert.equal(s.hud.mapas, 0)
  s.aim(0, s.camera.position.y, -1.54); s.walk(0, 1, 1.4); s.aim(-1.53, 1.54, -1.54); s.sim.interact()
  assert.equal(sim.estado().hasTablet, true)
  assert.equal(sim.comando('abrirMapa').tono, 'ok'); assert.equal(s.hud.mapas, 1)
  assert.match(sim.comando('abrirMapa').texto, /ya está abierto/)
  s.vista.mapaAbierto = false
  assert.match(sim.comando('cerrarMapa').texto, /no está abierto/)
  s.vista.mapaAbierto = true; assert.equal(sim.comando('cerrarMapa').accion, 'cerrarMapa')
  s.vista.mapaAbierto = false
  assert.equal(sim.estado().luces, true)
  assert.match(sim.comando('lucesOff').texto, /apagadas/); assert.equal(sim.estado().luces, false)
  assert.match(sim.comando('lucesOff').texto, /ya están apagadas/)
  assert.match(sim.comando('lucesOn').texto, /encendidas/); assert.equal(sim.estado().luces, true)
  assert.match(sim.comando('lucesOn').texto, /ya están encendidas/)
  const t0 = sim.comando('tierra'); assert.equal(t0.tono, 'aviso'); assert.match(t0.texto, /puente/)
  s.aim(0, s.camera.position.y, 100); s.walk(0, 1, 2.0)
  assert.ok(sim.estado().z > 2.15, 'z=' + sim.estado().z)
  const t1 = sim.comando('tierra'); assert.equal(t1.tono, 'aviso'); assert.match(t1.texto, /enlace|antena|estación/)
  sim.dispose()
})

test('el rover es idempotente, no nace junto al casco y los canales del mando se recortan', () => {
  const s = simulation(), { sim } = s
  // Dentro del casco no se despliega nada.
  assert.equal(sim.comando('rover').tono, 'aviso')
  assert.equal(sim.estado().rover, 'guardado')
  assert.equal(s.scene.getObjectByName('rover de superficie').visible, false)
  assert.match(sim.comando('rover').texto, /bodega/)
  salirPorEsclusa(s)
  // La primera voz despliega y sube a bordo, como la tecla V.
  assert.equal(sim.comando('rover').tono, 'ok'); assert.equal(sim.estado().rover, 'conduciendo')
  const rover = s.scene.getObjectByName('rover de superficie'); assert.equal(rover.visible, true)
  // El centro del rover queda fuera del casco y de la rampa.
  assert.ok(Math.abs(rover.position.x) >= 4.5 || rover.position.z <= -8, `rover en ${rover.position.x},${rover.position.z}`)
  let rovers = 0; s.scene.traverse(o => { if (o.name === 'rover de superficie') rovers++ })
  assert.equal(rovers, 1, 'no se duplica el rover')
  assert.equal(sim.comando('rover').tono, 'aviso'); assert.match(sim.comando('rover').texto, /Ya conduces/)
  assert.match(sim.comando('estadoRover').texto, /Conduciendo/)
  // Al bajar queda aparcado: la voz no vuelve a subir a bordo.
  sim.vehicle(); sim.update(0)
  assert.equal(sim.estado().rover, 'desplegado'); assert.equal(sim.estado().conduciendo, false)
  const cerca = sim.comando('rover')
  assert.equal(cerca.tono, 'aviso'); assert.match(cerca.texto, /no sube a bordo/i)
  assert.equal(sim.estado().conduciendo, false, 'la voz no sube a bordo')
  // Recentrar y canales analógicos.
  sim.vehicle(); sim.update(0); assert.equal(sim.estado().conduciendo, true)
  sim.look(120, 0); assert.notEqual(sim.estado().miradaYaw, 0)
  sim.recentrar(); assert.equal(sim.estado().miradaYaw, 0)
  sim.ejes(0, 1); for (let i = 0; i < 60; i++) sim.update(1 / 60); sim.ejes(0, 0)
  const v1 = Math.abs(sim.estado().velocidad); assert.ok(v1 > 1, 'v1=' + v1)
  sim.frenar(true); for (let i = 0; i < 60; i++) sim.update(1 / 60); sim.frenar(false)
  const v2 = Math.abs(sim.estado().velocidad); assert.ok(v2 < v1, 'v2=' + v2 + ' v1=' + v1)
  sim.mandoTurbo(true); assert.equal(sim.estado().turboMando, true); sim.mandoTurbo(false)
  sim.vehicle(); sim.update(0)
  // Los ejes enormes valen lo mismo que los ejes a tope (recorte a [-1,1]).
  const p0 = sim.estado(); sim.ejes(0, 5); for (let i = 0; i < 20; i++) sim.update(1 / 60); sim.ejes(0, 0)
  const p1 = sim.estado(); const d1 = Math.hypot(p1.x - p0.x, p1.z - p0.z)
  const p2 = sim.estado(); sim.ejes(0, 1); for (let i = 0; i < 20; i++) sim.update(1 / 60); sim.ejes(0, 0)
  const p3 = sim.estado(); const d2 = Math.hypot(p3.x - p2.x, p3.z - p2.z)
  assert.ok(Math.abs(d1 - d2) < .05, `d1=${d1} d2=${d2}`)
  sim.ejes(NaN, Infinity); sim.update(1 / 60)
  sim.dispose()
})

test('la ayuda y los guiños no abren diálogos ni cambian el mundo', () => {
  const s = simulation(), { sim } = s
  assert.match(sim.comando('presente').texto, /En línea/)
  assert.match(sim.comando('hangar').texto, /No puedo hacer eso/)
  assert.match(sim.comando('ambiguo').texto, /traje, rover, nave o baliza/)
  assert.match(sim.comando('desconocido').texto, /No te he entendido/)
  assert.equal(sim.comando('silencio').silencio, true)
  assert.equal(sim.comando('habla').silencio, false)
  const ayuda = sim.comando('ayuda'); assert.equal(ayuda.lista.length, 19); assert.match(ayuda.texto, /19 comandos/)
  assert.equal(s.hud.finales, 0)
  sim.dispose()
})
