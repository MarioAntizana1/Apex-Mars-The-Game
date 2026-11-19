const PI = Math.PI
const TAU = 2 * PI
const wrap = value => ((value % TAU) + TAU) % TAU

// Advance along a great circle on Mars and carry its tangent into the new
// local north/east frame. A constant compass bearing would bend the path.
export function followArc(latitude, longitude, heading, arc, out) {
  const sinLat = Math.sin(latitude), cosLat = Math.cos(latitude)
  const sinArc = Math.sin(arc), cosArc = Math.cos(arc)
  const north = Math.cos(heading), east = Math.sin(heading)
  out.latitude = Math.asin(Math.max(-1, Math.min(1, sinLat * cosArc + cosLat * sinArc * north)))
  out.longitude = wrap(longitude + Math.atan2(east * sinArc * cosLat,
    cosArc - sinLat * Math.sin(out.latitude)) + PI) - PI
  out.heading = wrap(Math.atan2(east * cosLat, north * cosLat * cosArc - sinLat * sinArc))
  return out
}
