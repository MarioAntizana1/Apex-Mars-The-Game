// Ares Vallis. Superficie visible y colisión comparten los mismos triángulos.
import { crearRegolito, materialRegolito } from './historia-regolito.js'
import { crearDepositos } from './historia-rocas.js'

const RUTA = './datos/ares/'
export const MUNDO = Object.freeze({ x0:-4096,z0:-2048,x1:3072,z1:14336,sector:1024,paso:4,muestras:257,columnas:7,filas:16,limite:24000 })
export const SAGAN = Object.freeze({ x:1200,z:1600 })
export const ORIGEN = Object.freeze({ lon:326.7575625336271,lat:19.164003701859567 })
export const ESCALA = Object.freeze({ x:.9537405849265161,y:1.0095308204752965 })
export const GEO = Object.freeze({ mPorGradoLat:59252,mPorGradoLon:55977 })
const L = MUNDO.sector, PASO = 64, RADIO = 7, DETALLE = 2
const clave = (c,f) => `${c}_${f}`
const esDTM = (c,f) => c>=0 && c<MUNDO.columnas && f>=0 && f<MUNDO.filas
const sat = x => Math.max(0,Math.min(1,x))
const suave = x => { const t=sat(x); return t*t*(3-2*t) }
const mezcla = (a,b,t) => a+(b-a)*t

