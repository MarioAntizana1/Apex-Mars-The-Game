# 01 · Mundo abierto de Ares Vallis

## Idea

La escena jugable ya no es una explanada de 460 m alrededor de la nave: es un
trozo real de Marte de **7,2 × 16,4 km de detalle** (el DTM HiRISE del sitio
Pathfinder) y, fuera de ahí, relieve MOLA procedural que sigue generándose
alrededor del jugador sin un muro visible. Todo el terreno de detalle viene de
datos reales; solo se añaden detalles locales pequeños (la plataforma del
impacto, las rocas de escala y el relieve fino procedural) para que el suelo
funcione a la altura de los ojos. Al alejarte del sitio de aterrizaje ya no hay
un corte: el mundo se sigue cargando por sectores y la niebla oculta el borde de
la ventana de carga.

## Coordenadas

El origen `(0, 0)` es el **punto de impacto de la nave**. Los ejes son metros:

- `+x` = este
- `+z` = sur
- `+y` = arriba
- `yaw = 0` mira al norte (`-z`), igual que la cámara del traje.

| Punto | x | z | lon | lat | altura relativa |
| --- | ---: | ---: | ---: | ---: | ---: |
| Impacto (nave) | 0 m | 0 m | -33,24244° | 19,16400° | 0,000 m |
| Sagan (Pathfinder) | 1200 m | 1600 m | -33,22100° | 19,13700° | +8,887 m |

La distancia es **2.000 m** (1,2 km al este y 1,6 km al sur). El DTM original
está en longitud 326,7576° (0–360); en el mapa se muestra como 33,24° O.

### Extensiones

| Elemento | Valor |
| --- | --- |
| DTM real (rectángulo del archivo) | x −3399 … +2875 m; z −1075 … +13337 m |
| Sectores de detalle jugables | x −4096 … +3072 m; z −2048 … +14336 m |
| Tamaño de sector | 1024 × 1024 m |
| Rejilla de altura | 4 m (257 × 257 muestras por sector) |
| Textura | 2 m/píxel (512 × 512 por sector) |
| Vista previa de altura | 64 m (`previa.bin`) |
| Peso de fusión DTM↔MOLA | 16 m (`borde.bin`) |
| Albedo común (juntas) | 64 muestras por sector (`albedo-comun.webp`) |
| MOLA local | teselas nivel 5 de 33 × 33 (`datos/bloques/relieve/5/`) |
| Ventana de carga | 15 × 15 sectores (7,5 km de radio) |
| Detalle HiRISE simultáneo | 5 × 5 sectores alrededor del jugador |
| Niebla | `FogExp2` con densidad 0,00062 |
| Cámara | `near` 0,06; `far` 5000 m; cielo de radio 4500 m |

El detalle real del DTM no cubre todo el rectángulo: la máscara de correlación
estéreo deja **≈54 %** de la superficie del rectángulo con datos válidos. Los
huecos y el borde se rellenan con MOLA y se funden; el jugador no ve un acantilado
en la frontera del DTM. La zona de la ruta impacto–Sagan y el gran cráter real
del sur quedan dentro de la parte válida.

## Sectores (chunks)

`datos/ares/terreno/{col}_{fila}.bin` guarda una rejilla de 257 × 257 `Int16`
little-endian con **decímetros respecto al impacto**. Se generan 7 columnas y 16
filas. El cliente:

1. descarga `manifiesto.json`, `lejano.bin`, `previa.bin` y `borde.bin`;
2. coloca de inmediato una **malla de vista previa de 64 m** en toda la ventana
   (15 × 15 sectores), con piedras y suelo ya visibles aunque falte la foto;
3. sustituye por el detalle HiRISE los 5 × 5 sectores más cercanos, corrigiendo
   la máscara interior con `borde.bin` y las aristas con el proxy;
4. mantiene las teselas MOLA nivel 5 que rodean al jugador para el relieve
   global, y las descarta al alejarse;
5. descarga los sectores que salen de la ventana y libera geometría y texturas.

Las alturas son continuas porque los sectores comparten el borde y las normales
de la arista se interpolan desde el mismo campo de referencia. La prueba
`historia-mundo.test.mjs` comprueba la costura y la altura del impacto y de Sagan.

### Detalle procedural mínimo

Sobre la textura real se añade:

