# 09 · Cómo se hizo (bitácora)

Esta es la memoria del proceso: lo que se decidió, lo que se intentó, lo que
falló y cómo se resolvió. Sirve para continuar el proyecto sin repetir errores.

## Punto de partida

El proyecto ya tenía:

- un globo Cesium de Marte con relieve MOLA, imágenes CTX/HiRISE y vuelo;
- un prólogo cinematográfico (`historia-cine.js`) y una visita Cesium al sitio
  Pathfinder;
- una escena three.js jugable con la nave, el puente, la esclusa, el kit de
  baliza y una EVA local.

Lo que faltaba era convertir esa escena local en un mundo abierto real, añadir
rover, carrera, salto, tablet/mapa y un menú de inicio con visitas.

## Decisiones tomadas contigo

Se consultaron todos los puntos antes de suponer:

1. **Escala**: Sagan a ~2 km del impacto, mundo con carga por sectores.
2. **Terreno**: datos reales de Ares Vallis; había que importarlos.
3. **Sagan**: solo el sitio histórico (lander, Sojourner y cartel), sin edificios.
4. **Vehículo**: rover de seis ruedas, `V` lo despliega al lado, montaje
   automático y cámara de tercera persona.
5. **Física**: arcade; `Shift` mantenido para correr y salto corto.
6. **Mapa**: 2D esquemático, norte arriba, con zoom, cuadrícula real y pausa.
7. **Menú**: el grande es solo para el arranque; después, pausa de cristal.
8. **Inicio**: prólogo con opción de saltarlo, como ya estaba.
9. **Créditos**: lista compartida con el equipo, NASA/JPL, USGS, CesiumJS,
   three.js, las tipografías del sistema y los recursos.
10. **Imágenes científicas**: capas orbitales del globo.
11. **Sonido**: solo ambiente sintetizado, sin música.
12. **Límite**: extender con MOLA global más allá del DTM.
13. **Borde del impacto**: quitar el cráter inventado y usar el terreno real.
14. **Sitios**: Sagan en el sitio real de Pathfinder; impacto 2 km al noroeste.
15. **Encontrar Sagan**: sin flechas por defecto; la tablet guía; la flecha es una
    opción.
16. **Guardado**: no se guarda la partida; solo preferencias.
17. **Documentación**: `.md` por cada apartado y del proceso.

## Datos: de HiRISE al juego

### Búsqueda

Se localizó el DTM HiRISE del **sitio de aterrizaje de Pathfinder**
(`DTEEC_002391_1995_001890_1995_A01`), de 1 m/píxel, 6.579 × 14.277, con
ortoimágenes RED de 1 m. Se descargaron ~450 MB en una carpeta temporal. Los
originales no se quedaron en el repositorio (decisión tuya); el script de descarga
y el generador permiten regenerarlos.

### Coordenadas

El sitio real Pathfinder se tomó en 19,137° N, 33,221° O. Con las escalas del DTM
(0,953741 m/px en X y 1,009531 m/px en Y) se calculó el impacto 1,2 km al oeste y
1,6 km al norte, de modo que Sagan queda exactamente en `(1200, 1600)`. El punto
de impacto queda a `-3699,596 m` de altitud real y Sagan a `+8,887 m` relativos.

### Generador

`herramientas/datos-ares.py` hace todo el procesado. Durante su desarrollo
aparecieron estos fallos, ya corregidos:

- **Longitud 326° en vez de −33°**: el muestreo MOLA usaba 0–360 sin normalizar;
  se pasó a (−180, 180) y el MOLA coincidió con el DTM (~25 m de diferencia).
- **Alturas absolutas en los sectores**: se restaban mal el origen; el `Int16`
  se saturaba a −3276,8 m. Se restó `H0` antes de mezclar.
- **Máscara de validez**: se añadió el fundido DTM→MOLA y el borde de 1.200 m
  para que no hubiera escalones.
- **Sectores**: al principio se escribían con un offset de 64 muestras en vez de
  256; se corrigió y las costuras ahora son 0.
- **Texturas**: se añadió el fundido del albedo al polvo en el borde y en los
  huecos, y el tinte/contraste.
- **Rocas/regolito**: se añadieron como detalle local, con exclusión alrededor de
  la nave y de Sagan; después se ampliaron a bloques métricos por todo el mundo.

El resultado: 112 sectores de 132 KB, 112 texturas WebP, `lejano.bin`,
`previa.bin`, `borde.bin`, `albedo-comun.webp` y `manifiesto.json`; ~21 MB.

## Integración en la escena

- Se retiró el terreno procedural de 460 m y el **borde de cráter inventado**.
- Se sustituyó por `crearTerreno`, que mantiene una ventana de 15 × 15 sectores
  con vista previa a 64 m y detalle HiRISE en los 5 × 5 más cercanos.
- La nave, la rampa, la esclusa, el puente, el kit y la tablet se conservaron; la
  zona de impacto se aplana para que apoyen.
- Se añadió el **rover** procedural con ruedas, cámara de persecución y turbo.
- Se añadieron **correr y saltar** con teclado/táctil.
- Se añadió la **Estación Sagan** con los GLB Pathfinder/Sojourner y un lector GLB
  propio (no había GLTFLoader en `vendor/`).
- Se añadió la **misión de comunicaciones**: la baliza se transporta, se repliega
  y se replanta junto a Pathfinder antes de transmitir.

### Las juntas entre fotografías

Con el terreno a la altura de los ojos se veían cortes rectos entre las fotos
orbitales. La solución fue separar el **albedo de gran escala** del **detalle**:

