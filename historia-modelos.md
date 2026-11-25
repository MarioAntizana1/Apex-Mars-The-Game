# Mars Pathfinder y Sojourner: modelos 3D

Los dos GLB son **reconstrucciones visuales originales de Apex Mars**, no modelos oficiales de NASA/JPL ni conversiones del CAD de la misión. Representan el equipo de la misión Mars Pathfinder desplegado sobre Marte en 1997. Se simplificaron detalles, materiales, cableado y mecanismos; no son modelos de ingeniería. La geometría y los materiales se generan en este repositorio y no contienen fotografías, texturas, logotipos ni mallas de terceros. Se distribuyen bajo la [licencia del proyecto](LICENSE).

## Origen de las referencias

- La [página histórica de VRML](http://www.iki.rssi.ru/mpfmirror/vrml/vrml.html) dice que sus modelos se derivaron del CAD de JPL y acredita el desarrollo a JPL junto con Silicon Graphics y Dramatis. Los enlaces originales a [`lander_light.wrl`](http://mars.sgi.com/worlds/lander_light.wrl) y [`rover_complex.wrl`](http://mars.sgi.com/worlds/rover_complex.wrl) no respondieron durante la revisión, aunque Wayback Machine registra capturas del [aterrizador](https://web.archive.org/web/20041012103035id_/http://mars.sgi.com/worlds/lander_light.wrl) y del [rover](https://web.archive.org/web/20000817082338id_/http://mars.sgi.com/worlds/rover_complex.wrl). La existencia de una copia archivada no acredita autorización de reutilización: no se verificó una licencia que cubriera la conversión y redistribución, así que no se incorporó el VRML histórico.
- **Pathfinder:** [concepto artístico de NASA/JPL-Caltech](https://science.nasa.gov/resource/mars-pathfinder-artists-concept/), [informe de diseño mecánico de JPL](https://trs.jpl.nasa.gov/bitstream/handle/2014/22661/97-1174.pdf?sequence=1&isAllowed=y), [imagen y descripción del disco de la antena de alta ganancia](https://photojournal.jpl.nasa.gov/catalog/PIA00625) y [dossier de aterrizaje de 1997](https://mpf.digitec.net/newspio/pkts/mpfland2.pdf) para los 2,75 m de ancho desplegado y la altura aproximada de 1,50 m del mástil de cámara. Se muestran la base triangular, los tres pétalos solares, el mástil del imager estéreo (IMP), el mástil meteorológico y la antena plana. No se incluyen la cápsula, los airbags desplegados ni el rover dentro del GLB del aterrizador.
- **Sojourner:** [ficha y fotografía de ensamblaje de JPL Robotics](https://www-robotics.jpl.nasa.gov/what-we-do/flight-projects/pathfinder/) para sus 65 × 48 × 30 cm nominales, las seis ruedas con suspensión rocker-bogie, la cubierta solar y el instrumento APXS. La malla muestra también las cámaras y la antena corta; no anima la suspensión ni los instrumentos.

## Archivos e integración

| Archivo | X × Y × Z (m) | Triángulos | Bytes |
| --- | ---: | ---: | ---: |
| [pathfinder.glb](modelos/pathfinder.glb) | 2,75 × 1,50 × 2,3816 | 5 632 | 276 368 |
| [sojourner.glb](modelos/sojourner.glb) | 0,48 × 0,3007 × 0,65 | 5 620 | 258 520 |

Son archivos glTF 2.0 binarios independientes, sin texturas ni recursos externos. Usan metros, sistema de coordenadas de mano derecha, **+Y vertical** y **+Z hacia delante**. El origen está en el centro de la proyección horizontal de la caja envolvente, al nivel del punto más bajo (`Y = 0`). A escala `1` conservan sus tamaños físicos; para colocarlos en terreno, sitúa el origen sobre la superficie en vez de alinear el centro de la caja.

## Regenerar y comprobar

Desde la raíz de `apex-mars`, con Python 3 y sin dependencias externas:

```sh
python modelos/generar.py
python modelos/generar.py --check
```

El [generador](modelos/generar.py) comprueba las dimensiones, el orden de cara y las normales al exportar. `--check` compara los GLB byte por byte sin modificar los archivos.
