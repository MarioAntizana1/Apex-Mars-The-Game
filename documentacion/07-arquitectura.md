# 07 · Arquitectura

## Dos mundos, dos motores

La aplicación tiene dos escenas separadas que nunca se dibujan a la vez:

1. **Globo Cesium** (`#mapa`): Marte completo, relieve MOLA/CTX, menú de inicio,
   vistas y sobrevuelos. Es el arranque del juego y el regreso.
2. **Escena three.js** (`#historia-escena`): prólogo, cabina, EVA, terreno real,
   rover y Sagan. Vive dentro de `#historia` y se crea al empezar la partida.

El menú de inicio es DOM sobre el globo; el menú de pausa y el HUD son DOM sobre
la escena three.js.

## Mapa de archivos

| Archivo | Papel |
| --- | --- |
| `index.html` | Marcado del globo, menú de inicio, historia, EVA, tablet, pausa y vuelo; hojas y módulos |
| `globo.js` | Visor Cesium, capas, vuelos, turismo; crea la historia y el menú; `window.__apexMars` |
| `menu.js` / `menu.css` | Menú de inicio: vistas previas, sobrevuelos, opciones, créditos |
| `creditos.js` | Lista única de créditos (equipo, fuentes, recursos y tipografías) para el menú y la pausa; la detalla `documentacion/12-creditos.md` |
| `preferencias.js` | `leerPreferencias` / `guardarPreferencias` y evento `apex:preferencias` |
| `historia.js` | Modo historia Cesium (prólogo y visita Pathfinder); cierre y `escape` |
| `historia-escena.js` | Campaña three.js: cine, EVA, HUD, tablet, pausa, audio |
| `historia-explora.js` | Simulación EVA: movimiento, salto/carrera, rover, Sagan, colisiones y misión de la baliza |
| `historia-terreno.js` | Sectores reales, vista previa, MOLA, alturas y constantes del mundo |
| `historia-regolito.js` | Baldosa procedural de suelo y material con juntas de fotos fundidas |
| `historia-rocas.js` | Bloques y campos de piedra procedurales por sector |
| `historia-sagan.js` | Estación Sagan, telemetría de los paneles y lector GLB mínimo |
| `historia.css` / `historia-mundo.css` | HUD de la historia, tablet, pausa de cristal, herramientas |
| `historia-cine.js`, `historia-nave.js`, `historia-puente.js`, `historia-esclusa.js`, `historia-guion.js`, `globo.js`, `vuelo.js`, `marineris.js` | Escena original: prólogo, nave, puente, esclusa, guion y vuelo |
| `datos/ares/` | Mundo real generado: manifiesto, 112 sectores, 112 texturas, previa, máscara, albedo y MOLA |
| `datos/bloques/` | Relieve e imágenes del globo; MOLA base y teselas nivel 5 |
| `herramientas/datos-ares.py` | Generador del mundo real |
| `herramientas/mosaico-ares.py` | Albedo común para fundir las juntas entre fotografías |
| `herramientas/descargar-datos-ares.mjs` | Descarga de los productos HiRISE |
| `herramientas/servidor-local.mjs` | Servidor estático de desarrollo |
| `documentacion/` | Esta documentación |

## API de la simulación

`crearExploracion(T, scene, camera, renderer, ui)` crea el mundo y devuelve:

```js
{
  update(dt), dispose(), interact(), move(x, z), look(dx, dy),
  sprint(activo), jump(), vehicle(), mapa(), estado()
}
```

`estado()` devuelve `{x,z,y,yaw,outside,exteriorZone,hasTablet,rover,conduciendo,airborne,
llegadaSagan,comunicacionesActivas,distanciaSagan,panelesLimpios,encendidoIntentado,
balizaConectada,estadoBaliza,estadoRadio,sitioBaliza}`; sirve para pruebas y
depuración.

### Ganchos `ui`

`historia-escena.js` pasa un objeto `ui` con:

| Gancho | Uso |
| --- | --- |
| `objective(texto)` / `inventory(texto)` | Panel de misión |
| `status(texto)` | Aviso central con temporizador y pitido |
| `prompt(texto)` | Botón contextual `E` |
| `exterior(bool)` | Zona cabina/exterior; muestra/oculta el vehículo; audio |
| `vehiculo(estado)` | Texto del botón: guardado/desplegado/conduciendo |
| `tablet(bool)` | Muestra/oculta el botón del mapa |
| `mapa()` | Abre/cierra el diálogo de la tablet |
| `paused()` | Verdadero con mapa o pausa abiertos; detiene la simulación |
| `position(datos)` | Posición, rumbo, velocidad, distancia a Sagan; mapa y flecha |

## API del terreno

`crearTerreno(T, parent, opciones)` devuelve:

