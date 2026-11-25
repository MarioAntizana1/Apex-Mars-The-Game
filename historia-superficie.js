// World-space samples make adjacent sectors share their edge, even after recycling.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)}
export function height(x,z){
  const f=smooth((Math.hypot(x,z)-13)/40)*smooth((Math.hypot(x-180,z+340)-16)/35)
  return f*(1.1*Math.sin(x*.073+z*.024)+.7*Math.sin(z*.113-x*.031)+.35*Math.sin(x*.17+z*.1)+7*Math.sin(x*.009+z*.016)*Math.cos(z*.012)+3.6*Math.sin(x*.029-z*.014))
}
const size=96, divisions=32, span=5
const hash=(x,z)=>{const n=Math.imul(x,73856093)^Math.imul(z,19349663);return ((Math.imul(n^(n>>>16),2246822519)>>>0)/4294967296)}
export function crearSuperficie(T,world,dustMap){
  const soil=new T.MeshStandardMaterial({vertexColors:true,map:dustMap,roughness:1}),stone=new T.MeshStandardMaterial({color:0x96664f,roughness:1}),shape=new T.IcosahedronGeometry(1,0),dummy=new T.Object3D(),color=new T.Color()
  const slots=Array.from({length:span**2},()=>{
    const g=new T.PlaneGeometry(size,size,divisions,divisions);g.rotateX(-Math.PI/2)
    g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3),3));const ground=new T.Mesh(g,soil),rocks=new T.InstancedMesh(shape,stone,75);world.add(ground,rocks);return {g,ground,rocks}
  });let lastX,lastZ
  function update(x,z){const cx=Math.floor(x/size+.5),cz=Math.floor(z/size+.5);if(cx===lastX&&cz===lastZ)return;lastX=cx;lastZ=cz
    for(let iz=cz-2;iz<=cz+2;iz++)for(let ix=cx-2;ix<=cx+2;ix++){
      const tile=slots[((iz%span+span)%span)*span+(ix%span+span)%span];if(tile.ix===ix&&tile.iz===iz)continue;Object.assign(tile,{ix,iz})
      const {g,ground,rocks}=tile,ox=ix*size,oz=iz*size,p=g.attributes.position,c=g.attributes.color,n=g.attributes.normal;ground.position.set(ox,0,oz);rocks.position.copy(ground.position)
      for(let i=0;i<p.count;i++){const xx=ox+p.getX(i),zz=oz+p.getZ(i),h=height(xx,zz);p.setY(i,h-.035);const dx=(height(xx+1,zz)-height(xx-1,zz))*.5,dz=(height(xx,zz+1)-height(xx,zz-1))*.5,k=1/Math.hypot(dx,1,dz);n.setXYZ(i,-dx*k,k,-dz*k);color.setHex(0xb47651).multiplyScalar(.88+.13*hash(xx,zz)+.085*Math.sin(xx*.07+zz*.045));c.setXYZ(i,color.r,color.g,color.b)}
      p.needsUpdate=n.needsUpdate=c.needsUpdate=true;g.computeBoundingSphere()
      let count=0;for(let i=0;i<75;i++){const xx=(hash(ix*79+i,iz)-.5)*size,zz=(hash(ix,iz*79+i+421)-.5)*size,s=.07+hash(ix*85+i+67,iz+42)**4*1.35;if(Math.hypot(ox+xx,oz+zz)<79||Math.hypot(ox+xx-180,oz+zz+340)<18)continue
        dummy.position.set(xx,height(ox+xx,oz+zz)+s*.08,zz);dummy.rotation.set(.28,i*2.39,.12);dummy.scale.set(s*1.2,s*.56,s);dummy.updateMatrix();rocks.setMatrixAt(count++,dummy.matrix)}rocks.count=count;rocks.instanceMatrix.needsUpdate=true;rocks.computeBoundingSphere()
    }
  }
  update(0,0);return {update}
}
