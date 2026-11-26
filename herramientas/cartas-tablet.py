"""Regenera las cartas norte-arriba a partir de los DEM locales (numpy y Pillow)."""
from pathlib import Path
import numpy as np
from PIL import Image

DATOS = Path(__file__).resolve().parents[1] / 'datos'
DEST = DATOS / 'cartas'
DEST.mkdir(exist_ok=True)


def tesela(archivo, lado):
    return np.fromfile(archivo, dtype='<i2').reshape(lado, lado)


def mosaico(columnas, filas, lector, paso=1):
    # Cada tesela comparte su última fila y columna con la siguiente.
    return np.vstack([np.hstack([lector(c, f)[:-1:paso, :-1:paso]
                                 for c in range(columnas)]) for f in range(filas)])


def carta(nombre, alturas, contraste, mascara=None):
    a = alturas.astype('float32')
    dz, dx = np.gradient(a)
    # Luz noroeste, color hipsométrico y sombreado de pendientes.
    luz = np.tanh((dx + dz) / contraste) * .27
    bajo, alto = np.percentile(a if mascara is None else a[mascara > 128], [2, 98])
    t = np.clip((a - bajo) / (alto - bajo), 0, 1)
    imagen = np.stack([np.clip(base + rango*t + 160*luz, 0, 255)
                       for base, rango in [(65, 126), (51, 91), (48, 61)]], axis=-1)
    im = Image.fromarray(imagen.astype('uint8'))
    if mascara is not None:
        im.putalpha(Image.fromarray(mascara))
    im.save(DEST / (nombre + '.webp'), quality=86, method=6)


mola = DATOS / 'bloques' / 'relieve' / '4'
carta('marte', mosaico(32, 16, lambda c, f: tesela(mola / str(c) / f'{f}.bin', 33)), 420)
ares = DATOS / 'ares'
carta('regional', tesela(ares / 'lejano.bin', 97), 45)
dtm = mosaico(7, 16, lambda c, f: tesela(ares / 'terreno' / f'{c}_{f}.bin', 257), 2)
borde = np.fromfile(ares / 'borde.bin', dtype='uint8').reshape(1025, 449)
mascara = Image.fromarray(borde[:-1, :-1]).resize((dtm.shape[1], dtm.shape[0]), Image.Resampling.BILINEAR)
carta('ares', dtm, 10, np.asarray(mascara))
