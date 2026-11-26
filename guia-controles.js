// La guía no cambia el estado de la partida: la pausa sigue abierta debajo.
export function conectarGuiaControles(dialogo, botones) {
  let origen
  for (const boton of botones) {
    boton.addEventListener('keydown', evento => {
      // En EVA, Espacio también es saltar. Conserva la activación nativa del botón.
      if (evento.code === 'Space') evento.stopPropagation()
    })
    boton.addEventListener('click', () => {
      origen = boton
      dialogo.showModal()
      dialogo.scrollTop = 0
    })
  }
  // No enviar M/E/Esc a la escena durante la lectura. El diálogo nativo
  // conserva sus acciones por defecto (Tab, Escape y botones del formulario).
  dialogo.addEventListener('keydown', evento => evento.stopPropagation())
  dialogo.addEventListener('close', () => origen?.focus())
}
