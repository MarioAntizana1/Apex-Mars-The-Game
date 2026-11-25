const TAU=Math.PI*2, clamp=x=>Math.max(0,Math.min(1,x))
const outputGL='\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n'
export const Z_INICIO_PUENTE=2.15,Z_FIN_CASCO=7.5
// Clearances include a 22 cm suit radius; the padded seat remains after landing.
export function transitablePuente(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z)||z<Z_INICIO_PUENTE||z>5.32||Math.abs(x)>1.36)return false
  if(z<2.55 && Math.abs(x)>.65)return false
  if(z<3.14 && Math.abs(x)>.55)return false // aft avionics cabinets
  if(z>3.16&&z<4.4&&x>-.24&&x<1.02)return false // pilot seat
  return true
}
export function crearPuenteCine(T,rand){return montarPuente(T,rand,true)}
export function crearPuenteJugable(T){
  const {root,diagnosticar}=montarPuente(T,()=>0,false)
  return {root,diagnosticar,accion:{id:'diagnostico',pt:[0,1.55,5.72],range:1.65,text:'Consultar diagnóstico de vuelo',active:()=>true}}
}

// Build the cabin as an actual set. Coordinates match the exterior hull, +Z is forward.
function montarPuente(T,rand,vuelo){
  const root=new T.Group(), mats={}
  root.name='Puente de vuelo APEX-04';root.position.set(0,.558,4.15);root.scale.set(.78,.8,.75)
  function mat(col,em=0,metal=.12){return mats[[col,em,metal]]??=new T.MeshStandardMaterial({color:col,roughness:.63,metalness:metal,emissive:em})}
  const steel=mat(0x52615e,0,.52),trim=mat(0x233337,0,.42),black=mat(0x101b1f),bone=mat(0xb7b5a0),orange=mat(0xbb4e23),cloth=mat(0x9a9780),joint=mat(0x303e3c),gold=mat(0xe3b24c),lamp=mat(0xb6dedb,0x80e4dc),red=mat(0xbf341b,0xd32c11)
  const boxG=new T.BoxGeometry(),ballG=new T.SphereGeometry(1,32,22),barG=new T.CylinderGeometry(1,1,1,10)
  function mesh(parent,g,m,x,y,z,sx=1,sy=1,sz=1){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o}
  const box=(parent,m,x,y,z,sx,sy,sz)=>mesh(parent,boxG,m,x,y,z,sx,sy,sz)
  const oval=(parent,m,x,y,z,sx,sy,sz)=>mesh(parent,ballG,m,x,y,z,sx,sy,sz)
  function tube(parent,m,a,b,r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),delta=vb.sub(va),o=mesh(parent,barG,m,...va.toArray(),r,delta.length(),r);o.position.addScaledVector(delta,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o}
  function canvas(w,h,paint){
    const c=globalThis.document?.createElement?.('canvas');if(c){c.width=w;c.height=h}
    const g=c?.getContext?.('2d');let map
    if(g){paint(g,w,h);map=new T.CanvasTexture(c)}
    else{map=new T.DataTexture(new Uint8Array([90,148,134,255]),1,1);map.needsUpdate=true}
    map.colorSpace=T.SRGBColorSpace;return map
  }
  function decal(parent,tex,x,y,z,w,h,rot=0){const o=mesh(parent,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}),x,y,z);o.rotation.y=rot;return o}
  const stamp=canvas(512,128,(g)=>{g.fillStyle='#2e3734';g.fillRect(0,0,512,128);g.fillStyle='#ddba79';g.fillRect(11,10,5,109);g.font='bold 55px monospace';g.fillText('ARES / 07',30,67);g.font='19px monospace';g.fillText('DESCENT SYSTEM   •   APEX',32,104)})
  box(root,trim,0,-.06,.435,4.7,.2,5.63);box(root,trim,0,3.44,-.3,4.04,.15,4.4);for(const s of [-1,1])box(root,trim,s*1.72,1.6,-2.53,1.22,3.55,.16)
  // During re-entry the pressure door is latched. In EVA both leaves are
  // fully retracted into the jambs, so the aisle is physically open.
  if(vuelo)for(const s of [-1,1]){box(root,steel,s*.555,1.65,-2.53,1.10,3.47,.13);box(root,orange,s*.4,1.57,-2.447,.35,.046,.015)}
  for(let j=0;j<8;j++){if(j>=2&&j<=5)continue;const x=-2.03+j*.58;box(root,j%2?steel:joint,x,1.65,-2.41,.53,3.31,.08);for(let k=0;k<4;k++)box(root,black,x,.42+k*.72,-2.35,.44,.025,.02)}
  decal(root,stamp,-1.69,2.5,-2.31,1.1,.275)
  for(const s of [-1,1]){
    box(root,trim,s*2.18,.65,.3,.22,1.36,6);box(root,joint,s*2.18,1.98,-1.89,.15,1.48,1.3)
    for(const z of [-1.31,.55,2.47]){tube(root,bone,[s*2.19,1.23,z],[s*1.86,3.36,z-.25],.092);tube(root,black,[s*2.11,1.24,z-.11],[s*1.78,3.35,z-.36],.042)}
    tube(root,steel,[s*2.2,1.35,-2.4],[s*2.2,1.35,2.55],.1);tube(root,bone,[s*1.88,3.33,-2.4],[s*1.88,3.33,2.15],.12)
    tube(root,steel,[s*2.18,1.37,2.55],[s*1.72,3.28,1.83],.12);tube(root,trim,[s*1.72,3.25,1.86],[s*.27,3.25,1.86],.08)
    for(let i=0;i<8;i++)box(root,i%3?black:gold,s*2.035,1.05,-.55+i*.32,.06,.11,.17)
    box(root,lamp,s*1.38,3.32,-.78,.7,.028,.11)
  }
  tube(root,black,[0,1.36,2.88],[0,3.27,1.9],.058);tube(root,bone,[-2.12,1.37,2.59],[2.12,1.37,2.59],.11)
  const hudMap=canvas(512,256,g=>{g.clearRect(0,0,512,256);g.strokeStyle='#9be9bb';g.fillStyle='#b0ecc8';g.lineWidth=2;g.font='16px monospace';g.fillText('04 / EDL',22,34);g.fillText('AUTO',421,34);g.beginPath();g.arc(256,128,13,0,TAU);g.moveTo(230,128);g.lineTo(244,128);g.moveTo(268,128);g.lineTo(282,128);for(let i=-2;i<3;i++){const y=105+i*32;g.moveTo(132,y);g.lineTo(168,y);g.moveTo(345,y);g.lineTo(381,y);g.fillText((10-i*5).toString(),395,y+5)}g.stroke();g.fillText('▼',248,42) });const hud=decal(root,hudMap,0,1.99,2.54,1.57,.785,Math.PI);hud.material.transparent=true;hud.material.depthWrite=false;hud.material.opacity=.63;hud.material.toneMapped=false
  const dashes=[];for(let n=-1;n<=1;n++){
    const stand=new T.Group();root.add(stand);stand.position.set(n*1.08,1.24,2.23-Math.abs(n)*.19);stand.rotation.set(-.43,n*.18,0)
    box(stand,trim,0,0,0,1.05,.68,.18);box(stand,black,0,.025,-.104,.93,.51,.035)
    const tex=canvas(384,192,()=>{}),screen=decal(stand,tex,0,.039,-.13,.89,.445,Math.PI);screen.name=`Pantalla de vuelo ${n+2}`;dashes.push({tex,g:tex.image.getContext?.('2d'),n});screen.material.toneMapped=false
    for(let i=0;i<7;i++)box(stand,i===1?red:i===5?lamp:steel,(i-3)*.127,-.253,-.108,.08,.035,.045)
  }
  const pilot=new T.Group();pilot.position.set(.49,.05,-.25);root.add(pilot);pilot.name="Asiento de pilotaje"
  box(pilot,steel,0,.27,-.22,.39,.66,.45);box(pilot,trim,0,.04,-.22,.8,.10,.76);box(pilot,joint,0,.73,-.2,1.02,.28,.91);box(pilot,black,0,1.47,-.54,1.01,1.58,.19);box(pilot,joint,0,2.19,-.54,.75,.59,.25)
  const body=new T.Group();pilot.add(body);body.visible=vuelo;oval(body,cloth,0,1.5,0,.51,.62,.37);box(body,bone,0,1.62,-.23,.8,.67,.29)
  const head=new T.Group();head.position.set(0,2.2,.015);body.add(head)
  oval(head,trim,0,-.31,0,.4,.145,.38);oval(head,bone,0,.03,0,.485,.498,.455)
  const visor=new T.ShaderMaterial({vertexShader:`varying vec3 nrm,dir,vShell; void main(){vShell=position;vec4 p=modelViewMatrix*vec4(position,1.);nrm=normalize(normalMatrix*normal);dir=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec3 nrm,dir,vShell;void main(){vec3 n=normalize(nrm),s=normalize(vShell);float fres=pow(1.-abs(dot(n,normalize(dir))),2.7);float h=n.y+.15*n.x;float refl=smoothstep(-.10,-.03,h);vec3 c=mix(vec3(.019,.027,.032),vec3(.32,.143,.042),refl);c+=vec3(.35,.22,.08)*exp(-abs(h-.01)*12.);c+=vec3(.68,.74,.62)*(1.-smoothstep(.015,.042,abs(h-.28)))*smoothstep(.2,.5,abs(n.x));c+=vec3(.18,.13,.065)*fres;float glass=smoothstep(.27,.34,s.z-.33*s.y*s.y);c=mix(vec3(.012,.017,.017)+.032*fres,c,glass);gl_FragColor=vec4(c,1.);${outputGL}}`})
  oval(head,visor,0,.037,.255,.477,.376,.374)
  for(const s of [-1,1]){oval(head,trim,s*.447,-.015,-.008,.072,.214,.191);oval(head,steel,s*.498,-.012,-.005,.038,.139,.127);box(head,orange,s*.317,.345,.104,.085,.059,.12)
    oval(body,bone,s*.443,1.69,.015,.255,.25,.246);tube(body,cloth,[s*.49,1.62,.04],[s*.59,1.31,.41],.181);tube(body,joint,[s*.59,1.31,.41],[s*.56,1.32,.51],.167);tube(body,cloth,[s*.56,1.32,.50],[s*.43,1.25,.87],.147);oval(body,black,s*.42,1.24,.91,.142,.122,.164)
    tube(body,orange,[s*.29,1.96,.258],[s*.13,1.14,.31],.063);box(body,steel,s*.23,1.49,.367,.142,.138,.06);oval(body,cloth,s*.25,.85,.28,.238,.259,.56);tube(body,cloth,[s*.25,.83,.68],[s*.25,.26,.79],.19);box(body,black,s*.25,.17,.88,.37,.235,.46)
  }box(body,trim,0,1.57,.337,.37,.24,.09);box(body,lamp,-.086,1.596,.39,.108,.035,.018);box(body,red,.07,1.596,.39,.095,.031,.018)
  const patch=canvas(160,160,g=>{g.fillStyle='#354347';g.fillRect(0,0,160,160);g.strokeStyle='#e8b66f';g.lineWidth=5;g.beginPath();g.arc(80,80,60,0,TAU);g.stroke();g.fillStyle='#de794a';g.beginPath();g.moveTo(32,103);g.lineTo(68,54);g.lineTo(81,78);g.lineTo(95,62);g.lineTo(125,104);g.fill();g.fillStyle='#fff1ca';g.font='bold 19px monospace';g.fillText('APEX',57,128)})
  decal(body,patch,.622,1.684,.061,.195,.195,Math.PI/2)
  // Flight director, command placards and edge lighting are physical props.
  const placard=canvas(512,128,g=>{g.fillStyle='#171e20';g.fillRect(0,0,512,128);g.fillStyle='#ecb859';for(let x=-20;x<512;x+=50){g.beginPath();g.moveTo(x,0);g.lineTo(x+26,0);g.lineTo(x+14,15);g.lineTo(x-12,15);g.fill()}g.font='bold 48px monospace';g.fillText('APEX–04',18,72);g.fillStyle='#c3c8b6';g.font='21px monospace';g.fillText('FLIGHT DECK    //   CREW 01',18,108)})
  decal(root,placard,.03,3.11,1.83,.84,.21,Math.PI);decal(root,placard,-1.68,2.29,-2.30,.97,.243)
  for(const side of [-1,1]){box(root,joint,side*1.08,1.30,-1.73,.51,.65,.36);tube(root,gold,[side*1.09,1.71,-1.75],[side*1.09,1.45,-1.64],.035);for(let k=0;k<5;k++)box(root,k%3?steel:gold,side*1.08,1.12+k*.085,-1.525,.40,.027,.019);tube(root,lamp,[side*2.13,1.43,-1.13],[side*2.13,1.43,.33],.018);tube(root,orange,[side*1.91,3.14,-.64],[side*1.97,2.95,-.61],.046)}
  for(const s of [-1,1]){for(let k=0;k<3;k++)tube(body,k===1?orange:joint,[s*.455,1.65-k*.032,.012+k*.039],[s*.463,1.622-k*.032,.054+k*.039],.201);box(head,bone,s*.469,.20,-.10,.086,.109,.224);box(head,lamp,s*.483,.20,.020,.062,.055,.045);box(body,joint,s*.065,1.61,.397,.083,.03,.009)}
  // Hot flecks pass OUTSIDE the pressure glass, in ship space.
  const fleckData=Array.from({length:120},()=>[rand(),rand(),rand(),rand()]),fleckGeo=new T.BufferGeometry();fleckGeo.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(fleckData.length*6),3).setUsage(T.DynamicDrawUsage));const flecks=new T.LineSegments(fleckGeo,new T.LineBasicMaterial({color:0xffb258,transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false}));flecks.frustumCulled=false;root.add(flecks)
  const alarm=new T.PointLight(0xff5421,3,5,2);alarm.position.set(-1.48,2.7,.45);root.add(alarm)
  const fill=new T.PointLight(0xb4f0f1,8,5);fill.position.set(.2,2.48,1.1);root.add(fill)
  let frame=-1,verificado=false
  function update(t,interior=true){head.rotation.set(.035*Math.sin(t*2),.12+.12*Math.sin(t*.9),.045*Math.sin(t*11));body.rotation.z=.016*Math.sin(t*14);alarm.intensity=vuelo?2.2+3*Math.max(0,Math.sin(t*5))**4:verificado?.1:.8
    flecks.visible=vuelo&&interior&&t<15.6;if(flecks.visible){const attr=fleckGeo.attributes.position;fleckData.forEach(([aa,b,c,d],i)=>{const k=(t*(.80+d*.82)+b)%1,a=aa*TAU,r=3.15+3.2*c+k*1.5,x=Math.cos(a)*r,y=1.75+Math.sin(a)*r,z=20.-k*26.;attr.setXYZ(i*2,x,y,z);attr.setXYZ(i*2+1,x+.10*Math.cos(a),y+.10*Math.sin(a),z-.72-1.20*d)});attr.needsUpdate=true}
    if(frame===Math.floor(t*7))return;frame=Math.floor(t*7)
    for(const {tex,g,n} of dashes){if(!g){if(verificado){tex.image.data.set([118,228,162,255]);tex.needsUpdate=true}continue}const w=384,h=192;g.fillStyle='#0b211f';g.fillRect(0,0,w,h);g.strokeStyle='#23403a';g.lineWidth=1;for(let i=0;i<w;i+=24){g.beginPath();g.moveTo(i,37);g.lineTo(i,h-20);g.stroke()}for(let i=42;i<h-20;i+=23){g.beginPath();g.moveTo(0,i);g.lineTo(w,i);g.stroke()}
      g.fillStyle='#b4d6bf';g.font='bold 19px monospace';g.fillText(['THERMAL  /  07','DESCENT  VECTOR','RETRO   /   SYS'][n+1],12,23);g.fillStyle='#e6af6a';g.fillRect(300,12,65,8);g.strokeStyle=n===0?'#dcad6f':'#88d5ba';g.lineWidth=3;g.beginPath();for(let i=0;i<w;i+=4){const y=96+Math.sin(i*.019+t)*22+Math.sin(i*.092+t*3)*8+Math.sin(i*.19+t*5)*3;i?g.lineTo(i,y):g.moveTo(i,y)}g.stroke();g.fillStyle='#9bd5bd';g.font='bold 26px monospace';g.fillText(!vuelo?(verificado?['CASCO   OK','72 kPa','RADIO   RX'][n+1]:['TÉRMICO','DIAGNÓSTICO','RESERVA'][n+1]):n===0?`${Math.max(0,Math.round((29-t)**3*.83))} M`:n<0?'SHIELD':'THRUST',13,163);g.fillStyle='#d29a58';g.fillRect(12,176,355*clamp(1-t/37),4);tex.needsUpdate=true}
  }
  function diagnosticar(){verificado=true;frame=-1;update(35);return 'Diagnóstico APEX-04: casco estanco · presión del puente 72 kPa · radio orbital sin enlace.'}
  if(!vuelo)update(35)
  return {root,update,diagnosticar}
}

