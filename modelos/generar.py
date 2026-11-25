"""Generate the two original historical reconstructions as standalone glTF 2.0 GLBs.

Python 3 standard library only. Coordinates are in metres, +Y up, +Z forward.
Run with --check to verify the committed assets without rewriting them.
"""
import argparse
from collections import defaultdict
import json
from math import cos, sin, pi, sqrt, floor, ceil
from pathlib import Path
import struct


TAU = 2 * pi
PALETTE = {
    'Aluminio': ('C9CBD0', .34, .48), 'Acero': ('777C85', .38, .50),
    'Mecanismos': ('484B50', .25, .66), 'Aislamiento dorado': ('DCAC5E', .28, .59),
    'Aislamiento claro': ('DFD5AF', .09, .80), 'Lentes': ('223A48', .16, .24),
    'Antena plana': ('454953', .10, .80), 'Retícula solar': ('485978', .14, .70),
    'Celdas azul cobalto': ('334F87', .18, .55), 'Celdas azul índigo': ('3D5084', .14, .57),
    'Celdas azul pizarra': ('3B578D', .13, .61), 'Contactos solares': ('A3A6A8', .24, .55),
}
CELLS = ('Celdas azul cobalto', 'Celdas azul índigo', 'Celdas azul pizarra')


def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def unit(a): return mul(a, 1 / sqrt(dot(a, a)))
def yaw(a, angle): return (cos(angle)*a[0]+sin(angle)*a[2], a[1], -sin(angle)*a[0]+cos(angle)*a[2])


def linear(s):
    x = int(s, 16) / 255
    return x / 12.92 if x <= .04045 else ((x + .055) / 1.055)**2.4


