const levelOffset = level => 2 * (4 ** level - 1) / 3
const tileIndex = (x, y, level) => levelOffset(level) + y * (2 << level) + x
const tileCount = level => levelOffset(level + 1)
const paths = ['base-global-v2.bin', 'base-global-v1.pack']

export async function preloadBase(C, size, terrainLevel, scheme, apply) {
  const urls = paths.map(path => new URL(`./datos/bloques/${path}`, import.meta.url))
  const cache = await globalThis.caches?.open('the-game-base-global-v1').catch(() => null)
  const downloaded = await Promise.all(urls.map(async url => {
    const saved = await cache?.match(url).catch(() => null)
    const response = saved ?? await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const copy = !saved && cache ? response.clone() : null
    return { data: await response.arrayBuffer(), copy }
  }))
  const [terrain, imagery] = downloaded.map(item => item.data)
  const stride = size * size * 2
  if (terrain.byteLength !== tileCount(terrainLevel) * stride) throw new Error('Relieve base incompleto')
  const imageLevel = 4
  const imageCount = tileCount(imageLevel)
  const header = (imageCount + 1) * 4
  if (imagery.byteLength <= header) throw new Error('Imágenes base incompletas')
  const offsets = new DataView(imagery, 0, header)
  let last = 0
  for (let i = 0; i <= imageCount; i++) {
    const next = offsets.getUint32(i * 4, true)
    if ((i === 0 ? next !== 0 : next <= last) || next > imagery.byteLength - header) {
      throw new Error('Índice de imágenes base inválido')
    }
    last = next
  }
  if (last !== imagery.byteLength - header) throw new Error('Tamaño de imágenes base incorrecto')

  const provider = new C.UrlTemplateImageryProvider({
    url: './datos/bloques/imagen/marte/{z}/{x}/{y}.webp',
    tilingScheme: scheme, maximumLevel: imageLevel,
  })
  provider.requestImage = async (x, y, level) => {
    const index = tileIndex(x, y, level)
    const start = offsets.getUint32(index * 4, true)
    const end = offsets.getUint32((index + 1) * 4, true)
    const blob = new Blob([new Uint8Array(imagery, header + start, end - start)], { type: 'image/webp' })
    const url = URL.createObjectURL(blob)
    try {
      return await new C.Resource(url).fetchImage({ preferImageBitmap: true, flipY: true })
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  apply((x, y, level) => level <= terrainLevel
    ? new DataView(terrain, tileIndex(x, y, level) * stride, stride)
    : undefined, provider)
  await Promise.all(downloaded.map(({ copy }, i) => copy && cache.put(urls[i], copy).catch(() => {})))
}
