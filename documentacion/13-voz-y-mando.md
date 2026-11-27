# 13 · Nostromo y mando de Xbox

## Primer contacto

En **Opciones → Voz del OBC**, elige *Siempre escuchando* para usar el nombre de activación, o *Pulsar para hablar* si prefieres abrir el micrófono solo con **F** o **LB**. La voz está apagada de fábrica. Al entrar en la exploración, autoriza el micrófono en el navegador. Di **«Nostromo»** o **«Nostrosmo»**: el barrido de luces inferior y una señal corta indican que la nave espera tu orden. Di **«Dame diagnóstico de nave»** en los siguientes siete segundos. También puedes decir el nombre y la orden seguidos. Con F/LB no hace falta decir el nombre.

Sin micrófono, usa **OBC · Escribir**. Puedes completar la partida sin activar la voz. La barra da la respuesta por escrito aunque el juego esté silenciado; la lectura con voz del sistema es opcional. Con movimiento reducido las luces no hacen el barrido animado.

## Órdenes de exploración

| Di… | Resultado |
| --- | --- |
| Dame diagnóstico de nave | Lee el informe de la APEX-04 desde el interior. Conserva las condiciones del final de la demo. |
| Despliega rover | Solo desde fuera y con el rover guardado: comprueba el terreno, lo despliega y te sube, como V. Repetir la orden no te baja. |
| Intenta transmisión con la Tierra | Desde el puente. Al principio informa de que no hay enlace. Tras recuperar y montar Pathfinder y la baliza junto a la nave, Houston responde. No sustituye la llamada desde Sagan. |
| ¿Qué hago? | Lee el objetivo de la etapa actual. |
| Estado del traje / Estado del rover | Informe del escáner o estado del vehículo. |
| Abre el mapa / Cierra el mapa | Abre la tablet si ya la recogiste. Desde la tablet puedes cerrar el mapa sin abrir un canal de escucha permanente. |
| Rumbo a Sagan | Distancia y dirección desde tu posición. |
| Estado de la baliza / Estado de la esclusa | Situación de los equipos, sin accionarlos. |
| Enciende las luces / Apaga las luces | Cambia la iluminación de cabina. |
| Informe de tormenta | Informa del polvo según la etapa de la historia. |
| Silencio / Habla | Silencia o recupera los sonidos y la lectura del OBC, no el ambiente ni los subtítulos. |
| Ayuda de voz | Muestra las órdenes disponibles. |
| ¿Estás ahí? / Abre las puertas del hangar | Respuestas de la computadora sin efectos en la misión. |

## Micrófono y privacidad

Usa HTTPS o el servidor local en `http://127.0.0.1:8123/`. La disponibilidad depende del navegador, del idioma y de los permisos del sitio. Si el navegador permite comprobar que el paquete de idioma ya está instalado, se prefiere ese procesamiento local. En caso contrario el **servicio de voz del navegador puede recibir el audio**, incluso mientras espera la palabra de activación. El juego no archiva grabaciones ni transcripciones; aplica la lista de órdenes al resultado del navegador. Para dejar de capturar, selecciona *Apagada*. Una denegación de permiso no impide escribir órdenes.

## Dos mandos, un astronauta

Conecta los mandos Xbox y pulsa un botón para que el navegador los exponga. No se crea un segundo personaje: un mando puede tomar el relevo del otro. El teclado, el ratón y los controles táctiles siguen disponibles.

| Control | En la campaña |
| --- | --- |
| Stick izquierdo / derecho | Caminar o conducir / mirar u orbitar la cámara del rover |
| A / B | Interactuar / saltar |
| X / Y | Vehículo (desplegar, subir, bajar) / tablet |
| RT / LT | Correr o turbo / frenar en el rover |
| LB / RB | Mantener para hablar / recentrar la vista |
| Menú (Start) / Vista (View) | Pausa / guía de controles |
| Cruceta, A, B en menús | Cambiar foco, confirmar y volver; el final exige elegir una de las dos opciones |

## Comprobación manual con hardware

1. Con voz apagada, escribe «Despliega rover» dentro del casco. Debe responder sin crear un vehículo. Sal por la esclusa, repite en terreno despejado y repite a bordo: no debe bajarte ni crear un segundo rover.
2. Prueba cada nombre por separado, espera el barrido y pide un informe. Espera más de siete segundos y comprueba que una orden sin el nombre se ignora. Prueba también F y LB con el acento, el ruido y el micrófono reales del equipo.
3. Intenta llamar desde el puente antes y después de montar ambos equipos. La llamada final no debe repetir el acto de Sagan ni reactivar la tormenta.
4. Prueba denegar permiso, silenciar, cambiar de pestaña y volver al globo: el juego debe seguir disponible por escrito y no mantener el micrófono abierto al salir.
5. Camina con un mando y toma el relevo con el otro; desconecta el que tiene el control mientras mantienes un gatillo. Comprueba que no quedan movimiento, turbo, freno o micrófono retenidos. En pausa, las pulsaciones deben mover el foco sin mover al astronauta.
