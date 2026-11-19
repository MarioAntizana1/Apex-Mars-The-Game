import assert from 'node:assert/strict'
import test from 'node:test'
import { aboveGround, belly, flightPhase, newFlight, stepFlight, MAX_FLIGHT_ALTITUDE, TERRAIN_FREE_ALTITUDE } from './flight-dynamics.js'

const dt = 1 / 60
const controls = (overrides = {}) => ({ pitch: 0, steer: 0, throttle: 0, brake: false, ...overrides })
const flat = () => -1800
const tick = (state, seconds, input, probe = flat) => {
  let distance = 0
  let minClearance = Infinity
  for (let i = 0; i < seconds / dt; i++) {
    distance += stepFlight(state, input, dt, probe)
    minClearance = Math.min(minClearance, state.height - belly(state.pitch, state.bank))
  }
  return { distance, minClearance }
}

test('banks into and out of turns, pitches, accelerates and brakes', () => {
  const state = newFlight(-1300, flat(), 0)
  tick(state, 1, controls({ steer: 1, throttle: 1, pitch: 1 }))
  assert.ok(state.bank > .7 && state.heading > .1 && state.pitch > .5)
  assert.ok(state.speed > 160 && state.height > -1260)
  const curvedHeading = state.heading
  tick(state, 1, controls({ brake: true }))
  assert.ok(state.heading > curvedHeading && Math.abs(state.bank) < .015)
  assert.ok(state.speed < 68)
})

test('assisted approach reaches the actual DEM and supports ground alignment and takeoff', () => {
  const state = newFlight(-1340, flat(), 0)
  const { minClearance } = tick(state, 40, controls({ pitch: -1, brake: true }))
  assert.equal(flightPhase(state), 'ground')
  assert.ok(minClearance >= flat() - 1e-10)
  assert.ok(Math.abs(state.height - (flat() + belly())) < .01)
  assert.equal(state.speed, 0)
  const { distance } = tick(state, 1, controls({ steer: -1 }))
  assert.equal(distance, 0)
  assert.ok(state.heading > 5 && state.heading < 5.6 && Math.abs(state.bank) < .01)
  tick(state, 3.5, controls({ pitch: 1, throttle: 1 }))
  assert.equal(flightPhase(state), 'air')
  assert.ok(aboveGround(state) > 35)
})

test('an unsafe touchdown causes a recoverable climb rather than penetration', () => {
  const state = newFlight(-1740, flat(), 0)
  const input = controls({ pitch: -1, throttle: 1 })
  let entered = false
  for (let i = 0; i < 180; i++) {
    stepFlight(state, input, dt, flat)
    assert.ok(state.height >= flat() + belly(state.pitch, state.bank))
    if (flightPhase(state) === 'recovery') entered = true
  }
  assert.ok(entered)
  assert.equal(state.mode, 'air')
  assert.ok(aboveGround(state) > 35)
  tick(state, 20, controls({ pitch: -1, brake: true }))
  assert.equal(flightPhase(state), 'ground')
})

test('missing terrain stops horizontal travel and descent until confirmed', () => {
  const state = newFlight(-1500, flat(), 0)
  tick(state, 1, controls({ pitch: -1 }))
  const previous = state.height
  assert.equal(tick(state, 2, controls({ pitch: -1 }), distance => distance === 0 ? flat() : undefined).distance, 0)
  assert.equal(state.height, previous)
  assert.equal(flightPhase(state), 'waiting')
  assert.ok(tick(state, 1, controls({ pitch: -1 })).distance > 50)
  assert.ok(state.height < previous)
})

