// Arcade flight in metres, seconds and radians. The terrain probe is supplied by
// the renderer; it returns the surface at the requested distance along our track.
const TAU = 2 * Math.PI
const rad = degrees => degrees * Math.PI / 180
const clamp = (x, low, high) => Math.max(low, Math.min(high, x))
const mix = (a, b, rate, dt) => a + (b - a) * -Math.expm1(-rate * dt)
const turn = (heading, delta) => (heading + delta + TAU) % TAU
const takeoffSpeed = 58
const lowSpeedLimit = 280
const cruiseSpeedLimit = 12000 / 3.6

function speedLimit(agl) {
  return lowSpeedLimit + (cruiseSpeedLimit - lowSpeedLimit) * clamp((agl - 1000) / 5000, 0, 1)
}

export function belly(pitch = 0, bank = 0) {
  // The cohete.glb bounds (14.08 m nose/tail, 6.4 m span on the wider
  // side, 6.82 m below the origin) projected onto the local vertical.
  return .25 + 14.08 * Math.abs(Math.sin(pitch)) + Math.cos(pitch) *
    (6.4 * Math.abs(Math.sin(bank)) + 6.82 * Math.cos(bank))
}

export function newFlight(height, ground, heading) {
  return { height, ground, rawGround: ground, heading, pitch: 0, bank: 0,
    speed: 112, sink: 0, mode: 'air', waiting: false, landing: false, recovery: 0 }
}

export function aboveGround(state) {
  return Math.max(0, state.height - state.ground - belly(state.pitch, state.bank))
}

export function flightPhase(state) {
  return state.waiting ? 'waiting' : state.mode === 'ground' ? 'ground' :
    state.recovery > 0 ? 'recovery' : state.landing ? 'landing' : 'air'
}

