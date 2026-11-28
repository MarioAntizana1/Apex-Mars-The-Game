// Consola del OBC: barra de diálogo diegética, tira KITT, comandos escritos y
// ajustes compartidos por el menú inicial y la pausa. Sin dependencias.
import { guardarPreferencias, leerPreferencias } from './preferencias.js'

const SEGMENTOS = 14
const POR_PAGINA = 4
const TONO_A_EFECTO = { info: 'info', ok: 'confirmar', aviso: 'aviso', pregunta: 'aviso', error: 'negativa' }
const CAMPOS = [
  ['voz', 'opcion-voz', 'pausa-voz'],
  ['idiomaVoz', 'opcion-idioma-voz', 'pausa-idioma-voz'],
  ['vozHablada', 'opcion-voz-hablada', 'pausa-voz-hablada'],
  ['mando', 'opcion-mando', 'pausa-mando'],
]
const AYUDA = 'Mantén F para hablar · botón OBC para escribir'
const AYUDA_MANDO = 'Mantén LB para hablar · botón OBC para escribir'
const AYUDA_JUEGO = 'A usar · B saltar · X vehículo · Y tablet · LB hablar · RT correr'
const TECLAS = { 'eva-vehiculo': ' · V', 'eva-mapa': ' · M' }
const VIDAS = { texto: 9000, turnos: 14000, lista: 30000, despertar: 12000 }

// Un ítem de lista puede venir como texto o como ficha {comando, descripcion}.
export function textoDeItem(item) {
  if (typeof item === 'string') return item.trim()
  if (!item || typeof item !== 'object') return ''
  const principal = item.frase ?? item.comando ?? item.texto ?? item.titulo ?? item.nombre ?? ''
  const detalle = item.descripcion ?? item.detalle ?? item.desc ?? ''
  const texto = principal ? (detalle ? `${principal} — ${detalle}` : principal) : detalle
  return String(texto ?? '').trim()
}

export function paginar(items, tamano = POR_PAGINA) {
  const limpios = (Array.isArray(items) ? items : []).map(textoDeItem).filter(Boolean)
  const porPagina = Math.max(1, Math.floor(Number(tamano)) || POR_PAGINA)
  const paginas = []
  for (let i = 0; i < limpios.length; i += porPagina) paginas.push(limpios.slice(i, i + porPagina))
  return { items: limpios, paginas: paginas.length ? paginas : [[]], tamano: porPagina }
}