```js
{
  iniciar(), actualizar(x, z), altura(x, z), normal(x, z, target),
  dispose(), cuandoListo(cb), limitesRocas,
  manifiesto, listo, fallo
}
```

- `iniciar()` carga manifiesto, recorte MOLA, vista previa y máscara; si hay red,
  construye la ventana inicial. Si no hay `fetch`/`location` (Node), usa el
  terreno de respaldo sin red.
- `actualizar(x, z)` mantiene la ventana de 15 × 15 sectores: coloca vistas
  previas, pide el detalle HiRISE de los 5 × 5 más cercanos, carga o descarta
  teselas MOLA y actualiza la visibilidad de las piedras.
- `altura` interpola el sector cargado con la diagonal de su malla; fuera de la
  ventana usa la vista previa o MOLA.
- `normal` calcula la normal con diferencias finitas para inclinar el rover.
- `limitesRocas` son los bloques de la zona del impacto que bloquean la baliza.
- `dispose` quita el grupo del padre y libera sectores, texturas, regolito,
  piedras y la caché MOLA.

Constantes exportadas: `MUNDO`, `SAGAN`, `ORIGEN`, `ESCALA`, `GEO`.

## API de Sagan

`crearEstacionSagan(T, world, height)` devuelve
`{permite(x,z,radio), update(dt,pos), telemetria(estado), dispose(), grupo, SAGAN}`.

- El grupo se coloca en `(1200, 1600)` y actualiza su altura cuando carga el
  terreno.
- Los GLB se cargan a 260 m con `cargarGlb` (lector GLB mínimo sin dependencias).
- `permite` bloquea lander, rover y poste del cartel.
- `telemetria({panelesLimpios, encendidoIntentado, balizaConectada,
  comunicacionesActivas})` quita el polvo de las celdas solares y cambia el
  testigo de radio.
- `dispose` detiene cargas, retira el grupo y libera geometrías/materiales.

## Historia y menús

- `crearHistoria(C, viewer, detenerOtros, alCerrar)`:
  - `open`/`close` mantienen el estado de cámara y el render del globo;
  - `close(false)` interno al cambiar de escena no avisa;
  - `close()` avisa a `alCerrar` para que el menú de inicio vuelva;
  - al abrir dispara `apex:historia-abierta` (el menú se oculta);
  - `Esc` prueba `campaign.escape?.()` antes de cerrar.
- `crearMenu(C, viewer, ellipsoid, opciones)` devuelve
  `{ocultar, mostrar, actualizar, destruir}`.
- `crearCampana({reduced})` devuelve
  `{skip, dispose, escape, get simulacion}`.

## Ciclo de vida

```text
globo.js start()
 ├─ visor Cesium, capas, vuelo
 ├─ crearHistoria(..., alCerrar → menu.mostrar)
 ├─ crearMenu(...)
 ├─ go('global', 0)
 └─ menú visible

menú Iniciar → #abrir-historia → historia.js caida()
 → crearCampana → cine o directo
 → wake() → crearExploracion
    ├─ crearTerreno (async)
    ├─ crearEstacionSagan
    ├─ rover
    └─ HUD/tablet/pausa/audio
 → salir al globo → historia.close() → camp.dispose()
    ├─ eva.dispose(): estación y terreno se retiran; world se limpia
    ├─ renderer/audio cerrados
    └─ alCerrar → menú de inicio
```

## Depuración

- `window.__apexMars = { C, viewer, scene }` en `globo.js`.
- `camp.simulacion` (getter) devuelve la simulación; `sim.estado()` resume el
  estado. Solo se usa en pruebas/desarrollo; no es una función de juego.
- Los errores de carga de sectores se avisan por consola (`console.warn`).
- `terreno.fallo` guarda el error del manifiesto si el mundo real no carga.

## Dependencias

- **CesiumJS** local en `node_modules/cesium` (globo).
- **three.js** en `vendor/three/three.module.min.js` (escena 3D y rover).
- Sin bundler ni framework: módulos ES nativos; el servidor solo debe enviar los
  MIME correctos (`.mjs`, `.bin`, `.webp`, `.glb`, `.wasm`).
- Python con numpy/Pillow solo para regenerar los datos.

## Convenciones y detalles

- Todo el texto de interfaz está en español.
- Los módulos nuevos usan nombres en español (`crearTerreno`, `crearEstacionSagan`,
  `leerPreferencias`).
- Los datos de altura están en decímetros relativos al impacto; el manifiesto es
  la fuente de verdad de coordenadas.
- La escena original no se reescribió: se integró con ganchos y se sustituyó
  únicamente su terreno/rim inventado por el terreno real, además de las
  ampliaciones de movimiento e interfaz.
- El HUD respeta `[hidden]`, `aria-pressed`, `aria-modal`, `:focus-visible` y
  `prefers-reduced-motion` en lo posible.
