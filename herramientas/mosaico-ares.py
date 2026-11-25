"""Albedo común de baja frecuencia para fundir fotos vecinas, sin cargarlas juntas en el juego."""
from pathlib import Path
from PIL import Image, ImageFilter
import json


def generar_mosaico(carpeta):
    d = json.loads((carpeta / 'manifiesto.json').read_text(encoding='utf8'))['detalle']
    lado = 64  # un texel por 16 metros
    atlas = Image.new('RGB', (lado * d['columnas'], lado * d['filas']))
    for fila in range(d['filas']):
        for col in range(d['columnas']):
            with Image.open(carpeta / 'textura' / f'{col}_{fila}.webp') as foto:
                atlas.paste(foto.convert('RGB').resize((lado, lado), Image.Resampling.BOX), (col*lado, fila*lado))
    # Una sola convolución sobre el mosaico ensamblado, no una por sector.
    atlas.filter(ImageFilter.GaussianBlur(1)).save(carpeta/'albedo-comun.webp', quality=82, method=4)

if __name__ == '__main__':
    generar_mosaico(Path(__file__).resolve().parents[1] / 'datos' / 'ares')
