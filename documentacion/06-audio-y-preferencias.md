# 06 · Audio y preferencias

## Audio sintetizado

No hay archivos de audio. Todo se genera con **Web Audio API** al entrar en la
exploración (`ambiente()` en `historia-escena.js`):

- **Viento**: búfer de ruido de 2 s en bucle, filtro paso bajo y ganancia maestra;
  el corte sube fuera de la nave y baja dentro.
- **Pasos**: ráfaga corta de ruido (0,16 s) con filtro de banda y envolvente;
  se dispara mientras el jugador camina, más rápido al correr.
- **Motor del rover**: oscilador de sierra + filtro paso bajo + ganancia; la
  ganancia y el tono suben con la velocidad; se apaga al bajar.
- **Avisos**: un pitido suave (seno 760 → 980 Hz, 0,16 s) al cambiar el mensaje
  de estado, para que una interacción no pase desapercibida.
- **Maestro**: un `GainNode` común; `mix()` lo pone a 0 si está silenciado, si la
  pestaña está oculta, si el mapa o la pausa están abiertos, y ajusta el volumen
  interior/exterior.

El audio del prólogo cinematográfico sigue siendo el de `historia-cine.js`; el
botón **Audio** de la barra controla ambos. Los navegadores exigen un gesto del
usuario para arrancar el audio: el primer clic en el juego o en el botón lo
reanuda; si el navegador lo bloquea, el juego sigue jugable sin sonido.

## Preferencias

Se guardan en `localStorage` bajo la clave:

```text
apex-mars:preferencias
```

Valores:

| Clave | Por defecto | Efecto |
| --- | --- | --- |
| `sonido` | `true` | Activa/desactiva viento, pasos, motor y avisos |
| `ciencia` | `true` | Muestra/oculta las capas de imágenes orbitales del globo (Jezero, Olimpo, alrededores) |
| `rumbo` | `false` | Muestra/oculta la flecha de rumbo a Sagan en el HUD y la línea de ruta del mapa |
| `voz` | `'apagada'` | `apagada`, `ptt` (F/LB) o `siempre` (palabra de activación) |
| `idiomaVoz` | `'es-ES'` | Idioma que se pide al reconocimiento: `es-ES`, `es-MX` o `es-PE` |
| `vozHablada` | `false` | Lee las respuestas con la voz del sistema, si existe |
| `mando` | `true` | Lee los mandos Xbox conectados |

El OBC añade `voz` (apagada, pulsar para hablar o siempre), `idiomaVoz`, `vozHablada` y `mando`. Véase [Nostromo y mando](13-voz-y-mando.md).

- `leerPreferencias()` devuelve los valores seguros; si el almacenamiento no está
  disponible (modo privado, Node) devuelve los valores base y no rompe.
- `guardarPreferencias({...})` mezcla los cambios, guarda y dispara el evento
  `apex:preferencias` con el objeto completo en `detail`.
- Los menús de inicio y pausa escuchan el evento y sincronizan sus casillas.
- El botón **Audio** de la barra y la casilla **Sonidos** de pausa comparten el
  mismo estado; si cambias uno, el otro se actualiza en la siguiente apertura.
- **Imágenes científicas** solo afecta al globo Cesium, no a las texturas reales
  del terreno del juego. La opción se conserva al entrar y salir de la partida.
- **Flecha de rumbo** es opcional a propósito: el usuario pidió que la guía
  aparezca solo si se activa; por defecto el juego se orienta con la tablet.

## Dónde se ven las opciones

- Menú de inicio → **Opciones** (Jezero): ajustes de juego, OBC y mando.
- Menú de pausa → **Opciones**: ajustes de juego, OBC y mando.
- La barra de la historia tiene **Audio** para silenciar al vuelo.
- La tablet tiene su propio zoom/centro; no es una preferencia persistente.

## Límites conocidos

- Los avisos del OBC son sintetizados. La lectura opcional usa las voces disponibles del sistema; no se distribuyen grabaciones.
- No hay control de volumen fino, solo activar/desactivar y el volumen relativo
  interior/exterior.
- El pitido de aviso se dispara con cada mensaje de estado; si resulta molesto se
  puede quitar `aviso()` de `ui.status`.
- El audio se reinicia al recargar; las preferencias sí se conservan.
