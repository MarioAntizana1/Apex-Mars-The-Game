# 04 · Tablet y mapa de Ares Vallis

## La tablet

La tablet es un objeto de la cabina que ya existía en la escena original. Al
recogerla (mirar al banco EVA y pulsar `E`) se guarda en el equipo:

- el HUD muestra **Tablet · mapa** en el inventario;
- aparece el botón **Tablet · M** arriba a la derecha;
- `M` o el botón abren el mapa;
- sin tablet, `sim.mapa()` responde “Necesitas la tablet del banco EVA para
  consultar el mapa.” y no abre nada.

El mapa es un `<dialog>` nativo con `showModal`, de 720 × 480 internos y
adaptado al ancho de la pantalla. Mientras está abierto:

- `ui.paused()` devuelve `true` y la simulación deja de actualizar el movimiento,
  la esclusa, el rover y el audio de motor/pasos;
- el audio general se silencia (`mix()` pone el volumen maestro a 0);
- `Esc`, el botón **Cerrar mapa**, la “X” del diálogo o un clic en el fondo lo
  cierran y devuelven el foco al canvas.

## Contenido del mapa

Está orientado **norte arriba** (`−z` arriba, `+x` a la derecha), siempre
independientemente de hacia dónde mire la cámara.

- **Cuadrícula real**: líneas de latitud y longitud calculadas a partir del
  origen real del impacto (`ORIGEN.lon = 326,7576`, `lat = 19,164`) y de las
  escalas `GEO` (`55.977 m/°` en longitud, `59.252 m/°` en latitud). El paso se
  adapta al zoom (0,002° a 0,5°) para que las etiquetas no se solapen.
- **Rectángulo de detalle HiRISE**: el área de 7 × 16 sectores de 1 km que
  corresponde al DTM real; se dibuja con relleno cálido y la etiqueta
  `DETALLE HiRISE · 1 m`.
- **Límite del mundo**: cuadrado de ±24 km con línea discontinua; el jugador no
  puede salir de él.
- **NAVE**: cuadrado en `(0, 0)`.
- **SAGAN**: rombo cian en `(1200, 1600)`; si queda fuera de la vista se pega al
  borde y se etiqueta.
- **TÚ**: triángulo amarillo con halo, orientado al rumbo real del jugador o del
  rover. Se dibuja el último para que no lo tapen las demás marcas.
- **Escala**: barra de 100 m a 25 km según el zoom y texto `1 km ≈ N px`.
- **Brújula**: `N` arriba a la derecha.
- **Lectura**: posición en latitud/longitud, altura relativa, estado (a pie,
  parado, rover), distancia y rumbo a Sagan, y escala.
- **Zoom**: `+` / `−` entre 6, 12, 25, 50, 100, 250 y 600 m/píxel; por defecto
  50 m/píxel (ventana de ~36 × 24 km).
- **Centrar en Sagan**: alterna el centro del mapa entre Sagan y el jugador; el
  texto del botón cambia a **Centrar en mí**.
- **Ruta opcional**: si la preferencia `rumbo` está activa, se dibuja una línea
  discontinua del jugador a Sagan. Sin ella, el mapa solo muestra el rombo y las
  distancias, tal y como se pidió.

### Flecha de rumbo en el HUD

La preferencia **Flecha de rumbo a Sagan** (apagada por defecto) añade un pequeño
HUD en el centro de la pantalla con una flecha `➤` y el texto
`Sagan · 2,0 km · sureste`. La flecha se rota con el rumbo real
(`atan2(dx, −dz)`), de modo que apunta a Sagan aunque el jugador gire. Se puede
activar o desactivar en las **Opciones** del menú de inicio o de la pausa; el
cambio se guarda y el evento `apex:preferencias` actualiza ambos menús.

### Cómo llegar a Sagan

1. Recoge la tablet en la cabina.
2. Abre el mapa con `M`.
3. Sagan aparece 2 km al sureste, con rumbo 143° desde el impacto.
4. Si activas la flecha de rumbo, síguela; si no, orienta la brújula y usa la
   distancia del mapa.
5. En rover: `V`, luego `W`/`S` y `A`/`D`; `Shift` turbo. A 18–26 m/s son unos
   2 minutos (o menos con turbo).

## Cálculo de coordenadas

El mapa usa:

```text
lat = ORIGEN.lat - z / GEO.mPorGradoLat
lon = ORIGEN.lon + x / GEO.mPorGradoLon
```

`lon` se normaliza a −180…180 para mostrarla como 33°… O. Las etiquetas se
formatean en grados, minutos y segundos (`19°09′50″N`). La cuadrícula es
aproximada (escala local constante), suficiente para orientarse en 48 km.

## Límites conocidos

- No se puede arrastrar ni desplazar el mapa libremente: se centra en el jugador
  o en Sagan y se acerca/aleja.
- No dibuja el relieve ni la máscara exacta del DTM; dibuja el rectángulo de
  detalle y una cuadrícula real. La imagen de satélite está en el globo Cesium,
  no en la tablet.
- En pantallas muy bajas el diálogo hace scroll; en móvil el canvas se adapta al
  ancho.
- La lectura de altura es relativa al impacto; no es una altitud absoluta.
- El mapa no marca las rocas ni la baliza de campo.
