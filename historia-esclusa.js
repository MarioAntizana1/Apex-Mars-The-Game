// La cámara nunca decide el destino del viajero: mover hojas e igualar la presión
// son órdenes independientes. La colisión reserva el umbral completo hasta el fin de carrera.
const A=-2.12, B=-4.03, CABINA=101, MARTE=.6, SEGUNDOS=4
const puertas=['interior','exterior']
const fmt=p=>p.toFixed(p<10?1:0).replace('.',',')+' kPa'
export function crearEsclusa(T,world,{hatch,door,placard=()=>{},position,notify=()=>{}}){
  const grupo=new T.Group();grupo.name='Cámara de esclusa';world.add(grupo)
  const geo=new T.BoxGeometry(),mat=(color,metalness=.3)=>new T.MeshStandardMaterial({color,metalness,roughness:.62}),lit=color=>new T.MeshBasicMaterial({color})
  const marco=mat(0x263236),panel=mat(0xa3aca2),hoja=mat(0x788886,.55),banda=mat(0xcda35e),tinta=mat(0x293637),blanco=lit(0xf3e2ae)
  function caja(x,y,z,w,h,d,m,parent=grupo){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(w,h,d);parent.add(o);return o}
  const hojas=[]
  for(const s of [-1,1]){
    caja(s*1.34,1.84,A,1.13,2.52,.19,marco)
    for(const lado of [-1,1]){
      caja(s*1.35,1.81,A+lado*.106,1.01,2.32,.034,panel)
      for(const y of [.81,2.67])caja(s*1.35,y,A+lado*.129,.95,.035,.018,tinta)
    }
    const g=new T.Group();g.name=`Hoja interior ${s<0?'izquierda':'derecha'}`;grupo.add(g);hojas.push(g)
    caja(s*.39,1.64,A,.783,2.11,.075,hoja,g)
    for(const lado of [-1,1]){
      caja(s*.38,1.58,A+lado*.042,.73,.11,.012,banda,g)
      caja(s*.22,2.17,A+lado*.044,.30,.19,.013,tinta,g)
      caja(s*.22,2.17,A+lado*.054,.24,.034,.013,blanco,g)
    }
  }
  caja(0,2.91,A,1.59,.43,.19,marco)
  placard(0,2.89,A+.103,1.52,.35,0,'A   /   ACCESO','ESCLUSA','1   ABRIR Y ENTRAR', 'dark',grupo)
  placard(0,2.89,A-.103,1.52,.35,Math.PI,'A   /   RETORNO','CABINA','IGUALAR A 101 kPa', 'dark',grupo)
  const pt={aCab:[1.14,1.73,A+.17],aCam:[1.14,1.73,A-.17],bCam:[1.16,1.73,-3.77],bMar:[1.16,1.73,-4.22],aire:[-1.53,1.72,-3.02]}
  const luces={interior:lit(0x8fe9cc),exterior:lit(0xff9959)}
  for(const [id,lado,dir] of [['aCab','interior',1],['aCam','interior',-1],['bCam','exterior',1],['bMar','exterior',-1]]){
    const [x,y,z]=pt[id],g=new T.Group();g.position.set(x,y,z);g.rotation.y=dir===1?0:Math.PI;grupo.add(g);g.name=`Mando ${id}`
    caja(0,.08,-.025,.49,.60,.07,marco,g);caja(0,0,.018,.24,.15,.048,luces[lado],g)
    placard(0,.24,.020,.45,.19,0,lado==='interior'?'A  /  101 kPa':'B  /  0,6 kPa',lado==='interior'?'CABINA':'MARTE','ABRIR / CERRAR','paper',g)
  }
  caja(1.70,1.89,-3.01,.32,.46,1.23,marco)
  caja(-1.70,1.86,-3.02,.32,.89,1.08,tinta)
  placard(1.53,1.89,-3.01,1.19,.43,-Math.PI/2,'PROTOCOLO  /  AMBOS SENTIDOS','CIERRA A Y B','IGUALA PRESIÓN Y ABRE TU SALIDA','paper',grupo)
  const central=new T.Group();central.name='Control de presión';central.position.set(...pt.aire);central.rotation.y=Math.PI/2;grupo.add(central)
  caja(0,.14,-.045,1.15,.96,.11,marco,central);caja(0,-.14,.026,.41,.12,.055,banda,central)
  placard(0,-.25,.027,.84,.13,0,'','IGUALAR PRESIÓN','','paper',central)
  const canvas=globalThis.document?.createElement('canvas');const ctx=canvas?.getContext?.('2d');let tex,ultimo=''
  if(ctx){canvas.width=768;canvas.height=288;tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const pantalla=new T.Mesh(new T.PlaneGeometry(1.02,.44),new T.MeshBasicMaterial({map:tex}));pantalla.position.set(0,.29,.022);central.add(pantalla)}
  const abertura={interior:0,exterior:0},destino={interior:0,exterior:0};let presion=CABINA,ciclo=null,tiempo=0
  const estado=()=>({presion,...abertura,ciclo})
  const moviendo=k=>abertura[k]!==destino[k], sellada=k=>abertura[k]===0&&destino[k]===0
  const fase=k=>moviendo(k)?destino[k]?'abriendo':'cerrando':abertura[k]?'abierta':'sellada'
  const resumen=()=>`Esclusa: ${fmt(presion)} · ${ciclo||'presión estable'} · A ${fase('interior')} / B ${fase('exterior')}`
  const zona=z=>z>A?'cabina':z<B?'marte':'cámara'
  function pintar(){
    const key=resumen();if(key===ultimo)return;ultimo=key
    for(const k of puertas)luces[k].color.setHex(ciclo||moviendo(k)?0xffab53:abertura[k]===1?0xe5fcf2:presion===(k==='interior'?CABINA:MARTE)?0x86e1cc:0xb77b55)
    if(!ctx)return
    ctx.fillStyle='#102427';ctx.fillRect(0,0,768,288);ctx.fillStyle='#dff9ea';ctx.font='bold 28px monospace';ctx.fillText('CÁMARA  /  PRESIÓN ABSOLUTA',24,40);ctx.font='bold 73px monospace';ctx.fillText(fmt(presion),22,119)
    ctx.font='bold 32px sans-serif';ctx.fillStyle='#ffcd87';ctx.fillText((ciclo||'PRESIÓN ESTABLE').toUpperCase(),24,164);ctx.fillStyle='#334d50';ctx.fillRect(24,181,716,13);ctx.fillStyle='#a0ead4';ctx.fillRect(24,181,716*(presion-MARTE)/(CABINA-MARTE),13)
    ctx.font='bold 28px monospace';ctx.fillText(`A ${fase('interior')}   /   B ${fase('exterior')}`.toUpperCase(),24,232);ctx.font='24px sans-serif';ctx.fillText('Cierra ambas puertas antes de igualar.',24,271);tex.needsUpdate=true
  }
  const peligro=(k,x,z)=>Math.abs(x)<1.09&&Math.abs(z-(k==='interior'?A:B))<(k==='interior'?.38:.52)
  function accionar(k){const otra=k==='interior'?'exterior':'interior',letra=k==='interior'?'A':'B'
    if(ciclo)return notify('Igualación en curso. Espera a que la presión se estabilice.')
    if(moviendo(k))return notify(`Puerta ${letra} en movimiento. Espera el fin de carrera.`)
    if(!sellada(otra))return notify(`Interbloqueo: cierra la puerta ${otra==='interior'?'A':'B'} y espera hasta que quede sellada.`)
    if(presion!==(k==='interior'?CABINA:MARTE))return notify(`Presión incompatible. Usa el mando de la cámara para ${k==='interior'?'presurizar':'despresurizar'}.`)
    const {x,z}=position();if(abertura[k]&&peligro(k,x,z))return notify('Umbral ocupado. Da un paso atrás antes de cerrar.')
    destino[k]=1-abertura[k];pintar();notify(`Puerta ${letra}: ${fase(k)}.`)
  }
  function igualar(){if(ciclo)return notify('Ciclo en curso. Ambas puertas permanecen selladas.')
    if(!puertas.every(sellada))return notify('Para igualar, cierra ambas puertas y espera a que queden selladas.')
    ciclo=presion===CABINA?'despresurizando':'presurizando';tiempo=0;pintar();notify(`Cámara ${ciclo}. Ambas puertas selladas.`)
  }
  function accion(id,area,k){return {id:'esclusa-'+id,pt:pt[id],range:k?1.8:1.92,active:()=>zona(position().z)===area,
    get text(){return k?`${destino[k]?'Cerrar':'Abrir'} puerta ${k==='interior'?'A · cabina':'B · Marte'}`:ciclo?`Cámara ${ciclo} · ${fmt(presion)}`:presion===CABINA?'Despresurizar cámara hacia Marte':'Presurizar cámara para volver a cabina'},run(){if(!this.active())return;k?accionar(k):igualar()}}}
  const actions=[accion('aCab','cabina','interior'),accion('aCam','cámara','interior'),accion('bCam','cámara','exterior'),accion('bMar','marte','exterior'),accion('aire','cámara')]
  function update(dt){if(!Number.isFinite(dt)||dt<=0)return
    for(const k of puertas){const prev=abertura[k];if(!moviendo(k))continue
      abertura[k]=destino[k]?Math.min(1,prev+dt*1.15):Math.max(0,prev-dt*1.15)
      const u=(1-Math.cos(Math.PI*abertura[k]))/2
      if(k==='interior'){hojas[0].position.x=-u*.80;hojas[1].position.x=u*.80}else hatch.position.x=door.position.x=-1.6*u
      if(!moviendo(k))notify(`Puerta ${k==='interior'?'A':'B'} ${fase(k)}. ${abertura[k]?'Puedes cruzar.':'Cierre confirmado.'}`)
    }
    if(ciclo){tiempo=Math.min(SEGUNDOS,tiempo+dt);const f=tiempo/SEGUNDOS,sube=ciclo==='presurizando';presion=sube?MARTE+(CABINA-MARTE)*f:CABINA-(CABINA-MARTE)*f
      if(tiempo===SEGUNDOS){presion=sube?CABINA:MARTE;ciclo=null;notify(`Presión estable: ${fmt(presion)}. Ya puedes abrir la puerta ${sube?'A hacia la cabina':'B hacia Marte'}.`)}}
    pintar()
  }
  function permite(x,z){if(Math.abs(x)>2.99)return true
    if(Math.abs(z+3.02)<.68&&Math.abs(x)>1.30)return false // consolas murales, más el radio del traje
    if(Math.abs(z-A)<.27&&(abertura.interior!==1||destino.interior!==1||Math.abs(x)>.53))return false
    if(Math.abs(z-B)<.35&&Math.abs(x)<1.02&&(abertura.exterior!==1||destino.exterior!==1||Math.abs(x)>.53))return false
    return true}
  pintar();return {actions,update,permite,estado,resumen}
}