export function crearConsola({ alEnviar, alPulsar, alAjustar, alTono, alVozHablada, documento = globalThis.document, ventana = globalThis } = {}) {
  const $ = id => documento?.getElementById?.(id) ?? null
  const barra = $('obc'), estadoNodo = $('obc-estado'), textoNodo = $('obc-texto'), kitt = $('obc-kitt')
  const ayuda = $('obc-ayuda'), micro = $('obc-micro'), eva = $('eva')
  const editor = $('obc-editor'), formulario = $('obc-editor-form'), entrada = $('obc-entrada')
  const abrir = $('obc-abrir'), tabletObc = $('tablet-obc'), cancelar = $('obc-cerrar-editor')
  const nav = $('obc-nav'), pagAnterior = $('obc-pagina-prev'), pagSiguiente = $('obc-pagina-next'), pagContador = $('obc-pagina')
  const ayudaJuego = $('eva-ayuda'), ayudaJuegoTexto = ayudaJuego?.textContent ?? ''
  const eventos = new AbortController()
  const { signal } = eventos
  const on = (nodo, tipo, fn, extra = {}) => { nodo?.addEventListener?.(tipo, fn, { ...extra, signal }) }
  let vivo = true
  let conSonido = true
  let silenciado = false
  let escuchando = false
  let hablando = false
  let turnoVoz = 0
  let temporizadorOcultar = 0
  let temporizadorKitt = 0
  let vidaOcultar = 0
  let enEspera = false
  let listaActual = { titulo: '', paginas: [[]], items: [], indice: 0 }
  let mandoActivo = false
  let observadorTeclas = null
  let mutandoTeclas = false
  let origenFoco = null

  function textoEn(nodo, valor) { if (nodo) nodo.textContent = valor }
  function mostrarBarra() {
    if (!barra) return
    barra.hidden = false
    eva?.setAttribute?.('data-obc', 'si')
  }
  function ajustarAlto() {
    if (!barra || barra.hidden || !eva) return
    const caja = barra.getBoundingClientRect?.()
    const alto = caja?.height || barra.offsetHeight
    if (alto > 0) eva.style?.setProperty?.('--obc-alto', `${Math.ceil(alto)}px`)
    const ventanaAlto = ventana?.innerHeight || documento?.documentElement?.clientHeight || 0
    if (caja && ventanaAlto > 0) {
      const tope = Math.ceil(ventanaAlto - caja.top + 10)
      if (tope > 0) eva.style?.setProperty?.('--obc-tope', `${tope}px`)
    }
  }
  function ocultarBarra() {
    if (!barra) return
    barra.hidden = true
    eva?.removeAttribute?.('data-obc')
  }
  function avisarVoz(activa) {
    if (hablando === activa) return
    hablando = activa
    try { alVozHablada?.(activa) } catch { /* la señal de silencio no debe romper la consola */ }
  }
  function detenerVoz() {
    turnoVoz += 1
    try { (ventana?.speechSynthesis ?? globalThis.speechSynthesis)?.cancel?.() } catch { /* sin voz del sistema */ }
    avisarVoz(false)
  }
  function hablar(texto) {
    if (!vivo || !conSonido || silenciado) return
    const prefs = leerPreferencias()
    if (!prefs.vozHablada) return
    const sintesis = ventana?.speechSynthesis ?? globalThis.speechSynthesis
    const Utterance = ventana?.SpeechSynthesisUtterance ?? globalThis.SpeechSynthesisUtterance
    if (!sintesis?.speak || typeof Utterance !== 'function') return
    try {
      sintesis.cancel?.()
      const turno = ++turnoVoz
      const utterance = new Utterance(texto)
      utterance.lang = prefs.idiomaVoz || 'es-ES'
      // El catálogo del sistema puede llegar después del primer mensaje. Consultarlo
      // en cada respuesta permite aprovecharlo sin retrasar la primera lectura.
      const idioma = utterance.lang.toLowerCase()
      const voces = (sintesis.getVoices?.() ?? []).filter(v => v.lang?.toLowerCase().split(/[-_]/)[0] === idioma.split('-')[0])
      const afinidad = v => (v.lang.toLowerCase().replace('_', '-') === idioma ? 4 : 0)
        + (/\b(pablo|jorge|diego|alvaro|álvaro|alonso|alex|carlos|raul|raúl)\b/i.test(v.name) ? 2 : 0)
        + (v.localService ? 1 : 0)
      if (voces.length) utterance.voice = voces.reduce((a, b) => afinidad(b) > afinidad(a) ? b : a)
      utterance.rate = .89
      utterance.pitch = .80
      utterance.onend = () => { if (turno === turnoVoz) avisarVoz(false) }
      utterance.onerror = () => { if (turno === turnoVoz) avisarVoz(false) }
      avisarVoz(true)
      sintesis.speak(utterance)
    } catch { avisarVoz(false) }
  }
  function fijarEstado(mensaje) { textoEn(estadoNodo, mensaje) }
  // Tira KITT: la luz de barrido marca que Nostromo despierta o responde; los
  // segmentos encendidos, en cambio, siguen el nivel real del micrófono.
  let segmentosOn = -1
  function nivel(valor, tope = 0) {
    if (!vivo || !kitt) return
    const cuantos = Math.round(Math.max(0, Math.min(1, Number(valor) || 0)) * SEGMENTOS)
    if (cuantos === segmentosOn) return
    segmentosOn = cuantos
    for (let i = 0; i < SEGMENTOS; i++) {
      const segmento = kitt.children?.[i]
      if (!segmento?.dataset) continue
      if (i < cuantos) { if (segmento.dataset.on !== 'si') segmento.dataset.on = 'si' }
      else if (segmento.dataset.on) delete segmento.dataset.on
    }
    if (barra) barra.dataset.nivel = String(cuantos)
  }
  function prepararKitt() {
    if (!kitt) return
    if (!kitt.children?.length) {
      for (let i = 0; i < SEGMENTOS; i++) {
        const segmento = documento?.createElement?.('i')
        if (!segmento) return
        segmento.style?.setProperty?.('--i', String(i))
        kitt.appendChild(segmento)
      }
    }
    let luz = null
    try { luz = kitt.querySelector?.('.obc-kitt-luz') ?? null } catch { luz = null }
    if (!luz) {
      luz = documento?.createElement?.('span')
      if (luz) { luz.className = 'obc-kitt-luz'; luz.setAttribute?.('aria-hidden', 'true'); kitt.appendChild(luz) }
    }
  }
  function barrer(ms = 2000) {
    if (!kitt) return
    kitt.classList?.add?.('activo')
    clearTimeout(temporizadorKitt)
    temporizadorKitt = setTimeout(() => { temporizadorKitt = 0; kitt.classList?.remove?.('activo') }, ms)
  }
  function emitir(tipo) {
    if (!conSonido || silenciado) return
    try { alTono?.(tipo) } catch { /* el audio no puede romper la interfaz */ }
  }
  function focoJuego() {
    const lienzo = documento?.querySelector?.('#historia-escena canvas')
    if (lienzo?.focus) { lienzo.focus({ preventScroll: true }); return }
    abrir?.focus?.({ preventScroll: true })
  }
  function restaurarFoco() {
    const origen = origenFoco
    origenFoco = null
    if (origen?.focus && (!documento?.contains || documento.contains(origen))) origen.focus({ preventScroll: true })
    else focoJuego()
  }
  function sincronizar(prefs = leerPreferencias()) {
    for (const [clave, ...ids] of CAMPOS) {
      for (const id of ids) {
        const nodo = documento?.getElementById?.(id)
        if (!nodo) continue
        if (nodo.type === 'checkbox') nodo.checked = Boolean(prefs[clave])
        else nodo.value = prefs[clave]
      }
    }
    sonido(Boolean(prefs.sonido))
  }
  function cancelarOcultar() {
    clearTimeout(temporizadorOcultar)
    temporizadorOcultar = 0
  }
  function ocultar() {
    if (!vivo) return
    cancelarOcultar()
    detenerVoz()
    textoEn(textoNodo, '')
    fijarEstado('')
    if (nav) nav.hidden = true
    listaActual = { titulo: '', paginas: [[]], items: [], indice: 0 }
    if (barra) { barra.dataset.tono = 'info'; delete barra.dataset.tipo; delete barra.dataset.modo }
    mensajeParcial = ''
    nivel(0)
    kitt?.classList?.remove?.('activo')
    ocultarBarra()
  }
  function programarOcultar(ms) {
    vidaOcultar = Math.max(1500, Number(ms) || 0)
    cancelarOcultar()
    if (enEspera) return
    temporizadorOcultar = setTimeout(ocultar, vidaOcultar)
  }
  function pausarOcultar() { enEspera = true; cancelarOcultar() }
  function reanudarOcultar() { if (!enEspera) return; enEspera = false; if (vidaOcultar) programarOcultar(vidaOcultar) }

  function pintarPagina() {
    const p = listaActual
    if (!p.items.length) { if (nav) nav.hidden = true; return }
    const pagina = p.paginas[p.indice] ?? []
    const cabecera = p.indice === 0 && p.titulo ? `${p.titulo}\n` : ''
    textoEn(textoNodo, cabecera + pagina.map(linea => `· ${linea}`).join('\n'))
    if (nav) nav.hidden = false
    if (pagContador) pagContador.textContent = `${p.indice + 1}/${p.paginas.length}`
    if (pagAnterior) pagAnterior.disabled = p.indice === 0
    if (pagSiguiente) pagSiguiente.disabled = p.indice >= p.paginas.length - 1
    if (barra) barra.dataset.tipo = 'lista'
    ajustarAlto()
  }
  function cambiarPagina(direccion) {
    if (!vivo || !listaActual.items.length) return
    const destino = listaActual.indice + direccion
    if (destino < 0 || destino >= listaActual.paginas.length) return
    listaActual.indice = destino
    pintarPagina()
    barrer(1100)
    programarOcultar(VIDAS.lista)
  }
  function pintarTurnos(turnos) {
    const lineas = turnos.map(turno => {
      if (typeof turno === 'string') return turno
      if (!turno || typeof turno !== 'object') return ''
      const emisor = turno.emisor ? `${turno.emisor}: ` : ''
      return emisor + String(turno.texto ?? turno.mensaje ?? '')
    }).filter(Boolean)
    textoEn(textoNodo, lineas.join('\n'))
    if (nav) nav.hidden = true
    if (barra) barra.dataset.tipo = 'turnos'
    ajustarAlto()
    return lineas
  }

  function despertar() {
    if (!vivo) return
    cancelarOcultar()
    mostrarBarra()
    textoEn(textoNodo, '')
    if (nav) nav.hidden = true
    if (barra) barra.dataset.tono = 'info'
    fijarEstado('En línea')
    barrer(1800)
    emitir('barrido')
    detenerVoz()
    programarOcultar(VIDAS.despertar)
    ajustarAlto()
  }
  function responder({ texto = '', tono = 'info', lista = null, turnos = null, lineas = null, titulo = '' } = {}) {
    if (!vivo) return null
    const intercambio = Array.isArray(turnos) ? turnos : Array.isArray(lineas) ? lineas : null
    const items = Array.isArray(lista) ? lista : null
    const limpio = String(texto).trim()
    if (!intercambio?.length && !items?.length && !limpio) return null
    cancelarOcultar()
    mostrarBarra()
    // Una respuesta ocupa la barra completa aunque estuviera en modo escucha.
    if (barra) { delete barra.dataset.modo; barra.dataset.tono = Object.hasOwn(TONO_A_EFECTO, tono) ? tono : 'info' }
    mensajeParcial = ''
    fijarEstado('')
    barrer(2200)
    emitir(TONO_A_EFECTO[tono] ?? 'info')
    if (intercambio?.length) {
      const lineasPintadas = pintarTurnos(intercambio)
      if (nav) nav.hidden = true
      hablar(lineasPintadas.join('. '))
      programarOcultar(VIDAS.turnos)
      return { tipo: 'turnos', lineas: lineasPintadas.length }
    }
    if (items?.length) {
      const paginado = paginar(items)
      const cabecera = String(titulo || limpio || '').trim()
      listaActual = { titulo: cabecera, paginas: paginado.paginas, items: paginado.items, indice: 0 }
      pintarPagina()
      if (paginado.paginas.length > 1) hablar(listaActual.titulo || `Lista de ${paginado.items.length} entradas`)
      programarOcultar(VIDAS.lista)
      return { tipo: 'lista', paginas: paginado.paginas.length, total: paginado.items.length }
    }
    listaActual = { titulo: '', paginas: [[]], items: [], indice: 0 }
    if (nav) nav.hidden = true
    textoEn(textoNodo, limpio)
    if (barra) barra.dataset.tipo = 'texto'
    hablar(limpio)
    programarOcultar(Math.max(VIDAS.texto, Math.min(20000, limpio.length * 70)))
    ajustarAlto()
    return { tipo: 'texto' }
  }
  // Modo compacto: mientras el micrófono está armado la barra se queda a la
  // vista con la tira KITT, para ver si llega voz. Un diálogo la devuelve a su
  // tamaño normal y al apagar la voz se retira.
  let mensajeParcial = ''
  function escucha(activo) {
    if (!vivo || !barra) return
    if (activo) {
      mostrarBarra()
      if (barra.dataset.modo !== 'escucha') { barra.dataset.modo = 'escucha'; ajustarAlto() }
      cancelarOcultar()
      if (mensajeParcial === '') fijarEstado('Escuchando…')
      return
    }
    if (barra.dataset.modo !== 'escucha') return
    delete barra.dataset.modo
    nivel(0)
    if (!String(textoNodo?.textContent ?? '').trim() && !listaActual.items.length) ocultar()
    else ajustarAlto()
  }
  // Lo que el reconocedor está oyendo ahora mismo. Sirve para distinguir «no
  // llega audio» de «llega, pero el motor no reconoce la orden».
  function parcial(texto) {
    if (!vivo) return
    const limpio = String(texto ?? '').trim()
    if (!limpio) { mensajeParcial = ''; return }
    mensajeParcial = limpio
    escucha(true)
    fijarEstado(`Oigo: ${limpio}`)
  }
  function estado({ escuchando: activo, mensaje, error = false, directo = false } = {}) {
    if (!vivo) return
    // Mostrar el gesto explícito de F/LB incluso si no había diálogo. La
    // espera pasiva de «Nostromo» no debe abrir la consola en cada reinicio.
    if (directo) { mostrarBarra(); ajustarAlto() }
    if (typeof activo === 'boolean') {
      escuchando = activo
      micro?.setAttribute?.('aria-pressed', String(escuchando))
      if (barra) {
        if (escuchando) barra.dataset.escuchando = 'si'
        else delete barra.dataset.escuchando
      }
      if (mensaje === undefined) fijarEstado(escuchando ? (mensajeParcial ? `Oigo: ${mensajeParcial}` : 'Escuchando…') : 'En espera')
      // No retirar el indicador mientras se está hablando.
      if (escuchando && !barra?.hidden) cancelarOcultar()
    }
    if (mensaje !== undefined) {
      const importante = error || /permiso|denegad|no disponible|activa voz|micrófono apagado\. activa|sin soporte/i.test(String(mensaje))
      fijarEstado(mensaje || '')
      if (importante) { mostrarBarra(); barrer(900); programarOcultar(9000); ajustarAlto(); return }
      else if (!escuchando && barra && !barra.hidden && !listaActual.items.length && !String(textoNodo?.textContent ?? '').trim()) programarOcultar(2500)
    }
    if (typeof activo === 'boolean' && !activo && !String(textoNodo?.textContent ?? '').trim() && !listaActual.items.length && barra && !barra.hidden) {
      programarOcultar(2500)
    }
  }
  function sonido(activo) {
    conSonido = Boolean(activo)
    if (!conSonido) detenerVoz()
  }
  function silenciar(activo) {
    silenciado = Boolean(activo)
    if (barra) {
      if (silenciado) barra.dataset.silenciado = 'si'
      else delete barra.dataset.silenciado
    }
    if (silenciado) detenerVoz()
  }
  function reducirTeclas() {
    mutandoTeclas = true
    try {
      for (const [id, sufijo] of Object.entries(TECLAS)) {
        const nodo = $(id)
        if (!nodo) continue
        const actual = String(nodo.textContent ?? '')
        const limpio = actual.replace(/\s*·\s*[VM]\s*$/, '')
        if (mandoActivo) { if (limpio !== actual) nodo.textContent = limpio }
        else if (actual && !actual.endsWith(sufijo)) nodo.textContent = actual + sufijo
      }
    } finally { mutandoTeclas = false }
  }
  function observarTeclas() {
    if (observadorTeclas || !mandoActivo) return
    const MO = globalThis.MutationObserver
    if (typeof MO !== 'function') return
    observadorTeclas = new MO(() => { if (!mandoActivo || mutandoTeclas) return; reducirTeclas() })
    for (const id of Object.keys(TECLAS)) {
      const nodo = $(id)
      if (!nodo) continue
      try { observadorTeclas.observe(nodo, { childList: true, characterData: true, subtree: true }) } catch { /* DOM simulado */ }
    }
  }
  function dejarDeObservar() {
    try { observadorTeclas?.disconnect?.() } catch { /* DOM simulado */ }
    observadorTeclas = null
  }
  function dispositivo(activo) {
    mandoActivo = Boolean(activo)
    if (barra) {
      if (mandoActivo) barra.dataset.mando = 'si'
      else delete barra.dataset.mando
    }
    if (ayuda) ayuda.textContent = mandoActivo ? AYUDA_MANDO : AYUDA
    if (eva) eva.setAttribute?.('data-dispositivo', mandoActivo ? 'mando' : 'teclado')
    reducirTeclas()
    if (ayudaJuego) ayudaJuego.textContent = mandoActivo ? AYUDA_JUEGO : ayudaJuegoTexto
    if (mandoActivo) observarTeclas()
    else dejarDeObservar()
  }
  function cerrar() {
    if (!vivo) return
    ocultar()
    if (editor?.open) cerrarEditor(false)
  }

  function abrirEditor() {
    if (!vivo || !editor) return
    const activo = documento?.activeElement
    origenFoco = activo && activo !== editor && activo !== entrada && typeof activo.focus === 'function' ? activo : abrir
    if (entrada) entrada.value = ''
    if (typeof editor.showModal === 'function' && !editor.open) editor.showModal()
    else if (!editor.open) { editor.open = true; editor.setAttribute('open', '') }
    entrada?.focus?.()
    entrada?.select?.()
  }
  function cerrarEditor(enfocar = true) {
    if (!editor) return
    if (typeof editor.close === 'function' && editor.open) editor.close()
    else if (editor.open) { editor.open = false; editor.removeAttribute('open') }
    if (entrada) entrada.value = ''
    if (enfocar) restaurarFoco()
  }
  function enviar(evento) {
    evento?.preventDefault?.()
    if (!vivo) return
    const comando = String(entrada?.value ?? '').trim()
    if (!comando) { entrada?.focus?.(); return }
    cerrarEditor(true)
    mostrarBarra()
    cancelarOcultar()
    textoEn(textoNodo, '» ' + comando)
    fijarEstado('Comando enviado')
    if (nav) nav.hidden = true
    if (barra) { barra.dataset.tono = 'info'; barra.dataset.tipo = 'texto' }
    barrer(900)
    programarOcultar(VIDAS.despertar)
    ajustarAlto()
    try { alEnviar?.(comando) } catch (error) { globalThis.console?.error?.('OBC: alEnviar falló', error) }
  }
  function cambiar(evento) {
    if (!vivo) return
    const id = evento?.target?.id
    if (!id || !id.startsWith('pausa-')) return
    const campo = CAMPOS.find(([, , pausaId]) => pausaId === id)
    if (!campo) return
    const nodo = evento.target
    const valor = nodo.type === 'checkbox' ? Boolean(nodo.checked) : nodo.value
    sincronizar(guardarPreferencias({ [campo[0]]: valor }))
  }
  function actualizarAjustes() {
    if (!vivo) return
    const prefs = leerPreferencias()
    sincronizar(prefs)
    try { alAjustar?.(prefs) } catch { /* el reconocedor decide */ }
  }
  function dispose() {
    if (!vivo) return
    vivo = false
    eventos.abort()
    cancelarOcultar()
    clearTimeout(temporizadorKitt)
    temporizadorKitt = 0
    kitt?.classList?.remove?.('activo')
    detenerVoz()
    dejarDeObservar()
    mandoActivo = false
    if (eva) eva.removeAttribute?.('data-dispositivo')
    if (ayudaJuego) ayudaJuego.textContent = ayudaJuegoTexto
    if (editor?.open) cerrarEditor(false)
    ocultarBarra()
    textoEn(textoNodo, '')
    fijarEstado('')
  }

  on(abrir, 'click', abrirEditor)
  on(tabletObc, 'click', abrirEditor)
  on(cancelar, 'click', () => cerrarEditor(true))
  on(formulario, 'submit', enviar)
  on(editor, 'cancel', evento => { evento?.preventDefault?.(); cerrarEditor(true) })
  on(editor, 'click', evento => { if (evento?.target === editor) cerrarEditor(true) })
  on(editor, 'keydown', evento => evento?.stopPropagation?.())
  on(micro, 'click', () => {
    if (!vivo) return
    // El botón solicita captura. Sólo onstart del motor confirma que escucha.
    try { alPulsar?.() } catch { /* el reconocedor decide */ }
  })
  on(pagAnterior, 'click', () => cambiarPagina(-1))
  on(pagSiguiente, 'click', () => cambiarPagina(1))
  on(barra, 'keydown', evento => {
    if (evento?.target?.tagName === 'BUTTON' && (evento.key === ' ' || evento.key === 'Enter')) {
      evento.stopPropagation?.()
    }
    if (!listaActual.items.length) return
    if (evento?.key === 'ArrowLeft' || evento?.key === 'ArrowRight') {
      evento.stopPropagation?.(); evento.preventDefault?.()
      cambiarPagina(evento.key === 'ArrowLeft' ? -1 : 1)
    }
  })
  on(barra, 'pointerenter', pausarOcultar)
  on(barra, 'pointerleave', reanudarOcultar)
  on(barra, 'focusin', pausarOcultar)
  on(barra, 'focusout', evento => {
    if (evento?.relatedTarget && barra.contains?.(evento.relatedTarget)) return
    reanudarOcultar()
  })
  for (const boton of documento?.querySelectorAll?.('[data-obc-ejemplo]') ?? []) {
    on(boton, 'click', () => {
      if (!entrada) return
      entrada.value = boton.dataset?.obcEjemplo ?? ''
      entrada.focus?.()
    })
  }
  on(documento, 'change', cambiar)
  on(ventana, 'apex:preferencias', actualizarAjustes)
  on(ventana, 'resize', ajustarAlto)

  prepararKitt()
  if (barra) { barra.hidden = true; barra.dataset.tono = 'info' }
  micro?.setAttribute?.('aria-pressed', 'false')
  sincronizar()
  dispositivo(false)

  return { despertar, responder, estado, sonido, silenciar, dispositivo, cerrar, ocultar, dispose, abrirEditor, nivel, escucha, parcial }
}