class Model:
    def __init__(self):
        self.geometry = defaultdict(list)

    def face(self, material, points, normals=None):
        if normals is None:
            n = unit(cross(sub(points[1], points[0]), sub(points[2], points[0])))
            normals = [n] * len(points)
        vs = list(zip(points, normals))
        for i in range(1, len(vs)-1):
            self.geometry[material].extend((vs[0], vs[i], vs[i+1]))

    def box(self, material, center, size, axes=((1,0,0),(0,1,0),(0,0,1))):
        for i in range(3):
            j, k = (i+1)%3, (i+2)%3
            for s in (-1, 1):
                c = add(center, mul(axes[i], size[i]*s/2))
                a, b = mul(axes[j], size[j]/2), mul(axes[k], size[k]*s/2)
                self.face(material, [sub(sub(c, a), b), sub(add(c, a), b), add(add(c, a), b), add(sub(c, a), b)])

    def prism(self, material, points, bottom, top, angle=0):
        # Negative signed XZ area gives top faces a +Y normal.
        area = sum(x*z2-x2*z for (x,z),(x2,z2) in zip(points,points[1:]+points[:1]))
        if area > 0:
            points = points[::-1]
        a = [yaw((x, bottom, z), angle) for x, z in points]
        b = [yaw((x, top, z), angle) for x, z in points]
        self.face(material, a[::-1]); self.face(material, b)
        for i in range(len(a)):
            j = (i+1) % len(a)
            self.face(material, [a[i], a[j], b[j], b[i]])

    def cylinder(self, material, a, b, r, r2=None, sides=16):
        w = unit(sub(b, a))
        u = unit(cross((0,1,0) if abs(w[1]) < .9 else (1,0,0), w))
        v = cross(w, u)
        offsets = [add(mul(u, cos(i*TAU/sides)), mul(v, sin(i*TAU/sides))) for i in range(sides)]
        if r2 is None: r2 = r
        delta = sub(b, a)
        normals = [unit(add(d, mul(w, (r-r2)/sqrt(dot(delta,delta))))) for d in offsets]
        bottom, top = [add(a, mul(d, r)) for d in offsets], [add(b, mul(d, r2)) for d in offsets]
        self.face(material, bottom[::-1]); self.face(material, top)
        for i in range(sides):
            j = (i+1) % sides
            self.face(material, [bottom[i], bottom[j], top[j], top[i]], [normals[i], normals[j], normals[j], normals[i]])

    def bar(self, material, a, b, width, thickness):
        forward = unit(sub(b, a))
        side = unit(cross((0,1,0) if abs(forward[1]) < .9 else (1,0,0), forward))
        self.box(material, mul(add(a, b), .5), (width, thickness, sqrt(dot(sub(b,a),sub(b,a)))), (side,cross(forward,side),forward))

    def glb(self, name, dimensions):
        doc = {'asset': {'version': '2.0', 'generator': 'apex-mars modelos/generar.py',
                         'extras': {'provenance': 'Original visual reconstruction; not NASA/JPL CAD', 'unit': 'meter', 'upAxis': '+Y'}},
               'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': name, 'mesh': 0}],
               'meshes': [{'name': name, 'primitives': []}], 'materials': [], 'accessors': [], 'bufferViews': []}
        raw = bytearray()

        def accessor(values, fmt, comp, kind, target, bounds=False):
            raw.extend(bytes(-len(raw) % 4))
            packed = b''.join(struct.pack('<'+fmt, *p) for p in values)
            view = len(doc['bufferViews'])
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(raw), 'byteLength': len(packed), 'target': target})
            raw.extend(packed)
            item = {'bufferView': view, 'componentType': comp, 'count': len(values), 'type': kind}
            if bounds:
                # Report the bounds of the actual stored values, including float32 rounding.
                stored = list(struct.iter_unpack('<'+fmt, packed))
                item.update(min=[min(c) for c in zip(*stored)], max=[max(c) for c in zip(*stored)])
            doc['accessors'].append(item)
            return len(doc['accessors'])-1

        all_positions = [pos for verts in self.geometry.values() for pos, _ in verts]
        bounds = [(min(c), max(c)) for c in zip(*all_positions)]
        assert all(abs(hi-lo-want) < .008 for (lo,hi),want in zip(bounds,dimensions)), bounds
        center = tuple((lo+hi)/2 if i != 1 else lo for i,(lo,hi) in enumerate(bounds))
        triangles = 0
        for material, verts in self.geometry.items():
            hex_color, metal, rough = PALETTE[material]
            pbr = {'baseColorFactor': [linear(hex_color[i:i+2]) for i in (0,2,4)]+[1],
                   'metallicFactor': metal, 'roughnessFactor': rough}
            unique = {}; positions = []; normals = []; indices = []
            for pos, n in verts:
                p = tuple(round(x,7) for x in sub(pos, center))
                n = tuple(round(x,7) for x in n)
                if (p,n) not in unique:
                    unique[p,n] = len(positions); positions.append(p); normals.append(n)
                indices.append((unique[p,n],))
            assert len(positions) <= 65536
            for k in range(0,len(indices),3):
                i,j,l = (idx[0] for idx in indices[k:k+3])
                perpendicular = cross(sub(positions[j],positions[i]),sub(positions[l],positions[i]))
                assert all(dot(perpendicular,normals[m]) > 0 for m in (i,j,l)), (material,k)
            attributes = {'POSITION': accessor(positions,'3f',5126,'VEC3',34962,bounds=True),
                          'NORMAL': accessor(normals,'3f',5126,'VEC3',34962)}
            doc['meshes'][0]['primitives'].append({'attributes': attributes, 'indices': accessor(indices,'H',5123,'SCALAR',34963,bounds=True),
                                                   'material': len(doc['materials'])})
            doc['materials'].append({'name': material, 'pbrMetallicRoughness': pbr})
            triangles += len(indices)//3
        doc['buffers'] = [{'byteLength': len(raw)}]
        encoded = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf8')
        encoded += b' ' * (-len(encoded) % 4)
        raw.extend(bytes(-len(raw)%4))
        chunks = struct.pack('<I4s',len(encoded),b'JSON') + encoded + struct.pack('<I4s',len(raw),b'BIN\0') + raw
        geometry = struct.pack('<4sII',b'glTF',2,len(chunks)+12) + chunks
        return geometry, triangles, tuple(round(hi-lo,4) for lo,hi in bounds)


