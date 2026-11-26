import { ORIGEN, GEO, MUNDO } from './historia-terreno.js'

export function geolocalizar(x, z) {
  const lon = ORIGEN.lon + x / GEO.mPorGradoLon
  return { lat: ORIGEN.lat - z / GEO.mPorGradoLat, lon: ((lon + 180) % 360 + 360) % 360 - 180 }
}
export function proyectar(lon, lat, ancho, alto) {
  return [(lon + 180) / 360 * ancho, (90 - lat) / 180 * alto]
}

// La carta se carga al abrir la tablet, no durante el aterrizaje.
export function cargarCartas(redibujar) {
  const cartas = {}
  for (const id of ['marte', 'regional', 'ares']) {
    const img = new Image()
    img.onload = () => { cartas[id] = img; redibujar() }
    img.onerror = () => { cartas[id] = null; redibujar() }
    img.src = new URL(`./datos/cartas/${id}.webp`, import.meta.url).href
  }
  return cartas
}

export function relieveLocal(g, cartas, sx, sy) {
  const capa = (img, x0, z0, x1, z1) => {
    if (img) g.drawImage(img, sx(x0), sy(z0), sx(x1) - sx(x0), sy(z1) - sy(z0))
  }
  // El jugador explora una fracción pequeña de Marte: basta la copia del atlas
  // que contiene Ares, y los recortes georreferenciados se superponen encima.
  const origen = geolocalizar(0, 0)
  capa(cartas.marte, (-180 - origen.lon)*GEO.mPorGradoLon, (origen.lat - 90)*GEO.mPorGradoLat,
    (180 - origen.lon)*GEO.mPorGradoLon, (origen.lat + 90)*GEO.mPorGradoLat)
  capa(cartas.regional, -24832, -24832, 24832, 24832) // centros de 97 muestras × 512 m
  capa(cartas.ares, MUNDO.x0, MUNDO.z0, MUNDO.x1, MUNDO.z1)
}

export function dibujarPlaneta(g, cartas, datos, w, h) {
  const ancho = Math.min(w - 24, (h - 52) * 2), alto = ancho/2
  const x0 = (w-ancho)/2, y0 = (h-alto)/2
  g.save(); g.translate(x0, y0)
  if (cartas.marte) g.drawImage(cartas.marte, 0, 0, ancho, alto)
  g.lineWidth = 1; g.strokeStyle = '#f1d5bf60'; g.beginPath()
  for (let lon=-180; lon<=180; lon+=60) {
    const [x] = proyectar(lon, 0, ancho, alto); g.moveTo(x, 0); g.lineTo(x, alto)
  }
  for (let lat=-90; lat<=90; lat+=30) {
    const [,y] = proyectar(0, lat, ancho, alto); g.moveTo(0, y); g.lineTo(ancho, y)
  }
  g.stroke(); g.fillStyle = '#f8dfbd'; g.font = 'bold 15px ui-monospace, monospace'; g.textAlign='center'
  g.fillText('NORTE · 90° N', ancho/2, -10); g.fillText('SUR · 90° S', ancho/2, alto+22)
  const {lon, lat} = geolocalizar(datos.x, datos.z), [x,y] = proyectar(lon,lat,ancho,alto)
  g.strokeStyle='#201916'; g.lineWidth=6; g.beginPath(); g.arc(x,y,8,0,2*Math.PI); g.stroke()
  g.strokeStyle='#ffd27a'; g.lineWidth=3; g.stroke(); g.fillStyle='#ffd27a'; g.fillRect(x-2,y-2,4,4)
  g.font='bold 13px ui-monospace, monospace'; g.textAlign='left'; g.fillStyle='#201916'; g.fillRect(x+12,y-21,130,22)
  g.fillStyle='#ffe5b7'; g.fillText('TÚ · ARES VALLIS',x+16,y-6); g.restore()
}
