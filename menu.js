import { iniciarVueloCreditos } from './creditos-vuelo.js'
import { crearListaCreditos } from './creditos.js'
import { guardarPreferencias, leerPreferencias } from './preferencias.js'

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
  const voz = raiz.querySelector('#opcion-voz')
  const idiomaVoz = raiz.querySelector('#opcion-idioma-voz')
  const vozHablada = raiz.querySelector('#opcion-voz-hablada')
  const mando = raiz.querySelector('#opcion-mando')
  const volver = raiz.querySelector('#menu-volver')
  const control = new AbortController()
  const { signal } = control

  let panel = null
  let detenerVueloCreditos = null
  const musica = panelCreditos.querySelector('audio')
  const regresar = panelCreditos.querySelector('.menu-volver')
  crearListaCreditos(document, panelCreditos.querySelector('ul'))
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

  function salirDeCreditos() {
    detenerVueloCreditos?.()
    detenerVueloCreditos = null
    if (panel === 'creditos') { musica.pause(); musica.currentTime = 0 }
    panelCreditos.hidden = true
  }

  function volverAlGlobo() {
    const anterior = panel
    salirDeCreditos()
    panel = null
    panelOpciones.hidden = true
    seleccionar('globo')
    anunciar('Marte en órbita · elige un destino')
    opciones.orbita?.iniciar(reducido())
    if (anterior) botones.get(anterior)?.focus()
  }

  function abrirCreditos() {
    if (panel === 'creditos') return
    opciones.orbita?.detener()
    viewer.camera.cancelFlight()
    panel = 'creditos'
    panelOpciones.hidden = true
    seleccionar(panel)
    panelCreditos.dataset.reducido = String(reducido())
    panelCreditos.hidden = false
    panelCreditos.querySelector('.creditos-ventana').scrollTop = 0
    detenerVueloCreditos = iniciarVueloCreditos(C, viewer, ellipsoid, { reducido: reducido() })
    if (leerPreferencias().sonido) musica.play().catch(() => {})
    regresar.focus()
  }

  function elegir(clave) {
    if (raiz.hidden) return
    if (clave === 'iniciar') {
      ocultar()
      opciones.detenerVuelo?.()
      opciones.iniciar?.()
    } else if (clave === 'opciones') {
      panel = clave
      seleccionar(clave)
      panelOpciones.hidden = false
      anunciar('Opciones de la misión')
    } else if (clave === 'globo') volverAlGlobo()
    else if (clave === 'creditos') abrirCreditos()
  }

  function ocultar() {
    opciones.orbita?.detener()
    salirDeCreditos()
    panel = null
    raiz.hidden = true
  }

  function mostrar() {
    raiz.hidden = false
    volverAlGlobo()
  }
  function aplicarCiencia(activa) {
    cienciaAplicada = activa
    if (typeof opciones.ciencia === 'function') opciones.ciencia(activa)
  }

  function sincronizarControles(prefs) {
    const campos = [
      ['opcion-voz', prefs.voz], ['pausa-voz', prefs.voz],
      ['opcion-idioma-voz', prefs.idiomaVoz], ['pausa-idioma-voz', prefs.idiomaVoz],
      ['opcion-voz-hablada', prefs.vozHablada, 'checkbox'], ['pausa-voz-hablada', prefs.vozHablada, 'checkbox'],
      ['opcion-mando', prefs.mando, 'checkbox'], ['pausa-mando', prefs.mando, 'checkbox'],
    ]
    for (const [id, valor, tipo] of campos) {
      const nodo = document.getElementById(id)
      if (!nodo) continue
      if (tipo === 'checkbox') nodo.checked = Boolean(valor)
      else nodo.value = valor
    }
  }

  function actualizar() {
    const prefs = leerPreferencias()
    if (sonido) sonido.checked = prefs.sonido
    if (ciencia) ciencia.checked = prefs.ciencia
    if (rumbo) rumbo.checked = prefs.rumbo
    sincronizarControles(prefs)
    if (prefs.ciencia !== cienciaAplicada) aplicarCiencia(prefs.ciencia)
  }

  function destruir() {
    ocultar()
    control.abort()
  }

  for (const [clave, boton] of botones) escuchar(boton, 'click', () => elegir(clave))
  escuchar(regresar, 'click', volverAlGlobo)
  escuchar(panelCreditos.querySelector('.creditos-roll'), 'animationend', e => {
    if (e.animationName === 'roll-final' && panel === 'creditos') volverAlGlobo()
  })
  escuchar(document, 'keydown', e => {
    if (e.key === 'Escape' && panel === 'creditos') { e.preventDefault(); volverAlGlobo() }
  })
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
  escuchar(voz, 'change', () => {
    guardarPreferencias({ voz: voz.value })
    anunciar({ apagada: 'Voz del OBC apagada', ptt: 'Pulsar para hablar · mantén F o LB', siempre: 'OBC escuchando «Nostromo»' }[voz.value] ?? 'Voz del OBC actualizada')
  })
  escuchar(idiomaVoz, 'change', () => {
    guardarPreferencias({ idiomaVoz: idiomaVoz.value })
    anunciar('Idioma de voz actualizado')
  })
  escuchar(vozHablada, 'change', () => {
    guardarPreferencias({ vozHablada: Boolean(vozHablada.checked) })
    anunciar(vozHablada.checked ? 'Voz hablada activada' : 'Voz hablada desactivada')
  })
  escuchar(mando, 'change', () => {
    guardarPreferencias({ mando: Boolean(mando.checked) })
    anunciar(mando.checked ? 'Mando de Xbox activado' : 'Mando de Xbox desactivado')
  })
  escuchar(globalThis, 'apex:preferencias', actualizar)

  actualizar()
  if (!raiz.hidden) volverAlGlobo()

  return { ocultar, mostrar, actualizar, destruir }
}
