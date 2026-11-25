# 08 · Pruebas

## Ejecutar

Desde `apex-mars/`:

```powershell
node --test --test-isolation=none
```

Resultado actual: **39 pruebas, 39 correctas** en unos 1,6 s (sin navegador).

## Qué cubre cada grupo

| Archivo | Pruebas |
| --- | --- |
| `historia.test.mjs` | Guion, mando táctil, cabeceras de los GLB |
| `historia-explora.test.mjs` | Nave, puente, esclusa, kit de baliza, movimiento y arrastre |
| `historia-esclusa.test.mjs` | Ciclo de presión, sensores, enclavamientos y modelo físico |
| `historia-puente.test.mjs` | Puesto de mando, trayecto del traje y visión del horizonte |
| `vuelo.test.mjs` | Dinámica de vuelo, aterrizaje, LOD, control y trayectoria |
| `historia-mundo.test.mjs` | Manifiesto y activos reales, estación Sagan, salto/carrera, rover, tablet y misión de la baliza |
| `historia-regolito.test.mjs` | Detalle del suelo repetible, filtrado y sin costura al repetir la baldosa |
| `historia-rocas.test.mjs` | Seis siluetas, determinismo, altura sobre el DTM, perímetros y presupuesto de dibujo |
| `preferencias.test.mjs` | Valores seguros y guardado sin almacenamiento |

### Pruebas de la última ampliación

- **Activos nuevos**: `previa.bin` 58.082 B, `borde.bin` 460.225 B y
  `albedo-comun.webp` presente.
- **Misión de la baliza**: se recoge en la nave, se ancla y se acopla, se repliega,
  viaja en el rover, se replanta junto a Pathfinder; el enlace con Tierra solo se
  activa tras limpiar los paneles, intentar el encendido, comprobar el alcance,
  conectar la baliza y transmitir. Replagarla deshace el enlace.
- **Regolito**: dos generaciones idénticas, filtrado con mipmaps y discontinuidad
  de las juntas comparable a la del interior de la baldosa.
- **Rocas**: las seis geometrías se reparten, cada piedra apoya en su DTM, se
  respetan los perímetros de la nave y de Sagan, y con 25 sectores cargados el
  peor caso se queda en 18 lotes y 231.840 triángulos antes del frustum.

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

El globo Cesium **no se pudo capturar** con SwiftShader: el render de Cesium falla
con `TypeError: this.skyBox.update is not a function` y deja el canvas negro. Es
un problema del entorno headless, no de los cambios (el globo base ya estaba en el
proyecto). El menú de inicio se validó con DOM simulado y revisión de código; la
comprobación visual final del menú sobre el globo debe hacerse en un navegador
real. La escena three.js sí se renderizó correctamente en headless.

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
