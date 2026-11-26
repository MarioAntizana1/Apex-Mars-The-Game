# 08 · Pruebas

## Ejecutar

Desde `apex-mars/`:

```powershell
node --test --test-isolation=none
```

Resultado actual: **60 pruebas, 60 correctas** en menos de un segundo (sin navegador).

## Qué cubre cada grupo

| Archivo | Pruebas |
| --- | --- |
| `historia.test.mjs` | Guion, mando táctil, cabeceras de los GLB |
| `historia-explora.test.mjs` | Nave, puente, esclusa, kit de baliza, movimiento y arrastre |
| `historia-esclusa.test.mjs` | Ciclo de presión, sensores, enclavamientos y modelo físico |
| `historia-puente.test.mjs` | Puesto de mando, trayecto del traje, visión del horizonte y diagnóstico con y sin enlace orbital |
| `rover-fisica.test.mjs` | Gravedad marciana, apoyo en llano, caída libre, salto al coronar una loma, aterrizaje y pendientes en el marco girado |
| `vuelo.test.mjs` | Dinámica de vuelo, aterrizaje, LOD, control y trayectoria |
| `historia-mundo.test.mjs` | Manifiesto y activos reales, estación Sagan, salto/carrera, rover, tablet, misión de la baliza completa: transmisión, recogida de los dos equipos, vuelta, montaje en la nave, diagnóstico orbital y cierre de la demo |
| `historia-mapa.test.mjs` | Cartas de relieve, georreferenciación, capas del mapa y planisferio con el jugador |
| `guia-controles.test.mjs` | Botones de los dos menús, foco al cerrar y aislamiento de atajos |
| `fin-demo.test.mjs` | Marcado accesible, animación del fundido, las dos salidas y el cableado con la escena |
| `creditos.test.mjs` | Equipo, fuentes, recursos y tipografías; misma lista en menú, pausa y `12-creditos.md` |
| `historia-regolito.test.mjs` | Detalle del suelo repetible, filtrado y sin costura al repetir la baldosa |
| `historia-rocas.test.mjs` | Seis siluetas, determinismo, altura sobre el DTM, perímetros y presupuesto de dibujo |
| `preferencias.test.mjs` | Valores seguros y guardado sin almacenamiento |

### Pruebas de la última ampliación

- **Activos nuevos**: `previa.bin` 58.082 B, `borde.bin` 460.225 B y
  `albedo-comun.webp` presente.
- **Misión de la baliza completa**: se recoge en la nave, se ancla y se acopla, se
  repliega, viaja en el rover, se replanta junto a Pathfinder; el enlace con Tierra
  solo se activa tras limpiar los paneles, intentar el encendido, comprobar el
  alcance y conectar la baliza, y ahora **se acciona la baliza** para llamar a
  Houston. La conversación (siete turnos) termina con la tormenta de arena: la
  niebla pasa de `0,00062` a `0,057` y la simulación no avanza mientras se lee.
  Después se recogen los dos equipos, se vuelve en marcha atrás por el mismo
  camino, se montan Pathfinder y la baliza en sus soportes y el diagnóstico del
  puente confirma el enlace orbital y abre el cierre de la demo una sola vez.
- **Física del rover**: en llano las seis ruedas apoyan sin hundirse; en caída
  libre la aceleración medida es 3,71 m/s²; al coronar una loma de 1,2 m a
  14 m/s el chasis pierde contacto, vuela y vuelve a apoyar; una caída a −30 m/s
  no atraviesa el terreno; las pendientes se leen correctamente al girar el
  chasis.
- **Conducción real en navegador** (`_probe/verificar-conduccion.mjs`): con
  `?depurar=1` se salió por la esclusa, se desplegó el rover y se condujo con
  turbo sobre el relieve HiRISE avanzando el tiempo de simulación desde CDP. El
  rover quedó **16 de 32 muestras** con alguna rueda en el aire y las capturas
  `rover-suspension.png` y `rover-vuelo.png` muestran apoyo, inclinación y vuelo.
- **Cierre de la demo**: las pruebas comprueban el `<dialog>`, el fundido en CSS,
  que `Esc` no decide por el jugador, que “seguir explorando” reanuda y que
  “terminar” devuelve al globo, además de que la escena pausa la simulación.
- **Guía de controles**: mismo diálogo desde inicio y pausa, `aria-haspopup`,
  devolución del foco y atajos que no llegan a la escena.
- **Regolito**: dos generaciones idénticas, filtrado con mipmaps y discontinuidad
  de las juntas comparable a la del interior de la baldosa.
- **Rocas**: las seis geometrías se reparten, cada piedra apoya en su DTM, se
  respetan los perímetros de la nave y de Sagan, y con 25 sectores cargados el
  peor caso se queda en 18 lotes y 231.840 triángulos antes del frustum.

- **Créditos**: los tres nombres del equipo, HiRISE, MOLA, CTX, Viking,
  CesiumJS, three.js, glTF, Web Audio, WebP y las tipografías del sistema
  aparecen en la lista compartida y en `12-creditos.md`; el menú y la pausa
  renderizan la misma lista desde `creditos.js`.

### Ajuste de una prueba antigua

