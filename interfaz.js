const controles = document.querySelector('#controles')
const barra = controles.querySelector('summary')
const compacto = matchMedia('(max-width: 42rem), (pointer: coarse)')
const vuelo = document.querySelector('#vuelo-panel')
const estado = document.querySelector('#estado')
const estadoMapa = document.querySelector('#estado-mapa')
const estadoVuelo = document.querySelector('#estado-vuelo')

function adaptarPanel() {
  if (compacto.matches && controles.contains(document.activeElement)) barra.focus()
  controles.open = !compacto.matches
}

adaptarPanel()
compacto.addEventListener('change', adaptarPanel)
controles.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !controles.open) return
  event.preventDefault()
  controles.open = false
  barra.focus()
})

// On small screens, let the chosen destination take over the view.
controles.addEventListener('click', event => {
  if (!compacto.matches || !event.target.closest('#vistas button, #destinos button, #marineris button')) return
  controles.open = false
  barra.focus({ preventScroll: true })
})

// Both modes share the live status used by the globe and the flight controller.
new MutationObserver(() => {
  const destino = vuelo.hidden ? estadoMapa : estadoVuelo
  if (estado.parentElement !== destino) destino.append(estado)
  if (!vuelo.hidden && compacto.matches) controles.open = false
  if (vuelo.hidden && !controles.open && document.activeElement === document.body) barra.focus({ preventScroll: true })
}).observe(vuelo, { attributes: true, attributeFilter: ['hidden'] })
