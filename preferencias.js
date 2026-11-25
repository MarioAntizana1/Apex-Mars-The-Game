// Shared player preferences. Safe in Node and in private windows without storage.
const CLAVE = 'apex-mars:preferencias'
const BASE = Object.freeze({ sonido: true, ciencia: true, rumbo: false })

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
