// Catálogo único de comandos de voz del OBC «Nostromo».
// Lo consumen la simulación (sim.comando) y el emparejador de frases (voz.js).
// Sin DOM, sin audio y sin dependencias: se puede importar en Node.

export const TONOS = Object.freeze(['ok', 'aviso', 'error', 'info', 'pregunta'])

// `frases` son ejemplos y sinónimos; voz.js añade tolerancia a errores del ASR.
// `categoria` agrupa la ayuda y separa los guiños del resto.
export const COMANDOS = Object.freeze([
  {
    id: 'diagnostico',
    categoria: 'nave',
    frases: ['dame diagnóstico de nave', 'diagnóstico de nave', 'diagnóstico de vuelo', 'dame el diagnóstico', 'consultar diagnóstico'],
    descripcion: 'Lee el diagnóstico de vuelo desde dentro de la nave.',
  },
  {
    id: 'rover',
    categoria: 'rover',
    frases: ['despliega el rover', 'desplegar rover', 'despliega rover', 'saca el rover', 'despliega el vehículo'],
    descripcion: 'Despliega el rover si estás fuera y te sube a bordo.',
  },
  {
    id: 'tierra',
    categoria: 'nave',
    frases: ['intenta transmisión con la Tierra', 'intenta la transmisión con la Tierra', 'llama a la Tierra', 'intenta contacto con Houston', 'transmisión a Tierra'],
    descripcion: 'Intenta el enlace con Tierra desde el puente de mando.',
  },
  {
    id: 'mision',
    categoria: 'misión',
    frases: ['qué hago', 'estado de la misión', 'objetivo actual', 'cuál es el objetivo', 'qué toca ahora'],
    descripcion: 'Lee el objetivo actual de la misión.',
  },
  {
    id: 'traje',
    categoria: 'traje',
    frases: ['estado del traje', 'cómo está el traje', 'revisa el traje', 'diagnóstico del traje'],
    descripcion: 'Informa del estado del traje y del escáner médico.',
  },
  {
    id: 'estadoRover',
    categoria: 'rover',
    frases: ['estado del rover', 'cómo está el rover', 'telemetría del rover', 'revisa el rover'],
    descripcion: 'Lee la telemetría del rover: ruedas, altura y velocidad.',
  },
  {
    id: 'abrirMapa',
    categoria: 'nave',
    frases: ['abre el mapa', 'abrir mapa', 'muéstrame el mapa', 'abre la tablet'],
    descripcion: 'Abre el mapa de la tablet si la llevas contigo.',
  },
  {
    id: 'cerrarMapa',
    categoria: 'nave',
    frases: ['cierra el mapa', 'cerrar mapa', 'quita el mapa', 'cierra la tablet'],
    descripcion: 'Cierra el mapa de la tablet.',
  },
  {
    id: 'rumbo',
    categoria: 'nave',
    frases: ['rumbo a Sagan', 'dónde está Sagan', 'cuánto falta para Sagan', 'distancia a Sagan'],
    descripcion: 'Da la distancia y el rumbo hasta la estación Sagan.',
  },
  {
    id: 'silencio',
    categoria: 'voz',
    frases: ['silencio', 'cállate', 'modo silencioso', 'guarda silencio'],
    descripcion: 'Silencia las respuestas del OBC hasta que lo vuelvas a llamar.',
  },
  {
    id: 'habla',
    categoria: 'voz',
    frases: ['habla', 'vuelve a hablar', 'activa la voz', 'en voz alta'],
    descripcion: 'Reactiva las respuestas habladas del OBC.',
  },
  {
    id: 'baliza',
    categoria: 'misión',
    frases: ['estado de la baliza', 'cómo está la baliza', 'revisa la baliza', 'dónde está la baliza'],
    descripcion: 'Informa del estado y la distancia de la baliza.',
  },
  {
    id: 'esclusa',
    categoria: 'nave',
    frases: ['estado de la esclusa', 'cómo está la esclusa', 'presión de la esclusa'],
    descripcion: 'Lee la presión y las compuertas de la esclusa.',
  },
  {
    id: 'lucesOn',
    categoria: 'nave',
    frases: ['enciende las luces', 'luces', 'luces de cabina', 'prende las luces', 'ilumina la cabina'],
    descripcion: 'Enciende las luces de la cabina.',
  },
  {
    id: 'lucesOff',
    categoria: 'nave',
    frases: ['apaga las luces', 'luces apagadas', 'sin luces', 'oscurece la cabina'],
    descripcion: 'Apaga las luces de la cabina.',
  },
  {
    id: 'tormenta',
    categoria: 'nave',
    frases: ['informe de tormenta', 'hay tormenta', 'estado del clima', 'cómo está el clima', 'tormenta'],
    descripcion: 'Informa del polvo y la tormenta en el exterior.',
  },
  {
    id: 'ayuda',
    categoria: 'voz',
    frases: ['ayuda', 'comandos', 'ayuda de voz', 'qué puedo decir', 'qué comandos hay'],
    descripcion: 'Lista los comandos de voz disponibles.',
  },
  {
    id: 'presente',
    categoria: 'guiño',
    frases: ['estás ahí', 'sigues ahí', '¿estás en línea?', 'oye, ¿estás ahí?'],
    descripcion: 'Comprueba que el OBC sigue en línea.',
  },
  {
    id: 'hangar',
    categoria: 'guiño',
    frases: ['abre las puertas del hangar', 'abrir hangar', 'abre el hangar', 'puertas del hangar'],
    descripcion: 'Guiño: el OBC no puede abrir el hangar.',
  },
])

// Los ids que no tienen frase propia: el emparejador los usa para la
// pregunta de aclaración y para el rechazo educado.
export const RESERVADOS = Object.freeze(['ambiguo', 'desconocido'])

export const IDS = Object.freeze([
  'diagnostico', 'rover', 'tierra', 'mision', 'traje', 'estadoRover',
  'abrirMapa', 'cerrarMapa', 'rumbo', 'silencio', 'habla', 'baliza',
  'esclusa', 'lucesOn', 'lucesOff', 'tormenta', 'ayuda', 'presente',
  'hangar', 'ambiguo', 'desconocido',
])

// Palabras sueltas que no identifican un comando por sí solas.
export const AMBIGUOS = Object.freeze(['estado', 'informe', 'diagnóstico'])

const POR_ID = new Map(COMANDOS.map(comando => [comando.id, comando]))

export function comando(id) {
  return POR_ID.get(id) ?? null
}

export function fraseEjemplo(id) {
  return comando(id)?.frases[0] ?? ''
}

// Lista preparada para la respuesta de «ayuda»: el HUD puede paginarla.
export function listaAyuda() {
  return COMANDOS.map(({ id, categoria, frases, descripcion }) => ({
    id, categoria, frase: frases[0], descripcion,
  }))
}