La prueba de la esclusa calculaba el tiempo de caminata con
`zone.includes(true)` (¿alguna vez estuve fuera?). La simulación ahora usa la zona
**actual** para la velocidad (dentro 2,02 m/s, fuera 2,85 m/s), que es lo correcto
al volver a entrar. El helper de la prueba pasó a `zone.at(-1)`; el juego no se
rebajó para que la prueba antigua pasara.

## Cómo funciona el entorno de pruebas

- Node importa three.js y crea escenas sin WebGL: `crearExploracion` funciona con
  un `EventTarget` como canvas y un renderer falso (`{domElement}`).
- `crearTerreno` detecta que no hay `location` y usa el terreno de respaldo
  (altura 0 dentro del rectángulo, sin red). Por eso las pruebas de movimiento no
  descargan sectores.
- `crearEstacionSagan` no crea texturas de canvas sin `document` y no descarga los
  GLB si no se acerca (`update` lejos).
- El audio no se crea sin `window.AudioContext`; no afecta.
- Las pruebas no comprueban Cesium ni el menú del globo; eso requiere navegador.

## Comprobación visual en navegador

Se hizo con Edge headless y un servidor local:

```powershell
node herramientas/servidor-local.mjs
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new --no-first-run --disable-sync --disable-extensions `
  --enable-unsafe-swiftshader --use-angle=swiftshader `
  --remote-debugging-port=9222 --user-data-dir=... about:blank
```

y Chrome DevTools Protocol (`Runtime.evaluate`, `Page.captureScreenshot`,
`Emulation.setDeviceMetricsOverride`, caché desactivada). Se verificaron:

- la cabina y el HUD,
- el terreno real al salir de la nave,
- el sitio Sagan con Pathfinder/Sojourner,
- el rover desplegado y la cámara de tercera persona,
- el mapa de la tablet y su lectura de coordenadas,
- el menú de pausa de cristal y las opciones.

En la última iteración se repitió con `_probe/verificar-cierre.mjs`, que carga la
página real y conecta los módulos nuevos a su marcado:

- **Guía de controles**: dos botones (`#menu` y `.pausa-lista`), `showModal`,
  foco dentro del diálogo, `Esc`/`M` que no llegan a la escena y devolución del
  foco al botón de origen.
- **Cierre de la demo**: `showModal`, `animationName` `fin-demo-texto` en el panel y
  `fin-demo-negro` en el `::backdrop`, fondo negro opaco, título y pregunta
  correctos, y “Seguir explorando” que cierra el diálogo.
- Capturas: [`fin-demo.png`](imagenes/fin-demo.png) y
  [`guia-controles.png`](imagenes/guia-controles.png).

En la última iteración se añadieron capturas específicas del terreno:

- suelo del impacto con grano, grava y la huella de aterrizaje;
- juntas entre cuatro sectores, sin bandas ni cortes;
- horizonte desde 160 m de altura, sin pared;
- campo de bloques y una roca grande a 3 m.

Las capturas de desarrollo quedan en `_probe/` (fuera del juego); las de
`documentacion/imagenes/` son las que acompañan a la documentación.

### Comprobaciones automáticas de shaders

Un shader que no compila no lo detecta `node --test`: three escribe el error por
consola y la malla deja de dibujarse. En la inspección visual se comprobó también
`THREE.WebGLProgram: Shader Error` en la consola del navegador; conviene repetirlo
tras tocar `historia-regolito.js`.

### Prueba de integración real

Además de las capturas, se comprobó el flujo completo en la página real con CDP:
carga del globo, menú visible, panel oculto, clic en **Iniciar partida**, historia
visible con canvas three.js, **Saltar prólogo**, EVA lista con el botón de pausa,
apertura y cierre de la pausa de cristal y **Volver al globo** con el menú de
inicio de nuevo visible. Todo el flujo DOM respondió correctamente y sin errores
nuevos. Lo único que no se pudo verificar es el **aspecto visual del globo** en
headless; el render de la escena three.js sí se vio.

### Nota sobre Cesium headless

En pasadas anteriores el globo Cesium **no** se pudo capturar con SwiftShader
(`this.skyBox.update is not a function`, canvas negro). En la última pasada, con
`_probe/verificar-cierre.mjs`, el globo sí se renderizó y las capturas de la guía y
del cierre se tomaron sobre esa misma página. Si vuelve a fallar, es un problema
del entorno headless y no de los cambios: la comprobación visual final del menú
sobre el globo debe hacerse en un navegador real.

## Cómo añadir una prueba

- Para lógica pura, crea un `*.test.mjs` con `node:test` y `assert/strict`.
- Para la simulación, copia el helper `simulation()` de
  `historia-mundo.test.mjs`; ya incluye los ganchos `ui`.
- Para datos, lee `datos/ares/manifiesto.json` y valida tamaños/alturas; no
  ejecutes el generador (requiere 450 MB y Python) dentro de `node --test`.
- Mantén las pruebas rápidas y sin navegador; las visuales van aparte.

## Limitaciones de la cobertura

- No hay pruebas de WebGL, audio ni Cesium.
- El menú de inicio (`menu.js`) se probó con DOM simulado durante su desarrollo,
  pero esas pruebas no se incluyeron en el repositorio; queda la revisión manual.
- La generación de datos no está testeada de extremo a extremo; sus resultados sí
  están validados por `historia-mundo.test.mjs`.
- No hay prueba de rendimiento ni de móvil real.