// Interpolación con la diagonal de THREE.PlaneGeometry para colisiones, o
// bilineal para campos continuos (peso, raster MOLA y rejilla de referencia).
export function muestra(a,w,x,z,tri=false) {
  const i=Math.max(0,Math.min(w-2,Math.floor(x))), j=Math.max(0,Math.min(a.length/w-2,Math.floor(z)))
  const u=sat(x-i), v=sat(z-j), k=i+j*w, A=a[k], B=a[k+1], C=a[k+w], D=a[k+w+1]
  return tri ? (u+v<=1 ? A+(B-A)*u+(C-A)*v : D+(C-D)*(1-u)+(B-D)*(1-v)) : mezcla(mezcla(A,B,u),mezcla(C,D,u),v)
}
// Mismo sistema geográfico y datum que herramientas/datos-ares.py. Las teselas
// nivel 5 ya existen como archivos independientes (2.1 KiB, 33x33, metros).
function geografia(x,z) {
  const gx=((ORIGEN.lon+x/GEO.mPorGradoLon+180)%360+360)%360/360*64
  const gy=Math.max(0,Math.min(32,(90-ORIGEN.lat+z/GEO.mPorGradoLat)/180*32))
  const c=Math.min(63,Math.floor(gx)), f=Math.min(31,Math.floor(gy))
  return [c,f,(gx-c)*32,(gy-f)*32]
}
export function crearTerreno(T,parent,opciones={}) {
  const base=opciones.base??RUTA, grupo=new T.Group(); grupo.name='terreno real de Ares Vallis'; parent.add(grupo)
  const bump=crearRegolito(T,opciones.anisotropia??4,MUNDO); bump.repeat.set(L/4,L/4)
  const depositos=crearDepositos(T,grupo), matBase=materialRegolito(T,bump,{color:0xb38160}), loader=new T.TextureLoader()
  const chunks=new Map(), mola=new Map(), pendientesMola=new Map(), esperas=[], cola=[]
  let manifiesto=null, lejano, previa, borde, col, fila, activo=0, listo=false, desechado=false, fallo=null, visorX=0, visorZ=0
  async function bin(ruta,Tipo,n) {
    const r=await fetch(new URL(ruta,import.meta.url)); if(!r.ok)throw Error(`${ruta}: HTTP ${r.status}`)
    const a=new Tipo(await r.arrayBuffer()); if(a.length!==n)throw Error(`${ruta}: tamaño incorrecto`); return a
  }
  function molaLocal(x,z) {
    const m=manifiesto.lejano, u=(x-m.x0)/m.paso, v=(z-m.z0)/m.paso
    const dentro=u>=0 && v>=0 && u<=m.lado-1 && v<=m.lado-1
    const [c,f,i,j]=geografia(x,z), a=mola.get(clave(c,f))
    const tesela=a ? muestra(a,33,i,j)-manifiesto.origen.altura : null
    if(!dentro)return tesela ?? 0
    const d=Math.min(u,v,m.lado-1-u,m.lado-1-v), local=muestra(lejano,m.lado,u,v)*.1
    if(d>=2)return local
    // Fundir con la tesela global sólo en el borde del recorte.
    return tesela===null ? local : mezcla(tesela,local,suave(d/2))
  }
  function referencia(x,z) {
    const d=Math.min(x-MUNDO.x0,MUNDO.x1-x,z-MUNDO.z0,MUNDO.z1-z)
    if(d<=0)return molaLocal(x,z)
    const h=muestra(previa,113,(x-MUNDO.x0)/PASO,(z-MUNDO.z0)/PASO)*.1
    return d>=PASO ? h : mezcla(molaLocal(x,z),h,suave(d/PASO))
  }
  function baseSector(c,f) {
    const n=L/PASO+1, a=new Float32Array(n*n), x=MUNDO.x0+c*L,z=MUNDO.z0+f*L
    for(let j=0;j<n;j++)for(let i=0;i<n;i++)a[j*n+i]=referencia(x+i*PASO,z+j*PASO)
    return a
  }
  function corregir(r,raw) {
    const n=257,a=new Float32Array(raw.length), x0=MUNDO.x0+r.c*L,z0=MUNDO.z0+r.f*L
    for(let j=0;j<n;j++)for(let i=0;i<n;i++) {
      const k=j*n+i,x=x0+i*4,z=z0+j*4
      const peso=muestra(borde,449,(x-MUNDO.x0)/16,(z-MUNDO.z0)/16)/255
      const h=peso>=1 ? raw[k]*.1 : mezcla(molaLocal(x,z),raw[k]*.1,peso)
      // Toda arista fina coincide con la polilínea del proxy, incluso si el
      // vecino no llegó o falló. Sólo se ajusta una banda de 16 m.
      const d=Math.min(i,j,256-i,256-j)
      a[k]=d>=4 ? h : mezcla(muestra(r.proxy,17,i/16,j/16,true),h,suave(d/4))
    }
    return a
  }
  function construir(r,a,n,material) {
    const geo=new T.PlaneGeometry(L,L,n-1,n-1); geo.rotateX(-Math.PI/2)
    const p=geo.attributes.position
    for(let k=0;k<a.length;k++)p.setY(k,a[k])
    geo.computeVertexNormals()
    // Normales del borde compartidas en espacio mundial. Interpolar los nodos
    // del proxy (igual en ambos LOD), no calcular una derivada unilateral.
    const x0=MUNDO.x0+r.c*L,z0=MUNDO.z0+r.f*L, normal=geo.attributes.normal
    const arista=(i,j,di,dj)=>{
      const pasos=(n-1)/16
      for(let t=0;t<=16;t++) {
        const x=x0+i*L/(n-1)+t*PASO*di,z=z0+j*L/(n-1)+t*PASO*dj
        const dx=referencia(x-16,z)-referencia(x+16,z), dz=referencia(x,z-16)-referencia(x,z+16), m=Math.hypot(dx,32,dz)
        const k=(j+t*pasos*dj)*n+i+t*pasos*di
        normal.setXYZ(k,dx/m,32/m,dz/m)
        if(t)for(let s=1;s<pasos;s++) {
          const delta=n*dj+di, k0=k-pasos*delta, q=k0+s*delta, u=s/pasos
          normal.setXYZ(q,mezcla(normal.getX(k0),dx/m,u),mezcla(normal.getY(k0),32/m,u),mezcla(normal.getZ(k0),dz/m,u))
        }
      }
    }
    arista(0,0,1,0);arista(0,n-1,1,0);arista(0,0,0,1);arista(n-1,0,0,1)
    geo.computeBoundingSphere()
    const m=new T.Mesh(geo,material);m.name=`${n===17?'base':'HiRISE'} ${r.c}_${r.f}`;m.position.set(x0+L/2,0,z0+L/2);grupo.add(m)
    return m
  }
  function libres(r) {
    if(r.piedras){depositos.liberarSector(r.m);r.piedras=false}
    grupo.remove(r.m);r.m.geometry.dispose()
    if(r.m.material!==matBase){r.m.material.map?.dispose();r.m.material.dispose()}
  }
  function rocas(r,poner) {
    if(r.piedras===poner)return
    if(poner)depositos.sector(r.m,r.c,r.f,L,(lx,lz)=>muestra(r.a,r.n,(lx/L+.5)*(r.n-1),(lz/L+.5)*(r.n-1),true),SAGAN)
    else depositos.liberarSector(r.m)
    r.piedras=poner
  }
  function proxy(r) {
    if(r.m)libres(r)
    r.proxy=baseSector(r.c,r.f);r.n=17;r.a=r.proxy;r.m=construir(r,r.a,r.n,matBase);r.piedras=false
  }
  function cerca(r){return Math.max(Math.abs(r.c-col),Math.abs(r.f-fila))<=DETALLE}
  function procesar() {
    while(!desechado && activo<3 && cola.length) {
      const r=cola.shift(), key=clave(r.c,r.f)
      if(r.cargando || r.n!==17 || !cerca(r) || chunks.get(key)!==r)continue
      activo++;r.cargando=true
      bin(`${base}terreno/${key}.bin`,Int16Array,257**2).then(raw=>{
        if(desechado || chunks.get(key)!==r || !cerca(r))return
        const a=corregir(r,raw),mat=materialRegolito(T,bump,{color:0xb38160})
        libres(r);r.a=a;r.n=257;r.m=construir(r,a,257,mat);rocas(r,true)
        if(typeof document!=='undefined')loader.load(new URL(`${base}textura/${key}.webp`,import.meta.url).href,tex=>{
          if(desechado || chunks.get(key)!==r || r.m.material!==mat){tex.dispose();return}
          tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=Math.min(4,opciones.anisotropia??4);mat.map=tex;mat.color.setHex(0xffffff);mat.needsUpdate=true
        },undefined,()=>{})
      }).catch(e=>console.warn('Sector HiRISE no disponible; permanece la vista previa.',key,e)).finally(()=>{activo--;r.cargando=false;procesar()})
    }
  }
  function actualizarMola(x,z) {
    // La vista mide 11 sectores. Anticipar otros 8 km para tener el siguiente
    // raster global antes de entrar; una marcha normal nunca toca el respaldo.
    const necesarios=new Set()
    for(const dx of [-14000,0,14000])for(const dz of [-14000,0,14000]){
      const [c,f]=geografia(x+dx,z+dz),id=clave(c,f);necesarios.add(id)
      if(mola.has(id)||pendientesMola.has(id))continue
      const p=bin(`${base}../bloques/relieve/5/${c}/${f}.bin`,Int16Array,33**2).then(a=>{
        if(desechado || pendientesMola.get(id)!==p)return
        mola.set(id,a)
        // El recorte lejano manda dentro de 23.5 km. Refrescar sólo los
        // exteriores que pudieron usar el respaldo mientras llegaba MOLA.
        for(const r of chunks.values()){
          if(esDTM(r.c,r.f))continue
          const {x,z}=r.m.position
          if(Math.max(Math.abs(x),Math.abs(z))<22000)continue
          if(![-L/2,0,L/2].some(dx=>[-L/2,0,L/2].some(dz=>{const [cc,ff]=geografia(x+dx,z+dz);return cc===c && ff===f})))continue
          proxy(r);rocas(r,cerca(r))
        }
      }).catch(e=>console.warn('Tesela MOLA no disponible',id,e)).finally(()=>{if(pendientesMola.get(id)===p)pendientesMola.delete(id)})
      pendientesMola.set(id,p)
    }
    for(const id of mola.keys())if(!necesarios.has(id))mola.delete(id)
    for(const id of pendientesMola.keys())if(!necesarios.has(id))pendientesMola.delete(id)
  }
  function actualizar(x,z) {
    visorX=x;visorZ=z;depositos.actualizar(x,z)
    if(!previa || desechado)return
    const c=Math.floor((x-MUNDO.x0)/L),f=Math.floor((z-MUNDO.z0)/L)
    if(c===col && f===fila)return
    col=c;fila=f;cola.length=0;actualizarMola(x,z)
    for(const [id,r] of chunks)if(Math.max(Math.abs(r.c-c),Math.abs(r.f-f))>RADIO){libres(r);chunks.delete(id)}
    for(let j=f-RADIO;j<=f+RADIO;j++)for(let i=c-RADIO;i<=c+RADIO;i++){
      const id=clave(i,j);let r=chunks.get(id)
      if(!r){r={c:i,f:j};chunks.set(id,r);proxy(r)}
      const proximo=cerca(r)
      if(!proximo && r.n!==17)proxy(r)
      rocas(r,proximo)
      if(proximo && esDTM(i,j) && r.n===17)cola.push(r)
    }
    const d=r=>(r.c-c)**2+(r.f-f)**2
    cola.sort((a,b)=>d(a)-d(b));procesar()
  }
  function altura(x,z) {
    if(!previa)return 0
    const u=(x-MUNDO.x0)/L,v=(z-MUNDO.z0)/L,c=Math.floor(u),f=Math.floor(v),r=chunks.get(clave(c,f))
    return r ? muestra(r.a,r.n,(u-c)*(r.n-1),(v-f)*(r.n-1),true) : referencia(x,z)
  }
  function normal(x,z,target){const dx=altura(x-2,z)-altura(x+2,z),dz=altura(x,z-2)-altura(x,z+2);return target.set(dx,4,dz).normalize()}
  async function iniciar() {
    try {
      if(typeof fetch==='function' && typeof globalThis.location!=='undefined'){
        const resp=await fetch(new URL(base+'manifiesto.json',import.meta.url));if(!resp.ok)throw Error(`HTTP ${resp.status}`)
        const m=await resp.json(); const [l,p,b]=await Promise.all([bin(base+'lejano.bin',Int16Array,m.lejano.lado**2),bin(base+'previa.bin',Int16Array,113*257),bin(base+'borde.bin',Uint8Array,449*1025)])
        if(desechado)return null
        manifiesto=m;lejano=l;previa=p;borde=b;actualizar(visorX,visorZ)
      }
    } catch(e){fallo=e;console.warn('Mundo real no disponible.',e)}
    listo=true;for(const cb of esperas.splice(0))cb(manifiesto);return manifiesto
  }
  function dispose(){
    desechado=true;cola.length=0;esperas.length=0;for(const r of chunks.values())libres(r);chunks.clear();mola.clear();pendientesMola.clear();matBase.dispose();bump.dispose();depositos.dispose();parent.remove(grupo)
  }
  return {iniciar,actualizar,altura,normal,dispose,cuandoListo(cb){if(listo)cb(manifiesto);else esperas.push(cb)},limitesRocas:depositos.limites,get manifiesto(){return manifiesto},get listo(){return listo},get fallo(){return fallo}}
}