test('LOD changes have a hard upward limit and no large down/up oscillation', () => {
  const state = newFlight(-1680, flat(), 0)
  tick(state, 14, controls({ pitch: -1, brake: true }))
  assert.equal(flightPhase(state), 'ground')
  const high = flat() + 55
  stepFlight(state, controls(), dt, () => high)
  assert.ok(state.height >= high + belly())
  const highLevel = state.height
  stepFlight(state, controls(), dt, flat)
  assert.ok(highLevel - state.height < .21)
  for (let i = 0; i < 120; i++) {
    stepFlight(state, controls(), dt, () => i % 2 ? flat() : high)
    assert.ok(Math.abs(state.height - highLevel) < .21)
  }
})

test('rejects a touchdown even on a steep downhill slope', () => {
  const state = newFlight(flat() + belly(-.14) + .001, flat(), 0)
  Object.assign(state, { pitch: -.14, speed: 31, sink: -14 })
  const hillside = distance => flat() - .33 * distance
  const distance = stepFlight(state, controls({ pitch: -1, brake: true }), dt, hillside)
  assert.equal(flightPhase(state), 'recovery')
  assert.ok(state.height >= hillside(distance) + belly(state.pitch, state.bank))
})

test('reaches 120,000 km/h below 100 m and turns responsively at top speed', () => {
  const state = newFlight(flat() + 70, flat(), 0)
  tick(state, 25, controls({ throttle: 1 }))
  assert.equal(Math.round(state.speed * 3.6), 120000)
  assert.ok(aboveGround(state) < 100)
  tick(state, 1, controls({ steer: 1 }))
  assert.ok(state.heading > .9 && Math.abs(state.bank) > .7)
  assert.equal(Math.round(state.speed * 3.6), 120000)
})

test('skirts the terrain in a turbo dive and can still brake to a full landing', () => {
  const state = newFlight(flat() + 3000, flat(), 0)
  tick(state, 25, controls({ throttle: 1 }))
  const { minClearance } = tick(state, 10, controls({ pitch: -1 }))
  assert.ok(minClearance >= flat() + 38 - 1e-8)
  assert.ok(aboveGround(state) >= 38 - 1e-8 && aboveGround(state) < 50)
  assert.equal(Math.round(state.speed * 3.6), 120000)
  assert.equal(flightPhase(state), 'air')
  const before = state.speed
  stepFlight(state, controls({ brake: true }), dt, flat)
  assert.ok(state.speed < before && state.speed > before * .98)
  tick(state, 40, controls({ pitch: -1, brake: true }))
  assert.equal(flightPhase(state), 'ground')
  assert.equal(state.speed, 0)
})

test('climbs from low flight into space and respects the upper altitude limit', () => {
  const state = newFlight(flat() + 460, flat(), 0)
  const climb = controls({ pitch: 1, throttle: 1 })
  tick(state, 75, climb, () => undefined)
  assert.equal(flightPhase(state), 'space')
  assert.ok(state.height > 100000)
  tick(state, 130, climb, () => { throw new Error('spaceflight requested terrain') })
  assert.equal(state.height, MAX_FLIGHT_ALTITUDE)
  assert.equal(state.sink, 0)
})

test('reenters from space and waits safely for missing terrain before descending again', () => {
  const state = newFlight(112000, flat(), 0)
  state.speed = 120000 / 3.6
  const dive = controls({ pitch: -1 })
  assert.ok(tick(state, 14, dive, () => undefined).distance > 200000)
  assert.equal(flightPhase(state), 'waiting')
  assert.ok(state.height <= TERRAIN_FREE_ALTITUDE && state.height > TERRAIN_FREE_ALTITUDE - 200)
  const hold = state.height
  tick(state, 2, dive, () => undefined)
  assert.equal(state.height, hold)
  tick(state, 7, dive)
  assert.equal(flightPhase(state), 'air')
  assert.ok(state.height < hold - 20000)
})

test('detects a steep rise ahead before reaching it', () => {
  const state = newFlight(-1710, flat(), 0)
  const ridge = distance => flat() + Math.max(0, distance - 30) * .9
  stepFlight(state, controls(), dt, ridge)
  assert.equal(flightPhase(state), 'recovery')
  assert.equal(state.height, -1710)
})
