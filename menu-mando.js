import { crearMando, navegarMando } from './mando.js'
import { leerPreferencias } from './preferencias.js'

// El menú del globo no comparte bucle de render con la campaña. Se sondea sólo
// mientras está visible; la guía nativa mantiene el mismo orden de foco que Tab.
export function conectarMandoPrincipal(raiz, guia) {
  let raf=0, habilitado=leerPreferencias().mando
  const mando=crearMando({contexto:()=> 'menu', alAccion(id){
    if(guia.open){if(id==='volver'||id==='pausa')guia.close();else navegarMando(guia,id);return}
    if(id==='guia')raiz.querySelector('[data-guia-controles]')?.click()
    else if(id==='volver'){
      const volver=raiz.querySelector('section:not([hidden]) .menu-volver, section:not([hidden]) #menu-volver');volver?.click();raiz.querySelector('[data-menu=iniciar]')?.focus()
    }else navegarMando(raiz,id)
  }})
  function activo(){return habilitado && !document.hidden && !raiz.hidden && document.hasFocus()}
  function bucle(){raf=0;if(!activo())return;mando.actualizar(1/60);raf=requestAnimationFrame(bucle)}
  function sync(){habilitado=leerPreferencias().mando;if(!activo()){cancelAnimationFrame(raf);raf=0;mando.reset()}else if(!raf)raf=requestAnimationFrame(bucle)}
  const obs=new MutationObserver(sync);obs.observe(raiz,{attributes:true,attributeFilter:['hidden']})
  const ctrl=new AbortController(), opts={signal:ctrl.signal};window.addEventListener('apex:preferencias',sync,opts);document.addEventListener('visibilitychange',sync,opts);window.addEventListener('focus',sync,opts);window.addEventListener('blur',sync,opts)
  sync();return ()=>{cancelAnimationFrame(raf);obs.disconnect();ctrl.abort();mando.dispose()}
}
