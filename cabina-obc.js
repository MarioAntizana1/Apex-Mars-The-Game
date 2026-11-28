import { crearRitual } from './voz.js'
import { crearReconocedor } from './reconocedor.js'
import { crearConsola } from './consola.js'
import { crearMedidorVoz } from './medidor-voz.js'
import { crearMando, navegarMando } from './mando.js'
import { leerPreferencias } from './preferencias.js'

// Los sonidos de Nostromo no necesitan descargas. Los nodos son de un solo uso.
export function tonoOBC(audio, destino, tipo) {
  if (!audio || !destino || audio.state === 'closed') return
  const notas = tipo === 'negativa' ? [[300,205,0,.11],[260,175,.15,.13]] :
    tipo === 'barrido' ? [[520,880,0,.095],[790,1240,.12,.13],[1050,460,.27,.27]] :
    tipo === 'confirmar' ? [[650,650,0,.075],[955,955,.085,.12]] : [[690,810,0,.12]]
  for (const [desde,hasta,retardo,duracion] of notas) {
    const o=audio.createOscillator(), g=audio.createGain(), t=audio.currentTime+retardo
    o.type=tipo==='negativa'?'triangle':'sine'
    o.frequency.setValueAtTime(desde,t); o.frequency.exponentialRampToValueAtTime(hasta,t+duracion)
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.16,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+duracion)
    o.connect(g).connect(destino); o.onended=()=>{o.disconnect();g.disconnect()}; o.start(t); o.stop(t+duracion+.01)
  }
}

