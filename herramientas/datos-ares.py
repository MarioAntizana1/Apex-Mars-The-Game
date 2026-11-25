#!/usr/bin/env python3
"""Genera el mundo jugable real de Ares Vallis a partir de datos HiRISE y MOLA.

Entradas (no se versionan, se descargan aparte):
  - DTEEC_002391_1995_001890_1995_A01.IMG  DTM HiRISE de 1 m/píxel del sitio
    Pathfinder (NASA/JPL/University of Arizona, PDS).
  - PSP_002391_1995_RED_C_01_ORTHO.JP2 y PSP_001890_1995_RED_C_01_ORTHO.JP2
    ortoimágenes HiRISE de 1 m/píxel.

Salidas en datos/ares/:
  - manifiesto.json
  - terreno/{col}_{fila}.bin   (Int16, 257x257, decímetros sobre el punto de impacto)
  - textura/{col}_{fila}.webp  (512x512, color derivado de HiRISE)
  - lejano.bin                 (Int16, 97x97, malla MOLA de 512 m)

El área detallada mide 7x16 sectores de 1024 m. Alrededor se extiende una malla
MOLA de 48x48 km. El origen (0,0) es el punto de impacto; Sagan está en
(1200,1600) m, en el sitio real de aterrizaje de Mars Pathfinder.

Uso:
  python herramientas/datos-ares.py --fuente RUTA_A_DATOS_FUENTE
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = 200_000_000

# --- Constantes de la proyección PDS -----------------------------------------
W, H = 6579, 14277
RES = 58691.81313585          # píxeles por grado
CENTER_LON = 326.75           # longitud central de la proyección (este, 0..360)
LINE_OFFSET = 1125835.5
SAMPLE_OFFSET = 3120.5
R_MARTE = 3_394_840.0         # radio local usado por la etiqueta PDS

# Sitio real de Mars Pathfinder (19,137 N, 33,221 O) y separación pedida.
LON_SAGAN = 326.779
LAT_SAGAN = 19.137
SAGAN_X, SAGAN_Z = 1200.0, 1600.0   # metros al este y al sur del impacto

# Rejilla detallada: 7 x 16 sectores de 1024 m, muestras cada 4 m.
CHUNK = 1024.0
STEP = 4.0
COLS, ROWS = 7, 16
N = int(CHUNK / STEP) + 1            # 257 muestras por sector
X0, Z0 = -4096.0, -2048.0

# Malla lejana MOLA: 48 x 48 km, muestras cada 512 m.
FAR_X0 = -24576.0
FAR_Z0 = -24576.0
FAR_STEP = 512.0
FAR_N = 97

def pixel_a_lonlat(l: float, s: float) -> tuple[float, float]:
    lon = CENTER_LON + (s + 0.5 - SAMPLE_OFFSET) / RES
    lat = (LINE_OFFSET - (l + 0.5)) / RES
    return lon, lat


def lonlat_a_pixel(lon: float, lat: float) -> tuple[float, float]:
    s = (lon - CENTER_LON) * RES + SAMPLE_OFFSET - 0.5
    l = LINE_OFFSET - lat * RES - 0.5
    return l, s


def smoothstep(a: float, b: float, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def leer_dtm(fuente: Path) -> np.ndarray:
    ruta = fuente / "DTEEC_002391_1995_001890_1995_A01.IMG"
    # La etiqueta PDS ocupa un registro de 26316 bytes y la imagen empieza en el
    # registro 2.
    datos = np.fromfile(ruta, dtype="<f4", offset=26316)
    if datos.size != W * H:
        raise SystemExit(f"DTM inesperado: {datos.size} muestras (esperadas {W * H})")
    dem = datos.reshape(H, W).astype(np.float32, copy=False)
    dem[dem < -1.0e30] = np.nan
    return dem


def leer_orto(fuente: Path) -> np.ndarray:
    """Compone las dos ortoimágenes RED; usa la segunda donde la primera es nula."""
    piezas = []
    for nombre in ("PSP_002391_1995_RED_C_01_ORTHO.JP2", "PSP_001890_1995_RED_C_01_ORTHO.JP2"):
        with Image.open(fuente / nombre) as imagen:
            piezas.append(np.asarray(imagen.convert("L"), dtype=np.uint8))
    a, b = piezas
    comp = np.where(a > 0, a, b)
    return comp


def extraer_mola(ruta: Path) -> np.ndarray:
    raw = np.fromfile(ruta, dtype="<i2")
    if raw.size % (33 * 33):
        raise SystemExit("El paquete MOLA no tiene el tamaño esperado")
    return raw.reshape(-1, 33, 33)


class Mola:
    """Muestreo bilineal del relieve global MOLA de nivel 5 (33x33 por tesela)."""

    def __init__(self, teselas: np.ndarray):
        self.teselas = teselas.astype(np.float32)
        self.nivel = 5
        self.nx = 2 ** (self.nivel + 1)      # 64 teselas de longitud
        self.ny = self.nx // 2               # 32 teselas de latitud
        self.offset = 2 * (4 ** self.nivel - 1) // 3

    def muestra(self, lon, lat):
        lon = np.asarray(lon, dtype=np.float64)
        lat = np.asarray(lat, dtype=np.float64)
        lon = np.where(lon > 180.0, lon - 360.0, lon)
        fx = (lon + 180.0) / 360.0 * self.nx
        fy = (90.0 - lat) / 180.0 * self.ny
        tx = np.floor(fx).astype(np.int32)
        ty = np.floor(fy).astype(np.int32)
        tx = np.clip(tx, 0, self.nx - 1)
        ty = np.clip(ty, 0, self.ny - 1)
        sx = np.clip(fx - tx, 0.0, 1.0 - 1e-12) * 32.0
        sy = np.clip(fy - ty, 0.0, 1.0 - 1e-12) * 32.0
        x0 = np.floor(sx).astype(np.int32)
        y0 = np.floor(sy).astype(np.int32)
        x1 = np.minimum(x0 + 1, 32)
        y1 = np.minimum(y0 + 1, 32)
        ax = sx - x0
        ay = sy - y0
        idx = self.offset + ty * self.nx + tx
        t = self.teselas
        return ((t[idx, y0, x0] * (1 - ax) + t[idx, y0, x1] * ax) * (1 - ay) +
                (t[idx, y1, x0] * (1 - ax) + t[idx, y1, x1] * ax) * ay)


def bilineal_dtm(dem: np.ndarray, l, s):
    """Devuelve altura y fracción válida (0..1) del DTM para coordenadas de píxel."""
    l = np.asarray(l, dtype=np.float64)
    s = np.asarray(s, dtype=np.float64)
    lc = np.clip(l, 0, H - 2)
    sc = np.clip(s, 0, W - 2)
    l0 = np.floor(lc).astype(np.int64)
    s0 = np.floor(sc).astype(np.int64)
    ty = lc - l0
    tx = sc - s0
    v00 = dem[l0, s0]
    v01 = dem[l0, s0 + 1]
    v10 = dem[l0 + 1, s0]
    v11 = dem[l0 + 1, s0 + 1]
    w00 = (1 - tx) * (1 - ty)
    w01 = tx * (1 - ty)
    w10 = (1 - tx) * ty
    w11 = tx * ty
    valores = np.stack([v00, v01, v10, v11])
    pesos = np.stack([w00, w01, w10, w11])
    validos = np.isfinite(valores)
    suma = np.where(validos, pesos, 0.0).sum(axis=0)
    # Fuera del DTM o sin vecinos válidos, la suma es cero.
    valor = np.where(suma > 0, np.where(validos, valores * pesos, 0.0).sum(axis=0) / np.maximum(suma, 1e-9), 0.0)
    return valor, suma


def main() -> int:
    ap = argparse.ArgumentParser(description="Genera el mundo real de Ares Vallis")
    ap.add_argument("--fuente", default=str(Path.home() / "apex-mars-datos"),
                    help="Carpeta con el DTM, las ortoimágenes y base-global-v2.bin")
    ap.add_argument("--salida", default=str(Path(__file__).resolve().parent.parent / "datos" / "ares"))
    ap.add_argument("--sin-texturas", action="store_true", help="Solo relieve (para pruebas)")
    ap.add_argument("--mola", default=str(Path(__file__).resolve().parent.parent / "datos" / "bloques" / "base-global-v2.bin"), help="Paquete MOLA global base-global-v2.bin")
    args = ap.parse_args()

    fuente = Path(args.fuente)
    salida = Path(args.salida)
    (salida / "terreno").mkdir(parents=True, exist_ok=True)
    (salida / "textura").mkdir(parents=True, exist_ok=True)

    print("Leyendo DTM…")
    dem = leer_dtm(fuente)
    print("  alturas: %.2f a %.2f m" % (np.nanmin(dem), np.nanmax(dem)))

    # Escalas locales por píxel (la DTM es equirectangular planetocéntrica).
    lat_rad = math.radians(LAT_SAGAN)
    mx = R_MARTE * math.cos(lat_rad) * math.pi / 180.0 / RES
    my = R_MARTE * math.pi / 180.0 / RES
    print(f"  escala: {mx:.6f} m/px en X, {my:.6f} m/px en Y")

    # Anclaje: Sagan en el sitio real de Pathfinder; impacto 1,2 km al O y 1,6 km al N.
    ls, ss = lonlat_a_pixel(LON_SAGAN, LAT_SAGAN)
    l0 = ls - SAGAN_Z / my
    s0 = ss - SAGAN_X / mx
    lon0, lat0 = pixel_a_lonlat(l0, s0)
    h0, m0 = bilineal_dtm(dem, np.array(l0), np.array(s0))
    h0 = float(h0)
    h_sagan, ms = bilineal_dtm(dem, np.array(ls), np.array(ss))
    h_sagan = float(h_sagan)
    if not m0 > 0.99 or not ms > 0.99:
        raise SystemExit("El punto de impacto o Sagan cae fuera del DTM válido")
    print(f"  origen real: lon {lon0:.6f} lat {lat0:.6f}; H0 {h0:.2f} m")
    print(f"  Sagan: lon {LON_SAGAN:.6f} lat {LAT_SAGAN:.6f}; altura {h_sagan:.2f} m")

    # Extremos reales del DTM en coordenadas del juego.
    dlon_oeste, dlat_norte = pixel_a_lonlat(0, 0)
    dlon_este, dlat_sur = pixel_a_lonlat(H - 1, W - 1)
    xmin = (0 - s0) * mx
    xmax = (W - 1 - s0) * mx
    zmin = (0 - l0) * my
    zmax = (H - 1 - l0) * my
    print(f"  DTM en el juego: x {xmin:.1f}..{xmax:.1f}, z {zmin:.1f}..{zmax:.1f}")

    # Máscara de validez con transición suave (evita un escalón DTM→MOLA).
    print("Preparando máscara de validez…")
    mascara = Image.fromarray((np.isfinite(dem) * 255).astype(np.uint8))
    # El desenfoque solo dejaba ~50 % de DTM justo antes de una laguna
    # NoData (y 0 % dentro): escalones de hasta 21 m. Retraer primero la
    # máscara válida; la rampa termina *dentro* de la huella medida.
    mascara = mascara.resize((W // 8, H // 8), Image.Resampling.BOX)
    mascara = mascara.point(lambda p: 255 if p == 255 else 0)
    mascara = mascara.filter(ImageFilter.MinFilter(33)).filter(ImageFilter.GaussianBlur(5))
    # Rejilla de 16 m sobre el área detallada para muestrear la transición.
    gx = np.arange(X0, X0 + COLS * CHUNK + STEP, 16.0)
    gz = np.arange(Z0, Z0 + ROWS * CHUNK + STEP, 16.0)
    gl, gs = (gz[:, None] - 0) / my + l0, (gx[None, :] - 0) / mx + s0
    ms_small = np.asarray(mascara) / 255.0
    # Muestreo bilineal simple de la máscara en resolución 1/8.
    ll = np.clip(gl / 8.0, 0, H / 8 - 2)
    ss_ = np.clip(gs / 8.0, 0, W / 8 - 2)
    l0i = np.floor(ll).astype(np.int32)
    s0i = np.floor(ss_).astype(np.int32)
    ty = ll - l0i
    tx = ss_ - s0i
    campo_mascara = (ms_small[l0i, s0i] * (1 - tx) * (1 - ty) +
                     ms_small[l0i, s0i + 1] * tx * (1 - ty) +
                     ms_small[l0i + 1, s0i] * (1 - tx) * ty +
                     ms_small[l0i + 1, s0i + 1] * tx * ty)

    # Campo MOLA suave (64 m) para rellenar huecos y bordes.
    print("Muestreando MOLA…")
    teselas = extraer_mola(Path(args.mola))
    mola = Mola(teselas)
    mx64 = np.arange(X0, X0 + COLS * CHUNK + 64, 64.0)
    mz64 = np.arange(Z0, Z0 + ROWS * CHUNK + 64, 64.0)
    m_l = (mz64[:, None] - 0) / my + l0
    m_s = (mx64[None, :] - 0) / mx + s0
    m_lon = CENTER_LON + (m_s + 0.5 - SAMPLE_OFFSET) / RES
    m_lat = (LINE_OFFSET - (m_l + 0.5)) / RES
    campo_mola = mola.muestra(m_lon, m_lat).astype(np.float64) - h0

    # Rejilla completa (comparte bordes entre sectores).
    nx = COLS * int(CHUNK / STEP) + 1
    nz = ROWS * int(CHUNK / STEP) + 1
    alturas = np.empty((nz, nx), dtype=np.int16)
    cubierta = np.zeros((nz, nx), dtype=np.uint8)

    print(f"Resolviendo {nx}x{nz} muestras de relieve…")
    xs = X0 + np.arange(nx) * STEP
    for bloque in range(0, nz, 256):
        zb = np.arange(bloque, min(bloque + 256, nz))
        zz = Z0 + zb * STEP
        ll_rows = zz / my + l0
        ss_cols = xs / mx + s0
        L = ll_rows[:, None]
        S = ss_cols[None, :]
        val, frac = bilineal_dtm(dem, L, S)
        val = val - h0  # el juego mide la altura respecto al punto de impacto
        # MOLA suave: interpola la rejilla de 64 m por filas.
        zq = np.interp(zz, mz64, np.arange(mz64.size))
        zq0 = np.floor(zq).astype(np.int32)
        zq1 = np.minimum(zq0 + 1, mz64.size - 1)
        tz = (zq - zq0)[:, None]
        mola_rows = campo_mola[zq0] * (1 - tz) + campo_mola[zq1] * tz
        xq = np.interp(xs, mx64, np.arange(mx64.size))
        xq0 = np.floor(xq).astype(np.int32)
        xq1 = np.minimum(xq0 + 1, mx64.size - 1)
        tx_ = (xq - xq0)[None, :]
        mola_fino = mola_rows[:, xq0] * (1 - tx_) + mola_rows[:, xq1] * tx_
        # Máscara suave en resolución de 16 m.
        zq2 = np.interp(zz, gz, np.arange(gz.size))
        z20 = np.floor(zq2).astype(np.int32)
        z21 = np.minimum(z20 + 1, gz.size - 1)
        tz2 = (zq2 - z20)[:, None]
        fila_mask = campo_mascara[z20] * (1 - tz2) + campo_mascara[z21] * tz2
        xq2 = np.interp(xs, gx, np.arange(gx.size))
        x20 = np.floor(xq2).astype(np.int32)
        x21 = np.minimum(x20 + 1, gx.size - 1)
        tx2 = (xq2 - x20)[None, :]
        mask_fino = fila_mask[:, x20] * (1 - tx2) + fila_mask[:, x21] * tx2
        # DTM donde es válido, MOLA donde no.
        mezcla = np.clip(mask_fino * frac, 0, 1)
        h = val * mezcla + mola_fino * (1 - mezcla)
        # Transición en el borde del rectángulo DTM: DTM→MOLA en 1200 m.
        borde = np.minimum(
            np.minimum(xs[None, :] - xmin, xmax - xs[None, :]),
            np.minimum(zz[:, None] - zmin, zmax - zz[:, None]),
        )
        t_borde = smoothstep(0.0, 1200.0, borde)
        h = np.where(borde > 0, h * t_borde + mola_fino * (1 - t_borde), mola_fino)
        # Zona de impacto: plataforma plana para la nave.
        radio = np.hypot(xs[None, :], zz[:, None])
        p_imp = 1.0 - smoothstep(26.0, 70.0, radio)
        h = h * (1 - p_imp) + 0.0 * p_imp
        # Plataforma pequeña en Sagan para el lander y el rover.
        radio_s = np.hypot(xs[None, :] - SAGAN_X, zz[:, None] - SAGAN_Z)
        p_sag = 1.0 - smoothstep(8.0, 28.0, radio_s)
        h = h * (1 - p_sag) + (h_sagan - h0) * p_sag
        alturas[bloque:bloque + zb.size] = np.clip(np.rint(h * 10.0), -32768, 32767).astype(np.int16)
        cubierta[bloque:bloque + zb.size] = np.rint(np.clip(mezcla, 0, 1) * 255).astype(np.uint8)

    # Vista previa compartida de 64 m; cubre sectores mientras llega el detalle.
    alturas[::16, ::16].tofile(salida / 'previa.bin')

    # Peso de fusión DTM↔MOLA a 16 m: el visor interpola este campo continuo
    # para que ninguna frontera interior de la máscara quede en escalón.
    fusion = cubierta[::4, ::4].copy()
    paso16 = STEP * 4
    for cx, cz, radio in ((0.0, 0.0, 80.0), (SAGAN_X, SAGAN_Z, 40.0)):
        sx = int(round((cx - X0) / paso16))
        sz = int(round((cz - Z0) / paso16))
        r = int(round(radio / paso16)) + 1
        fusion[max(0, sz - r):sz + r + 1, max(0, sx - r):sx + r + 1] = 255
    fusion.tofile(salida / 'borde.bin')

    # Sectores. Los bordes se comparten: el último muestreo de un sector es el
    # primero del siguiente, así no hay costuras de altura.
    print("Escribiendo sectores de relieve…")
    for fila in range(ROWS):
        for col in range(COLS):
            i0 = fila * int(CHUNK / STEP)
            j0 = col * int(CHUNK / STEP)
            trozo = alturas[i0:i0 + N, j0:j0 + N]
            trozo.tofile(salida / "terreno" / f"{col}_{fila}.bin")

    # Texturas: una por sector, 2 m/píxel, derivadas de la ortoimagen HiRISE.
    print("Generando texturas…")
    if not args.sin_texturas:
        orto = leer_orto(fuente)
        # Estiramiento de contraste global con percentiles de la zona válida.
        validos = orto[orto > 0]
        bajo, alto = np.percentile(validos, (2, 98))
        print(f"  DN {bajo:.0f}..{alto:.0f}")

        def muestra_orto(l, s):
            lc = np.clip(l, 0, H - 2)
            sc = np.clip(s, 0, W - 2)
            l0 = np.floor(lc).astype(np.int32)
            s0 = np.floor(sc).astype(np.int32)
            ty = lc - l0
            tx = sc - s0
            v00 = orto[l0, s0]
            v01 = orto[l0, s0 + 1]
            v10 = orto[l0 + 1, s0]
            v11 = orto[l0 + 1, s0 + 1]
            return ((v00 * (1 - tx) * (1 - ty) + v01 * tx * (1 - ty) +
                     v10 * (1 - tx) * ty + v11 * tx * ty).astype(np.float32))

        for fila in range(ROWS):
            for col in range(COLS):
                px = 512
                bx = X0 + col * CHUNK + (np.arange(px) + 0.5) * (CHUNK / px)
                bz = Z0 + fila * CHUNK + (np.arange(px) + 0.5) * (CHUNK / px)
                l = (bz[:, None] / my + l0)
                s = (bx[None, :] / mx + s0)
                gris = muestra_orto(l, s)
                n = np.clip((gris - bajo) / max(1.0, alto - bajo), 0, 1)
                # Tinte marciano cálido, con un poco de saturación de albedo.
                real = np.stack([
                    0.18 + 0.82 * n,
                    0.10 + 0.62 * n,
                    0.06 + 0.44 * n,
                ], axis=-1)
                # Fundido del albedo real hacia polvo en el borde del DTM y en
                # los huecos de la máscara, a juego con el fundido de altura.
                xi = np.clip(np.interp(bx, gx, np.arange(gx.size)), 0, gx.size - 1 - 1e-6)
                zi = np.clip(np.interp(bz, gz, np.arange(gz.size)), 0, gz.size - 1 - 1e-6)
                x0i = np.floor(xi).astype(np.int32)
                z0i = np.floor(zi).astype(np.int32)
                x1i = np.minimum(x0i + 1, gx.size - 1)
                z1i = np.minimum(z0i + 1, gz.size - 1)
                tx_ = xi - x0i
                tz_ = zi - z0i
                filas_m = campo_mascara[z0i] * (1 - tz_)[:, None] + campo_mascara[z1i] * tz_[:, None]
                mtex = filas_m[:, x0i] * (1 - tx_)[None, :] + filas_m[:, x1i] * tx_[None, :]
                borde = np.minimum(
                    np.minimum(bx[None, :] - xmin, xmax - bx[None, :]),
                    np.minimum(bz[:, None] - zmin, zmax - bz[:, None]),
                )
                t_borde = smoothstep(0.0, 1200.0, borde)
                alfa = np.clip(mtex * t_borde, 0, 1) * (gris > 0.5)
                variacion = 0.94 + 0.08 * np.sin(bx[None, :] * 0.013 + bz[:, None] * 0.009)
                polvo = np.array([0.60, 0.38, 0.27])[None, None, :] * variacion[..., None]
                rgb = real * alfa[..., None] + polvo * (1 - alfa[..., None])
                # Grano fino determinista para que el suelo no parezca plástico.
                yy, xx = np.mgrid[0:px, 0:px]
                grano = (np.sin(xx * 12.9898 + yy * 78.233) * 43758.5453) % 1.0
                rgb = np.clip(rgb * (0.94 + 0.12 * grano[..., None]), 0, 1)
                img = Image.fromarray((rgb * 255).astype(np.uint8))
                img.save(salida / "textura" / f"{col}_{fila}.webp", "WEBP", quality=82, method=4)
        del orto

    # Rejilla MOLA lejana, para el anillo de mundo más allá del DTM.
    print("Generando malla lejana MOLA…")
    fx = FAR_X0 + np.arange(FAR_N) * FAR_STEP
    fz = FAR_Z0 + np.arange(FAR_N) * FAR_STEP
    f_l = fz[:, None] / my + l0
    f_s = fx[None, :] / mx + s0
    f_lon = CENTER_LON + (f_s + 0.5 - SAMPLE_OFFSET) / RES
    f_lat = (LINE_OFFSET - (f_l + 0.5)) / RES
    lejano = (mola.muestra(f_lon, f_lat).astype(np.float64) - h0)
    lejano_i16 = np.clip(np.rint(lejano * 10.0), -32768, 32767).astype(np.int16)
    lejano_i16.tofile(salida / "lejano.bin")

    # Manifiesto.
    manifiesto = {
        "version": 1,
        "origen": {"lon": lon0, "lat": lat0, "altura": h0},
        "impacto": {"x": 0.0, "z": 0.0},
        "sagan": {"x": SAGAN_X, "z": SAGAN_Z, "lon": LON_SAGAN, "lat": LAT_SAGAN, "altura": h_sagan - h0},
        "detalle": {
            "x0": X0, "z0": Z0, "sector": CHUNK, "paso": STEP,
            "columnas": COLS, "filas": ROWS, "muestras": N,
        },
        "lejano": {
            "x0": FAR_X0, "z0": FAR_Z0, "paso": FAR_STEP,
            "lado": FAR_N, "archivo": "lejano.bin",
        },
        "dtm": {
            "lon_oeste": dlon_oeste, "lon_este": dlon_este,
            "lat_norte": dlat_norte, "lat_sur": dlat_sur,
            "x_min": float(xmin), "x_max": float(xmax),
            "z_min": float(zmin), "z_max": float(zmax),
            "metros_por_pixel_x": mx, "metros_por_pixel_y": my,
            "resolucion_m": 1.0, "tamano": [W, H],
        },
        "limite": 24000.0,
        "fuentes": [
            "HiRISE DTM DTEEC_002391_1995_001890_1995_A01 (1 m/píxel), NASA/JPL/University of Arizona",
            "HiRISE ortho PSP_002391_1995_RED_C y PSP_001890_1995_RED_C (1 m/píxel), NASA/JPL/University of Arizona",
            "MOLA global base v2, NASA/JPL/MOLA Science Team",
        ],
        "cubierta_dtm": float(cubierta.mean() / 255.0),
    }
    (salida / "manifiesto.json").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Listo:", salida)
    print("  sectores:", COLS * ROWS, "· cubierta DTM media:", f"{manifiesto['cubierta_dtm']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
