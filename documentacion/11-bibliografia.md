# 11 · Bibliografía y fuentes

Todo lo que el juego toma del mundo real está aquí: qué producto se usó, de
dónde se descargó, quién lo produjo, con qué licencia y para qué se transformó.
Los enlaces se revisaron el **25 de noviembre de 2026** (el alcance de la
comprobación está en la sección 9). Los originales de gran tamaño no se guardan
en el repositorio; el proceso de descarga y regeneración está en
[02-datos-hirise.md](02-datos-hirise.md).

## Cómo leer este documento

- Las llamadas **[1]**, **[2]**… remiten a las
  [referencias completas](#referencias-completas).
- **Producto** es el archivo o servicio original; **derivado** es lo que el
  juego guarda en `datos/`.
- Las resoluciones citadas son las del original. El juego remuestrea a 4 m de
  altura y 2 m de textura para que quepa y fluya; no se ve el detalle de 1 m.
- Cuando un dato es una decisión de diseño (velocidades, salto, presiones de la
  ficción) se dice expresamente y no se le atribuye una fuente científica.

## 1. Terreno de detalle: HiRISE en Ares Vallis

### 1.1 Productos usados

| Producto | Archivo | Resolución | Uso |
| --- | --- | --- | --- |
| DTM HiRISE | `DTEEC_002391_1995_001890_1995_A01.IMG` | 1 m/píxel; 6.579 × 14.277; 32 bits reales; 375.739.848 B | Alturas del mundo, punto de impacto y Sagan |
| Ortoimagen HiRISE RED | `PSP_002391_1995_RED_C_01_ORTHO.JP2` | 1 m/píxel; 40.203.404 B | Textura del terreno |
| Ortoimagen HiRISE RED | `PSP_001890_1995_RED_C_01_ORTHO.JP2` | 1 m/píxel; 38.263.216 B | Relleno de huecos de la anterior |
| Etiquetas PDS | `*.LBL` de los productos | — | Proyección, radio local y escala |
| README del DTM | `README_DTEEC_002391_1995_001890_1995_A01.TXT` | — | Notas de producción del modelo |

El DTM se produjo a partir del par estéreo **PSP_002391_1995** (izquierda) y
**PSP_001890_1995** (derecha), adquirido por HiRISE entre 2006 y 2007 sobre el
sitio de aterrizaje de Mars Pathfinder [1][2]. La ficha del DTM indica escala
de mapa de 1,00 m/píxel y centro aproximado en 19,06° N, 326,7° E [1]. Las dos
ortoimágenes son [3].

### 1.2 Enlaces

- Ficha del DTM y del par estéreo:
  <https://www.uahirise.org/dtm/PSP_002391_1995>
- Ficha de la observación izquierda:
  <https://www.uahirise.org/PSP_002391_1995>
- Ficha de la observación derecha:
  <https://www.uahirise.org/PSP_001890_1995>
- Carpeta PDS con el DTM, las ortoimágenes y las etiquetas:
  <https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_002300_002399/PSP_002391_1995_PSP_001890_1995/>
- README del DTM y productos auxiliares:
  <https://www.uahirise.org/PDS/EXTRAS/DTM/PSP/ORB_002300_002399/PSP_002391_1995_PSP_001890_1995/README_DTEEC_002391_1995_001890_1995_A01.TXT>
- Descarga reproducible del proyecto (comprueba tamaños y no repite archivos):
  [`herramientas/descargar-datos-ares.mjs`](../herramientas/descargar-datos-ares.mjs)

### 1.3 Crédito y licencia

- Crédito pedido por HiRISE: **NASA/JPL-Caltech/University of Arizona**
  (la política de uso escribe `NASA/JPL/University of Arizona`; las fichas,
  `NASA/JPL-Caltech/UArizona`) [4].
- Las imágenes y los DTM de HiRISE son de **dominio público**; HiRISE pide el
  crédito «cuando sea posible», no una licencia copyleft [4].
- La misión MRO la gestiona JPL para la NASA; la cámara HiRISE la construyó
  Ball Aerospace y la opera la Universidad de Arizona [2].
- Los productos derivados del repositorio conservan ese crédito y se
  distribuyen con la licencia del proyecto, sin restringir el original.

### 1.4 Qué se transformó

`herramientas/datos-ares.py` lee el DTM, sustituye el valor ausente por `NaN`,
remuestrea a 4 m, funde los huecos y el borde con MOLA, compone las dos
ortofotos, estira el contraste y tiñe las texturas a tonos marcianos. El detalle
procesal paso a paso está en [02-datos-hirise.md](02-datos-hirise.md). Las
texturas del juego **no son color real de Marte**: HiRISE RED es monocromo y el
visor aplica una paleta (`imagen-marciana.js`).

El README del DTM declara paso de malla de 1 m y un error vertical **RMS de
2,06 m**; el espaciado no es la precisión. Es la cota que conviene citar si se
compara el juego con el terreno real [1].

## 2. Relieve global: MOLA

Fuera del rectángulo del DTM, la altura sale del relieve global del **Mars
Orbiter Laser Altimeter (MOLA)**, a bordo de Mars Global Surveyor [5][6].

| Producto en el repositorio | Qué es | Uso |
| --- | --- | --- |
| `datos/bloques/base-global-v2.bin` | Paquete global de relieve MOLA que ya traía el globo (5.945.940 B; 33 × 33 por tesela, nivel 5) | Generador del terreno y fusión de huecos |
| `datos/bloques/mola-global-v1/*.bin` | Teselas del globo Cesium, nivel 5 | Globo y vuelo |
| `datos/bloques/relieve/5/{col}/{fila}.bin` | Teselas locales de 33 × 33 en metros absolutos | Relieve cercano al borde del DTM |
| `datos/ares/lejano.bin` | Recorte de 97 × 97 muestras cada 512 m | Base del mundo exterior |

- **Fuente primaria**: MOLA/MGS, productos MEGDR (Mission Experiment Gridded
  Data Records) del PDS Geosciences Node [5].
- **Crédito**: NASA/JPL/MOLA Science Team.
- **Licencia**: MOLA se distribuye como **CC0** según la ficha del DEM combinado
  de USGS [7]; en todo caso es un producto público de NASA y se mantiene el
  crédito.
- **Límite honesto**: el MOLA original llega a ~463 m/píxel en sus versiones
  globales, pero el paquete que usa el juego está muy reducido (~10 km por
  muestra, según [02-datos-hirise.md](02-datos-hirise.md)). No es detalle real a
  esa escala.
- **Trazabilidad pendiente**: el repositorio guarda el paquete derivado, no la
  versión exacta del MEGDR de la que salió. Si se regenera, conviene anotar en
  `manifiesto.json` el producto y la fecha de descarga.

Enlaces:

- MOLA en el PDS Geosciences Node:
  <https://pds-geosciences.wustl.edu/missions/mgs/mola.html>
- Artículo de referencia del instrumento y de la cartografía global:
  Smith et al. (2001) [6].

## 3. Capas orbitales, mapas y DEM regionales

Estas capas se ven en el globo, en las visitas (Olimpo, Jezero, Valles
Marineris) y en la tablet. No son el suelo del juego: son imágenes de contexto.

| Capa | Origen y crédito | Enlace |
| --- | --- | --- |
| Base global del globo | Viking · NASA/USGS Astrogeology [11] (según los créditos del visor) | <https://astrogeology.usgs.gov/search/map/mars-viking-global-products> |
| Relieve global del globo | MOLA · NASA/JPL/MOLA Science Team [5][6] | <https://pds-geosciences.wustl.edu/missions/mgs/mola.html> |
| CTX directo | CTX/MRO · NASA/JPL/MSSS/Caltech Murray Lab/Esri [9][10] | <https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer?f=json> |
| Relieve regional (Ius Chasma, Valles Marineris) | MOLA + HRSC · USGS, Fergason et al. (2018) [7] | <https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m> |
| Ortofoto y DTM de Ius Chasma | HiRISE · NASA/JPL-Caltech/UArizona [12] | <https://www.uahirise.org/PSP_009645_1725> · <https://www.uahirise.org/dtm/PSP_007430_1725> |
| Exportación de recortes | Mars Trek · NASA/JPL [8] | <https://trek.nasa.gov/mars/> |

### 3.1 CTX

El visor puede pedir el mosaico CTX directamente al servicio público de Esri
(`ctx-directo.js`): es el mosaico **no controlado** del Murray Lab, a
~5 m/píxel, con compresión JPEG con pérdida [9]. La imagen llega en gris y el
juego la colorea; el crédito que muestra el código es «CTX (color aplicado):
NASA/JPL/MSSS/Caltech Murray Lab/Esri». El instrumento CTX y su artículo de
referencia son de Malin et al. (2007) [10].

> **Nota de servicio:** la raíz `OnMars/CTX1/MapServer` sin parámetros devuelve
> 404, pero con `?f=json` responde 200 y las teselas se sirven con normalidad.
> El visor pide teselas (`/tile/{z}/{y}/{x}`), así que la capa funciona; si el
> servicio falla, muestra «CTX no disponible · capas locales» y continúa con
> las capas locales.

### 3.2 Ius Chasma y el DEM MOLA/HRSC

El detalle de la prueba de Valles Marineris está documentado en
[ius-chasma.md](../ius-chasma.md): ortofoto HiRISE PSP_009645_1725 (17 de agosto
de 2008) y DTM `DTEEC_007430_1725_009645_1725_A01`, con muestreo de 0,253
m/píxel en la ortofoto y escala de 1,01 m/píxel en el DTM [12].

El relieve regional es el **DEM combinado MOLA/HRSC de 200 m v2** de USGS
Astrogeology (Fergason, Hare y Laura, 2018) [7]. MOLA es de dominio público;
la parte HRSC de Mars Express se distribuye con **CC BY-SA 3.0 IGO** [26]. Los
recortes de 1° × 1° se exportaron con Mars Trek [8] y se remuestrearon a 384 ×
384 para el visor.

> **Licencia importante:** los derivados que incorporan HRSC conservan la
> condición **CC BY-SA 3.0 IGO** y su atribución. La licencia MIT del código
> del proyecto no sustituye esa obligación.

### 3.3 Viking

La base del menú y de las vistas lejanas se atribuye a **Viking ·
NASA/USGS Astrogeology** [11]. El producto Viking global de referencia de USGS
es el mosaico colorizado de 232 m [11]; el archivo exacto que usa el globo no
quedó registrado en el repositorio, igual que ocurre con el paquete MOLA.

### 3.4 Cartas de la tablet

`herramientas/cartas-tablet.py` genera `datos/cartas/{marte,regional,ares}.webp`
a partir de los DEM locales (MOLA global, MOLA de 10 km y DTM HiRISE). No hay
una fuente externa nueva: es un sombreado derivado de los datos de las secciones
1 y 2, con luz del noroeste y rampa de color por altura. El detalle está en
[04-tablet-mapa.md](04-tablet-mapa.md).

## 4. Modelos 3D y referencias de Mars Pathfinder

Los GLB de `modelos/` son **reconstrucciones visuales originales** del
proyecto, no modelos oficiales ni conversiones de CAD de la misión. Se
distribuyen con la licencia MIT del repositorio. Las referencias usadas para
dimensiones y aspecto están en [historia-modelos.md](../historia-modelos.md):

| Referencia | Para qué se usó | Enlace |
| --- | --- | --- |
| Ficha de la misión Mars Pathfinder · NASA | Contexto, fecha y sitio de aterrizaje (4 de julio de 1997, Ares Vallis) [14] | <https://science.nasa.gov/mission/mars-pathfinder/> |
| Concepto artístico de Pathfinder · NASA/JPL-Caltech | Aspecto general, pétalos y mástil [20] | <https://science.nasa.gov/resource/mars-pathfinder-artists-concept/> |
| Informe de diseño mecánico (Eisen et al., 1997) | Dimensiones y mecanismos del aterrizador [18] | <https://ntrs.nasa.gov/citations/19980038315> |
| Ficha de la antena de alta ganancia · JPL Photojournal (PIA00625) | Disco de la antena plana [16] | <https://photojournal.jpl.nasa.gov/catalog/PIA00625> |
| Dossier de aterrizaje de 1997 | 2,75 m de ancho desplegado y ~1,50 m del mástil de cámara [17] | <https://mpf.digitec.net/newspio/pkts/mpfland2.pdf> |
| Ficha y foto de ensamblaje de Sojourner · JPL Robotics | 65 × 48 × 30 cm, seis ruedas, rocker-bogie, panel solar y APXS [19] | <https://www-robotics.jpl.nasa.gov/what-we-do/flight-projects/pathfinder/> |
| Página histórica de VRML (JPL/SGI/Dramatis) | Solo referencia histórica; **no se incorporó** por falta de licencia clara [21] | <http://www.iki.rssi.ru/mpfmirror/vrml/vrml.html> |

El formato de los GLB es glTF 2.0 binario, sin texturas ni recursos externos
[22]; el lector del juego está escrito a mano y solo usa POSITION, NORMAL,
índices y materiales PBR.

## 5. Constantes, coordenadas y hechos de Marte

| Dato | Valor en el juego | Dónde | Fuente | Nota |
| --- | --- | --- | --- | --- |
| Gravedad marciana | 3,71 m/s² | `rover-fisica.js` | NASA NSSDC [13] | La ficha da 3,69 m/s² en el ecuador y 3,73 de media/polo; 3,71 es el valor redondeado de uso común. |
| Gravedad del salto a pie | 11,5 m/s² | `historia-explora.js` | — | Decisión de juego para que el salto sea corto y controlable; **no es Marte**. |
| Radio planetario | 3.396.190 m | `globo.js` | NASA NSSDC [13] | 3.396,19 km ecuatoriales; el juego usa una esfera, no el elipsoide. |
| Radio local del DTM | 3.394.840 m | Etiqueta PDS | Producto HiRISE [1] | El que usa la proyección del DTM; distinto del radio esférico del globo. |
| Altura del impacto | −3.699,596 m | `datos/ares/manifiesto.json` | DTM [1] | Altura del DTM en el píxel elegido; el juego la toma como 0. |
| Altura de Sagan | +8,887 m | `datos/ares/manifiesto.json` | DTM [1] | Derivada del píxel de Pathfinder. |
| Coordenadas de Sagan | 19,137° N, 33,221° O | `manifiesto.json` | NASA/JPL + DTM [1][15] | Redondeo del sitio de aterrizaje; ver la nota de marcos abajo. |
| Fecha de aterrizaje de Pathfinder | 4 de julio de 1997 | Historia y documentación | NASA [14]; HiRISE [1] | Ares Vallis. |
| Proyección del DTM | Equirectangular planetocéntrica; centro 326,75°; escala 1,0095298 m/píxel | `datos/ares/manifiesto.json` | Etiqueta PDS [1] | Coincide con lo que documenta [02-datos-hirise.md](02-datos-hirise.md). |
| Presión del puente | 72 kPa | `historia-puente.js` | — | Ficción: la presión real media en Marte es ~0,636 kPa [13]. |

### 5.1 La nota de coordenadas

El proyecto usa **19,137° N, 33,221° O** para Sagan, que es el redondeo
habitual del sitio de Pathfinder y cae dentro del DTM. Otras fuentes dan cifras
ligeramente distintas según el marco de referencia:

- JPL (PIA01124) cita **19,17° N, 33,21° O** en el marco USGS, y
  **19,30° N, 33,52° O** en coordenadas inerciales [15].
- La NASA suele redondear a **19,13° N, 33,22° O** [14].

Eso supone una diferencia de unos 2 km en el marco fijo y de casi 10 km
respecto a las coordenadas inerciales [15]; no es un error de medición del DTM.
El juego coloca Sagan en el píxel del DTM correspondiente a 19,137/33,221 y
calcula el impacto 1,2 km al oeste y 1,6 km al norte con las escalas locales;
la altura relativa sale de esa misma muestra.

## 6. Software, formatos y herramientas

| Pieza | Versión | Licencia | Uso |
| --- | --- | --- | --- |
| [CesiumJS](https://github.com/CesiumGS/cesium) | 1.147.0 | Apache 2.0 | Globo, terreno, cámara y capas del menú |
| [three.js](https://threejs.org/) | r160 | MIT | Escena jugable, nave, rover y terreno local |
| [glTF 2.0](https://www.khronos.org/gltf/) | 2.0 | Khronos, abierta | Modelos Pathfinder y Sojourner |
| [Web Audio API](https://www.w3.org/TR/webaudio/) | — | W3C | Viento, pasos, motor y avisos sintetizados |
| [WebP](https://developers.google.com/speed/webp) | — | BSD de libwebp | Texturas del terreno |
| [NumPy](https://numpy.org/) | — | BSD 3-Clause | Procesado del DTM y los mosaicos |
| [Pillow](https://python-pillow.org/) | — | HPND (licencia PIL) | Lectura/escritura de imágenes |
| [Node.js](https://nodejs.org/) | — | MIT | Servidor local y pruebas (`node --test`) |

No hay archivos de audio, fuentes, iconos ni imágenes de terceros fuera de los
datos citados: el sonido se sintetiza, la interfaz usa CSS y los modelos y las
rocas se generan en el repositorio. Las capturas de `documentacion/imagenes/`
son del propio juego o derivados de los datos citados.

## 7. Trazabilidad: qué fuente sostiene cada documento

| Documento | Fuentes principales |
| --- | --- |
| [01-mundo-abierto.md](01-mundo-abierto.md) | HiRISE [1][2], MOLA [5][6], etiquetas PDS |
| [02-datos-hirise.md](02-datos-hirise.md) | HiRISE [1][2], MOLA [5][6], política de uso [4] |
| [03-movimiento-y-rover.md](03-movimiento-y-rover.md) | Gravedad [13]; el resto, diseño y pruebas |
| [04-tablet-mapa.md](04-tablet-mapa.md) | DTM y MOLA [1][5]; escalas derivadas del DTM |
| [05-menu-y-pausa.md](05-menu-y-pausa.md) | Créditos del menú y capas de la sección 3 |
| [06-audio-y-preferencias.md](06-audio-y-preferencias.md) | Web Audio [23]; sin archivos externos |
| [07-arquitectura.md](07-arquitectura.md) | CesiumJS [24], three.js [25], glTF [22] |
| [08-pruebas.md](08-pruebas.md) | `node --test`; gravedad [13] |
| [09-como-se-hizo.md](09-como-se-hizo.md) | Todas las anteriores; bitácora del proceso |
| [10-pendientes.md](10-pendientes.md) | Límites de los datos [1][5][7] |
| [ius-chasma.md](../ius-chasma.md) | HiRISE [12], USGS [7], Mars Trek [8], CC BY-SA [26] |
| [historia-modelos.md](../historia-modelos.md) | JPL/NASA [14]–[20] |

## 8. Créditos listos para copiar

Para el README, el menú de créditos o una ficha del juego. El equipo y los
recursos de software están en [12-creditos.md](12-creditos.md):

```text
Relieve e imagen de Ares Vallis: HiRISE (DTM DTEEC_002391_1995_001890_1995_A01,
ortoimágenes PSP_002391_1995_RED_C y PSP_001890_1995_RED_C), NASA/JPL-Caltech/
University of Arizona. Dominio público.

Relieve global: MOLA, NASA/JPL/MOLA Science Team.
DEM regional: MOLA/HRSC 200 m v2, USGS Astrogeology (Fergason, Hare y Laura,
2018); HRSC ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO.

Imágenes orbitales: CTX (NASA/JPL/MSSS/Caltech Murray Lab/Esri) y Viking
(NASA/USGS Astrogeology). Globo: CesiumJS (Apache 2.0). Escena: three.js (MIT).

Modelos Pathfinder y Sojourner: reconstrucción original del proyecto, a partir
de referencias públicas de NASA/JPL; no son modelos oficiales.

Mars Pathfinder (1997) como inspiración histórica. El resto de datos del juego
son procedimentales y se documentan en documentacion/.
```

## 9. Comprobación de enlaces y límites

El **25/11/2026** se comprobaron por HTTP 32 enlaces de esta bibliografía entre
productos, fichas, servicios, DOI y librerías. Resultado: **26 respondieron
200** (uno de ellos es un PDF), uno **no respondió**, uno dio **403** (bloqueo
anti-bot) y cuatro redirigen fuera de dominio (DOI y Photojournal). Incidencias
concretas:

- La raíz de `OnMars/CTX1` sin parámetros devuelve **404**, pero con `?f=json`
  responde 200 y las teselas `image/png` se sirven con normalidad. El visor pide
  teselas, no la raíz, así que la capa CTX funciona.
- El PDF del informe JPL 97-1174 y su `hdl.handle.net` no responden; se cita el
  registro **NTRS 19980038315**, que es público y no ofrece descarga [18].
- `jpl.nasa.gov/images/pia01124-...` devuelve **403** a peticiones automáticas
  (CloudFront); los metadatos se confirmaron por la API de imágenes de NASA.
- Los DOI redirigen a Wiley; los metadatos se confirmaron por Crossref.
- Mars Trek y algunas fichas de NASA cargan con JavaScript: el enlace es válido,
  pero el texto no se puede leer sin navegador.
- No se descargaron los `.IMG` ni los `.JP2` (cientos de MB): se verificaron las
  fichas y el listado PDS, no los binarios.

Otros límites:

- Los productos originales (unos 450 MB) **no se redistribuyen**; el
  repositorio guarda los derivados (~21 MB) y el
  [script de descarga](../herramientas/descargar-datos-ares.mjs).
- La versión exacta del MEGDR de MOLA y el producto Viking del globo no están
  registrados. Es la principal laguna de esta bibliografía; se puede cerrar
  anotando el archivo y la fecha en `manifiesto.json`.
- Las cifras de Pathfinder (2,75 m, ~1,50 m, 65 × 48 × 30 cm) son las que
  citan las fuentes de la sección 4, no mediciones propias sobre los GLB.
- Las fechas y horas del juego son de la ficción; solo el 4 de julio de 1997 y
  los datos del terreno son reales.

## 10. Fuentes consultadas y descartadas

- **VRML histórico de Pathfinder** (JPL junto con Silicon Graphics y Dramatis):
  se consultó y se conserva como referencia, pero no se usó su geometría. Los
  enlaces originales a `lander_light.wrl` y `rover_complex.wrl` no respondían
  durante la revisión; Wayback Machine conserva copias [21]. No se verificó una
  licencia que permitiera convertir y redistribuir esos archivos, así que no se
  incorporaron.
- **CAD oficial de la misión**: no se distribuye con el proyecto ni se usó como
  malla; los GLB son reconstrucciones propias.
- **Modelos de terceros, texturas y audio**: no se usan. El sonido es
  sintetizado y las texturas salen de los datos citados más detalle procedural.
- **Mapas base de Esri/Google**: no se usan como mapa del juego; el único
  servicio Esri es el mosaico CTX citado [9].

## Referencias completas

1. HiRISE Team. *Topography of the Mars Pathfinder Landing Site* (DTM
   `DTEEC_002391_1995_001890_1995_A01`, par estéreo PSP_002391_1995 /
   PSP_001890_1995). NASA/JPL-Caltech/University of Arizona. Ficha:
   <https://www.uahirise.org/dtm/PSP_002391_1995> · Productos:
   <https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_002300_002399/PSP_002391_1995_PSP_001890_1995/> ·
   Consultado el 25/11/2026.
2. McEwen, A. S., et al. (2007). «Mars Reconnaissance Orbiter's High
   Resolution Imaging Science Experiment (HiRISE)». *Journal of Geophysical
   Research*, 112, E05S02. <https://doi.org/10.1029/2005JE002605>
3. HiRISE Team. *Red HiRISE orthoimages of the Pathfinder site*
   (`PSP_002391_1995_RED_C_01_ORTHO`, `PSP_001890_1995_RED_C_01_ORTHO`).
   NASA/JPL-Caltech/University of Arizona. Misma carpeta PDS que [1].
4. HiRISE. *Image Usage Policy*. <https://www.uahirise.org/media/usage.php> ·
   Consultado el 25/11/2026.
5. NASA PDS Geosciences Node. *Mars Global Surveyor (MGS) Mars Orbiter Laser
   Altimeter (MOLA)*. <https://pds-geosciences.wustl.edu/missions/mgs/mola.html> ·
   Consultado el 25/11/2026.
6. Smith, D. E., et al. (2001). «Mars Orbiter Laser Altimeter: Experiment
   summary after the first year of global mapping of Mars». *Journal of
   Geophysical Research*, 106(E10), 23689–23722.
   <https://doi.org/10.1029/2000JE001364>
7. Fergason, R. L., Hare, T. M., y Laura, J. (2018). *HRSC and MOLA Blended
   Digital Elevation Model at 200m v2*. Astrogeology PDS Annex, U.S. Geological
   Survey.
   <https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m> ·
   Consultado el 25/11/2026.
8. NASA/JPL. *Mars Trek*. <https://trek.nasa.gov/mars/> · Consultado el
   25/11/2026.
9. NASA/JPL/MSSS/Caltech Murray Lab/Esri. *Mars CTX Imagery*
   (`OnMars/CTX1`, mosaico no controlado).
   <https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer?f=json> ·
   Consultado el 25/11/2026. La raíz sin `?f=json` devuelve 404, pero el
   servicio y sus teselas responden.
10. Malin, M. C., et al. (2007). «Context Camera Investigation on board the
    Mars Reconnaissance Orbiter». *Journal of Geophysical Research*, 112,
    E05S04. <https://doi.org/10.1029/2006JE002808>
11. USGS Astrogeology Science Center. *Mars Viking Global Products* (mosaico
    colorizado de 232 m). <https://astrogeology.usgs.gov/search/map/mars-viking-global-products>
12. HiRISE Team. *Ius Chasma*: PSP_009645_1725 (ortoimagen) y
    DTEEC_007430_1725_009645_1725_A01 (DTM). NASA/JPL-Caltech/UArizona.
    <https://www.uahirise.org/PSP_009645_1725> ·
    <https://www.uahirise.org/dtm/PSP_007430_1725>
13. Williams, D. R. (2025). *Mars Fact Sheet*. NASA Space Science Data
    Coordinated Archive. <https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html> ·
    Consultado el 25/11/2026.
14. NASA Science. *Mars Pathfinder*. <https://science.nasa.gov/mission/mars-pathfinder/> ·
    Consultado el 25/11/2026.
15. NASA/JPL. *Mars Pathfinder Landing Site* (PIA01124).
    <https://www.jpl.nasa.gov/images/pia01124-mars-pathfinder-landing-site/> ·
    Consultado el 25/11/2026.
16. NASA/JPL. *Mars Pathfinder High-Gain Antenna* (PIA00625).
    <https://photojournal.jpl.nasa.gov/catalog/PIA00625>
17. NASA/JPL. *Mars Pathfinder Landing* (dossier de prensa, 1997).
    <https://mpf.digitec.net/newspio/pkts/mpfland2.pdf>
18. Eisen, H. J., Buck, C. W., Gillis-Smith, G. R., y Umland, J. W. (1997).
    *Mechanical Design of the Mars Pathfinder Mission*. 7th European Space
    Mechanisms and Tribology Symposium, ESA SP-410, Noordwijk. NTRS
    19980038315. <https://ntrs.nasa.gov/citations/19980038315> · Registro
    público; en la revisión no tenía PDF descargable y el antiguo enlace
    `trs.jpl.nasa.gov/.../97-1174.pdf` no respondía.
19. NASA/JPL Robotics. *Mars Pathfinder / Sojourner*.
    <https://www-robotics.jpl.nasa.gov/what-we-do/flight-projects/pathfinder/>
20. NASA/JPL-Caltech. *Mars Pathfinder Artist's Concept*.
    <https://science.nasa.gov/resource/mars-pathfinder-artists-concept/>
21. The Mars Pathfinder VRML archive (JPL, Silicon Graphics, Dramatis).
    <http://www.iki.rssi.ru/mpfmirror/vrml/vrml.html> · Copias en Wayback:
    <https://web.archive.org/web/20041012103035id_/http://mars.sgi.com/worlds/lander_light.wrl> ·
    <https://web.archive.org/web/20000817082338id_/http://mars.sgi.com/worlds/rover_complex.wrl>
22. Khronos Group. *glTF 2.0 Specification*. <https://www.khronos.org/gltf/>
23. W3C. *Web Audio API*. <https://www.w3.org/TR/webaudio/>
24. Cesium GS. *CesiumJS* (versión 1.147.0, Apache 2.0).
    <https://github.com/CesiumGS/cesium>
25. three.js (r160, MIT). <https://threejs.org/>
26. Creative Commons. *Attribution-ShareAlike 3.0 IGO (CC BY-SA 3.0 IGO)*.
    <https://creativecommons.org/licenses/by-sa/3.0/igo/> · Consultado el
    25/11/2026.