// Un dueño de todos los adaptadores por partida. Ningún resultado tardío tiene
// acceso a la simulación si el jugador cambia de ventana, abre un modal o sale.
export function conectarOBC({sim, zona, raizMenu, accionMenu, pausar, guia, cerrarMapa, alTono}, {
  ventana=window, doc=document, preferencias=leerPreferencias, consolaHUD=crearConsola, reconocimiento=crearReconocedor, controlador=crearMando, medidor=crearMedidorVoz
}={}) {
  let prefs=preferencias(), terminado=false, hablando=false, config='', escuchaActiva=false, modoPad=null
  let consola, micro, ritual, mando, nivel
  let silencio=0, avisoSilencio=false, sinMedidor=false
  const abort=new AbortController(), opts={signal:abort.signal}, fuentes=new Set()
  const zonaActual=()=>terminado||doc.hidden?'bloqueado':zona()
  function ejecutar(id) {
    const z=zonaActual()
    if(z==='mapa') {
      if(id==='cerrarMapa') { cerrarMapa(); consola.responder({tono:'ok',texto:'Tablet cerrada.'}) }
      else consola.responder({tono:'aviso',texto:'Cierra la tablet para dar esa orden.'})
      return
    }
    if(z!=='juego')return
    const respuesta=sim.comando(id)
    if(id==='habla' || id==='silencio') consola.silenciar(id==='silencio')
    if(respuesta) consola.responder(respuesta)
  }
  // El medidor es independiente del reconocimiento: si la tira no se mueve con
  // la voz, el problema está en la entrada; si se mueve y no hay respuesta, en
  // el servicio de voz o en el idioma.
  function medir(activa) {
    if(!nivel || terminado)return
    if(activa && !sinMedidor && prefs.voz!=='apagada') {
      nivel.abrir().then(estado=>{
        if(terminado || !escuchaActiva || prefs.voz==='apagada'){nivel.cerrar();return}
        if(estado==='error')consola?.estado({escuchando:true,mensaje:nivel.motivo()})
      }).catch(()=>{})
      consola?.escucha?.(true)
    } else {
      nivel.cerrar(); silencio=0; avisoSilencio=false
      consola?.escucha?.(false)
    }
  }
  function sincronizar() {
    if(!micro || terminado)return
    // Sólo suspenden la captura la pestaña oculta y los menús. Perder el foco de
    // la ventana durante un instante (diálogo de permiso, alt-tab) no debe
    // silenciar a Nostromo ni descartar la frase que ya venía en camino.
    const z=zonaActual(), activa=!hablando && (z==='juego'||z==='mapa'), modo=z==='mapa' && prefs.voz!=='apagada'?'ptt':prefs.voz
    const clave=`${z}/${modo}/${prefs.idiomaVoz}`
    if(clave!==config || activa!==escuchaActiva) {
      // Una locución suspende el micro, pero no equivale a soltar F/LB.
      // Cambiar de zona, modo o foco sí exige una pulsación nueva.
      if(clave!==config) {
        fuentes.clear()
        if(escuchaActiva && activa)micro.configurar({activo:false}) // invalida un final PTT de la zona anterior
      } else if(hablando)fuentes.delete('hud')
      config=clave; escuchaActiva=activa; ritual?.dormir()
      micro.configurar({modo,idioma:prefs.idiomaVoz,activo:activa})
      if(activa)micro.pulsar(fuentes.size>0)
      medir(activa)
    }
    if(prefs.mando!==modoPad){modoPad=prefs.mando; mando?.reset(); if(!modoPad)consola.dispositivo(false)}
  }
  // Un aviso único por sesión de escucha: distinguir «no llega audio» de «no lo
  // entiende» es la mitad del diagnóstico cuando la orden no responde.
  function vigilarSilencio(lectura) {
    if(!escuchaActiva || !lectura.activo)return
    if(lectura.nivel > .04) { silencio=0; avisoSilencio=false; return }
    if(++silencio < 90 || avisoSilencio)return
    avisoSilencio=true
    consola?.estado({escuchando:true,mensaje:'No llega audio del micrófono. Revisa la entrada y prueba de nuevo.'})
  }
  function hablar(origen,pulsado) {
    sincronizar(); const z=zonaActual()
    if(z!=='juego' && z!=='mapa')return
    if(pulsado && prefs.voz==='apagada') {consola.estado({escuchando:false,mensaje:'Micrófono apagado. Activa Voz en Opciones o escribe una orden.'});return}
    const previo=fuentes.size
    if(pulsado)fuentes.add(origen);else fuentes.delete(origen)
    if(Boolean(previo)!==Boolean(fuentes.size))micro.pulsar(fuentes.size>0)
  }
  ritual=crearRitual({alDespertar:()=>consola.despertar(),alComando:ejecutar})
  nivel=medidor({entorno:ventana})
  micro=reconocimiento({
    alTexto:(frase,opciones)=>{const z=zonaActual(); if(!hablando && (z==='juego'||z==='mapa'))ritual.texto(frase,opciones)},
    alParcial:texto=>consola?.parcial?.(texto),
    alEstado:e=>{
      // Si el navegador no deja compartir el micrófono con el reconocimiento, la
      // orden hablada manda: se retira la tira de nivel y se reintenta escuchar.
      if(e?.error && /abrir el micrófono/i.test(String(e.mensaje)) && !sinMedidor) {
        sinMedidor=true; nivel?.cerrar(); consola?.escucha?.(false); micro?.reintentar?.()
        consola?.estado({escuchando:true,mensaje:'La tira de nivel se retira: este navegador no comparte el micrófono. La voz sigue activa.'})
        return
      }
      consola?.estado(e)
    }
  })
  consola=consolaHUD({alEnviar:frase=>ritual.texto(frase,{directo:true}),alPulsar:()=>hablar('hud',!fuentes.has('hud')),alAjustar:()=>actualizarPreferencias(),alTono,alVozHablada:v=>{hablando=v;sincronizar()}})
  const juego={usar:()=>sim.interact(),saltar:()=>sim.jump(),vehiculo:()=>sim.vehicle(),mapa:()=>sim.mapa(),recentrar:()=>sim.recentrar(),pausa:pausar,guia}
  mando=controlador({contexto:()=>{const z=zonaActual();return z==='juego'||z==='bloqueado'?z:'menu'},
    alEje:(x,z)=>sim.ejes(x,z),alMirar:(x,y)=>sim.look(x,y),alTurbo:v=>sim.mandoTurbo(v),alFreno:v=>sim.frenar(v),alHablar:v=>hablar('lb',v),alDispositivo:v=>consola.dispositivo(v),
    alAccion:id=>{const z=zonaActual();if(z==='juego')juego[id]?.();else if(z!=='bloqueado' && !accionMenu(z,id))navegarMando(raizMenu(z),id)}
  })
  function actualizarPreferencias(){prefs=preferencias();consola?.sonido(prefs.sonido);sincronizar()}
  ventana.addEventListener('apex:micro-comprobado',()=>micro.reintentar(),opts)
  ventana.addEventListener('apex:preferencias',actualizarPreferencias,opts)
  const teclaHablar=e=>e.code==='KeyF' || ((!e.code || e.code==='Unidentified') && e.key?.toLowerCase()==='f')
  ventana.addEventListener('keydown',e=>{
    if(!e.repeat)consola.dispositivo(false)
    if(!teclaHablar(e)||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target?.isContentEditable||e.target?.matches?.('input,textarea,select'))return
    if(['juego','mapa'].includes(zonaActual())){e.preventDefault();hablar('f',true)}
  },opts)
  ventana.addEventListener('keyup',e=>{if(teclaHablar(e))hablar('f',false)},opts)
  ventana.addEventListener('pointerdown',()=>consola.dispositivo(false),opts)
  const bloquear=()=>{mando.reset();fuentes.clear();micro.pulsar(false);sincronizar()}
  // Perder el foco cancela la pulsación (su keyup ya no llegará), no la escucha.
  ventana.addEventListener('blur',bloquear,opts)
  ventana.addEventListener('focus',()=>sincronizar(),opts)
  doc.addEventListener('visibilitychange',bloquear,opts)
  actualizarPreferencias()
  return {actualizar(dt){
      sincronizar()
      if(nivel && escuchaActiva) {
        const lectura=nivel.leer()
        consola?.nivel?.(lectura.nivel, lectura.pico)
        vigilarSilencio(lectura)
      }
      if(prefs.mando && zonaActual()!=='bloqueado')mando.actualizar(dt)
    },
    dispose(){terminado=true;abort.abort();ritual.dormir();nivel?.cerrar();micro.dispose();mando.dispose();consola.dispose()}}
}
