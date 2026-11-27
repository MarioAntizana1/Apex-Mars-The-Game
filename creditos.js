// Lista única de créditos para el menú de inicio y la pausa.
// documentacion/12-creditos.md repite estos datos; creditos.test.mjs vigila que
// los nombres y los recursos no se separen.
export const EQUIPO = [
  'Mario Manuel Antizana Ponce de Leon',
  'Esther Mamani Condor',
  'Diego Bellido Tello',
]

export const CREDITOS = [
  { titulo: 'Mario Manuel Antizana Ponce de Leon', detalle: 'Equipo del proyecto' },
  { titulo: 'Esther Mamani Condor', detalle: 'Equipo del proyecto' },
  { titulo: 'Diego Bellido Tello', detalle: 'Equipo del proyecto' },
  { titulo: 'Fuentes de datos', detalle: 'HiRISE · NASA/JPL/University of Arizona; MOLA · NASA/JPL/MOLA Science Team' },
  { titulo: 'Imágenes orbitales', detalle: 'CTX · NASA/JPL/MSSS/Caltech Murray Lab/Esri; Viking · NASA/USGS Astrogeology' },
  { titulo: 'Motores', detalle: 'CesiumJS 1.147.0 · Apache 2.0; three.js r160 · MIT' },
  { titulo: 'Modelos 3D', detalle: 'Pathfinder y Sojourner · reconstrucción original del proyecto; glTF 2.0' },
  { titulo: 'Tipografías', detalle: 'Pila del sistema (system-ui / Segoe UI y ui-monospace); sin fuentes externas' },
  { titulo: 'Audio', detalle: 'Web Audio API · efectos de sonido sintetizados' },
  { titulo: 'Herramientas', detalle: 'Node.js · NumPy · Pillow · WebP para datos, cartas y pruebas' },
  { titulo: 'Agradecimientos', detalle: 'NASA, JPL, USGS Astrogeology y la misión Mars Pathfinder (1997)' },
  { titulo: 'Engel Retro', detalle: 'Cristian Castro - Azul [8-Bit Version]' },
]

export function crearListaCreditos(documento, lista, datos = CREDITOS) {
  for (const { titulo, detalle } of datos) {
    const item = documento.createElement('li')
    const rotulo = documento.createElement('b')
    rotulo.textContent = titulo
    const nota = documento.createElement('small')
    nota.textContent = detalle
    item.append(rotulo, nota)
    lista.append(item)
  }
  return lista
}
