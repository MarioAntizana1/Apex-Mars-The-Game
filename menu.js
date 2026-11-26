import { crearListaCreditos } from './creditos.js'
import { guardarPreferencias, leerPreferencias } from './preferencias.js'

const RETARDO_PREVIA = 180

const VISTAS = {
  iniciar: { lon: -133.2, lat: 18.31, altura: 210000, pitch: -88, duracion: 3.6, nombre: 'Monte Olimpo' },
  opciones: { lon: 77.4509, lat: 18.4446, altura: 22000, pitch: -62, duracion: 3.2, nombre: 'Cráter Jezero' },
  globo: { lon: 73, lat: 16, altura: 8400000, pitch: -90, duracion: 3, nombre: 'Marte completo' },
  creditos: { lon: -78.5, lat: -7.7, altura: 420000, pitch: -80, duracion: 3.4, nombre: 'Valles Marineris' },
}

const SOBREVUELOS = {
  opciones: [
    { lon: 77.18, lat: 18.46, altura: 3200, pitch: -25, duracion: 5 },
    { lon: 77.86, lat: 18.43, altura: 2800, pitch: -25, duracion: 7 },
  ],
  creditos: [
    { lon: -98, lat: -16, altura: 130000, pitch: -70, duracion: 6 },
    { lon: -60, lat: -3, altura: 110000, pitch: -70, duracion: 8 },
  ],
}

function menuInactivo() {
  return { ocultar() {}, mostrar() {}, actualizar() {}, destruir() {} }
}

