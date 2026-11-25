# Documentación de APEX / MARS

Esta carpeta recoge **todo** lo añadido en la ampliación del juego: el mundo
abierto real de Ares Vallis, el rover, el salto y la carrera, la tablet con mapa,
el menú de inicio con visitas animadas y el menú de pausa de cristal, además de
los datos, las pruebas y el proceso de trabajo.

## Índice

| Documento | Contenido |
| --- | --- |
| [01-mundo-abierto.md](01-mundo-abierto.md) | Geometría del mundo, sectores, carga progresiva, niebla, rendimiento y mundo real |
| [02-datos-hirise.md](02-datos-hirise.md) | Origen de los datos, descarga, procesado, formato, licencias y límites |
| [03-movimiento-y-rover.md](03-movimiento-y-rover.md) | Caminar, correr, saltar, desplegar y conducir el rover, cámara y colisiones |
| [04-tablet-mapa.md](04-tablet-mapa.md) | Tablet, mapa real, zoom, cuadrícula, marcadores, pausa y flecha de rumbo |
| [05-menu-y-pausa.md](05-menu-y-pausa.md) | Menú de inicio, vistas previas, sobrevuelos, arranque y menú de pausa de cristal |
| [06-audio-y-preferencias.md](06-audio-y-preferencias.md) | Viento, pasos, motor, avisos y las tres preferencias |
| [07-arquitectura.md](07-arquitectura.md) | Módulos, APIs, ganchos de interfaz, ciclo de vida y depuración |
| [08-pruebas.md](08-pruebas.md) | Cómo ejecutar y qué cubren las 39 pruebas; notas de navegador headless |
| [09-como-se-hizo.md](09-como-se-hizo.md) | Bitácora del proceso, decisiones y errores corregidos |
| [10-pendientes.md](10-pendientes.md) | Límites conocidos y mejoras futuras |

## Imágenes

- [El mundo real](imagenes/mundo-real.jpg): relieve del DTM con la zona válida y
  los dos sitios.
- [Texturas HiRISE](imagenes/texturas-hirise.jpg): mosaico de las 112 texturas
  reales del juego.
- [Estación Sagan](imagenes/estacion-sagan.png): el lander Pathfinder y la
  Sojourner en el sitio real.
- [Suelo de cerca](imagenes/suelo-detalle.png): regolito procedural, grano y
  grava a la altura de los ojos.
- [Suelo desde arriba](imagenes/suelo-vista-alta.png): detalle a vista de pájaro
  sobre cuatro sectores, sin juntas visibles.
- [Horizonte](imagenes/horizonte.png): el mundo continúa sin pared ni corte.
- [Borde del detalle](imagenes/borde-dtm.png): transición DTM→MOLA sin escalón.
- [Bloque procedural](imagenes/bloque-procedural.png): una roca métrica de las
  seis siluetas, apoyada en el DTM.
- [Rover](imagenes/rover-sagan.png): el rover de seis ruedas junto a la estación.
- [Mapa de la tablet](imagenes/mapa-tablet.png): mapa norte-arriba con la
  cuadrícula real y Sagan.
- [Pausa de cristal](imagenes/pausa-cristal.png): el menú de pausa con
  desenfoque.

Las capturas de la escena 3D se tomaron con un navegador headless y un arranque
de prueba; el HUD puede mostrar mensajes de ese estado de prueba. El juego
normal empieza dentro de la nave, como en la historia.
