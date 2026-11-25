# Datos de Ares Vallis

Esta carpeta contiene los datos de juego derivados de productos públicos de
NASA/JPL. **No son los originales** (no se guardan) y no se deben editar a mano:
se regeneran con `herramientas/datos-ares.py`.

## Contenido

- `manifiesto.json`: origen, Sagan, rejillas, límites y fuentes.
- `terreno/{col}_{fila}.bin`: 7 × 16 sectores de 257 × 257 `Int16`
  (decímetros respecto al punto de impacto; 4 m por muestra).
- `textura/{col}_{fila}.webp`: 512 × 512, 2 m/píxel, derivadas de las
  ortoimágenes HiRISE RED.
- `lejano.bin`: malla MOLA de 97 × 97 muestras cada 512 m (48 × 48 km).

## Origen y créditos

- DTM y ortoimágenes: **HiRISE**, NASA/JPL/University of Arizona. Producto
  `DTEEC_002391_1995_001890_1995_A01` y ortoimágenes `PSP_002391_1995_RED_C`,
  `PSP_001890_1995_RED_C` del sitio de aterrizaje de Mars Pathfinder.
- Relieve global: **MOLA**, NASA/JPL/MOLA Science Team.
- El detalle procedural (rocas y bump) es del juego, no del mapa real.

## Regenerar

```powershell
node herramientas/descargar-datos-ares.mjs --destino D:\datos-fuente-ares
python herramientas/datos-ares.py --fuente D:\datos-fuente-ares
```

La documentación completa está en `../documentacion/02-datos-hirise.md`.
