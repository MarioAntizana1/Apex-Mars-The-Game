import { crearNave } from './historia-nave.js'
import { crearPuenteJugable, transitablePuente, Z_INICIO_PUENTE, Z_FIN_CASCO } from './historia-puente.js'
import { crearEsclusa } from './historia-esclusa.js'
import { height, crearSuperficie, normal, SAGAN, LIMITE } from './historia-terreno.js'
import { crearEstacionSagan } from './historia-sagan.js'

// Everything is local to the wreck. No pointer lock, network requests or renderer ownership.
export function crearExploracion(T, scene, camera, renderer, ui={}) {
  const world=new T.Group(); world.name='Ares Vallis · punto de impacto'; scene.add(world)
  const old={bg:scene.background,fog:scene.fog,near:camera.near,far:camera.far,fov:camera.fov}
  scene.background=new T.Color(0xd9a17a);scene.fog=new T.FogExp2(0xca997c,.0048)
  camera.near=.035;camera.far=1200;camera.fov=71;camera.updateProjectionMatrix()
  let seed=19760720
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), TAU=Math.PI*2
  const material=(color,metalness=.25,roughness=.66)=>new T.MeshStandardMaterial({color,metalness,roughness})
  const luminous=color=>new T.MeshBasicMaterial({color})
  const shell=material(0xbdb8a5), frame=material(0x464f51), gasket=material(0x222c30), black=material(0x202122), metal=material(0x818888,.68), deck=material(0x686662), seat=material(0x575341,.05), rust=material(0xad492d), ochre=material(0xb58a48), chalk=material(0xd8d1b7), cyan=luminous(0x83eddf), amber=luminous(0xffa75e), light=luminous(0xffe5b6)
  const ship=crearNave(T);world.add(ship)
  const boxGeo=new T.BoxGeometry(),tubeGeo=new T.CylinderGeometry(1,1,1,12)
  function mesh(g,m,x,y,z,parent=world){const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o}
  function box(x,y,z,w,h,l,m,parent){const o=mesh(boxGeo,m,x,y,z,parent);o.scale.set(w,h,l);return o}
  function rod(a,b,r,m,parent){const v=new T.Vector3(...a),d=new T.Vector3(...b).sub(v),o=mesh(tubeGeo,m,0,0,0,parent);o.position.copy(v).addScaledVector(d,.5);o.scale.set(r,d.length(),r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o}
  function group(x,y,z,name){const o=new T.Group();world.add(o);o.position.set(x,y,z);o.name=name;return o}
  // High-contrast printed panels with fasteners, section code and ruled baseline. No DOM overlay.
  function placard(x,y,z,w,h,yaw,code,title,sub,mode='dark',parent=world){
    const c=globalThis.document?.createElement('canvas'),ctx=c?.getContext?.('2d');if(!ctx)return
    c.width=768;c.height=192
    const paper=mode==='paper', danger=mode==='orange';ctx.fillStyle=paper?'#c9c4ac':danger?'#a74728':'#17282c';ctx.fillRect(0,0,768,192)
    const ink=paper?'#293337':danger?'#ffebcd':'#adf2e3';ctx.fillStyle=ink;ctx.fillRect(25,16,95,5);ctx.font='bold 21px monospace';ctx.fillText(code,27,49);ctx.font='bold 57px sans-serif';ctx.fillText(title,24,114,715);ctx.fillRect(25,129,716,2);ctx.font='24px monospace';ctx.fillText(sub,25,166,714)
    for(const xx of [10,757])for(const yy of [10,181]){ctx.fillStyle='#525856';ctx.beginPath();ctx.arc(xx,yy,3,0,TAU);ctx.fill()}
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace
    const m=new T.MeshBasicMaterial({map:tex});const p=mesh(new T.PlaneGeometry(w,h),m,x,y,z,parent);p.rotation.y=yaw
  }
  const hemi=new T.HemisphereLight(0xffe1be,0x8c6d62,1.35);world.add(hemi)
  const sun=new T.DirectionalLight(0xffdcab,2.1);sun.position.set(-26,17,-35);world.add(sun)
  for(const [x,z,col] of [[-.85,.6,0xc9efff],[.55,-2.7,0xffa15e]]){const p=new T.PointLight(col,11,6,2);p.position.set(x,2.75,z);world.add(p)}
  // Cabin interior: independent deck plates, marked escape lane, frames and exposed lines.
  for(let j=0;j<10;j++){
    const z=-3.61+j*.63
    box(0,.525,z,3.78,.12,.614,deck)
    for(const x of [-.65,.65])box(x,.59,z,.036,.008,.56,ochre)
    for(const x of [-1.21,1.21])for(let i=0;i<3;i++)box(x,.59,z-.16+.15*i,.56,.009,.031,gasket)
  }
  for(const s of [-1,1]){
    const yaw=-s*Math.PI/2
    box(s*1.99,1.72,-.76,.12,2.3,6.18,frame);box(s*1.89,2.82,-.76,.24,.2,6.18,gasket)
    for(let j=0;j<4;j++){
      const z=-3.03+j*1.55;box(s*1.91,1.74,z,.105,1.81,1.44,shell);box(s*1.78,1.66,z-.74,.14,2.1,.09,metal)
      const rib=box(s*1.55,2.89,z-.74,.76,.14,.09,metal);rib.rotation.z=-s*.58
      box(0,3.11,z-.74,2.72,.14,.09,metal)
      box(s*1.745,.78,z,.055,.055,.96,j===0?amber:light)
      box(s*1.84,2.32,z,.08,.07,.62,gasket)
    }
    for(let k=0;k<3;k++)rod([s*(1.31+.13*k),2.98,-3.65],[s*(1.31+.13*k),2.98,2.24],.044,k===1?ochre:gasket)
    for(const z of [-2.91,-.38,1.28]){
      rod([s*1.74,2.33,z],[s*1.6,2.32,z],.028,ochre);rod([s*1.6,2.32,z],[s*1.6,1.97,z],.028,ochre);rod([s*1.6,1.97,z],[s*1.74,1.97,z],.028,ochre)
    }
    box(s*1.32,1.02,1.53,.61,.23,.73,seat);const back=box(s*1.32,1.4,1.82,.61,.82,.16,seat);back.rotation.x=.13
    box(s*1.32,1.85,1.87,.43,.23,.17,gasket);box(s*1.32,.77,1.53,.32,.31,.44,metal)
    for(const k of [-1,1])box(s*1.32+k*.16,1.43,1.71,.065,.69,.04,gasket)
    box(s*1.65,.99,-1.0,.54,.83,1.58,frame);box(s*1.61,1.43,-1,.65,.065,1.65,metal)
    for(let j=0;j<3;j++){box(s*1.344,1.18-j*.19,-1.02,.04,.14,1.36,deck);box(s*1.308,1.18-j*.19,-.8,.045,.03,.26,black)}
    // Center the plate in the clear bay between ribs (-2.22 and -.67), not across the rib.
    box(s*1.84,2.03,-1.447,.047,.34,1.06,gasket)
    placard(s*1.81,2.03,-1.447,1.02,.31,yaw,s<0?'MED / 02':'EVA / 03',s<0?'BIOMETRÍA':'TRANSMISIÓN',s<0?'DIAGNÓSTICO LOCAL':'KIT DE ANTENA',s<0?'dark':'paper')
  }
  box(0,3.19,-.72,3.28,.13,6.22,deck)
  for(const z of [-2.72,-.37,1.47]){box(0,3.09,z,.84,.081,.18,gasket);box(0,3.044,z,.69,.02,.105,light)}
  const puente=crearPuenteJugable(T);world.add(puente.root)
  // Rear hatch sign, diegetic emergency handle, running lights and ramp.
  const hatch=ship.getObjectByName('escotilla'),door=group(0,0,0,'señal de escotilla');
  box(0,1.59,-3.893,1.28,1.96,.035,deck,door);box(0,1.98,-3.863,.66,.29,.034,gasket,door)
  placard(0,1.98,-3.84,.59,.23,0,'AIRLOCK // 01','EXTERIOR','DESBLOQUEO MANUAL','orange',door)
  rod([-.36,1.43,-3.82],[.36,1.43,-3.82],.05,ochre,door)
  for(const s of [-1,1]){box(s*.83,1.56,-3.76,.12,2.07,.16,gasket);box(s*.83,1.56,-3.64,.045,1.84,.04,amber)}
  box(0,2.73,-3.77,1.67,.31,.13,gasket);placard(0,2.73,-3.691,1.54,.24,0,'EGRESS / 01','SALIDA ↓','ARES VALLIS')
  // Thermal streaks, stencilled service markings and rivets are painted in hull space.
  // Outboard rails carry the hatch over (not through) the pressure bulkhead.
  function skin(x,y,z,w,h,kind,parent=world){const c=globalThis.document?.createElement('canvas'),g=c?.getContext?.('2d');if(!g)return
    c.width=512;c.height=512;const orange=kind==='PUERTA',cross=kind==='APEX';g.fillStyle=orange?'#a85238':cross?'#c9c4aa':'#aaa997';g.fillRect(0,0,512,512)
    g.fillStyle='rgba(43,40,36,.35)';g.fillRect(14,14,484,5);g.fillRect(14,16,4,480);g.fillRect(495,15,4,480);g.fillRect(14,490,484,5)
    const ash=g.createLinearGradient(0,0,145,512);ash.addColorStop(0,'rgba(24,24,24,.78)');ash.addColorStop(.33,'rgba(45,39,34,.22)');ash.addColorStop(.65,'rgba(45,39,34,0)');ash.addColorStop(1,'rgba(83,52,35,.55)');g.fillStyle=ash;g.fillRect(0,0,512,512)
    for(let i=0;i<330;i++){let u=random()*512,v=random()*512;g.strokeStyle=i%4?'rgba(37,34,32,.20)':'rgba(228,216,187,.48)';g.lineWidth=.65+random()*2;g.beginPath();g.moveTo(u,v);g.lineTo(u+9+random()*42,v+random()*17-10);g.stroke()}
    for(let i=0;i<78;i++){let u=random()*512,v=random()*85;g.fillStyle='rgba(26,25,23,.09)';g.beginPath();g.moveTo(u,v);g.lineTo(u+5+random()*16,v);g.lineTo(u-8-random()*48,v+24+random()*148);g.fill()}
    for(let j=0;j<6;j++)for(const k of [19,491]){g.fillStyle='#45433b';g.beginPath();g.arc(k,20+j*94,4.5,0,TAU);g.fill();g.fillStyle='#aba58f';g.fillRect(k-2,18+j*94,3,2)}
    g.fillStyle=orange?'#e0c4a2':'#303638';g.font='bold '+(cross?233:77)+'px sans-serif';g.fillText(cross?'APEX  /  04':orange?'01':'RCS',44,cross?355:306,423);g.font='bold 26px monospace';g.fillText(cross?'TRANSPORT SYSTEMS':orange?'HATCH  //  EGRESS':kind,48,cross?410:350,418)
    if(!cross){g.fillRect(48,376,148,7);for(let i=0;i<22;i++)g.fillRect(48+i*7,396,2+random()*3,24)}
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;const p=mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,roughness:.87,metalness:.16}),x,y,z,parent);p.rotation.y=Math.PI
  }
  hatch.position.z=-4.13;skin(0,1.57,-4.203,1.39,2.08,'PUERTA',door)
  skin(0,2.94,-4.045,3.53,.61,'APEX');for(const s of [-1,1]){skin(s*1.42,1.69,-4.03,1.21,2.46,s<0?'SERVICE  //  4B':'VENT  //  6A');box(s*1.37,.68,-4.055,.59,.22,.09,gasket);for(let i=0;i<5;i++)box(s*1.37,.614+i*.032,-4.108,.46,.014,.037,metal)}
  for(const y of [.48,2.65])box(-.78,y,-4.13,3.18,.077,.09,gasket)
  for(let j=0;j<12;j++){const z=-3.96-j*.18,y=.57-j*.05;box(0,y-.052,z,1.46,.105,.21,deck);box(0,y+.006,z-.06,1.39,.012,.026,metal)}
  for(const s of [-1,1])rod([s*.78,.51,-3.99],[s*.78,-.03,-6.02],.046,ochre)
  // Equipment is carried in named scene groups: picking up removes the actual object.
  const scanner=group(-1.55,1.5,-.96,'escáner médico');box(0,.05,0,.27,.08,.43,gasket,scanner);box(.008,.097,0,.18,.018,.28,cyan,scanner)
  const kit=group(1.56,1.5,-.94,'kit de antena');box(0,.13,0,.38,.25,.58,ochre,kit)
  for(const z of [-.17,.17])box(0,.14,z,.39,.26,.044,gasket,kit)
  rod([-.09,.34,0],[.09,.34,0],.028,gasket,kit);for(const x of [-.09,.09])rod([x,.265,0],[x,.34,0],.024,gasket,kit)
  const tablet=group(-1.56,1.5,-1.54,'tablet de navegación');box(0,.015,0,.36,.046,.26,black,tablet);box(0,.044,0,.29,.012,.19,cyan,tablet)
  // Exterior topography: a flat crash site blending into eroded hummocks and a distant rim.
  function height(x,z){const r=Math.hypot(x,z),f=clamp((r-13)/35,0,1);return f*(1.06*Math.sin(x*.083+z*.027)+.72*Math.sin(z*.137-x*.031)+.32*Math.sin(x*.22+z*.11))}
  const ground=new T.PlaneGeometry(460,460,145,145);ground.rotateX(-Math.PI/2);const pos=ground.attributes.position,cols=[];const soil=new T.Color()
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const h=height(x,z);pos.setY(i,h-.035);soil.setHex(0xb47651).multiplyScalar(.87+.16*random()+.1*Math.sin(x*.071+z*.047));cols.push(soil.r,soil.g,soil.b)}
  ground.setAttribute('color',new T.Float32BufferAttribute(cols,3));ground.computeVertexNormals()
  const grit=new Uint8Array(128*128*4);for(let i=0;i<grit.length;i+=4){const v=198+Math.round(57*random());grit.set([v,v,v,255],i)}
  const dustMap=new T.DataTexture(grit,128,128,T.RGBAFormat);dustMap.wrapS=dustMap.wrapT=T.RepeatWrapping;dustMap.repeat.set(180,180);dustMap.generateMipmaps=true;dustMap.minFilter=T.LinearMipmapLinearFilter;dustMap.magFilter=T.LinearFilter;dustMap.needsUpdate=true
  mesh(ground,new T.MeshStandardMaterial({vertexColors:true,map:dustMap,roughness:1}),0,0,0)
  const ring=[],rimCol=[],idx=[];for(let i=0;i<=140;i++){const a=i/140*TAU, noise=Math.sin(a*9)+.5*Math.sin(a*18)+.33*Math.cos(a*29), ridge=4.2+9*Math.abs(Math.cos(a*2.4)) +4*noise;
    for(let j=0;j<3;j++){const r=[93,116,142][j]+4*noise;ring.push(Math.sin(a)*r,[-2,ridge*.47,ridge][j],Math.cos(a)*r);soil.setHex([0xc18c70,0xad816c,0x946c5b][j]).multiplyScalar(.91+.08*Math.cos(a*9));rimCol.push(soil.r,soil.g,soil.b)}
    if(i)for(let j=0;j<2;j++){let k=i*3+j;idx.push(k-3,k,k+1,k-3,k+1,k-2)}
  }
  const rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(ring,3));rg.setAttribute('color',new T.Float32BufferAttribute(rimCol,3));rg.setIndex(idx);rg.computeVertexNormals();mesh(rg,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide}),0,0,0)
  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),material(0xffffff,0,1),740),dummy=new T.Object3D();world.add(rocks)
  for(let i=0;i<rocks.count;i++){const a=random()*TAU,r=6+random()**1.4*79,x=r*Math.cos(a),z=r*Math.sin(a),size=.045+random()**4*(r>16?1.9:.44);dummy.position.set(x,height(x,z)+size*.10,z);dummy.rotation.set(random(),a,random());dummy.scale.set(size*(.86+random()),size*(.38+random()*.3),size);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);soil.setHex(random()>.42?0x785447:0x93664c).multiplyScalar(.8+.45*random());rocks.setColorAt(i,soil)}
  // Layered soft contact patches and a gouge running back along the landing track.
  const shadeData=new Uint8Array(64*64*4);for(let i=0;i<4096;i++){const r=Math.hypot((i%64-31.5)/31.5,(Math.floor(i/64)-31.5)/31.5);shadeData.set([65,39,32,Math.round(210*Math.max(0,1-r*r)**2)],i*4)}
  const stain=new T.DataTexture(shadeData,64,64);stain.magFilter=T.LinearFilter;stain.needsUpdate=true;const shade=new T.MeshBasicMaterial({map:stain,transparent:true,depthWrite:false});const patch=(x,z,w,l)=>{const o=mesh(new T.PlaneGeometry(w,l),shade,x,.003,z);o.rotation.x=-Math.PI/2;return o}
  patch(0,-.1,7.9,12);patch(0,9,5.5,24);for(const s of [-1,1]){patch(s*2.3,8,1.3,20);for(let j=0;j<10;j++)box(s*(2.4+.25*random()),.016,3+j*.85,.32+random()*.43,.07,.86,material(0x936449,0,1)).rotation.y=s*.22}
  // Broken rims of excavated soil flank a long scrape; keep the central ramp unobstructed.
  for(const s of [-1,1]){
    const p=[],rgb=[],ix=[],uv=[];for(let i=0;i<=49;i++){const z=4-i*.42,fade=Math.sin(i/49*Math.PI)**.55,w=(.42+random()*.21)*fade,spine=s*(2.29+.27*Math.cos(z*.27)+.025*Math.max(-z,0)**1.4)
      for(let j=0;j<5;j++){const lateral=[-.93,-.55,.04,.34,.86][j],xx=spine+s*lateral*w*2.6,h=[.013,.018,.046,.19+random()*.12,.012][j]*fade; p.push(xx,height(xx,z)+h,z);uv.push((xx+230)/460,(230-z)/460);soil.setHex([0xab7050,0x714b39,0x7a5039,0xae7350,0xbc7e58][j]).multiplyScalar(.92+random()*.10);rgb.push(soil.r,soil.g,soil.b)}
      if(i)for(let j=0;j<4;j++){const k=i*5+j;ix.push(k-5,k,k+1,k-5,k+1,k-4)}
    }const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();mesh(g,new T.MeshStandardMaterial({vertexColors:true,map:dustMap,roughness:1,side:T.DoubleSide}),0,0,0)
  }
  // No hardware outside at touchdown. A boot-sized projection previews the player's chosen site.
  const guide=mesh(new T.RingGeometry(.49,.53,40),new T.MeshBasicMaterial({color:0x95e4c3,side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false}),0,0,0);guide.rotation.x=-Math.PI/2;guide.visible=false
  const base=group(0,0,0,'baliza de campo'),baseShade=patch(0,0,2.25,1.85);base.visible=baseShade.visible=false
  box(0,.28,0,.78,.41,.72,gasket,base);box(0,.53,0,.82,.12,.75,ochre,base);box(0,.615,0,.33,.055,.28,metal,base)
  for(const s of [-1,1])for(const k of [-1,1])rod([s*.29,.25,k*.26],[s*.52,.04,k*.48],.052,metal,base)
  rod([-.47,.02,0],[-.47,1.47,0],.035,metal,base);box(-.47,1.42,0,.42,.21,.045,amber,base)
  placard(0,.32,.373,.64,.25,0,'EVA // RELAY','BALIZA','ACOPLAR ANTENA','paper',base)
  const mast=new T.Group();mast.name='antena ensamblada';mast.position.y=.63;base.add(mast);mast.visible=false
  rod([0,0,0],[0,1.67,0],.05,metal,mast);for(const s of [-1,1])rod([s*.31,0,0],[0,.72,0],.028,ochre,mast)
  const dish=mesh(new T.SphereGeometry(.65,24,10,0,TAU,0,.86),shell,0,1.22,0,mast);dish.material=shell.clone();dish.material.side=T.DoubleSide;dish.rotation.x=2.38
  rod([0,1.48,0],[0,1.86,.54],.021,metal,mast);box(0,1.86,.54,.12,.11,.14,ochre,mast)
  // The case and gloves travel with the astronaut until the base is anchored.
  const carried=group(0,0,0,'maletín en mano');carried.visible=false
  const packed=kit.clone();packed.position.set(.26,-.22,-.54);packed.scale.setScalar(.47);packed.rotation.y=-.38;carried.add(packed)
  const glove=new T.SphereGeometry(1,12,8);const hand=mesh(glove,gasket,.29,-.09,-.51,carried);hand.scale.set(.055,.044,.077)
  rod([.32,-.12,-.46],[.46,-.27,-.23],.055,shell,carried)
  // Dusty scattering gradient and compact pale sun, fixed to the scene horizon.
  const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,vertexShader:`varying vec3 ray; void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 ray;void main(){vec3 d=normalize(ray);float h=clamp(d.y,0.,1.);vec3 c=mix(vec3(.68,.40,.26),vec3(.28,.16,.12),pow(h,.52));float s=max(dot(d,normalize(vec3(-.46,.28,-.84))),0.);c+=vec3(.40,.35,.26)*pow(s,18.)+vec3(.9,.83,.62)*smoothstep(.99973,.99987,s);gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`});const sky=mesh(new T.SphereGeometry(230,40,16),skyMat,0,0,0)
  const motes=new Float32Array(90*3);for(let i=0;i<motes.length;i+=3){motes[i]=(random()-.5)*28;motes[i+1]=.1+random()**2*1.3;motes[i+2]=-6-random()*19}
  const motesG=new T.BufferGeometry();motesG.setAttribute('position',new T.BufferAttribute(motes,3));const grains=new T.Points(motesG,new T.PointsMaterial({color:0xf3cba0,size:.024,transparent:true,opacity:.56,depthWrite:false}));world.add(grains)
  const airMat=new T.SpriteMaterial({map:stain,color:0xecc5a3,transparent:true,opacity:0,depthWrite:false});const vent=Array.from({length:8},()=>{const puff=new T.Sprite(airMat);world.add(puff);return {puff,x:random()-.5,y:.35+random(),z:random(),spin:random()}})
  let windTime=0,exteriorZone=false,ventTime=0
  // Static repetition costs one draw per material rather than per rib, bolt or tread.
  function batch(parent){const batches=new Map();for(const o of [...parent.children]){if(!o.isMesh||o.isInstancedMesh||o===hatch||![boxGeo,tubeGeo].includes(o.geometry))continue;const k=o.geometry.uuid+o.material.uuid;if(!batches.has(k))batches.set(k,[]);batches.get(k).push(o)}
    for(const arr of batches.values()){if(arr.length<3)continue;const inst=new T.InstancedMesh(arr[0].geometry,arr[0].material,arr.length);arr.forEach((o,i)=>{o.updateMatrix();inst.setMatrixAt(i,o.matrix);parent.remove(o)});parent.add(inst)} }
  batch(world);batch(base);batch(door);batch(mast)

  const canvas=renderer.domElement,oldTouch=canvas.style?.touchAction
  if(canvas.style)canvas.style.touchAction='none'
  let x=0,z=1.34,yaw=0,pitch=-.045,mx=0,mz=0,outside=false,hasKit=false,hasTablet=false,scanned=false,anchored=false,assembled=false,disposed=false,bob=0,walking=false,drag=null,target=null
  let placing=0,unfolding=0,lastCycle=''
  const esclusa=crearEsclusa(T,world,{hatch,door,placard,position:()=>({x,z}),notify:msg=>say('status',msg)})
  const lookDir=new T.Vector3(),candidate=new T.Vector3(),dropPoint=new T.Vector3(),handPoint=new T.Vector3()
  const rockBounds=[];for(let i=0;i<rocks.count;i++){rocks.getMatrixAt(i,dummy.matrix);const m=dummy.matrix.elements;rockBounds.push([m[12],m[14],Math.max(Math.hypot(m[0],m[1],m[2]),Math.hypot(m[8],m[9],m[10]))])}
  function placement(){
    if(!exteriorZone||!hasKit||anchored||z> -6.5&&Math.abs(x)<4.5)return false
    camera.getWorldDirection(lookDir);if(lookDir.y>-.3)return false
    let d=(height(x,z)-camera.position.y)/lookDir.y
    for(let i=0;i<2;i++){candidate.copy(camera.position).addScaledVector(lookDir,d);d=(height(candidate.x,candidate.z)-camera.position.y)/lookDir.y}
    if(d<.5||d>3.4||Math.abs(candidate.x)<3.9&&candidate.z> -6.75&&candidate.z<Z_FIN_CASCO+1||Math.hypot(candidate.x-x,candidate.z-z)<.8)return false
    const {x:px,z:pz}=candidate
    if(rockBounds.some(([rx,rz,r])=>r>.18&&Math.hypot(rx-px,rz-pz)<r+.54))return false
    candidate.y=height(px,pz);return Math.abs(height(px+.6,pz)-candidate.y)<.18&&Math.abs(height(px,pz+.6)-candidate.y)<.18
  }
  const keys=new Set(), texts=new Map(),listeners=[]
  function say(type,msg){if(texts.get(type)!==msg){texts.set(type,msg);ui[type]?.(msg)}}
  function goals(){
    const chamber=Math.abs(x)<1.8&&z< -2.12&&z> -4.03
    say('objective',chamber?esclusa.resumen():!exteriorZone?'Puente de mando a proa · equipo en los bancos · esclusa a popa.':assembled?'Baliza local activa, sin enlace orbital. Puedes volver por la esclusa.':anchored?'Mira la base que anclaste y acopla el mástil.':hasKit?'Elige suelo despejado y mira abajo para anclar el trípode.':'El kit de baliza sigue a bordo, en el banco EVA.')
    say('inventory',[hasTablet?'Tablet · mapa local':'',hasKit?(assembled?'Baliza desplegada':anchored?'Mástil plegado':'Kit de baliza en mano'):'',scanned?'Traje verificado':''].filter(Boolean).join('  /  ')||'Sin equipo recogido')}
  const actions=[...esclusa.actions,{...puente.accion,run(){say('status',puente.diagnosticar())}},
    {id:'kit',pt:[1.53,1.66,-.94],range:1.67,text:'Recoger kit de baliza',active:()=>!hasKit,run(){hasKit=true;kit.visible=false;carried.visible=true;say('status','Llevas el trípode, el mástil y la batería. Busca suelo despejado fuera de la nave.')}},
    {id:'tablet',pt:[-1.53,1.54,-1.54],range:1.65,text:'Recoger tablet',active:()=>!hasTablet,run(){hasTablet=true;tablet.visible=false;say('status','Mapa almacenado: Ares Vallis. GPS sin conexión.')}},
    {id:'scan',pt:[-1.53,1.6,-.96],range:1.65,text:'Usar escáner médico',active:()=>!scanned,run(){scanned=true;say('status','Presión del traje estable. Contusión leve en el hombro.')}},
    {id:'relay',get pt(){return [base.position.x,base.position.y+.55,base.position.z]},range:2.2,text:'Acoplar mástil y conectar batería',active:()=>anchored&&placing===0&&!assembled,run(){assembled=true;unfolding=.001;mast.visible=true;say('status','Mástil conectado. Baliza local activa, sin enlace orbital.')}}
  ]
  const plant={text:'Anclar trípode aquí',run(){if(!placement())return;anchored=true;placing=.001;carried.visible=false;base.visible=baseShade.visible=true;guide.visible=false;dropPoint.copy(candidate);base.position.copy(candidate);baseShade.position.set(candidate.x,candidate.y+.029,candidate.z);base.rotation.y=yaw;packed.getWorldPosition(handPoint);base.scale.setScalar(.44);say('status','Base anclada. Falta acoplar el mástil y conectar la batería.')}}
  const dir=new T.Vector3(),way=new T.Vector3()
  function targets(){camera.getWorldDirection(dir);let best=-1;target=null;for(const a of actions){if(!a.active())continue;way.set(...a.pt).sub(camera.position);const d=way.length(),dot=dir.dot(way.normalize());if(d>a.range||dot<.77)continue;const score=dot-.085*d;if(score>best){best=score;target=a}}
    guide.visible=!target&&placement();if(guide.visible){guide.position.copy(candidate);guide.position.y+=.026;target=plant}
    say('prompt',target?target.text:'')}
  function interact(){if(disposed)return;targets();if(target){target.run();goals();targets()}}
  function move(a,b){mx=Number.isFinite(a)?clamp(a,-1,1):0;mz=Number.isFinite(b)?clamp(b,-1,1):0}
  function look(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy)||disposed)return;yaw-=dx*.0042;pitch=clamp(pitch-dy*.0038,-1.16,1.16);pose();targets()}
  function floorY(x,z){return Math.abs(x)<.84&&z< -3.9&&z> -6.08 ?clamp((z+6.05)/2.1,0,1)*.59:z>=-3.9&&z<Z_FIN_CASCO&&Math.abs(x)<1.96?.59:height(x,z)}
  function allowed(x,z){if(!esclusa.permite(x,z)||Math.hypot(x,z)>74)return false
    // Being inside the hull is only possible on the cabin deck or inside the door/ramp throat.
    if(x>-3.02 && x<3.02 && z>-4.23 && z<Z_FIN_CASCO){
      if(z< -3.48)return Math.abs(x)<.53
      if(z>=Z_INICIO_PUENTE)return transitablePuente(x,z)
       if(Math.abs(x)>1.55)return false
      if(Math.abs(x)>1.09 && ((z>-1.99&&z<.03)||(z>.95&&z<1.98)))return false
    }
    if(anchored&&Math.abs(x-base.position.x)<.49&&Math.abs(z-base.position.z)<.49)return false
    return true}
  function pose(){camera.position.set(x,floorY(x,z)+1.51+(walking?Math.sin(bob)*.018:0),z);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld(true)}
  function update(dt){if(disposed)return;dt=clamp(Number(dt)||0,0,.08);esclusa.update(dt);const cycle=esclusa.estado().ciclo
     if(cycle!==lastCycle&&cycle==='despresurizando')ventTime=0;lastCycle=cycle
     if(ventTime<2.5){ventTime=Math.min(2.5,ventTime+dt);const t=ventTime/2.5;airMat.opacity=.21*Math.sin(t*Math.PI);for(const {puff,x:offset,y,z:spread,spin} of vent){puff.visible=t<1;puff.position.set(offset*(.8+2*t)+.48*t,y+.4*t,-3.98-spread*.26-t*(.6+spread*1.3));puff.scale.setScalar(.42+t*(1.15+spin))}}
    if(keys.has('ArrowLeft'))yaw+=dt*1.65;if(keys.has('ArrowRight'))yaw-=dt*1.65
    const r=mx+Number(keys.has('KeyD'))-Number(keys.has('KeyA')),f=mz+Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),mag=Math.max(1,Math.hypot(r,f)),speed=(outside?2.85:2.02)*dt/mag
    const nx=x+(r*Math.cos(yaw)-f*Math.sin(yaw))*speed,nz=z+(-r*Math.sin(yaw)-f*Math.cos(yaw))*speed
    walking=Math.abs(r)+Math.abs(f)>.02;if(walking)bob+=dt*8
    if(allowed(nx,z))x=nx;if(allowed(x,nz))z=nz
    const inHull=z>=-3.98&&z<Z_FIN_CASCO&&Math.abs(x)<1.97;if(exteriorZone===inHull){exteriorZone=!inHull;ui.exterior?.(exteriorZone)}
    sky.position.set(x,0,z);windTime+=dt;grains.position.x=Math.sin(windTime*.47)*1.57;grains.position.y=Math.sin(windTime*1.63)*.048
    if(!outside && z< -6.08){outside=true;say('status','Ares Vallis. Tus botas tocan Marte. La nave ha quedado a tu espalda.');goals()}
    pose();carried.position.copy(camera.position);carried.quaternion.copy(camera.quaternion);carried.updateMatrixWorld(true)
    if(placing){placing=Math.min(1,placing+dt*1.7);base.position.lerpVectors(handPoint,dropPoint,placing);base.scale.setScalar(.44+.56*placing);if(placing===1)placing=0}
    if(unfolding){unfolding=Math.min(1,unfolding+dt*1.3);mast.scale.y=.15+.85*unfolding;if(unfolding===1)unfolding=0}
    goals();targets()
  }
  function on(el,type,fn,opts){if(!el?.addEventListener)return;el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts))}
  const keyset=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyE'])
  on(globalThis.window,'keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||!keyset.has(e.code)||e.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;e.preventDefault();if(e.code==='KeyE'){if(!e.repeat)interact()}else keys.add(e.code)})
  on(globalThis.window,'keyup',e=>keys.delete(e.code));on(globalThis.window,'blur',()=>{keys.clear();move(0,0);drag=null})
  on(canvas,'pointerdown',e=>{if(drag||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId)})
  on(canvas,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY})
  const end=e=>{if(drag?.id===e.pointerId)drag=null};on(canvas,'pointerup',end);on(canvas,'pointercancel',end);on(canvas,'lostpointercapture',end)
  ui.exterior?.(false);say('status','Despiertas bajo las luces de emergencia. El pasillo ámbar conduce a la escotilla.');goals();pose();targets()
  function dispose(){if(disposed)return;disposed=true;listeners.forEach(f=>f());keys.clear();if(drag&&canvas.hasPointerCapture?.(drag.id))canvas.releasePointerCapture(drag.id);if(canvas.style)canvas.style.touchAction=oldTouch
    scene.remove(world);scene.background=old.bg;scene.fog=old.fog;camera.near=old.near;camera.far=old.far;camera.fov=old.fov;camera.updateProjectionMatrix()
    const gs=new Set(),ms=new Set(),ts=new Set();world.traverse(o=>{if(o.geometry&&!o.isSprite)gs.add(o.geometry);if(o.material)for(const m of [].concat(o.material)){ms.add(m);if(m.map)ts.add(m.map)}if(o.isInstancedMesh)o.dispose()});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose())}
  return {update,dispose,interact,move,look}
}
