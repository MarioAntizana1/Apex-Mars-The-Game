import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync, existsSync } from 'node:fs'
import * as T from './vendor/three/three.module.min.js'
import { crearExploracion } from './historia-explora.js'
import { crearEstacionSagan } from './historia-sagan.js'
import { MUNDO, SAGAN } from './historia-terreno.js'

const raiz = new URL('./datos/ares/', import.meta.url)
const manifiesto = JSON.parse(readFileSync(new URL('manifiesto.json', raiz), 'utf8'))

function simulation() {
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(54, 1.5, .3, 1000), canvas = new EventTarget()
  canvas.style = { touchAction: 'pan-y' }
  const hud = {}, zone = []
  let tablilla = false, mapas = 0
  const ui = {
    exterior: v => zone.push(v),
    tablet: v => { tablilla = v },
    mapa: () => { mapas++ },
    vehiculo: () => {},
    position: () => {},
    paused: () => false,
  }
  for (const type of ['objective', 'prompt', 'status', 'inventory']) ui[type] = v => { hud[type] = v }
  const sim = crearExploracion(T, scene, camera, { domElement: canvas }, ui)
  function walk(x, z, secs) { sim.move(x, z); for (let i = 0; i < Math.round(secs * 60); i++) sim.update(1 / 60); sim.move(0, 0); sim.update(0) }
  function aim(x, y, z) {
    const d = new T.Vector3(x, y, z).sub(camera.position).normalize()
    const yaw = Math.atan2(-d.x, -d.z), pitch = Math.asin(d.y)
    sim.look((camera.rotation.y - yaw) / .0042, (camera.rotation.x - pitch) / .0038)
  }
  return { scene, camera, sim, walk, aim, hud, zone, canvas, historia: () => tablilla, mapas: () => mapas }
}

test('el manifiesto y los sectores reales describen el sitio de Ares Vallis', () => {
  assert.equal(manifiesto.version, 1)
  assert.equal(manifiesto.sagan.x, 1200)
  assert.equal(manifiesto.sagan.z, 1600)
  assert.ok(Math.abs(manifiesto.sagan.altura - 8.887) < .05)
  assert.equal(manifiesto.detalle.columnas, 7)
  assert.equal(manifiesto.detalle.filas, 16)
  assert.equal(manifiesto.detalle.muestras, 257)
  assert.equal(manifiesto.detalle.paso, 4)
  assert.equal(manifiesto.limite, 24000)
  assert.equal(MUNDO.x0, manifiesto.detalle.x0)
  assert.equal(SAGAN.x, manifiesto.sagan.x)
  assert.equal(manifiesto.tamano_dtm, undefined)
  assert.equal(manifiesto.dtm.tamano[0], 6579)
  assert.equal(manifiesto.dtm.tamano[1], 14277)
  const terreno = new URL('terreno/', raiz), textura = new URL('textura/', raiz)
  const muestras = manifiesto.detalle.muestras
  for (let f = 0; f < manifiesto.detalle.filas; f++) {
    for (let c = 0; c < manifiesto.detalle.columnas; c++) {
      assert.ok(existsSync(new URL(`${c}_${f}.bin`, terreno)), `sector ${c}_${f}`)
      assert.equal(statSync(new URL(`${c}_${f}.bin`, terreno)).size, muestras * muestras * 2)
      assert.ok(existsSync(new URL(`${c}_${f}.webp`, textura)), `textura ${c}_${f}`)
    }
  }
  assert.equal(statSync(new URL('lejano.bin', raiz)).size, manifiesto.lejano.lado ** 2 * 2)
  // Vista previa de 64 m, peso de fusión a 16 m y albedo común para las juntas.
  assert.equal(statSync(new URL('previa.bin', raiz)).size, 113 * 257 * 2)
  assert.equal(statSync(new URL('borde.bin', raiz)).size, 449 * 1025)
  assert.ok(statSync(new URL('albedo-comun.webp', raiz)).size > 4096)
  const leer = url => { const b = readFileSync(url); return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2) }
  const impacto = leer(new URL('terreno/4_2.bin', raiz))
  assert.equal(impacto[0], 0)
  const sagan = leer(new URL('terreno/5_3.bin', raiz))
  const alturaSagan = sagan[144 * muestras + 44]
  assert.ok(Math.abs(alturaSagan - 89) <= 2, `altura Sagan ${alturaSagan} dm`)
})