def pathfinder():
    m = Model()
    # A central triangular base and three flat opening petals. Radius fixes the 2.75 m span.
    r = 2.75 / sqrt(3)
    w = 2.75 / 4
    edge = r / 4
    m.prism('Aluminio', [(-w,edge),(w,edge),(0,-r/2)][::-1], .055, .235)
    m.prism('Aislamiento dorado', [(-.30,.19),(.30,.19),(.29,-.25),(0,-.48),(-.29,-.25)][::-1], .235, .422)
    m.box('Aluminio', (0,.438,-.123), (.46,.034,.44))
    for i in range(3):
        angle = i * TAU/3
        p = lambda x,y,z: yaw((x,y,z),angle)
        axes = tuple(yaw(axis,angle) for axis in ((1,0,0),(0,1,0),(0,0,1)))
        m.prism('Aluminio', [(w,edge),(0,r),(-w,edge)], .068, .148, angle)
        m.prism('Retícula solar', [(w-.055,edge+.035),(0,r-.077),(-w+.055,edge+.035)], .148, .157, angle)
        m.box('Aislamiento claro', p(0,.047,1.05), (.32,.094,.27), axes)
        for x in (-.43,.43):
            m.cylinder('Mecanismos',p(x-.058,.181,edge),p(x+.058,.181,edge),.039,sides=12)
            m.cylinder('Acero',p(x-.062,.181,edge),p(x+.062,.181,edge),.024,sides=12)
        for row in range(14):
            z = edge+.076 + row*.071
            half = (w-.055)*(r-.077-z-.051)/(r-.077-edge-.035)
            for col in range(ceil((-half+.036)/.075),floor((half-.036)/.075)+1):
                x = col*.075
                # Cell top glints vary subtly; the narrow seams remain the dark substrate.
                m.box(CELLS[(col+row*2+i)%3],p(x,.1585,z+.025),(.069,.003,.047),axes)
        for side in (-1,1):
            m.bar('Acero', p(side*(w-.034),.153,edge+.015), p(side*.018,.153,r-.052), .012,.012)
        if i == 0:
            for x in (-.1,.1):
                m.cylinder('Acero',p(x-.063,.197,.59),p(x+.063,.197,.59),.034,sides=16)
        elif i == 1:
            # Thin independent ASI/MET meteorology mast, away from the main electronics.
            m.box('Aislamiento dorado',p(0,.199,1.26),(.12,.084,.16),axes)
            m.cylinder('Aluminio',p(0,.21,1.30),p(0,1.16,1.30),.012,sides=10)
            for y in (.42,.76,1.14):
                m.cylinder('Acero',p(-.045,y,1.30),p(.075,y,1.30),.005,sides=8)
    # Telescopic IMP stereo-imager mast, transverse golden camera head and twin lenses.
    for y0,y1,radius in ((.455,.67,.07),(.67,.87,.045),(.87,1.08,.032),(1.08,1.36,.022)):
        m.cylinder('Aluminio', (.076,y0,-.105),(.076,y1,-.105),radius)
    m.cylinder('Acero',(.076,1.345,-.105),(.076,1.399,-.105),.052)
    m.box('Aislamiento dorado',(.076,1.444,-.105),(.32,.112,.126))
    for x in (-.047,.199):
        m.cylinder('Mecanismos',(x,1.445,-.045),(x,1.445,-.021),.037)
        m.cylinder('Lentes',(x,1.445,-.02),(x,1.445,-.018),.023)
    # Pathfinder used a flat high-gain disk, not an open parabolic reflector.
    a = (-.349,.498,.008)
    n = unit((-.38,.89,.25)); b = add(a,mul(n,.048)); c = add(b,mul(n,.008))
    m.cylinder('Aluminio',(-.30,.32,-.10),a,.047)
    m.cylinder('Aluminio',a,b,.255,sides=32)
    m.cylinder('Antena plana',b,c,.241,sides=32)
    m.cylinder('Acero',(.322,.37,.14),(.322,.72,.14),.024,sides=12)
    m.box('Aislamiento claro',(.24,.293,.24),(.21,.116,.14))
    return m.glb('Mars Pathfinder | estación desplegada', (2.75,1.50,2.38))


