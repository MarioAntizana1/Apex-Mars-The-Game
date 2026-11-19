const smooth = x => (x = Math.max(0, Math.min(1, x)), x * x * (3 - 2 * x))

// CTX and the RED HiRISE orthophoto are monochrome. These palettes are
// display treatments; luminance still comes from the original imagery.
const looks = {
  ctx: { shadow: [43, 26, 23], middle: [159, 105, 77], light: [246, 208, 161], low: 16, high: 235, gamma: .91 },
  hirise: { shadow: [32, 23, 23], middle: [165, 115, 87], light: [253, 216, 174], low: 30, high: 194, gamma: .68 },
}

export function stylishTiles(C, provider, url, { look, feather = 0, transparentBlack = false } = {}) {
  const lut = looks[look] && Array.from({ length: 256 }, (_, i) => {
    const { shadow, middle, light, low, high, gamma } = looks[look]
    const t = Math.max(0, Math.min(1, (i - low) / (high - low))) ** gamma
    const a = t < .5 ? shadow : middle
    const b = t < .5 ? middle : light
    return a.map((k, c) => Math.round(k + (b[c] - k) * (t < .5 ? 2 * t : 2 * t - 1)))
  })
  if (!lut && !feather && !transparentBlack) return provider
  provider.requestImage = (x, y, level, request) => {
    // Request an HTMLImageElement, not a pre-flipped ImageBitmap. Cesium
    // uploads the processed canvas using its usual texture orientation.
    const resource = new C.Resource({ url: url.replace('{z}', level).replace('{x}', x).replace('{y}', y), request })
    return resource.fetchImage({ preferImageBitmap: false })?.then(source => {
      const canvas = document.createElement('canvas')
      const width = canvas.width = source.width
      const height = canvas.height = source.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return source
      ctx.drawImage(source, 0, 0)
      let image
      try { image = ctx.getImageData(0, 0, width, height) } catch { return source }
      const { data } = image
      const cols = provider.tilingScheme.getNumberOfXTilesAtLevel(level)
      const rows = provider.tilingScheme.getNumberOfYTilesAtLevel(level)
      for (let row = 0, i = 0; row < height; row++) {
        const v = (y + (row + .5) / height) / rows
        for (let col = 0; col < width; col++, i += 4) {
          if (!data[i + 3]) continue
          const l = (54 * data[i] + 183 * data[i + 1] + 19 * data[i + 2]) >> 8
          if (lut) {
            const color = lut[l]
            data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]
          }
          if (transparentBlack && l <= 6) data[i + 3] *= smooth(l / 7)
          if (feather) {
            const u = (x + (col + .5) / width) / cols
            data[i + 3] *= smooth(Math.min(u, v, 1 - u, 1 - v) / feather)
          }
        }
      }
      ctx.putImageData(image, 0, 0)
      return canvas
    })
  }
  return provider
}

export function atmosferaMarciana(C, scene, globe) {
  scene.skyAtmosphere = new C.SkyAtmosphere(globe.ellipsoid)
  const rayleigh = new C.Cartesian3(13e-6, 8e-6, 5e-6)
  const mie = new C.Cartesian3(20e-6, 14e-6, 9e-6)
  scene.skyAtmosphere.rayleighCoefficient = rayleigh
  scene.skyAtmosphere.mieCoefficient = mie
  // Keep the near-surface sky dusty rather than the default terrestrial blue.
  scene.skyAtmosphere.hueShift = .52
  scene.skyAtmosphere.saturationShift = -.06
  globe.showGroundAtmosphere = true
  globe.atmosphereRayleighCoefficient = C.Cartesian3.clone(rayleigh)
  globe.atmosphereMieCoefficient = C.Cartesian3.clone(mie)
  scene.fog.enabled = true
  scene.fog.renderable = true
  scene.fog.density = .00036
  scene.fog.maxHeight = 250000
  scene.fog.visualDensityScalar = .64
  scene.fog.screenSpaceErrorFactor = 1.6
  scene.fog.minimumBrightness = .16
}
