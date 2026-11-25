# 03 · Movimiento a pie y vehículo

## El traje

El jugador empieza tumbado en la cabina, como antes. La exploración usa el mismo
controlador de primera persona de la base jugable original (`historia-explora.js`)
con estas ampliaciones:

| Estado | Velocidad |
| --- | ---: |
| Dentro de la nave | 2,02 m/s |
| Fuera, andando | 2,85 m/s |
| Corriendo (×1,7) | 4,85 m/s fuera · 3,43 m/s dentro |
| En el aire | 55 % de la velocidad horizontal |

- **Correr**: mantener `Shift` o el botón táctil **Correr**.
- **Saltar**: `Espacio` o **Saltar**. Impulso vertical 4,3 m/s; gravedad 11,5 m/s²;
  salto corto y controlable. Se puede seguir moviendo en el aire.
- **Cámara**: `look` gira con el arrastre; el giro de las flechas izquierda y
  derecha sigue funcionando andando.
- **Interactuar**: `E`; el punto de mira y la distancia deciden la acción.

La distinción **dentro/fuera** se hace con `exteriorZone`, que se recalcula cada
fotograma según el casco (z ≈ −3,98 a `Z_FIN_CASCO`, |x| < 1,97). La variable
`outside` solo recuerda si el jugador ya ha salido alguna vez por la rampa, para
el mensaje de bienvenida; **no** decide la velocidad ni el rover. Esto corrige el
comportamiento antiguo, en el que volver a entrar en la nave seguía usando la
velocidad del exterior. La prueba de la esclusa se ajustó para usar la zona
actual (`zone.at(-1)`) en lugar de “alguna vez fuera”, que era el supuesto viejo.

### Suelo y colisiones

- `floorY(x, z)` devuelve la cubierta de la cabina (0,59 m), la rampa o la altura
  real del terreno. La plataforma del impacto está aplanada a 0, y Sagan a +8,89.
- El jugador no puede atravesar el casco: las reglas de la esclusa, el puente y
  las puertas siguen siendo las originales.
- `allowed(x, z, radio)` impone además:
  - el cuadrado del mundo de ±24.000 m;
  - las colisiones del sitio Sagan (lander 2,2 m, Sojourner 1,3 m, cartel 0,6 m);
  - la baliza de campo anclada, si existe.
- El movimiento se resuelve por ejes (`x` y luego `z`) para deslizar por paredes.

### Controles táctiles

El joystick de la cabina sigue siendo el mismo. En el HUD exterior hay:

- **Correr**: mantener pulsado (aria-pressed);
- **Saltar**: pulsación;
- **Vehículo**: despliega/sube/baja;
- **Tablet**: abre el mapa cuando se ha recogido.

## El rover

### Modelo

Rover procedural de seis ruedas construido en three.js, sin archivos externos:

- chasis de 2,5 × 0,55 × 3,7 m, cúpula, panel solar azul, mástil con cámara,
  dos faros, seis ruedas con buje y brazos;
- las ruedas giran al avanzar; el vehículo se inclina según la normal real del
  terreno;
- material compartido por piezas; no tiene texturas propias.

### Desplegar

`V` (o **Vehículo**) cuando el jugador está **fuera**. Se busca un sitio libre de
3,8 m a la derecha, 4,6 m delante o 3,8 m a la izquierda; se comprueba
`allowed(...)` con radio 1,4 (nave, esclusa, Sagan, límite). Si no hay sitio, se
avisa. Al desplegarlo, el jugador **monta** automáticamente.

Si ya está desplegado y estás a menos de 4,6 m, `V` sube; si estás lejos, se
indica la distancia. `V` mientras conduces baja al jugador a un lado (se prueban
derecha, izquierda y detrás) y deja el rover aparcado.

### Conducir

- `W`/`S` o `↑`/`↓`: acelerador y freno/atrás.
- `A`/`D` o `←`/`→`: giro; el sentido se invierte al dar marcha atrás.
- `Shift`: turbo.
- `V`: bajar.
- El rover sigue el terreno con `floorY` y `terreno.normal`, y respeta
  `allowed` con radio 1,3. No puede entrar en el casco ni en el sitio Sagan.

Constantes actuales:

| Parámetro | Valor |
| --- | ---: |
| Aceleración | 9 m/s² (16 con turbo) |
| Velocidad máxima | 18 m/s (26 con turbo) |
| Marcha atrás | −5 m/s |
| Fricción al soltar | `exp(−1,3·dt)` |
| Giro | 0,9–1,5 rad/s según velocidad |
| Radio de colisión | 1,3 m |
| Cámara | 8,2 m detrás, 3,6 m sobre el suelo; mira al rover |
| Altura de los ojos a pie | 1,51 m |

La cámara de conducción es de **tercera persona cercana**. El arrastre mueve el
punto de vista alrededor del rover (`miradaYaw`/`miradaPitch`); no cambia el
rumbo de conducción. La cámara sube con el terreno para no enterrarse.

### Sonido y HUD

- El motor sintetizado sube de ganancia y tono con la velocidad; el viento y los
  pasos siguen activos a pie.
- El botón **Vehículo** muestra el estado: *Desplegar vehículo*, *Subir al rover*
  o *Bajar del rover*.
- El objetivo del HUD pasa a indicar la distancia y el rumbo a Sagan cuando la
  misión de la baliza está resuelta.

### Depuración

`crearExploracion` devuelve `estado()` (posición, pie, `outside`, `exteriorZone`,
rover, etc.) y el campamento expone el simulador en `camp.simulacion` en el
arranque de prueba. La prueba `historia-mundo.test.mjs` recorre la esclusa, monta
el rover, lo conduce y comprueba que se mueve; también prueba salto, carrera y
tablet.

## Lo que no hace (todavía)

- No hay daño, combustible, vuelco ni caída desde grandes alturas.
- El rover no salta ni flota; sigue el suelo.
- La cámara no hace colisión contra el casco al montar cerca de la nave.
- No hay gamepad ni mando analógico para el rover; el joystick táctil es para el
  traje.
- Las rocas no bloquean el paso (solo son visuales), salvo las piezas de Sagan y
  la baliza.