// Advance one short step, returning the distance the aircraft actually travelled.
export function stepFlight(state, input, dt, probe) {
  const grounded = state.mode === 'ground'
  const { pitch, steer, throttle, brake } = input
  const current = probe(0, state.heading)
  const known = Number.isFinite(current)
  const agl = state.height - Math.max(state.ground, known ? current : state.rawGround) - belly(state.pitch, state.bank)
  const recovery = !grounded && state.recovery > 0
  const flare = !grounded && !recovery && pitch <= 0 && (brake || state.speed <= 77)
    ? clamp((95 - agl) / 95, 0, 1) : 0
  state.landing = flare > 0

  if (grounded) {
    state.speed = clamp(state.speed + (brake ? -85 : throttle > 0 ? 32 : throttle < 0 ? -30 : -14) * dt, 0, 100)
  } else {
    const limit = speedLimit(agl)
    const boost = clamp((agl - 1000) / 5000, 0, 1)
    const brakeRate = 98 + .14 * Math.max(0, state.speed - lowSpeedLimit)
    if (brake || recovery) {
      const target = recovery && !brake ? 95 : 31
      if (state.speed > target) state.speed = Math.max(target, state.speed - brakeRate * dt)
    } else if (state.speed > limit) {
      // Bleed speed on descent without snapping the ship to the new limit.
      state.speed = Math.max(limit, state.speed - (brakeRate + 150) * dt)
    } else {
      const acceleration = throttle > 0 ? 52 + 208 * boost : throttle < 0 ? -42 - .06 * Math.max(0, state.speed - lowSpeedLimit) : 0
      state.speed = clamp(state.speed + acceleration * dt, 31, limit)
    }
  }
  const rotate = grounded && !brake && pitch > 0 && state.speed >= takeoffSpeed
  const bankTarget = grounded || recovery ? 0 : steer * rad(48 - 33 * flare)
  const cruise = clamp((state.speed - lowSpeedLimit) / 1500, 0, 1)
  const pitchTarget = grounded ? (rotate ? rad(14) : 0) : recovery ? rad(brake ? 31 : 23) :
    pitch >= 0 ? pitch * rad(35 - 13 * cruise) : pitch * rad(41 - 33 * Math.max(flare, cruise))
  state.bank = mix(state.bank, bankTarget, 4.6, dt)
  state.pitch = mix(state.pitch, pitchTarget, 4.2, dt)
  // Airborne yaw follows the bank, not the key. On the ground, steering can
  // align the nose even after the aircraft stops rolling.
  const yaw = grounded ? steer * (state.speed > 40 ? .56 : .88) :
    clamp(Math.tan(state.bank) * 39 / (Math.min(state.speed, 820) + 42), -.68, .68)
  state.heading = turn(state.heading, yaw * dt)

  const distance = state.speed * Math.cos(state.pitch) * dt
  const next = known && distance > 0 ? probe(distance, state.heading) : current
  const clearance = belly(state.pitch, state.bank)
  if (!Number.isFinite(next)) {
    // Do not enter or sink into a gap in the DEM. Keep the nose controllable
    // and allow a climb while Cesium fetches the surrounding tiles.
    state.waiting = true
    state.sink = 0
    if (grounded) state.speed = 0
    const reference = Math.max(state.rawGround, known ? current : -Infinity)
    const rise = !grounded && state.height < reference + 12000 ? Math.max(0, Math.sin(state.pitch)) * state.speed * dt : 0
    state.height = Math.max(reference + clearance, state.height + rise)
    return 0
  }
  state.waiting = false
  // Separate a time-varying LOD change at the same point from spatial relief.
  // Follow spatial relief, but rate-limit LOD settling. The raw surface still
  // serves as a hard collision limit, so smoothing never hides penetration.
  const lodShift = current - state.rawGround
  const slope = distance > 0 ? (next - current) / distance : 0
  const spatialChange = clamp(next - current, -.65 * distance, .65 * distance)
  state.ground += spatialChange + clamp((current - state.ground) * 3 * dt, -12 * dt, 22 * dt)
  state.rawGround = next
  const floor = next + clearance

  if (grounded) {
    // Preserve the most recent higher support so switching repeatedly between
    // coarse and fine meshes does not drop the aircraft every other frame.
    state.ground = Math.max(state.ground, next)
    state.height = state.ground + clearance
    if (rotate) {
      state.mode = 'air'
      state.pitch = Math.max(state.pitch, rad(14))
      state.sink = 12
      state.height = state.ground + belly(state.pitch, state.bank) + 3
    }
    return distance
  }

  let sinkTarget = Math.sin(state.pitch) * state.speed
  if (flare > 0) {
    sinkTarget = Math.max(sinkTarget, -5 - 40 * (1 - flare) ** 2)
    if (brake && pitch === 0 && agl < 20) sinkTarget = Math.min(sinkTarget, -2)
  }
  state.sink = mix(state.sink, sinkTarget, flare > 0 ? 7 : 4, dt)
  const desired = Math.min(state.height + state.sink * dt, Math.max(state.ground, next) + 12000)
  if (desired <= floor) {
    const aligned = state.speed <= 83 && state.sink >= -15 && Math.abs(state.bank) <= rad(19) &&
      state.pitch >= rad(-17) && Math.abs(slope) <= .24
    state.sink = 0
    if (!recovery && aligned && lodShift < 6) {
      state.mode = 'ground'
      state.speed *= .78
      state.ground = next
    } else {
      state.recovery = Math.max(state.recovery, 3)
    }
  } else if (recovery) {
    state.recovery = Math.max(0, state.recovery - dt)
  } else if (agl < 180) {
    // Plain inclines remain landable. An imminent steep rise gets a head
    // start on the recovery before the raw collision clamp has to react.
    const look = Math.max(32, state.speed * 1.4)
    const ahead = probe(look, state.heading)
    if (Number.isFinite(ahead) && (ahead - current) / look > .25 &&
        ahead + clearance + 6 > state.height + state.sink * 1.4) state.recovery = 3
  }
  state.height = Math.max(desired, floor)
  return distance
}
