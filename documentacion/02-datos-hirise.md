# 02 · Datos reales de Ares Vallis (HiRISE) y MOLA

## Qué se ha importado

El mundo jugable se construye a partir de tres productos del **sitio de
aterrizaje de Mars Pathfinder**, en Ares Vallis:

| Producto | Archivo | Tamaño | Resolución |
| --- | --- | ---: | --- |
| DTM HiRISE (Modelo Digital del Terreno) | `DTEEC_002391_1995_001890_1995_A01.IMG` | 375.739.848 B | 1 m/píxel; 6.579 × 14.277; 32 bits reales |
| Ortoimagen HiRISE RED | `PSP_002391_1995_RED_C_01_ORTHO.JP2` | 40.203.404 B | 1 m/píxel; 6.579 × 14.277; 8 bits |
| Ortoimagen HiRISE RED | `PSP_001890_1995_RED_C_01_ORTHO.JP2` | 38.263.216 B | 1 m/píxel; 6.579 × 14.277; 8 bits |
| Relieve global MOLA | `datos/bloques/base-global-v2.bin` (ya en el proyecto) | 5.945.940 B | nivel 5; 33 × 33 por tesela; ~10 km |

Los originales **no se guardan en el repositorio**: suman ~450 MB. Los datos
derivados que usa el juego ocupan ~21 MB en `datos/ares/` (más los 4,3 MB de
teselas MOLA en `datos/bloques/relieve/5/`, que ya venían con el globo).

### Procedencia

- DTM: `https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_002300_002399/PSP_002391_1995_PSP_001890_1995/DTEEC_002391_1995_001890_1995_A01.IMG`
- Ortoimágenes: la misma carpeta, archivos `PSP_002391_1995_RED_C_01_ORTHO.JP2`
  y `PSP_001890_1995_RED_C_01_ORTHO.JP2`.
- Etiquetas y README: la misma carpeta y
  `https://www.uahirise.org/PDS/EXTRAS/DTM/PSP/ORB_002300_002399/PSP_002391_1995_PSP_001890_1995/README_DTEEC_002391_1995_001890_1995_A01.TXT`.
- MOLA: paquete global ya usado por el globo del proyecto; NASA/JPL/MOLA
  Science Team.

**Créditos obligatorios:** NASA/JPL/University of Arizona (HiRISE);
NASA/JPL/MOLA Science Team (MOLA). Los productos son públicos; el proyecto no
los redistribuye sin recortar/remuestrear y cita la fuente.

## Descargar

```powershell
node herramientas/descargar-datos-ares.mjs --destino D:\datos-fuente-ares
```

Descarga los tres productos grandes y las etiquetas/README. Comprueba tamaños y
no repite lo que ya existe. Necesita red y ~450 MB libres. Si el destino no se
pasa, usa `datos-fuente-ares` junto a la carpeta del proyecto.

## Generar el mundo

```powershell
python herramientas/datos-ares.py --fuente D:\datos-fuente-ares
```

Salida en `datos/ares/`:

- `manifiesto.json` con origen, Sagan, rejillas, límites y créditos;
- `terreno/{col}_{fila}.bin` para 7 × 16 sectores;
- `textura/{col}_{fila}.webp`;
- `lejano.bin` (MOLA 97 × 97).

El script acepta `--salida` y `--sin-texturas` (solo relieve, útil para pruebas).
Requiere Python con `numpy` y `Pillow`.

## Proyección y coordenadas

El DTM usa una proyección **equirectangular planetocéntrica** con:

- `RECORD_BYTES = 26316` (la imagen empieza en el registro 2, byte 26.316);
- `LINE_SAMPLES = 6579`, `LINES = 14277`, `SAMPLE_BITS = 32`, `SAMPLE_TYPE = PC_REAL`;
- `CENTER_LONGITUDE = 326,75°`, `MAP_RESOLUTION = 58.691,81313585 pix/°`,
  `MAP_SCALE = 1,0095297649608 m/píxel`;
- `MAXIMUM_LATITUDE = 19,182149448421°`, `MINIMUM_LATITUDE = 18,938910015711°`,
  `WESTERNMOST_LONGITUDE = 326,69496308°`,
  `EASTERNMOST_LONGITUDE = 326,81098787°`;
- radio local de la etiqueta: 3.394.840 m.

El generador usa las fórmulas directas de la proyección:

```text
s = (lon - 326,75) · RES + 3120,5 - 0,5
l = 1.125.835,5 - lat · RES - 0,5
```

con `RES = 58691,81313585` píxeles/grado. Las escalas métricas por píxel a la
latitud del sitio son:

```text
mx = R · cos(lat) · π/180 / RES = 0,953741 m/px
my = R · π/180 / RES            = 1,009531 m/px
```

El **punto de impacto** se define 1,2 km al oeste y 1,6 km al norte del sitio
real de Pathfinder (19,137° N, 33,221° O), usando esas escalas:

```text
s0 = s_sagan - 1200 / mx
l0 = l_sagan - 1600 / my
H0 = DTM(l0, s0) = -3699,596 m
```

