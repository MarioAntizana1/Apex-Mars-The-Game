// APEX-04. Metres, +Y up, nose +Z, aft airlock -Z. Feet rest at y=0.
// The caller owns the returned group and its materials/geometries.
export function crearNave(T) {
  const ship = new T.Group(); ship.name = 'APEX-04'
  const mat = (c, m=.38, r=.58) => new T.MeshStandardMaterial({color:c, metalness:m, roughness:r, side:T.DoubleSide})
  const ivory=mat(0xc9c5b4), pale=mat(0xe0dccb), dark=mat(0x252c30), heat=mat(0x3b3432), alloy=mat(0x797b76), red=mat(0xae4b31), gold=mat(0x9f7643), glass=mat(0x284954,.6,.23)
  // Pressure glazing has no opaque inner liner. It renders the landscape as well
  // as the displays and seat behind it when the wreck is seen from outside.
  glass.color.setHex(0x9ed4df);glass.transparent=true;glass.opacity=.115;glass.depthWrite=false;glass.metalness=.06
  const boxG=new T.BoxGeometry(), pipeG=new T.CylinderGeometry(1,1,1,10)
  function mesh(g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);ship.add(o);return o}
  function box(x,y,z,w,h,l,m){const o=mesh(boxG,m,x,y,z);o.scale.set(w,h,l);return o}
  function rod(a,b,r,m){const v=new T.Vector3(...a), d=new T.Vector3(...b).sub(v),o=mesh(pipeG,m);o.position.copy(v).addScaledVector(d,.5);o.scale.set(r,d.length(),r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o}
  // Longitudinal pressure shell; baked material groups batch all thermal panels and their seams.
  const shape=[[-.78,0],[.78,0],[1,.18],[1,.66],[.72,.94],[.46,1],[-.46,1],[-.72,.94],[-1,.66],[-1,.18]]
  const stations=[[-3.95,2.12,.44,3.03],[-3.25,2.52,.34,3.43],[-1.5,2.68,.30,3.57],[.35,2.65,.30,3.54],[2.15,2.48,.35,3.34],[3.7,2.43,.35,3.34],[5.52,2.38,.35,3.34],[6.13,2.16,.39,2.99],[6.7,1.68,.55,1.93],[7.39,.37,.87,.78]]
  const pts=[], colors=[], indices=[], materials=[ivory,pale,dark,heat,red,glass]
  const point=(s,k)=>[shape[k][0]*s[1],s[2]+shape[k][1]*s[3],s[0]]
  function quad(a,b,c,d,idx){const n=pts.length/3;pts.push(...a,...b,...c,...d);indices.push(n,n+1,n+2,n,n+2,n+3);colors.push(idx)}
  for(let j=1;j<stations.length;j++)for(let k=0;k<10;k++){
    const n=(k+1)%10, a=point(stations[j-1],k),b=point(stations[j-1],n),c=point(stations[j],n),d=point(stations[j],k)
    const center=a.map((v,i)=>(v+b[i]+c[i]+d[i])/4), inset=p=>p.map((v,i)=>v+(center[i]-v)*.023)
    const pane=j>=5 && (j>=7?k>=2&&k<=8:[2,3,7,8].includes(k))
    const inner=[a,b,c,d].map(inset)
    quad(...inner,pane?5:[9,0,1].includes(k)?3:j===2&&[2,8].includes(k)?4:(j+k)%4===0?1:0)
    if(pane){const corners=[a,b,c,d];for(let i=0;i<4;i++){const next=(i+1)%4;quad(corners[i],corners[next],inner[next],inner[i],2)}}
    else{const shrink=p=>[p[0]*.997,p[1]*.997,p[2]];quad(shrink(a),shrink(b),shrink(c),shrink(d),2)}
  }
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(pts,3));
  const sorted=[];for(let m=0;m<materials.length;m++){const start=sorted.length;colors.forEach((v,i)=>{if(v===m)sorted.push(...indices.slice(i*6,i*6+6))});geom.addGroup(start,sorted.length-start,m)}geom.setIndex(sorted);geom.computeVertexNormals();mesh(geom,materials)
  box(0,1.26,7.39,.74,.78,.05,heat)
  // Aft bulkhead with real 1.38 m clear opening; movable hatch for exploration.
  const bulk=new T.Shape(),outline=shape.map(([u,v])=>[2.12*u,.44+3.03*v]);bulk.moveTo(...outline[0]);for(const p of outline.slice(1))bulk.lineTo(...p);bulk.closePath();const cut=new T.Path();cut.moveTo(-.705,.52);cut.lineTo(-.705,2.64);cut.lineTo(.705,2.64);cut.lineTo(.705,.52);cut.closePath();bulk.holes.push(cut);mesh(new T.ShapeGeometry(bulk),alloy,0,0,-3.951)
  for(const s of [-1,1]){box(s*1.38,1.69,-3.95,1.38,2.52,.14,alloy);box(s*.77,1.58,-4.04,.13,2.25,.17,dark)}
  box(0,2.94,-3.94,3.55,.64,.19,ivory);box(0,.48,-3.96,3.54,.18,.2,dark)
  const hatch=box(0,1.57,-3.98,1.42,2.12,.13,red);hatch.name='escotilla';
  for(const s of [-1,1]){
    for(const z of [-2.62,2.14]){
      const x=s*(z<0?2.4:2.12),foot=s*(z<0?2.94:2.72)
      rod([x,1.25,z],[foot,.16,z-.33],.095,alloy);rod([x,.72,z+.38],[foot,.13,z-.31],.066,gold);box(foot,.08,z-.32,.53,.16,.68,dark)
    }
    // Shoulder-mounted RCS and radiator fins.
    box(s*2.58,1.73,-.52,.25,.63,1.49,dark)
    for(let i=0;i<8;i++)box(s*2.73,1.76,-1.12+i*.165,.05,.48,.047,alloy)
    for(const z of [-2.45,1.53]){const engine=mesh(new T.CylinderGeometry(.29,.42,.43,16,1,true),heat,s*1.72,.37,z);engine.rotation.z=s*.11;mesh(new T.CylinderGeometry(.3,.33,.09,16),dark,s*1.72,.22,z)}
    rod([s*1.86,3.46,-2.85],[s*1.86,3.48,.4],.06,gold)
  }
  return ship
}