export function crearMenu(C, viewer, ellipsoid, opciones = {}) {
  const raiz = document.querySelector('#menu')
  if (!C || !viewer?.camera || !raiz) return menuInactivo()

  const botones = new Map()
  raiz.querySelectorAll('[data-menu]').forEach(boton => botones.set(boton.dataset.menu, boton))
  const panelOpciones = raiz.querySelector('#menu-opciones')
  const panelCreditos = raiz.querySelector('#menu-creditos')
  const estado = raiz.querySelector('#menu-estado')
  const sonido = raiz.querySelector('#opcion-sonido')
  const ciencia = raiz.querySelector('#opcion-ciencia')
  const rumbo = raiz.querySelector('#opcion-rumbo')
  const volver = raiz.querySelector('#menu-volver')
  const control = new AbortController()
  const { signal } = control

  let panel = null
  let pendiente = null
  let temporizador = 0
  let turno = 0
  let sobrevolando = false
  let cienciaAplicada = null

  const escuchar = (elemento, tipo, manejador) => elemento?.addEventListener(tipo, manejador, { signal })

  function reducido() {
    return opciones.reduced === true ||
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  }

  function anunciar(texto) {
    if (estado) estado.textContent = texto
  }

  function seleccionar(clave) {
    for (const [nombre, boton] of botones) boton.setAttribute('aria-pressed', String(nombre === clave))
    raiz.dataset.vista = clave
  }

  function abrirPanel(nombre) {
    panel = nombre
    if (panelOpciones) panelOpciones.hidden = nombre !== 'opciones'
    if (panelCreditos) panelCreditos.hidden = nombre !== 'creditos'
    if (nombre === 'creditos') crearCreditos()
  }

  function cerrarPaneles() {
    panel = null
    if (panelOpciones) panelOpciones.hidden = true
    if (panelCreditos) panelCreditos.hidden = true
  }

  function crearCreditos() {
    if (!panelCreditos || panelCreditos.dataset.creado === 'si') return
    panelCreditos.dataset.creado = 'si'
    const titulo = document.createElement('h2')
    titulo.className = 'menu-creditos-titulo'
    titulo.textContent = 'Créditos de la misión'
    const lista = document.createElement('ul')
    lista.className = 'menu-creditos-lista'
    crearListaCreditos(document, lista)
    const retroceso = document.createElement('button')
    retroceso.type = 'button'
    retroceso.className = 'menu-volver'
    retroceso.textContent = 'Volver a los destinos'
    escuchar(retroceso, 'click', volverAlGlobo)
    panelCreditos.replaceChildren(titulo, lista, retroceso)
  }

  function volarA(clave, alTerminar) {
    const vista = VISTAS[clave]
    if (!vista) return
    turno += 1
    const token = turno
    sobrevolando = false
    viewer.camera.cancelFlight()
    const destino = C.Cartesian3.fromDegrees(vista.lon, vista.lat, vista.altura, ellipsoid)
    const orientacion = { heading: 0, pitch: C.Math.toRadians(vista.pitch), roll: 0 }
    if (reducido()) {
      viewer.camera.setView({ destination: destino, orientation: orientacion })
      alTerminar?.()
      return
    }
    viewer.camera.flyTo({
      destination: destino,
      orientation: orientacion,
      duration: vista.duracion,
      complete() {
        if (token === turno) alTerminar?.()
      },
    })
  }

  function volarSobrevuelo(clave, alTerminar) {
    const tramos = SOBREVUELOS[clave]
    if (!tramos || reducido()) {
      volarA(clave, alTerminar)
      return
    }
    turno += 1
    const token = turno
    sobrevolando = true
    viewer.camera.cancelFlight()
    let indice = 0
    const siguiente = () => {
      if (token !== turno) return
      const tramo = tramos[indice]
      indice += 1
      if (!tramo) {
        sobrevolando = false
        alTerminar?.()
        return
      }
      viewer.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(tramo.lon, tramo.lat, tramo.altura, ellipsoid),
        orientation: { heading: 0, pitch: C.Math.toRadians(tramo.pitch), roll: 0 },
        duration: tramo.duracion,
        complete: siguiente,
        cancel() {
          if (token === turno) sobrevolando = false
        },
      })
    }
    siguiente()
  }

  function cancelarPrevia() {
    if (temporizador) clearTimeout(temporizador)
    temporizador = 0
    pendiente = null
  }

  function programarPrevia(clave) {
    if (raiz.hidden || sobrevolando || !VISTAS[clave]) return
    cancelarPrevia()
    pendiente = clave
    temporizador = setTimeout(() => {
      temporizador = 0
      if (raiz.hidden || sobrevolando || pendiente !== clave) return
      const nombre = VISTAS[clave].nombre
      anunciar(`Vista previa · ${nombre}`)
      volarA(clave, () => {
        if (pendiente === clave && !raiz.hidden) anunciar(`Vista previa · ${nombre}`)
      })
    }, RETARDO_PREVIA)
  }

  function volverAlGlobo() {
    if (raiz.hidden) return
    cancelarPrevia()
    cerrarPaneles()
    seleccionar('globo')
    anunciar('Marte completo')
    volarA('globo', () => {
      if (!raiz.hidden) anunciar('Marte completo · elige un destino')
    })
  }

  function iniciarPartida() {
    if (raiz.hidden) return
    cancelarPrevia()
    turno += 1
    sobrevolando = false
    viewer.camera.cancelFlight()
    opciones.detenerVuelo?.()
    ocultar()
    opciones.iniciar?.()
  }

  function abrirOpciones() {
    if (raiz.hidden) return
    cancelarPrevia()
    seleccionar('opciones')
    abrirPanel('opciones')
    if (reducido()) {
      anunciar('Cráter Jezero · elige una opción')
      volarA('opciones', () => anunciar('Cráter Jezero · elige una opción'))
      return
    }
    anunciar('Sobrevuelo por Jezero…')
    volarSobrevuelo('opciones', () => anunciar('Sobrevuelo por Jezero completado'))
  }

  function abrirCreditos() {
    if (raiz.hidden) return
    cancelarPrevia()
    seleccionar('creditos')
    abrirPanel('creditos')
    anunciar('Créditos · Valles Marineris')
    if (reducido()) {
      volarA('creditos', () => anunciar('Créditos · Valles Marineris'))
      return
    }
    volarSobrevuelo('creditos', () => anunciar('Sobrevuelo por Valles Marineris completado'))
  }

  function elegir(clave) {
    if (raiz.hidden) return
    cancelarPrevia()
    if (clave === 'iniciar') iniciarPartida()
    else if (clave === 'opciones') abrirOpciones()
    else if (clave === 'globo') volverAlGlobo()
    else if (clave === 'creditos') abrirCreditos()
  }

  function ocultar() {
    cancelarPrevia()
    raiz.hidden = true
  }

  function mostrar() {
    if (!raiz.hidden) return
    raiz.hidden = false
    cerrarPaneles()
    seleccionar('globo')
    anunciar('Marte completo · elige un destino')
    volarA('globo')
  }

  function aplicarCiencia(activa) {
    cienciaAplicada = activa
    if (typeof opciones.ciencia === 'function') opciones.ciencia(activa)
  }

  function actualizar() {
    const prefs = leerPreferencias()
    if (sonido) sonido.checked = prefs.sonido
    if (ciencia) ciencia.checked = prefs.ciencia
    if (rumbo) rumbo.checked = prefs.rumbo
    if (prefs.ciencia !== cienciaAplicada) aplicarCiencia(prefs.ciencia)
  }

  function destruir() {
    cancelarPrevia()
    control.abort()
    turno += 1
    sobrevolando = false
    viewer.camera?.cancelFlight?.()
  }

  for (const [clave, boton] of botones) {
    escuchar(boton, 'click', () => elegir(clave))
    escuchar(boton, 'pointerenter', () => programarPrevia(clave))
    escuchar(boton, 'focus', () => programarPrevia(clave))
    escuchar(boton, 'pointerleave', cancelarPrevia)
    escuchar(boton, 'blur', cancelarPrevia)
  }
  escuchar(volver, 'click', volverAlGlobo)
  escuchar(sonido, 'change', () => {
    guardarPreferencias({ sonido: Boolean(sonido.checked) })
    anunciar(sonido.checked ? 'Sonidos activados' : 'Sonidos desactivados')
  })
  escuchar(ciencia, 'change', () => {
    guardarPreferencias({ ciencia: Boolean(ciencia.checked) })
    aplicarCiencia(ciencia.checked)
    anunciar(ciencia.checked ? 'Imágenes científicas activadas' : 'Imágenes científicas desactivadas')
  })
  escuchar(rumbo, 'change', () => {
    guardarPreferencias({ rumbo: Boolean(rumbo.checked) })
    anunciar(rumbo.checked ? 'Flecha de rumbo activada' : 'Flecha de rumbo desactivada')
  })
  escuchar(globalThis, 'apex:preferencias', actualizar)

  const prefs = leerPreferencias()
  if (sonido) sonido.checked = prefs.sonido
  if (ciencia) ciencia.checked = prefs.ciencia
  if (rumbo) rumbo.checked = prefs.rumbo
  aplicarCiencia(prefs.ciencia)
  cerrarPaneles()
  seleccionar('globo')
  anunciar('Marte completo · elige un destino')

  return { ocultar, mostrar, actualizar, destruir }
}