1. `mosaico-ares.py` reduce cada sector a 64 × 64 y los cose en un atlas único;
2. el shader del suelo calcula la media local de cada foto con un sesgo de mip y
   la sustituye por la del atlas solo cerca de la junta (96 m);
3. el grano de alta frecuencia de la foto se conserva hasta el borde.

Así no desaparece el detalle en una banda de 16 m —el primer intento— ni queda un
escalón de color.

### El muro del borde del DTM

Al alejarse del sitio de aterrizaje aparecía una pared vertical donde la máscara
del DTM dejaba de tener datos. El generador ya fundía DTM y MOLA, pero los
sectores guardados conservaban puntos de relleno con una discontinuidad de hasta
21 m en 4 m. Se añadió `borde.bin` (peso de fusión a 16 m) y el visor interpola
ese campo continuo; además, las aristas de cada sector comparten normal con el
proxy de 64 m, así que ni el LOD ni la máscara dejan costuras visibles.

### El bug `outside` vs `exteriorZone`

El controlador original usaba `outside` (¿alguna vez salí?) para la velocidad.
Al volver a entrar en la nave seguía corriendo a velocidad exterior. Se cambió a
`exteriorZone` (¿estoy fuera ahora?) para la velocidad y el rover. Eso destapó una
prueba antigua que calculaba el tiempo con “alguna vez fuera”; se actualizó el
helper a la zona actual. La prueba de la esclusa pasa y el juego es más correcto.

### El bug de la doble base

Los sectores se pedían como `base + "terreno/..."` y `cargarBinario` volvía a
anteponer `base`: la URL salía `datos/ares/datos/ares/terreno/...`. Los 404
inundaban la consola y el mundo no aparecía. Se corrigió la ruta y se validó con
la lista de recursos del navegador.

### Caché del navegador

Al probar cambios de módulos en headless, Edge seguía sirviendo versiones
antiguas y mostrando errores ya corregidos (`muestras` duplicado). Se desactivó la
caché por CDP (`Network.setCacheDisabled`) y se lanzó un perfil limpio. En
producción, un refresco normal basta.

## Menú y pausa

El menú de inicio se encargó a un subagente con un contrato de marcado y API
(`crearMenu`), y se integró en `globo.js`. Incluye vistas previas con retardo,
sobrevuelos, opciones, créditos, `prefers-reduced-motion` y estados accesibles.
El menú de pausa se hizo a mano en `historia-escena.js` con
`backdrop-filter` (cristal), pausa de la simulación y las tres preferencias.

El primer intento de subagentes (menú, movimiento y Sagan) falló sin dejar
mensaje; se asumió el trabajo directamente. El segundo intento del menú sí
entregó `menu.js` y `menu.css`, que se revisaron e integraron.

## Verificación

- **109 pruebas** en Node; todas pasan. La voz, la consola y los mandos se
  probaron con APIs simuladas y, además, en Edge headless con `SpeechRecognition`
  y `getGamepads` falsos (9 pasos, capturas en `_probe/obc-qa/evidencia/`).
- Comprobación visual con Edge headless + CDP: cabina, terreno real, juntas entre
  sectores, horizonte, bloques de roca, Sagan, rover, mapa y pausa. Capturas en
  `documentacion/imagenes/`.
- Prueba de integración en la página real: menú → Iniciar partida → historia →
  Saltar prólogo → EVA → pausa → Volver al globo → menú. Todo correcto.
- El globo Cesium no se pudo capturar en headless (SwiftShader/Cesium falla con
  `skyBox.update`); hay que verlo en un navegador real.
- Se limpiaron los archivos temporales, los perfiles de Edge y los 450 MB de
  datos fuente. Solo queda lo necesario para jugar y regenerar.

## Voz y mandos

El OBC se diseñó como una capa de intención sobre la simulación existente: el
catálogo de órdenes vive en `comandos.js`, el emparejador tolera erratas y
negaciones en `voz.js`, y `cabina-obc.js` enruta micrófono, consola escrita y
mandos hacia las mismas puertas de la misión. Así, «despliega el rover» y `V`
nunca pueden divergir, y la voz no puede saltarse Sagan ni repetir el final. La
consola escrita se añadió como camino accesible y como red de pruebas sin
micrófono. El reconocimiento del navegador puede enviar audio a su servicio y
requiere permiso; se documenta en la propia interfaz y se puede apagar. Los
mandos comparten un único astronauta para no abrir un modo cooperativo que el
juego no tiene.

## Problemas de entorno

Al principio, el sandbox de Windows no dejaba escribir en `apex-mars/` desde
PowerShell o Python, aunque sí en la raíz del workspace. Se lanzó el diagnóstico
`diagnose-windows-sandbox-acl`; concluyó que no era un problema de ACL
(`NOT_THIS_CLASS`). El cambio de política de la sesión a acceso completo resolvió
la escritura y permitió descargar y generar los datos.

## Lecciones

- Los datos reales tienen máscaras y huecos; hay que presupuestar el relleno y
  documentarlo.
- Los productos PDS son enormes; conviene descargar una vez y derivar un paquete
  pequeño y versionado.
- Las pruebas de movimiento dependen de la semántica de “dentro/fuera”; conviene
  medir la zona actual, no el histórico.
- En headless, la caché y el render de Cesium pueden engañar; valida los datos y
  la escena con herramientas independientes y, al final, en un navegador real.
- Documentar mientras se hace ahorra reconstruir decisiones después.
