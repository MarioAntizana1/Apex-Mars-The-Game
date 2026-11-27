// Gamepad API: copiar los valores; algunos navegadores mutan el mismo Gamepad.
const JUEGO = { 0:'usar', 1:'saltar', 2:'vehiculo', 3:'mapa', 5:'recentrar', 8:'guia', 9:'pausa' }
const MENU = { 0:'confirmar', 1:'volver', 3:'mapa', 8:'guia', 9:'pausa', 12:'arriba', 13:'abajo', 14:'izquierda', 15:'derecha' }
function palanca(x=0,y=0) {
  const r=Math.hypot(x,y), zona=.18
  if (!Number.isFinite(r) || r<=zona) return [0,0]
  const escala=(Math.min(1,r)-zona)/((1-zona)*r)
  return [x*escala,y*escala]
}
function muestra(p) {
  const e=[...palanca(p.axes?.[0],p.axes?.[1]), ...palanca(p.axes?.[2],p.axes?.[3])]
  const valor=i=>{const b=p.buttons?.[i];return Math.max(0,Math.min(1,typeof b==='number'?b:(b?.value ?? +!!b?.pressed)))}
  const b=Array.from({length:16},(_,i)=>!!p.buttons?.[i]?.pressed || valor(i)>.5)
  const [x,y]=e
  if(Math.max(Math.abs(x),Math.abs(y))>.55) b[Math.abs(y)>=Math.abs(x)?(y<0?12:13):(x<0?14:15)]=true
  return {e,b,lt:valor(6)>.06?valor(6):0,rt:valor(7)>.1,id:p.id}
}
function cambio(a,b) {
  const varia=(x,y)=>Math.abs(x-y)>.04 || (!x!==!y)
  return a.b.some((v,i)=>v!==b.b[i]) || a.e.some((v,i)=>varia(v,b.e[i])) || varia(a.lt,b.lt) || a.rt!==b.rt
}
export function crearMando({alEje,alMirar,alTurbo,alFreno,alHablar,alAccion,contexto=()=> 'juego',alDispositivo,obtenerPads=()=>globalThis.navigator?.getGamepads?.(),ventana=globalThis.window}={}) {
  let previos=new Map(), activo=null, ultimoModo=null, muerto=false, dispositivo=false
  let salida=[0,0,false,0,false]
  function emitir(x=0,z=0,turbo=false,freno=0,hablar=false) {
    const [ox,oz,ot,of,oh]=salida; salida=[x,z,turbo,freno,hablar]
    if(x!==ox || z!==oz) alEje?.(x,z)
    if(turbo!==ot) alTurbo?.(turbo)
    if(freno!==of) alFreno?.(freno)
    if(hablar!==oh) alHablar?.(hablar)
  }
  function inactivo(){if(dispositivo){dispositivo=false;alDispositivo?.(false)}}
  function reset(){previos.clear();activo=null;ultimoModo=null;emitir();inactivo()}
  function actualizar(dt=0) {
    if(muerto)return
    const modo=typeof contexto==='function'?contexto():contexto
    let pads
    try { pads=Array.from(obtenerPads() ?? []) } catch {reset();return}
    const estados=new Map(); let ganador=null, tiempo=-Infinity
    for (const [slot,p] of pads.entries()) {
      if(!p || p.connected===false || p.mapping!=='standard')continue
      const i=p.index ?? slot, s=muestra(p), anterior=previos.get(i), base=anterior?.s.id===s.id?anterior:null
      const transicion=modo!==ultimoModo || modo==='bloqueado'
      const flancos=s.b.map((v,j)=>v && !!base && !base.s.b[j] && !transicion)
      const cambioReal=base && cambio(base.ref,s)
      // Un LB ya pulsado antes de abrir/cerrar un diálogo no inicia otra escucha.
      const lb=s.b[4] && !transicion && (flancos[4] || base?.lb)
      estados.set(i,{s,ref:cambioReal || !base?s:base.ref,flancos,lb})
      // Soltar en el mando inactivo no arrebata el personaje al otro.
      const uso=flancos.some(Boolean) || (base && (s.e.some((v,j)=>v && Math.abs(v-base.ref.e[j])>.04) || s.lt>base.ref.lt || (s.rt && !base.ref.rt)))
      if(cambioReal && (i===activo || uso) && !transicion && (p.timestamp || 0)>=tiempo){ganador=i;tiempo=p.timestamp || 0}
      if(estados.size===2)break
    }
    if(activo!==null && (!estados.has(activo) || estados.get(activo).s.id!==previos.get(activo)?.s.id)){activo=null;emitir();inactivo()}
    previos=estados;ultimoModo=modo
    if(modo==='bloqueado'){activo=null;emitir();inactivo();return}
    if(ganador!==null){activo=ganador;dispositivo=true;alDispositivo?.(true)}
    for(const [i,estado] of estados)if(i!==activo)estado.lb=false
    const estado=estados.get(activo)
    if(!estado){emitir();return}
    const {s,flancos,lb}=estado, juego=modo==='juego'
    emitir(juego?s.e[0]:0,juego?(-s.e[1] || 0):0,juego && s.rt,juego?s.lt:0,!!lb)
    if(juego && (s.e[2] || s.e[3])){
      const paso=900*Math.min(.1,Math.max(0,Number(dt)||0));alMirar?.(s.e[2]*paso,s.e[3]*paso)
    }
    // Una sola activación por muestra: la primera puede abrir otro diálogo.
    const tabla=juego?JUEGO:MENU, boton=flancos.findIndex((f,i)=>f && tabla[i]);if(boton>=0)alAccion?.(tabla[boton])
  }
  function desconectar(evento){
    const i=evento.gamepad?.index;previos.delete(i)
    if(i===activo){activo=null;emitir();inactivo()}
  }
  ventana?.addEventListener('gamepaddisconnected',desconectar)
  return {actualizar,reset,dispose(){muerto=true;ventana?.removeEventListener('gamepaddisconnected',desconectar);reset()}}
}

// Arriba/abajo recorre el orden del diálogo; izquierda/derecha edita un select.
export function navegarMando(raiz,id) {
  if(!raiz || !['arriba','abajo','izquierda','derecha','confirmar'].includes(id)) return false
  const items=Array.from(raiz.querySelectorAll('button,select,input:not([type="hidden"]),textarea,a[href],[tabindex]')).filter(el=>
    el.tabIndex>=0 && !el.matches(':disabled,[aria-disabled="true"]') && !el.closest('[hidden],[inert],[aria-hidden="true"]') && el.getClientRects().length)
  if(!items.length)return false
  const pos=items.indexOf(raiz.ownerDocument.activeElement), el=items[pos]
  if(id==='confirmar'){if(el && el.tagName!=='SELECT')el.click();else (el || items[0]).focus();return true}
  const paso=id==='arriba'||id==='izquierda'?-1:1
  if(el?.tagName==='SELECT' && (id==='izquierda'||id==='derecha')){
    for(let i=el.selectedIndex+paso;i>=0 && i<el.options.length;i+=paso){
      if(el.options[i].matches(':disabled') || el.options[i].hidden)continue
      el.selectedIndex=i;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));break
    }
  }else items[pos<0?(paso>0?0:items.length-1):(pos+paso+items.length)%items.length].focus()
  return true
}
