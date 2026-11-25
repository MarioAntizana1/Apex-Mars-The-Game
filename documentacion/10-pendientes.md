# 10 · Límites conocidos y pendientes

## Verificación pendiente

- **Globo/menú en navegador real**: el flujo DOM (menú → inicio → historia →
  EVA → pausa → vuelta) se comprobó en Edge headless; el **render visual** del
  globo Cesium no se pudo capturar (SwiftShader falla con `skyBox.update`). Falta
  abrirlo en un navegador normal y revisar las cuatro opciones, los sobrevuelos y
  el regreso desde el juego.
- **Audio real**: no se ha escuchado en un dispositivo con audio; los nodos están
  sintetizados y se silencian correctamente, pero conviene ajustar volúmenes.
- **Móvil real**: el HUD, la tablet y la pausa son responsive, pero solo se
  revisaron con métricas de escritorio y un viewport pequeño.

## Mundo y datos

- El DTM real solo cubre ~54 % del rectángulo jugable; el resto y el terreno
  exterior son **MOLA de ~10 km por muestra**. No es detalle real a esa escala.
- Las alturas del juego son de **4 m** y las texturas de **2 m/píxel**, aunque el
  DTM original es de 1 m.
- Fuera del rectángulo de detalle el mundo sigue generándose, pero **no hay un
  límite de movimiento**: se puede caminar indefinidamente por relieve MOLA
  procedural. El antiguo recorte de 24 km ya no dibuja una pared.
- El regolito, las rocas y la huella de aterrizaje son procedurales; no están en
  el mapa real.
- **Los bloques grandes no bloquean el paso**: se puede atravesar una roca de 8 m.
  Falta una consulta de colisión por sector (los campos de grava sí respetan los
  perímetros de la nave y de Sagan).
- La plataforma del impacto (26–70 m) y la de Sagan (8–28 m) son aplanados de
  juego.
- No se guardan los datos fuente (~450 MB). Para cambiar de resolución o de
  recorte hay que descargar y regenerar.
- Las teselas MOLA nivel 5 vienen con el globo; si se regeneran los datos HiRISE
  hay que volver a lanzar `mosaico-ares.py` para el albedo común.

## Juego

- **No hay guardado de partida**: cada inicio empieza en la nave; solo se
  conservan las preferencias.
- **No hay viaje rápido** ni teletransporte. Ir a Sagan son 2 km a pie o en rover.
- La misión de la baliza es de un solo uso por partida (aunque la baliza se puede
  replegar y volver a instalar); no hay interior explorable del lander.
- El cartel puede quedar fuera del campo de visión si te acercas por el este o el
  sur; está orientado a la aproximación noroeste.
- El rover es procedural y sencillo (cúpula, panel, seis ruedas). No tiene
  interiores ni daños; la cámara no colisiona con el casco al montar cerca.
- No hay gamepad, ni vuelco, ni combustible.
- La flecha de rumbo está apagada por defecto; se activa en Opciones.
- El panel de controles del globo se oculta mientras el menú de inicio está
  visible. Si se quiere consultar el panel, no hay un botón para cerrar el menú
  sin empezar; se puede recargar o usar el menú de pausa una vez dentro.

## Interfaz

- La pausa no tiene focus trap completo ni cierre con clic fuera del panel (sí
  con el fondo); cumple `aria-modal` y botones reales.
- El mapa no se puede arrastrar; solo centra en el jugador o en Sagan y hace
  zoom. No dibuja el relieve real ni la máscara del DTM.
- La cuadrícula del mapa usa una escala local constante (aprox. 56 km/° y
  59 km/°); es suficiente para orientarse, no para cartografía.
- La tablet no tiene una miniatura del terreno; el mapa es esquemático a
  propósito.
- La barra de la historia y los botones se solapan en pantallas muy estrechas;
  el CSS reduce tamaños, pero no se probó en todos los móviles.
- Los créditos son genéricos; faltan nombres reales si se quieren.

## Menú y preferencias

- El menú de inicio solo aparece al cargar y al volver del juego; no hay una tecla
  para invocarlo durante la partida (el de pausa sí).
- “Imágenes científicas” solo afecta a las capas del globo Cesium; no cambia las
  texturas del suelo del juego.
- El sonido es sintetizado y no hay música ni control de volumen fino.
- Las preferencias se guardan en `localStorage`; en modo privado pueden no
  persistir (el juego no falla).
- La opción de idioma no existe: todo está en español.

## Ideas para la siguiente iteración

1. Verificar el menú del globo y los sobrevuelos en un navegador real; ajustar
   cámaras y duraciones si hace falta.
2. Ampliar la misión de comunicaciones de Sagan (recoger una muestra o
   comparar el paisaje con la foto de 1997).
3. Guardar descubrimientos (Sagan visitada, rover desplegado) sin guardar la
   posición, o guardado completo.
4. Añadir una vista de satélite real en la tablet (miniatura HiRISE) y un botón
   para alternar esquema/imagen.
5. Texturas de 1 m y un mapa normal derivado del DTM de 1 m para el suelo.
6. Sustituir el MOLA de nivel 5 por uno de 463 m en las zonas cercanas al DTM.
7. Añadir colisión de los bloques grandes y un aviso al alejarse mucho del sitio
   de aterrizaje.
8. Mejorar el rover (suspensión, polvo, luces, sonido por ruedas) y la cámara con
   colisión.
9. Añadir gamepad, opción de idioma y focus trap en la pausa.
10. Incluir los nombres reales en los créditos y un enlace a esta documentación
    desde el menú.
