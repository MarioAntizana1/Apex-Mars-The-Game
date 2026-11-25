"""Migración única de los sectores v1 ya distribuidos, sin requerir el IMG fuente.
Si se tiene el IMG, usar datos-ares.py, que ya erosiona la máscara NoData original.
Detectamos el relleno por áreas continuas idénticas al MOLA que usó el generador,
no por pendiente (un acantilado real dentro de HiRISE se debe conservar).
"""
import json
import runpy
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parents[1]
salida = root / 'datos/ares'
if (salida / 'previa.bin').exists():
    raise SystemExit('Ya hay vista previa; migración innecesaria')
m = json.loads((salida/'manifiesto.json').read_text())
gen = runpy.run_path(str(root/'herramientas/datos-ares.py'))
mola = gen['Mola'](gen['extraer_mola'](root/'datos/bloques/base-global-v2.bin'))
h = np.zeros((4097, 1793), dtype='<i2')
for f in range(16):
    for c in range(7):
        h[f*256:f*256+257,c*256:c*256+257] = np.fromfile(salida/f'terreno/{c}_{f}.bin','<i2').reshape(257,257)
# Reconstruir la misma rejilla de referencia a 64 m que se usó al exportar.
x = -4096 + np.arange(113)*64
z = -2048 + np.arange(257)*64
mx = gen['R_MARTE'] * np.pi/180 * np.cos(np.radians(gen['LAT_SAGAN']))
my = gen['R_MARTE'] * np.pi/180
ref64 = (mola.muestra(m['origen']['lon']+x/mx,m['origen']['lat']-z[:,None]/my)-m['origen']['altura'])*10
rows = np.array([np.interp(np.arange(1793), np.arange(113)*16,row) for row in ref64])
ref = np.array([np.interp(np.arange(4097), np.arange(257)*16,col) for col in rows.T]).T
# Cinco por cinco muestras contiguas de MOLA: descarta coincidencias puntuales.
mask = Image.fromarray((np.abs(h-ref) < .51).astype('uint8')*255).filter(ImageFilter.MinFilter(5))
dentro = ~np.asarray(mask).astype(bool)
peso = np.zeros_like(h,'float32')
for i in range(32): # rampa de 128 m desde el borde interior
    anterior = np.pad(dentro, 1, mode='edge')
    dentro = np.logical_and.reduce([anterior[dy:dy+4097,dx:dx+1793] for dx,dy in ((1,1),(0,1),(2,1),(1,0),(1,2))])
    peso += dentro * (1/32)
peso = peso*peso*(3-2*peso)
# Almacenar el peso aparte a 16 m, conservando intactos los sectores fuente.
# El visor interpola entre muestras de este campo continuo.
# Plataformas medidas, no discontinuidades de NoData.
for cx,cz,r in ((0,0,80),(1200,1600,40)):
    sx=(cx+4096)//4; sz=(cz+2048)//4; r=r//4+1
    peso[sz-r:sz+r+1,sx-r:sx+r+1]=1
mask16=np.rint(255*peso[::4,::4]).astype('uint8')
mask16.tofile(salida/'borde.bin')
resultado = np.rint(ref+(h-ref)*peso).astype('<i2')
resultado[::16,::16].tofile(salida/'previa.bin')
print('Escalones máximos X/Z (m) antes/después:', [[abs(np.diff(a.astype(float),axis=k)).max()/10 for k in (1,0)] for a in (h,resultado)])