Así Sagan queda exactamente en `(1200, 1600)` y la altura relativa del sitio es
`+8,887 m`. La altura del juego es `(DTM - H0)`; el impacto se aplana a 0.

## Procesado paso a paso

1. **Lectura**: `np.fromfile(..., offset=26316, dtype='<f4')`; se sustituye el
   valor ausente (`-3,4e38`) por `NaN`.
2. **Rejilla de juego**: 4 m; 1.793 × 4.097 muestras; se muestrea el DTM con
   interpolación bilineal. Donde el DTM es inválido se usa MOLA.
3. **Máscara de validez**: se suaviza una máscara de 1/8 con desenfoque gaussiano
   y se muestrea a 16 m para fundir el DTM con MOLA en los huecos.
4. **Borde del DTM**: en los últimos 1.200 m hacia fuera se mezcla el DTM con
   MOLA, para que la frontera no sea un escalón.
5. **Plataformas**: impacto 26 → 70 m a altura 0; Sagan 8 → 28 m a +8.887 m.
6. **Sectores**: rejilla completa de 7 × 16 × 256 + 1 muestras; se guarda
   `Int16` en decímetros. Los bordes se comparten.
7. **Texturas**: se compone la ortoimagen A y B (la B donde la A es nula), se
   estira el contraste con percentiles 2–98 y se tiñe a tonos marcianos; 512 × 512
   por sector (2 m/píxel), WebP calidad 82. El albedo real se funde a polvo con la
   misma máscara y el mismo borde que la altura.
8. **MOLA lejano**: 97 × 97 muestras cada 512 m, en decímetros relativos a H0,
   para el muestreo global.
9. **Vista previa y máscara**: `previa.bin` guarda la rejilla completa cada 64 m
   (113 × 257) y `borde.bin` el peso de fusión DTM↔MOLA cada 16 m (449 × 1025),
   con las dos plataformas forzadas a peso completo.
10. **Albedo común**: `herramientas/mosaico-ares.py` reduce cada textura a 64 × 64,
    las ensambla en un único `albedo-comun.webp` de 448 × 1024 y lo desenfoca. El
    visor lo usa para igualar la media de fotos contiguas junto a las juntas.
11. **Manifiesto**: todo lo anterior, más la cobertura media del DTM (0,54).

## Formato de los archivos de juego

- **Sector de altura**: 257 × 257 `Int16` little-endian, fila 0 = norte, columna
  0 = oeste; decímetros sobre el impacto (`0` = −3.699,596 m reales).
  Tamaño: 132.098 B.
- **Textura**: WebP 512 × 512; el norte queda arriba; el material de three.js
  usa `flipY` estándar y UV 0–1 por sector.
- **Vista previa**: `previa.bin`, 113 × 257 `Int16`, una muestra cada 64 m.
  Tamaño: 58.082 B.
- **Peso de fusión**: `borde.bin`, 449 × 1025 `Uint8`, una muestra cada 16 m.
  Tamaño: 460.225 B.
- **Albedo común**: `albedo-comun.webp`, 448 × 1024 RGB (64 muestras por sector).
- **MOLA lejano**: 97 × 97 `Int16` little-endian; 512 m por muestra; decímetros
  sobre el impacto; 18.818 B.
- **Teselas MOLA cercanas**: `datos/bloques/relieve/5/{col}/{fila}.bin`, 33 × 33
  `Int16` en metros absolutos, 2.178 B cada una.
- **Manifiesto**: JSON con `detalle`, `lejano`, `dtm`, `origen`, `sagan`,
  `limite` y `fuentes`.

## Validación

`historia-mundo.test.mjs` comprueba:

- que el manifiesto declara Sagan en 1.200/1.600 y +8,887 m;
- que existen 112 sectores y 112 texturas con el tamaño correcto;
- que la vista previa, la máscara y el albedo común tienen el tamaño esperado;
- que el impacto es 0 y la muestra de Sagan es ≈89 dm;
- que el recorte MOLA tiene 97² muestras;
- la estación, la misión de la baliza, el salto/carrera, el rover y la tablet.

## Límites de los datos

- El DTM original es de 1 m, pero el juego usa alturas de 4 m y texturas de 2 m
  para que quepa y fluya; no se ve el detalle de 1 m.
- La cobertura válida del DTM es ~72 % de la imagen y ~54 % del rectángulo
  jugable; el resto es MOLA.
- MOLA tiene ~10 km por muestra; la llanura exterior es una aproximación.
- La altitud se guarda en decímetros: precisión vertical de 0,1 m.
- El terreno es de 1997–2007; no es un mapa actual.
- No se guardan los originales. Regenerar requiere descargar otra vez.
- Las imágenes científicas que se pueden apagar en el menú del globo son las
  capas orbitales de Cesium (Jezero, Olimpo, alrededores), no las texturas del
  suelo del juego.

## Por qué este sitio

Pathfinder aterrizó en Ares Vallis el 4 de julio de 1997 (19,13° N, 33,22° O).
La historia del juego sitúa la base Sagan allí; el impacto queda 2 km al noroeste
para que el trayecto sea explorable. El DTM cubre ambos puntos y el gran cráter
del sur, que es un accidente real del terreno y no una invención.
