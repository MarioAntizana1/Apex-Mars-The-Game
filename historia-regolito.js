// Una muestra continua de suelo en metros; la foto orbital sólo aporta el albedo
// a gran escala. Ninguna de estas pequeñas ondulaciones modifica la cota del DTM.
const LADO = 256, METROS = 4
function hash(x, y) {
  let h = Math.imul(x + 37, 0x85ebca6b) ^ Math.imul(y + 97, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 16), 0x27d4eb2d)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}
function ruido(u, v, f) {
  const x=u*f,y=v*f,i=Math.floor(x),j=Math.floor(y)
  let s=x-i,t=y-j; s*=s*(3-2*s); t*=t*(3-2*t)
  const n=(a,b)=>hash(a%f,b%f), a=n(i,j),b=n(i+1,j),c=n(i,j+1),d=n(i+1,j+1)
  return (a+(b-a)*s)*(1-t)+(c+(d-c)*s)*t
}
export function crearRegolito(T, anisotropia=4, cobertura={x0:-4096,z0:-2048,x1:3072,z1:14336}) {
  const h=new Float32Array(LADO**2), datos=new Uint8Array(h.length*4)
  for(let y=0;y<LADO;y++) for(let x=0;x<LADO;x++) {
    const i=y*LADO+x,u=x/LADO,v=y/LADO, campo=ruido(u,v,3), terron=ruido(u,v,19), arena=ruido(u,v,49), grano=hash(x,y)
    const fase=u*7+v*12+campo*1.9+.18*ruido(u,v,7)
    const cresta=(.5+.5*Math.cos(2*Math.PI*fase))**2.8
    const grava=Math.max(0, (arena-.51)*2.8)**1.6
    h[i]=.033*cresta*(.27+.9*campo)+.033*terron+.046*grava+.009*grano
    datos[i*4+3]=Math.round(255*Math.max(0,Math.min(1,.12+.33*terron+.16*cresta+.31*grano+.19*arena-.18*grava)))
  }
  const mask=LADO-1, muestra=(x,y)=>h[(y&mask)*LADO+(x&mask)]
  for(let y=0;y<LADO;y++) for(let x=0;x<LADO;x++) {
    const nx=(muestra(x-1,y)-muestra(x+1,y))*LADO/(2*METROS), ny=(muestra(x,y-1)-muestra(x,y+1))*LADO/(2*METROS)
    const k=1/Math.hypot(nx,ny,1), i=(y*LADO+x)*4
    datos[i]=Math.round(127.5*(1+nx*k));datos[i+1]=Math.round(127.5*(1+ny*k));datos[i+2]=Math.round(127.5*(1+k))
  }
  const textura=new T.DataTexture(datos,LADO,LADO)
  textura.wrapS=textura.wrapT=T.RepeatWrapping; textura.generateMipmaps=true
  textura.magFilter=T.LinearFilter; textura.minFilter=T.LinearMipmapLinearFilter
  textura.anisotropy=anisotropia; textura.needsUpdate=true
  const atlas={value:null}, listo={value:0}
  textura.userData.suelo={atlas,listo,marco:{value:new T.Vector4(cobertura.x0,cobertura.z0,cobertura.x1,cobertura.z1)}}
  if(globalThis.document?.createElementNS) {
    let vivo=true
    const mapa=new T.TextureLoader().load(new URL('./datos/ares/albedo-comun.webp',import.meta.url).href,()=>{if(vivo)listo.value=1},undefined,()=>{})
    mapa.colorSpace=T.SRGBColorSpace; atlas.value=mapa
    textura.addEventListener('dispose',()=>{vivo=false;mapa.dispose()})
  }
  return textura
}
export function materialRegolito(T,textura,propiedades) {
  const mat=new T.MeshStandardMaterial({...propiedades,roughness:1,metalness:0,normalMap:textura})
  mat.onBeforeCompile=shader=>{
    const {atlas,listo,marco}=textura.userData.suelo
    Object.assign(shader.uniforms,{atlasSuelo:atlas,atlasListo:listo,limitesFoto:marco})
    shader.vertexShader='varying vec2 terrenoXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      terrenoXZ=(modelMatrix*vec4(position,1.)).xz;`)
    shader.fragmentShader=`varying vec2 terrenoXZ;
      uniform sampler2D atlasSuelo;
      uniform float atlasListo;
      uniform vec4 limitesFoto;
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=terrenoXZ;
      vec2 lado=min(p-limitesFoto.xy,limitesFoto.zw-p);
      float cobertura=smoothstep(0.,96.,min(lado.x,lado.y));
      vec2 uvFoto=(p-limitesFoto.xy)/(limitesFoto.zw-limitesFoto.xy);
      vec3 basePolvo=vec3(.451,.220,.117); // 0xb38160 sRGB en luz lineal
      vec3 comun=mix(basePolvo,texture2D(atlasSuelo,vec2(uvFoto.x,1.-uvFoto.y)).rgb,atlasListo*cobertura);
      vec3 foto=comun;
      #ifdef USE_MAP
        // Corregir sólo la media de cada fotografía junto a la junta: el grano
        // y las sombras de las rocas llegan hasta el borde sin desaparecer.
        vec3 grueso=texture2D(map,vMapUv,6.).rgb;
        float junta=min(min(vMapUv.x,1.-vMapUv.x),min(vMapUv.y,1.-vMapUv.y))*1024.;
        foto=(diffuseColor.rgb-grueso)+mix(comun,grueso,smoothstep(0.,96.,junta));
      #endif
      // No confundir las sombras grabadas en las ortofotos con tierra negra.
      diffuseColor.rgb=mix(basePolvo,foto,.82);
      float arena=texture2D(normalMap,vNormalMapUv).a;
      float costra=texture2D(normalMap,mat2(.375,.125,-.125,.375)*vNormalMapUv).a;
      diffuseColor.rgb*=.44+.84*arena+.29*costra;
      // Huella de patinaje en el propio material: los bordes se desvanecen
      // en el albedo original, sin cintas, cajas ni polígonos superpuestos.
      float rodadura=0., lomo=0., pendiente=0.;
      if(abs(p.x)<6. && p.y> -17. && p.y<20.) {
        float fin=smoothstep(-17.,-9.,p.y)*(1.-smoothstep(6.,20.,p.y));
        float eje=2.35+.25*cos(p.y*.31)+.022*pow(max(-p.y,0.),1.4);
        float d=abs(p.x)-eje+(costra-.5)*.22;
        rodadura=fin*exp(-5.*d*d); float q=(d-.61)/.34;
        lomo=fin*exp(-q*q); pendiente=-.49*q*lomo*sign(p.x);
      }
      diffuseColor.rgb*=1.-.20*rodadura+.07*lomo;`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        normal=normalize(normal+mat3(viewMatrix)*vec3(-pendiente,0.,0.));`)
  }
  return mat
}