test('la estación Sagan es solo el sitio histórico y bloquea el paso de sus piezas', () => {
  const world = new T.Group()
  const estacion = crearEstacionSagan(T, world, () => 8.9)
  assert.ok(world.getObjectByName('estación científica Sagan'))
  assert.equal(estacion.permite(1200, 1600), false)
  assert.equal(estacion.permite(1200, 1601), false)
  assert.equal(estacion.permite(1260, 1600), true)
  estacion.update(0, { x: 0, z: 0 })
  estacion.dispose()
  assert.equal(world.children.length, 0)
})

test('salto y carrera respetan el suelo y el estado del traje', () => {
  const s = simulation()
  assert.equal(s.sim.estado().airborne, false)
  s.sim.jump()
  assert.equal(s.sim.estado().airborne, true)
  for (let i = 0; i < 120; i++) s.sim.update(1 / 60)
  assert.equal(s.sim.estado().airborne, false)
  const antes = s.sim.estado()
  s.sim.sprint(true)
  s.sim.move(0, 1)
  for (let i = 0; i < 30; i++) s.sim.update(1 / 60)
  s.sim.move(0, 0)
  const despues = s.sim.estado()
  assert.ok(Math.hypot(despues.x - antes.x, despues.z - antes.z) > .5)
  s.sim.sprint(false)
  s.sim.dispose()
})

function salirPorEsclusa(s) {
  // Salir por la esclusa, como en el guion jugable.
  const aCab = [1.14, 1.73, -1.95], aCam = [1.14, 1.73, -2.29], bCam = [1.16, 1.73, -3.77], aire = [-1.71, 1.72, -3.02]
  const ir = (tx, tz) => {
    const dx = tx - s.camera.position.x, dz = tz - s.camera.position.z
    s.aim(tx, s.camera.position.y, tz)
    s.walk(0, 1, Math.hypot(dx, dz) / (s.zone.at(-1) === true ? 2.85 : 2.02))
  }
  const mando = (pt, label) => { s.aim(...pt); assert.match(s.hud.prompt, label); s.sim.interact(); s.walk(0, 0, .95) }
  ir(0, -1.43); mando(aCab, /Abrir puerta A/)
  ir(0, -3.03); mando(aCam, /Cerrar puerta A/); mando(aire, /Despresurizar/); s.walk(0, 0, 4)
  mando(bCam, /Abrir puerta B/); ir(0, -4.9); ir(0, -7.5)
  assert.equal(s.zone.at(-1), true)
  return ir
}

test('el rover se despliega y se conduce fuera de la nave', () => {
  const s = simulation()
  s.sim.vehicle()
  assert.match(s.hud.status, /bodega/)
  assert.equal(s.sim.estado().rover, 'guardado')
  salirPorEsclusa(s)
  s.sim.vehicle()
  assert.equal(s.sim.estado().rover, 'conduciendo')
  const antes = s.sim.estado()
  s.sim.move(0, 1)
  for (let i = 0; i < 120; i++) s.sim.update(1 / 60)
  s.sim.move(0, 0)
  const despues = s.sim.estado()
  assert.ok(Math.hypot(despues.x - antes.x, despues.z - antes.z) > .2)
  s.sim.vehicle()
  assert.equal(s.sim.estado().rover, 'desplegado')
  s.sim.dispose()
})

test('la tablet recogida habilita el mapa y el mapa pausa la simulación', () => {
  const s = simulation()
  s.aim(0, s.camera.position.y, -1.54)
  s.walk(0, 1, 1.4)
  s.aim(-1.53, 1.54, -1.54)
  assert.match(s.hud.prompt, /tablet/i)
  s.sim.interact()
  assert.equal(s.historia(), true)
  s.sim.mapa()
  assert.equal(s.mapas(), 1)
  s.sim.dispose()
})

