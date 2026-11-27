# 12 · Créditos, fuentes y recursos

Quién hizo el juego y todo lo externo que utiliza. La trazabilidad completa de
cada dato (producto, archivo, licencia, enlace y qué se transformó) está en
[11-bibliografia.md](11-bibliografia.md); este documento es la versión breve que
también aparece en el **menú de inicio** y en la **pausa**.

## Equipo

- **Mario Manuel Antizana Ponce de Leon**
- **Esther Mamani Condor**
- **Diego Bellido Tello**

## Fuentes y datos

| Recurso | Origen y crédito | Uso en el juego |
| --- | --- | --- |
| DTM y ortoimágenes HiRISE del sitio Pathfinder | **NASA/JPL/University of Arizona** (dominio público) | Alturas y texturas de Ares Vallis. DTM `DTEEC_002391_1995_001890_1995_A01`; ortoimágenes `PSP_002391_1995_RED_C` y `PSP_001890_1995_RED_C` |
| Relieve global MOLA | **NASA/JPL/MOLA Science Team** | Globo, vuelo, fusión del borde del DTM y cartas de la tablet |
| CTX (MRO) | **NASA/JPL/MSSS/Caltech Murray Lab/Esri** | Capa orbital opcional del globo |
| Viking | **NASA/USGS Astrogeology** | Base global del globo |
| DEM MOLA/HRSC 200 m v2 | **USGS Astrogeology** (Fergason, Hare y Laura, 2018); HRSC ESA/DLR/FU Berlin, **CC BY-SA 3.0 IGO** | Relieve regional de las visitas a Valles Marineris |
| Constantes de Marte | **NASA NSSDC**, *Mars Fact Sheet* | Gravedad marciana del rover (3,71 m/s²) |
| Misión Mars Pathfinder (1997) | **NASA/JPL** | Inspiración histórica, fecha y coordenadas del sitio |

Los productos de HiRISE, MOLA y Viking son de dominio público y se usan con su
crédito. Los derivados que incorporan HRSC mantienen **CC BY-SA 3.0 IGO** y su
atribución. Los originales de gran tamaño (~450 MB) no se redistribuyen: el
repositorio guarda los derivados (~21 MB) y el
[script de descarga](../herramientas/descargar-datos-ares.mjs).

Enlaces principales:

- HiRISE: <https://www.uahirise.org/dtm/PSP_002391_1995>
- MOLA: <https://pds-geosciences.wustl.edu/missions/mgs/mola.html>
- CTX: <https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer?f=json>
- Viking: <https://astrogeology.usgs.gov/search/map/mars-viking-global-products>
- Mars Pathfinder: <https://science.nasa.gov/mission/mars-pathfinder/>

## Recursos de software

| Recurso | Versión | Licencia | Uso |
| --- | --- | --- | --- |
| [CesiumJS](https://github.com/CesiumGS/cesium) | 1.147.0 | Apache 2.0 | Globo, terreno, cámara y capas del menú |
| [three.js](https://threejs.org/) | r160 | MIT | Escena jugable, nave, rover y terreno local |
| [glTF 2.0](https://www.khronos.org/gltf/) | 2.0 | Khronos, abierta | Modelos Pathfinder, Sojourner y cohete |
| [Web Audio API](https://www.w3.org/TR/webaudio/) | — | W3C | Viento, pasos, motor y avisos sintetizados |
| [WebP](https://developers.google.com/speed/webp) | — | BSD de libwebp | Texturas del terreno y cartas de la tablet |
| [Node.js](https://nodejs.org/) | — | MIT | Servidor local y pruebas |
| [NumPy](https://numpy.org/) | — | BSD 3-Clause | Procesado del DTM y de los mosaicos |
| [Pillow](https://python-pillow.org/) | — | HPND (licencia PIL) | Lectura y escritura de imágenes |

Las licencias completas de las librerías viajan con el repositorio:
`node_modules/cesium/LICENSE.md` y [`vendor/three/LICENSE.txt`](../vendor/three/LICENSE.txt).

## Tipografías

No se descarga ninguna fuente ni se usan `@font-face`, `.woff`, `.ttf` u `.otf`:

- el **menú de inicio** usa la pila del sistema `system-ui, -apple-system,
  'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
- la **tablet**, la **pausa**, la **guía de controles** y los diálogos usan
  `system-ui, sans-serif`;
- los **rótulos técnicos y el HUD** usan `ui-monospace` (con `Consolas` y
  `monospace` como respaldo).

El aspecto cambia con el sistema operativo; no hay fuentes de terceros que
acreditar.

## Modelos, sonido e imágenes

- **Modelos 3D** (Pathfinder, Sojourner y cohete): reconstrucciones originales del
  proyecto con [`modelos/generar.py`](../modelos/generar.py), no modelos oficiales
  de la misión. Se distribuyen con la licencia MIT del repositorio.
- **Efectos de sonido**: el viento, los pasos, el motor y los avisos se sintetizan con la Web Audio API.
- **Música de los créditos**: Engel Retro · Cristian Castro - Azul [8-Bit Version] ([cancion8bits.mp3](../cancion8bits.mp3)).
- **Rocas, regolito y detalle del suelo**: procedurales, generados en el
  repositorio a partir del DTM.
- **Capturas** de `documentacion/imagenes/`: del propio juego o derivados de los
  datos citados.
- **Iconos**: no hay iconos externos; los símbolos son caracteres Unicode y CSS.

## Cómo citar

```text
APEX / MARS · Ares Vallis (2026). Mario Manuel Antizana Ponce de Leon,
Esther Mamani Condor y Diego Bellido Tello. Datos: HiRISE (NASA/JPL/University
of Arizona), MOLA (NASA/JPL/MOLA Science Team), CTX, Viking y Mars Pathfinder
(NASA/JPL). Código bajo licencia MIT.
```

## Licencia

El código y los modelos generados se distribuyen con la licencia **MIT** del
repositorio ([LICENSE](../LICENSE)). Los datos y librerías externos conservan su
licencia y su crédito, descritos en [11-bibliografia.md](11-bibliografia.md).
