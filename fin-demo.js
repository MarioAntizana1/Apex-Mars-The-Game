// Cierre de la demo: se abre sólo cuando el diagnóstico confirma el enlace orbital.
// No altera la partida salvo que el jugador decida volver al globo.
export function crearFinDemo({ dialogo, botonSeguir, botonSalir, alAbrir = () => {}, alSeguir = () => {}, alSalir = () => {} }) {
  // Esc cancela el diálogo nativo: aquí la decisión es explícita.
  dialogo.addEventListener('cancel', evento => evento.preventDefault())
  // La escena no debe leer M, E ni Espacio mientras se decide el final.
  dialogo.addEventListener('keydown', evento => evento.stopPropagation())
  botonSeguir.addEventListener('click', () => {
    if (dialogo.open) dialogo.close()
    alSeguir()
  })
  botonSalir.addEventListener('click', () => alSalir())
  return {
    get abierto() { return Boolean(dialogo.open) },
    abrir() {
      if (dialogo.open) return
      alAbrir()
      dialogo.showModal()
      botonSeguir.focus?.()
    },
    cerrar() { if (dialogo.open) dialogo.close() },
  }
}
