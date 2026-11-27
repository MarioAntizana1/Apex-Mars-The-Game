// Shared player preferences. Safe in Node and in private windows without storage.
const CLAVE = 'apex-mars:preferencias'
export const OPCIONES_VOZ = Object.freeze(['apagada', 'ptt', 'siempre'])
export const IDIOMAS_VOZ = Object.freeze(['es-ES', 'es-MX', 'es-PE'])
const BASE = Object.freeze({
  sonido: true, ciencia: true, rumbo: false,
  voz: 'apagada', idiomaVoz: 'es-ES', vozHablada: false, mando: true,
})

function almacen() {
  try { return globalThis.localStorage ?? null } catch { return null }
}

export function leerPreferencias() {
  try {
    const saved = JSON.parse(almacen()?.getItem(CLAVE) ?? '{}')
    return {
      sonido: typeof saved.sonido === 'boolean' ? saved.sonido : BASE.sonido,
      ciencia: typeof saved.ciencia === 'boolean' ? saved.ciencia : BASE.ciencia,
      rumbo: typeof saved.rumbo === 'boolean' ? saved.rumbo : BASE.rumbo,
      voz: OPCIONES_VOZ.includes(saved.voz) ? saved.voz : BASE.voz,
      idiomaVoz: IDIOMAS_VOZ.includes(saved.idiomaVoz) ? saved.idiomaVoz : BASE.idiomaVoz,
      vozHablada: typeof saved.vozHablada === 'boolean' ? saved.vozHablada : BASE.vozHablada,
      mando: typeof saved.mando === 'boolean' ? saved.mando : BASE.mando,
    }
  } catch { return { ...BASE } }
}

export function guardarPreferencias(cambios) {
  const next = { ...leerPreferencias(), ...cambios }
  try { almacen()?.setItem(CLAVE, JSON.stringify(next)) } catch { /* storage may be blocked */ }
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
    globalThis.dispatchEvent(new globalThis.CustomEvent('apex:preferencias', { detail: next }))
  }
  return next
}
