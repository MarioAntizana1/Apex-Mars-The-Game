// Geometría en metros; +Z local apunta hacia la parte trasera del rover.
export const RUEDAS = [[-1.32,-1.25],[1.32,-1.25],[-1.32,0],[1.32,0],[-1.32,1.25],[1.32,1.25]]
export const GRAVEDAD_MARTE = 3.71
const K=48, C=8, EXTENSION=GRAVEDAD_MARTE/K, TOPE=.24
const limitar=(n,a,b)=>Math.max(a,Math.min(b,n))

// Altura del bastidor y seis amortiguadores unilaterales: una rueda sin
// contacto no puede tirar del vehículo hacia el suelo al cruzar una cresta.
export function crearSuspension(altura){
  const terreno=new Float64Array(6),apoyoAnterior=new Float64Array(6)
  const e={y:0,vy:0,lateral:0,longitudinal:0,contactos:6,recorrido:new Float64Array(6)}
  function muestras(x,z,yaw){
    const c=Math.cos(yaw),s=Math.sin(yaw)
    for(let i=0;i<6;i++){
      const [u,v]=RUEDAS[i]
      terreno[i]=altura(x+u*c+v*s,z-u*s+v*c)
    }
  }
  function pendientes(dt){
    const k=dt===null?1:-Math.expm1(-12*dt)
    e.lateral+=k*((terreno[1]+terreno[3]+terreno[5]-terreno[0]-terreno[2]-terreno[4])/(3*2.64)-e.lateral)
    e.longitudinal+=k*((terreno[4]+terreno[5]-terreno[0]-terreno[1])/5-e.longitudinal)
  }
  const apoyo=i=>terreno[i]-RUEDAS[i][0]*e.lateral-RUEDAS[i][1]*e.longitudinal
  function reiniciar(x,z,yaw){
    muestras(x,z,yaw);pendientes(null)
    for(let i=0;i<6;i++)apoyoAnterior[i]=apoyo(i)
    e.y=Math.max(...apoyoAnterior);e.vy=0;e.contactos=6;e.recorrido.fill(0)
  }
  // El controlador submuestrea tanto la trayectoria horizontal como los apoyos.
  function avanzar(x,z,yaw,dt){
    if(dt<=0)return
    muestras(x,z,yaw)
    if(e.contactos)pendientes(dt) // En vuelo no orientar el chasis al terreno distante.
    let aceleracion=-GRAVEDAD_MARTE,tope=-Infinity
    for(let i=0;i<6;i++){
      const h=apoyo(i),comp=h-e.y+EXTENSION
      const tasa=limitar((h-apoyoAnterior[i])/dt,-12,12)-e.vy
      if(comp>0)aceleracion+=Math.max(0,K*comp+C*tasa)/6
      tope=Math.max(tope,h-TOPE);apoyoAnterior[i]=h
    }
    e.y+=e.vy*dt+.5*aceleracion*dt*dt;e.vy+=aceleracion*dt
    if(e.y<tope){e.y=tope;e.vy=Math.max(0,e.vy)}
    e.contactos=0
    for(let i=0;i<6;i++){
      const d=apoyoAnterior[i]-e.y
      if(d>=-EXTENSION)e.contactos++
      e.recorrido[i]=limitar(d,-EXTENSION,TOPE)
    }
  }
  return {estado:e,reiniciar,avanzar}
}