test('la baliza viaja en rover y Pathfinder solo enlaza tras limpieza, encendido y conexión local', t => {
  // Prueba de interacción local: no se necesitan descargas de modelos.
  t.mock.method(globalThis, 'fetch', () => new Promise(() => {}))
  const s = simulation()
  t.after(() => s.sim.dispose())
  const estado=s.sim.estado, usar=(p,texto)=>{s.aim(...p);assert.match(s.hud.prompt,texto);s.sim.interact();s.walk(0,0,.98)}
  const baliza=s.scene.getObjectByName('baliza de campo'),maletin=s.scene.getObjectByName('maletín en mano')
  const pieBaliza=()=>[baliza.position.x,baliza.position.y+.55,baliza.position.z]
  s.walk(0,1,1.14);usar([1.53,1.66,-.94],/kit/);s.aim(0,s.camera.position.y,-1.54);s.walk(0,1,.27);usar([-1.53,1.54,-1.54],/tablet/i)
  const ir = salirPorEsclusa(s)
  usar([0,0,-9.2],/Anclar/);ir(0,baliza.position.z+1.25);usar(pieBaliza(),/Acoplar/);usar(pieBaliza(),/Replegar/)
  assert.equal(estado().sitioBaliza,null);assert.equal(baliza.visible,false)
  ir(11,-7.5);s.aim(SAGAN.x,s.camera.position.y,SAGAN.z-12);s.sim.vehicle();s.sim.move(0,1)
  for(let i=0;i<2000&&estado().z<SAGAN.z-10;i++)s.sim.update(.08)
  assert.equal(estado().conduciendo,true);assert.equal(estado().llegadaSagan,true);assert.equal(maletin.visible,false)
  assert.match(estado().estadoBaliza,/rover/);assert.equal(s.hud.prompt,'');s.sim.move(0,0);s.sim.vehicle();s.sim.update(0)
  assert.equal(maletin.visible,true);ir(SAGAN.x,SAGAN.z-3.5)
  const lander=[SAGAN.x,s.camera.position.y-.5,SAGAN.z]
  s.aim(SAGAN.x,s.camera.position.y,SAGAN.z-12);assert.doesNotMatch(s.hud.prompt,/Limpiar/)
  usar(lander,/Limpiar/);assert.equal(estado().encendidoIntentado,false)
  usar(lander,/Intentar encendido/);usar(lander,/Comprobar alcance/);assert.equal(estado().balizaConectada,false)
  const suelo=s.camera.position.y-1.51
  // Ni un repetidor completo pero fuera de alcance ni un trípode solo sirven.
  ir(SAGAN.x,SAGAN.z-13);usar([SAGAN.x,suelo,SAGAN.z-14.6],/Anclar/);usar(pieBaliza(),/Acoplar/)
  ir(SAGAN.x,SAGAN.z-3.5);usar(lander,/Comprobar alcance/);assert.equal(estado().balizaConectada,false)
  ir(SAGAN.x,SAGAN.z-13);usar(pieBaliza(),/Replegar/);ir(SAGAN.x,SAGAN.z-3.5)
  usar([SAGAN.x,suelo,SAGAN.z-5.2],/Anclar/);usar(lander,/Comprobar alcance/);usar(pieBaliza(),/Acoplar/)
  usar(lander,/Conectar baliza/);assert.equal(estado().comunicacionesActivas,false)
  usar(lander,/enlace con Tierra/);assert.equal(estado().comunicacionesActivas,true)
  assert.match(s.hud.objective,/Enlace con Tierra activo/);usar(pieBaliza(),/Replegar/)
  assert.equal(estado().sitioBaliza,null);assert.equal(estado().balizaConectada,false);assert.equal(estado().comunicacionesActivas,false)
  assert.equal(estado().panelesLimpios,true);assert.equal(estado().encendidoIntentado,true);assert.match(s.hud.inventory,/Baliza en mano/)
  usar([SAGAN.x,suelo,SAGAN.z-5.2],/Anclar/);usar(pieBaliza(),/Acoplar/);usar(lander,/Conectar/);usar(lander,/enlace con Tierra/)
  assert.equal(estado().comunicacionesActivas,true)
})
