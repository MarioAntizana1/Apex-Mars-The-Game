// Duración del montaje; el despertar no espera a que se pulse ningún botón.
export const DURACION = 35

const cues = [
  [0,'cabina','plasma','Entrada atmosférica · señal inestable'],[6,'exterior','plasma','Escudo térmico · temperatura crítica'],
  [10,'black','wind',''],[10.22,'cabina','dust','Aerofreno derecho · sin respuesta'],[16,'exterior','chute','Paracaídas desplegados'],
  [20.5,'black','wind',''],[20.73,'cabina','burn','Retropropulsores · potencia máxima'],[25,'exterior','burn','Retropropulsores · potencia máxima'],
  [28.15,'black','burn',''],[28.47,'cabina','impact',''],[28.66,'black','impact',''],[30.3,'wreck','quiet','Ares Vallis · Marte'],[DURACION,'awake','quiet',''],
]
const path = [[0,-41000,29500,-.52,-.16],[6,-20000,14900,-.46,.14],[10,-10000,7300,-.37,-.2],[16,-3400,2110,-.25,-.25],[21,-1100,740,-.28,.18],[25,-270,146,-.27,-.19],[28.15,-37,26,-.33,.23],[28.66,-18,12,-.18,.35],[30.3,0,12,-.12,-.24]]
export function cuadro(time) {
  const t=Number.isFinite(time)?Math.max(0,time):0
  const [at,shot,effect,line]=cues.findLast(k=>k[0]<=t)
  const a=path.findLast(k=>k[0]<=t), b=path.find(k=>k[0]>t)??a, f=a===b?0:(t-a[0])/(b[0]-a[0])
  const [east,height,pitch,bank]=a.slice(1).map((v,i)=>v+(b[i+1]-v)*f)
  return {at,shot,effect,line,east,height,pitch,bank}
}

export function ejeTactil(dx, dz, radio) {
  if (![dx, dz, radio].every(Number.isFinite) || radio <= 0) return [0, 0]
  const length = Math.hypot(dx, dz)
  if (length < radio * .07) return [0, 0]
  const denom = Math.max(radio, length)
  return [dx / denom, dz / denom]
}