- una **capa de regolito** de 256 × 256 muestras por baldosa de 4 m, repetida
  256 veces por sector: costras, grano, grava y ondulaciones de polvo. Sustituye
  al bump de ruido anterior y no modifica la cota de colisión;
- un **mapa normal** derivado de esa altura, con un segundo muestreo rotado para
  el color, para que el suelo no parezca una lija lisa;
- una **huella de aterrizaje** dibujada en el propio material (surcos y bordes
  levantados en x ≈ ±2,3 m), sin planos superpuestos que se vean de canto;
- **96 bloques** de escala métrica por km² (1,8–8 m), seis siluetas de roca
  erosionada y **campos de grava** agrupados a su alrededor. Se generan con una
  semilla por sector, así que recargar no los mueve. No sustituyen al paisaje:
  dan escala y referencias al caminar o conducir.

## La zona del impacto

El generador aplana una plataforma de radio 26 m con transición hasta 70 m, a la
altura real del punto de impacto. Así la nave, la rampa, las marcas de contacto,
las rocas cercanas y el equipo pueden apoyarse sin flotar ni enterrarse. La
topografía real vuelve suavemente a partir de ahí. En Sagan se aplana una
plataforma de 8 m (transición 28 m) para el lander y el rover.

La **nave, la esclusa, el puente, el kit, la tablet y el balcón** son la escena
detallada que ya existía; no se ha inventado un paisaje nuevo alrededor. Los
detalles de la zona de impacto (rampa, rocas de la nave, marcas de aterrizaje)
siguen siendo los de la base jugable original.

## Fuera del detalle: MOLA global

Fuera del rectángulo de detalle, la altura sale del relieve global MOLA:
`previa.bin` y el recorte `lejano.bin` (97 × 97 muestras cada 512 m) dan una base
continua, y las teselas nivel 5 de `datos/bloques/relieve/5/{col}/{fila}.bin`
(33 × 33 muestras) afinan el muestreo cuando el jugador se acerca al borde del
recorte. Los sectores que caen fuera del rectángulo se dibujan como mallas de
vista previa de 64 m, así que el terreno nunca termina en un corte: la ventana
de 15 × 15 sectores se va desplazando con el jugador y las teselas MOLA se
cargan con antelación (hasta 8 km más allá de la vista). La niebla oculta el
borde de la ventana.

La resolución real del MOLA es mucho menor que la del DTM: es una aproximación
honesta, documentada en [02-datos-hirise.md](02-datos-hirise.md). En llano, a
nivel de ojos, el suelo lo pone el detalle procedural de
[historia-regolito.js](../historia-regolito.js).

## Navegación y referencias

- **Nave**: `(0, 0)`, dentro del cráter de impacto.
- **Sagan**: `(1200, 1600)`, 2 km al sureste; el cartel, el lander y la Sojourner
  se ven al acercarse.
- **Cráter real**: a unos 7 km al sur del impacto; es el accidente más grande del
  DTM y sirve de referencia visual en el mapa y en la exploración.
- **Más allá del DTM**: el mundo sigue generándose con MOLA procedural; no hay un
  muro ni un corte. El valor `limite` del manifiesto (24 km) es la referencia
  histórica del antiguo recorte lejano, no una barrera de movimiento.

## Rendimiento

- Terreno de detalle: 14,1 MB en 112 archivos.
- Texturas: 6,45 MB en 112 WebP.
- Vista previa y máscara: 58 KB + 460 KB.
- Albedo común: 28 KB. Recorte MOLA: 18,8 KB. Teselas MOLA: 4,25 MB.
- En pantalla se mantienen 225 sectores (15 × 15), pero solo 25 son mallas de
  detalle de ~66.000 vértices con textura de 512²; el resto son mallas de
  17 × 17 vértices sin foto. La niebla recorta el horizonte.
- Las rocas y el regolito son compartidos; cada sector reutiliza geometría y
  materiales comunes salvo la textura. Los lotes de piedras se ocultan por
  distancia (bloques a 1.050 m; grava a 190 m).

## Límites conocidos del mundo

- El terreno lejano es MOLA (~10 km de muestra), no HiRISE.
- La máscara del DTM deja huecos que se rellenan con MOLA.
- La textura de juego es de 2 m/píxel, no el 1 m/píxel original.
- El detalle procedural (regolito, rocas, huella) no está en el mapa real; está
  documentado como detalle de juego.
- Las piedras grandes todavía no bloquean el paso: se puede caminar a través de
  ellas.