def sojourner():
    m = Model()
    # Front is +Z; wheel spacing and bounding envelope follow the JPL Robotics dimensions.
    base = [(-.15,-.245),(-.171,-.221),(-.171,.219),(-.146,.246),(.146,.246),(.171,.219),(.171,-.221),(.15,-.245)]
    m.prism('Mecanismos', base, .081,.125)
    m.prism('Aislamiento dorado', base, .125,.188)
    m.prism('Aluminio', [(x*1.05,z*1.035) for x,z in base], .188,.204)
    m.box('Retícula solar',(0,.208,0),(.344,.008,.473))
    for row in range(9):
        for col in range(7):
            x,z = (col-3)*.048,(row-4)*.052
            m.box(CELLS[(2*row+col)%3],(x,.213,z),(.044,.002,.046))
            m.box('Contactos solares',(x,.2142,z-.022),(.042,.0004,.0015))
    for s in (-1,1):
        # Distinct front rocker and twin-wheel rear bogie, plus visible wheel motors and hubs.
        x = s*.180
        pivot = (x,.142,.087); bogie = (x,.11,-.114)
        m.bar('Aluminio', pivot,(x,.083,.26),.018,.022)
        m.bar('Acero',pivot,bogie,.023,.019)
        m.bar('Aluminio',bogie,(x,.065,0),.016,.019)
        m.bar('Aluminio',bogie,(x,.065,-.26),.016,.019)
        for p in (pivot,bogie):
            m.cylinder('Mecanismos',p,add(p,(s*.012,0,0)),.026,sides=12)
            m.cylinder('Aluminio',add(p,(s*.012,0,0)),add(p,(s*.013,0,0)),.013,sides=12)
        for z in (-.26,0,.26):
            y = .065
            p = lambda x: (s*x,y,z)
            m.cylinder('Mecanismos',p(.166),p(.209),.026,sides=12)
            m.cylinder('Acero',p(.181),p(.238),.060,sides=20)
            m.cylinder('Aluminio',p(.236),p(.239),.054,sides=20)
            m.cylinder('Mecanismos',p(.2385),p(.2394),.032,sides=12)
            m.cylinder('Aluminio',p(.2394),p(.240),.018,sides=12)
            for i in range(20):
                t = i*TAU/20
                radial = (0,cos(t),sin(t)); tangent = cross((1,0,0),radial)
                m.box('Aluminio',add(p(.2095),mul(radial,.062)),(.058,.006,.009),((1,0,0),radial,tangent))
    # Low front stereo camera pair. Rear science instrument and short UHF whip.
    for x in (-.112,.112):
        m.box('Mecanismos',(x,.163,.244),(.045,.034,.021))
        m.cylinder('Acero',(x,.163,.251),(x,.163,.262),.014,sides=12)
        m.cylinder('Lentes',(x,.163,.262),(x,.163,.264),.009,sides=12)
    m.box('Mecanismos',(.094,.157,-.248),(.048,.038,.025))
    m.cylinder('Lentes',(.094,.159,-.259),(.094,.159,-.264),.011,sides=12)
    m.bar('Acero',(-.044,.14,-.22),(-.04,.083,-.275),.022,.02)
    m.cylinder('Aluminio',(-.04,.084,-.27),(-.04,.078,-.295),.027,sides=14)
    m.cylinder('Aislamiento claro',(-.04,.078,-.295),(-.04,.077,-.299),.021,sides=14)
    m.box('Aluminio',(-.135,.218,-.163),(.03,.028,.03))
    m.cylinder('Acero',(-.135,.232,-.163),(-.132,.3,-.18),.003,sides=10)
    return m.glb('Sojourner | rover de seis ruedas', (.48,.30,.65))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare generated bytes with checked-in models')
    args = parser.parse_args()
    target = Path(__file__).resolve().parent
    for generate in (pathfinder, sojourner):
        path = target / (generate.__name__+'.glb')
        data, count, bounds = generate()
        if args.check:
            if not path.exists() or path.read_bytes() != data:
                raise SystemExit(f'{path.name}: regenerate the file before committing')
        else:
            path.write_bytes(data)
        print(f'{path.name}: {len(data):,} bytes; {count:,} triangles; XYZ (m): {bounds}')


if __name__ == '__main__':
    main()
