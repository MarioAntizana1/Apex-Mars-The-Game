// Ares Vallis · 35-second local-Y-up descent. No external textures or video.
import { crearNave } from './historia-nave.js'
import { crearPuenteCine } from './historia-puente.js'
import { cuadro } from './historia-guion.js'

const TAU = Math.PI * 2
const clamp = x => Math.max(0, Math.min(1, x))
const mix = (a,b,k) => a+(b-a)*k
const smooth = (a,b,t) => {const k=clamp((t-a)/(b-a)); return k*k*(3-2*k)}
const noiseGL = `float hash(vec2 p){return fract(sin(mod(dot(p, vec2(127.1,311.7)),6.28318))*43758.54);}
float noise(vec2 p){vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}`
const outputGL = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n'
const localVert = `varying vec2 vUv; varying vec3 vP; void main(){vP=position; vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
function rng(seed){return ()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296)}
function pathHeight(x,z){
  const rr=Math.hypot(x*.85,z*.7), rim=smooth(22,100,rr)
  const ridge=Math.pow(Math.abs(Math.sin(x*.009+Math.cos(z*.011)*2.8)),3)
  return rim*(3*Math.sin(x*.027+.9*Math.cos(z*.03))+4*Math.sin(z*.014+x*.015)+ridge*(3+smooth(80,300,rr)*26))+ .45*rim*Math.sin(x*.21+z*.13)
}

function martianWorld(T,scene,rand){
  const sky=new T.Mesh(new T.SphereGeometry(2100,40,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{entry:{value:0}},vertexShader:localVert,fragmentShader:`varying vec3 vP; uniform float entry; ${noiseGL}
  void main(){vec3 d=normalize(vP);vec3 sun=normalize(vec3(-.73,.22,.86));float h=max(d.y,0.);float a=length(sun-d);float bands=noise(d.xz*7.+d.y*17.)*.6+noise(d.xz*27.)*.4;
  vec3 haze=mix(vec3(.76,.38,.21),vec3(.82,.31,.15),entry);vec3 zen=mix(vec3(.19,.13,.13),vec3(.016,.025,.043),entry);
  vec3 col=mix(haze,zen,pow(smoothstep(-.08,.82,d.y),.56));col+=vec3(.22,.14,.075)*exp(-a*5.5)+vec3(.13,.095,.065)*exp(-a*17.);col+=vec3(1.,.79,.56)*(1.-smoothstep(.020,.024,a));col+=(bands-.5)*.045*(1.-h);
  gl_FragColor=vec4(col,1.);${outputGL}}`}))
  sky.renderOrder=-100;scene.add(sky)
  const g=new T.PlaneGeometry(2500,2500,150,150);g.rotateX(-Math.PI/2)
  const p=g.attributes.position
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i)-240;p.setXYZ(i,x,pathHeight(x,z),z)}
  g.computeVertexNormals()
  const terra=new T.Mesh(g,new T.ShaderMaterial({vertexShader:`varying vec3 vP,vN;void main(){vP=position;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vP,vN;${noiseGL}void main(){vec2 p=vP.xz;float dist=distance(cameraPosition,vP);float grain=noise(p*.95)*.38+noise(p*.13)*.34+noise(p*.024)*.28;
    float dunes=sin(p.x*.41+1.6*sin(p.y*.085)+grain*2.4);float slope=dot(normalize(vN),normalize(vec3(-.75,.55,.65)));
    vec3 col=mix(vec3(.165,.079,.048),vec3(.62,.294,.145),grain);col*=.59+.73*max(0.,slope);col+=vec3(.025,.012,.006)*dunes*exp(-dist*.008);
    // Skid scars cut through the sand on final approach.
    float track=(1.-smoothstep(.15,.9,abs(abs(p.x)-1.82)))*smoothstep(-25.,-12.,p.y)*(1.-smoothstep(0.,3.,p.y));col*=1.-.34*track;
    col=mix(col,vec3(.67,.355,.213),1.-exp(-dist*.0033));gl_FragColor=vec4(col,1.);${outputGL}}`}))
  scene.add(terra)
  // Isolated, eroded tablelands form a layered skyline below the cabin glass.
  const cliffs=[],rockColors=[],cc=new T.Color();for(let i=0;i<22;i++){
    const side=i%2?1:-1,x=side*(69+rand()*188),z=115-(i>>1)*60+rand()*41,sz=9+rand()*23,szZ=sz*(.62+rand()*.91),height=10+rand()*19,floor=pathHeight(x,z)-5,facets=12,profile=Array.from({length:facets},()=>[.75+rand()*.35,.78+rand()*.24]);
    const levels=[[-.5,1.44],[.27,1.04],[.34,1.02],[.75,.72],[.82,.73],[.97,.57],[1.04,.16],[1.04,.001]],palette=[0x81503d,0x9a644c,0x885845,0xa7775c,0x9b6950,0xb38264,0xaa795d];
    const vertex=(j,l)=>{const a=j*TAU/facets,[r,y]=profile[j%facets],[h,k]=levels[l];return [x+Math.cos(a)*sz*k*r,floor+height*h*y,z+Math.sin(a)*szZ*k*r]};
    for(let j=0;j<facets;j++)for(let l=0;l<levels.length-1;l++){cc.setHex(palette[l]);const shade=.88+.12*Math.sin(j*TAU/facets+2.3);for(const [dj,dl] of [[0,0],[0,1],[1,1],[0,0],[1,1],[1,0]]){cliffs.push(...vertex(j+dj,l+dl));rockColors.push(cc.r*shade,cc.g*shade,cc.b*shade)}}
  }const mesas=new T.BufferGeometry();mesas.setAttribute('position',new T.Float32BufferAttribute(cliffs,3));mesas.setAttribute('color',new T.Float32BufferAttribute(rockColors,3));const buttes=new T.Mesh(mesas,new T.ShaderMaterial({side:T.DoubleSide,vertexColors:true,vertexShader:`varying vec3 vC,vP;void main(){vC=color;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vC,vP;void main(){float haze=1.-exp(-distance(cameraPosition,vP)*.0042);gl_FragColor=vec4(mix(vC,vec3(.67,.355,.213),haze),1.);${outputGL}}`}));scene.add(buttes)
  // Basalt strewn field, kept to one draw call.
  const stones=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({roughness:.99,flatShading:true}),700)
  const dummy=new T.Object3D(), color=new T.Color()
  for(let i=0;i<stones.count;i++){
    const a=rand()*TAU,d=4+180*rand()**1.6,x=Math.cos(a)*d,z=Math.sin(a)*d,k=(.085+rand()**4*1.32)*(d<12?.55:1)
    dummy.position.set(x,pathHeight(x,z)+k*.08,z);dummy.rotation.set(rand(),rand()*4,rand());dummy.scale.set(k*(1+rand()),k*.55,k);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);stones.setColorAt(i,color.setHSL(.036+rand()*.025,.19+rand()*.12,.15+rand()*.135))
  }scene.add(stones);return sky
}

// Web Audio is optional. No oscillator, context, listener or timer survives dispose().
function soundRack(){
  let ctx,gate,wind,rumble,motor,filter,bass,ping,pingGain,muted=false,dead=false
  function beginAudio(){
    if(dead)return
    try{
      const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return
      if(!ctx){ctx=new AC();gate=ctx.createGain();gate.gain.value=muted?0:.7;gate.connect(ctx.destination)
        const buf=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),d=buf.getChannelData(0),r=rng(1976);let prev=0
        for(let i=0;i<d.length;i++){const n=r()*2-1;prev=.955*prev+.045*n;d[i]=prev*3+n*.21}
        wind=ctx.createBufferSource();wind.buffer=buf;wind.loop=true;filter=ctx.createBiquadFilter();filter.type='lowpass';rumble=ctx.createGain();rumble.gain.value=0;wind.connect(filter).connect(rumble).connect(gate);wind.start()
        motor=ctx.createOscillator();motor.type='triangle';bass=ctx.createGain();bass.gain.value=0;motor.connect(bass).connect(gate);motor.start();ping=ctx.createOscillator();ping.type='sine';pingGain=ctx.createGain();pingGain.gain.value=0;ping.connect(pingGain).connect(gate);ping.start()
      }return ctx.resume().catch(()=>{})
    }catch{close()}
  }
  function update(t){if(!ctx||ctx.state!=='running')return;const now=ctx.currentTime,at=(p,v,k=.055)=>p.setTargetAtTime(v,now,k)
    const hot=1-smooth(11,16,t),fire=smooth(20.7,21.5,t)*(1-smooth(28.05,28.5,t)),hit=t>=28.5?Math.exp(-(t-28.5)*4):0,air=t<28.5?.18:.028
    at(rumble.gain,air+.4*hot+.52*fire+hit,.04);at(filter.frequency,330+hot*1740+fire*960+hit*2000);at(motor.frequency,31+hot*23+fire*30+hit*21);at(bass.gain,.012+.07*hot+.16*fire+.34*hit,.035)
    at(ping.frequency,t<16?720:490);at(pingGain.gain,t>8&&t<27&&(t%1.42)<.13?.025:0,.015)
  }
  function audioEnabled(v){muted=!v;if(ctx)gate.gain.setTargetAtTime(v?.7:0,ctx.currentTime,.025)}
  function close(){dead=true;if(ctx){[wind,motor,ping].forEach(n=>{try{n?.stop()}catch{}});ctx.close().catch(()=>{});ctx=null}}
  return {beginAudio,update,audioEnabled,close}
}

function flightEffects(T,rand){
  const flight=new T.Group(),plasma=new T.Group(),canopies=new T.Group(),engines=new T.Group();flight.add(plasma,canopies,engines)
  // Bow shock wrapping around the blunt nose, then streaming aft. A transparent
  // shell is open at the back and never replaces the ship silhouette.
  const pg=new T.PlaneGeometry(1,1,64,30),pos=pg.attributes.position,uv=pg.attributes.uv
  for(let i=0;i<pos.count;i++){
    const a=uv.getX(i)*TAU,s=uv.getY(i),r=Math.sqrt(Math.max(.002,1-(Math.max(0,1-s/.29))**2)),flare=1+Math.max(0,s-.46)*.92
    pos.setXYZ(i,Math.cos(a)*r*3.05*flare,1.88+Math.sin(a)*r*2.23*flare,7.68-s*19.3)
  }pg.computeBoundingSphere()
  const shell=new T.Mesh(pg,new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time:{value:0}},vertexShader:localVert,fragmentShader:`varying vec2 vUv;uniform float time;${noiseGL}void main(){float a=vUv.x*6.28318,s=vUv.y;vec2 cir=vec2(sin(a),cos(a));float n=noise(cir*8.+vec2(-s*6.+time*5.,s*1.5));float ribbon=pow(noise(cir*22.+vec2(s*1.6-time*.7,s*4.-time*2.)),2.7);float bow=exp(-pow((s-.17)*8.,2.))* (.35+n*.65); float tail=(1.-smoothstep(.28,1.,s))*ribbon*(.4+n);float v=bow+tail;vec3 c=mix(vec3(1.,.083,.006),vec3(1.,.69,.18),clamp(v*.92,0.,1.));gl_FragColor=vec4(c,v*.96);${outputGL}}`}))
  plasma.add(shell)
  const trails=new T.BufferGeometry(),vtx=new Float32Array(100*6),seeds=Array.from({length:100},()=>[rand()*TAU,rand(),rand(),rand()]);trails.setAttribute('position',new T.BufferAttribute(vtx,3).setUsage(T.DynamicDrawUsage));const sparks=new T.LineSegments(trails,new T.LineBasicMaterial({color:0xffa761,transparent:true,opacity:.72,depthWrite:false,blending:T.AdditiveBlending}));sparks.frustumCulled=false;plasma.add(sparks)
  const cordMat=new T.LineBasicMaterial({color:0xc8bca7}),fabric=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1,flatShading:false}),chutes=[]
  for(let chute=0;chute<2;chute++){
    const unit=new T.Group(),s=chute?1:-1;canopies.add(unit);const vertices=[],colors=[],cords=[],R=4.45,panels=24
    const pt=(a,u,bulge)=>{const rad=R*(.075+.925*Math.sin(u*1.49))*(1+bulge*.043);return [Math.cos(a)*rad,2.62*Math.cos(u*1.47)+bulge*.13,Math.sin(a)*rad]}
    for(let p=0;p<panels;p++){
      const paint=new T.Color(p%8===0?0x34434c:(p%8<4?0xe37635:0xe3d7b9));for(let sub=0;sub<3;sub++)for(let row=0;row<7;row++){
        for(const [dx,dy] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){const u=(row+dy)/7,b=Math.sin(Math.PI*(sub+dx)/3)*Math.sin(Math.PI*u*.8);vertices.push(...pt((p+(sub+dx)/3)*TAU/panels,u,b));const k=.83+b*.20;colors.push(paint.r*k,paint.g*k,paint.b*k)}
      }
      cords.push(...pt(p*TAU/panels,1,0),0,-8.8,0)
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const cloth=new T.Mesh(g,fabric);unit.add(cloth)
    const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(cords,3));unit.add(new T.LineSegments(lines,cordMat));const tether=new T.BufferGeometry();tether.setAttribute('position',new T.Float32BufferAttribute([s*1.6,2.35,-1.63,0,0,0],3));const tie=new T.Line(tether,cordMat);tie.frustumCulled=false;canopies.add(tie);chutes.push({unit,tether,s})
  }
  const jets=[];const jetGeo=new T.ConeGeometry(.57,1,32,1,true);jetGeo.translate(0,.5,0);jetGeo.rotateZ(Math.PI)
  const jetMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0}},vertexShader:`varying vec2 vUv;varying vec3 vP,vD,vN;void main(){vP=position;vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vD=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec2 vUv;varying vec3 vP,vD,vN;uniform float time;${noiseGL}void main(){float d=-vP.y;float hot=1.-smoothstep(0.,1.,d);float ring=.5+.5*cos(d*43.-time*18.);float n=noise(vec2(vUv.x*14.,d*9.-time*12.));float edge=pow(abs(dot(normalize(vN),normalize(vD))),1.72);vec3 c=mix(vec3(.98,.20,.018),vec3(.16,.60,1.),hot*hot);gl_FragColor=vec4(c,(.18+.74*hot)*(.50+.42*ring+.31*n)*edge);${outputGL}}`})
  for(const x of [-1.72,1.72])for(const z of [-2.45,1.53]){const j=new T.Mesh(jetGeo,jetMat);j.position.set(x,.16,z);engines.add(j);jets.push(j)}
  const heat=new T.PointLight(0xff640e,0,14);heat.position.set(0,2,4.6);flight.add(heat)
  function update(t,interior){plasma.visible=t<14.8&&!interior;shell.material.uniforms.time.value=t;heat.intensity=t<14?14+5*Math.sin(t*22):0
    if(plasma.visible){seeds.forEach(([a,b,c,d],i)=>{const f=(t*(1.05+c)+b)%1,r=1.1+f*.65,x=Math.cos(a)*3.03*r,y=1.85+Math.sin(a)*2.23*r,z=2.9-f*17;vtx.set([x,y,z,x+Math.cos(a)*.12,y+Math.sin(a)*.12,z-.17-d*.96],i*6)});trails.attributes.position.needsUpdate=true}
    canopies.visible=t>=16&&t<22.75&&!interior
    if(canopies.visible)for(const {s,unit,tether} of chutes){const k=smooth(16,17.14,t),leaving=smooth(20.48,22.75,t);unit.scale.set(.15+.85*k,.28+.72*k,.15+.85*k);unit.position.set(s*(1.45+3.1*k)+Math.sin(t*2+s)*.2,3.4+10.3*k+leaving*9,-2.75-2.75*k-leaving*14);unit.rotation.z=-s*.12+.04*Math.sin(t*2+s);const end=new T.Vector3(0,-8.8,0).multiply(unit.scale).applyQuaternion(unit.quaternion).add(unit.position);tether.attributes.position.setXYZ(1,end.x,end.y,end.z);tether.attributes.position.needsUpdate=true}
    engines.visible=t>=20.74&&t<28.52&&!interior;jetMat.uniforms.time.value=t;for(let i=0;i<jets.length;i++){const k=1+.095*Math.sin(t*39+i*2);jets[i].scale.set(k,(5.4+.8*Math.sin(t*32+i))*smooth(20.74,21.1,t),k)}
  }return {flight,update}
}

function dustCloud(T,rand){
  // Instanced camera-facing quads (rather than GL_POINTS: no point-size limits).
  const base=new T.PlaneGeometry(1,1),g=new T.InstancedBufferGeometry();g.index=base.index;g.setAttribute('position',base.attributes.position);g.setAttribute('uv',base.attributes.uv)
  const seeds=[];for(let i=0;i<104;i++)seeds.push(rand(),rand(),rand(),rand());g.setAttribute('seed',new T.InstancedBufferAttribute(new Float32Array(seeds),4));g.instanceCount=104
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:`attribute vec4 seed;uniform float time;varying vec2 vUv;varying float alpha,vSeed;void main(){vUv=uv;vSeed=seed.x;float impact=step(.40,seed.w);float birth=mix(25.8+seed.z*3.5,28.43+seed.z*.87,impact);float age=max(0.,time-birth);float life=mix(4.8,7.8,impact);float f=clamp(age/life,0.,1.);float a=6.283*seed.x;float radius=1.5+age*(.85+seed.y*2.4)*mix(1.,1.6,impact);vec3 center=vec3(cos(a)*radius+age*.6,.35+age*(.21+seed.z*.55),sin(a)*radius-2.-age*.35);float size=(1.6+seed.y*2.2)*(1.+age*.36);vec4 mv=modelViewMatrix*vec4(center,1.);mv.xy+=position.xy*vec2(size*1.5,size);gl_Position=projectionMatrix*mv;alpha=smoothstep(0.,.35,age)*(1.-smoothstep(.45,1.,f))*.55;}`,
    fragmentShader:`varying vec2 vUv;varying float alpha,vSeed;${noiseGL}void main(){vec2 p=vUv-.5;float n=.62*noise(vUv*4.5+vSeed*100.)+.38*noise(vUv*11.+vSeed*30.);float a=alpha*(1.-smoothstep(.18,.53,length(p)+(n-.5)*.25))*(.40+n*.6);if(a<.01)discard;vec3 c=mix(vec3(.35,.15,.079),vec3(.72,.42,.239),n+vUv.y*.20);gl_FragColor=vec4(c,a);${outputGL}}`});const o=new T.Mesh(g,mat);o.frustumCulled=false;o.renderOrder=3;return o
}

// Compact the physical-altitude progression into a local tracking volume; the
// craft crosses the actual surface only once. Every pose is seekable by time.
const knots=[[0,275,-640],[6,172,-408],[10,125,-278],[16,73,-132],[20.7,35,-65],[25,12.7,-23],[27.6,4.3,-7.8],[28.5,.62,-1.8],[29.18,-.24,0],[35,-.24,0]]
function trajectory(t){let i=1;while(i<knots.length-1&&knots[i][0]<t)i++;const a=knots[i-1],b=knots[i],k=clamp((t-a[0])/(b[0]-a[0]));return [mix(a[1],b[1],k),mix(a[2],b[2],k)]}
export function crearCine(T,scene,camera,renderer){
  const rand=rng(19970704),world=new T.Group();scene.add(world);world.name='La caída · unidad cinematográfica'
  const saved={near:camera.near,far:camera.far,fov:camera.fov,up:camera.up.clone()};camera.near=.035;camera.far=3200
  const sky=martianWorld(T,world,rand),rig=new T.Group(),ship=crearNave(T),cab=crearPuenteCine(T,rand),fx=flightEffects(T,rand),dust=dustCloud(T,rand),audio=soundRack();world.add(rig,dust);rig.add(ship,cab.root,fx.flight)
  const hemi=new T.HemisphereLight(0xffdfb3,0xaf7356,1.85),sun=new T.DirectionalLight(0xffdfb8,2.75),rim=new T.DirectionalLight(0xabcddd,.8);sun.position.set(-.73,.52,.86);rim.position.set(1,.4,-1);world.add(hemi,sun,rim)
  const shadow=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{strength:{value:1}},vertexShader:localVert,fragmentShader:`varying vec2 vUv;uniform float strength;void main(){float r=length(vUv-.5)*2.;gl_FragColor=vec4(.038,.02,.017,(1.-smoothstep(.16,1.,r))*strength);${outputGL}}`}));shadow.rotation.x=-Math.PI/2;world.add(shadow)
  const eye=new T.Vector3(),target=new T.Vector3(),up=new T.Vector3(),tmp=new T.Vector3();let dead=false
  function update(sec){if(dead)return {line:'',black:true};const t=Number.isFinite(sec)?clamp(sec/35)*35:0,frame=cuadro(t),[h,z]=trajectory(t),wreck=t>=28.52
    const settled=smooth(28.45,29.23,t),flight=1-settled,shake=(.42+.58*(1-smooth(16,18,t)))*flight
    rig.position.set((Math.sin(t*.62)*.69+Math.sin(t*.28)*.37)*flight,h,z);rig.rotation.set((.23-.17*smooth(12,17,t)+.13*Math.sin(t*.85)*shake)*flight-.07*settled,-.1+.03*Math.sin(t*.75)*flight,(.12*Math.sin(t*1.4)+.055*Math.sin(t*5.2))*shake-.205*settled)
    const inside=frame.shot==='cabina';hemi.intensity=inside?.73:1.67;sun.intensity=inside?1.58:2.75;ship.visible=true;cab.root.visible=true;fx.update(t,inside);cab.update(t,inside);rig.updateMatrixWorld(true)
    dust.visible=t>25.8;dust.material.uniforms.time.value=t;shadow.visible=h<19;shadow.position.set(rig.position.x+Math.max(0,h)*.32,.035,z-Math.max(0,h)*.44);shadow.scale.set(8+Math.max(0,h)*.5,10+Math.max(0,h)*.5,1);shadow.material.uniforms.strength.value=.48*(1-smooth(1,19,h))
    // Film grammar: seated approach, helmet insert, hull tracking, drogue wide,
    // retro burn pass, and a locked aftermath at ground level. No screen-space VFX.
    let fov=49,roll=0;const narrow=Math.max(1,1.45/Math.max(.48,camera.aspect));
    if(inside){
      if(t<3.6||t>=20.73&&t<28.47){const k=t<4?smooth(0,3.6,t):smooth(20.73,25,t);eye.set(-.90+.12*k,2.53-.13*k,-1.49+.20*k);target.set(.08,1.95,2.80);fov=66}
      else{const k=smooth(10.22,16,t);eye.set(-.94+.18*k,2.21+.12*k,1.55-.30*k);target.set(.41,2.10,.03);fov=t<6?53:49}
      const j=.016+(.016*shake);eye.x+=j*Math.sin(t*28);eye.y+=j*.55*Math.sin(t*42);target.y+=j*.52*Math.cos(t*37);cab.root.localToWorld(eye);cab.root.localToWorld(target);up.set(0,1,0).applyQuaternion(rig.quaternion);roll=shake*.01*Math.sin(t*19)
    }else{
      const origin=rig.position;up.set(0,1,0)
      if(t<16){const k=smooth(6,10,t);eye.set(10.9+k*1.6,3.22+k*2.1,7.4-k*5.4);target.set(0,1.55,-1.10);fov=49;roll=-.05+.045*k}
      else if(t<23){const k=smooth(16,20.5,t);eye.set(17.1+k*1.5,8.5+k*1.7,18.3-k*4.7);target.set(0,7.68,-2.8);fov=52}
      else if(!wreck){const k=smooth(25,28.6,t);eye.set(-12.8+k*.6,2.4-k*4.8,10.6-k*5.8);target.set(0,.65,-.35);fov=48;roll=.024*Math.sin(t*2)}
      else if(t<30.3){const k=smooth(28.66,29.85,t);eye.set(-12.8,.98+.2*k,7.2);target.set(0,1.06,0);roll=-.042*(1-k);fov=47}
      else{const k=smooth(30.3,35,t);eye.set(-12.4+k*.50,2.82+k*.19,-12.0+k*.49);target.set(0,1.42,0);fov=43}
      eye.multiplyScalar(Math.min(narrow,2));eye.add(origin);target.add(origin);if(!wreck){eye.y+=shake*.024*Math.sin(t*23);roll+=.005*shake*Math.cos(t*13)}
    }
    camera.position.copy(eye);camera.up.copy(up);camera.lookAt(target);camera.rotateZ(roll);if(camera.fov!==fov){camera.fov=fov}camera.updateProjectionMatrix();camera.updateMatrixWorld();sky.position.copy(camera.position);sky.material.uniforms.entry.value=1-smooth(5,23,t);audio.update(t)
    return {line:frame.line,black:frame.shot==='black'&&!(t>=28.91&&t<29.80)}
  }
  function dispose(){if(dead)return;dead=true;audio.close();scene.remove(world);const geometries=new Set(),materials=new Set(),textures=new Set();world.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v)}if(o.isInstancedMesh)o.dispose()});textures.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());geometries.forEach(v=>v.dispose());camera.near=saved.near;camera.far=saved.far;camera.fov=saved.fov;camera.up.copy(saved.up);camera.updateProjectionMatrix()}
  update(0);return {update,dispose,beginAudio:audio.beginAudio,audioEnabled:audio.audioEnabled}
}
