import { useEffect, useRef, useState } from 'react'

/** Aviso «¿Seguro?» con el diseño de la app (0.27.0), en lugar de la ventana gris del navegador.
 *  Uso: `if (await confirmar('¿Borrar esta pesada?')) remove(...)`. Devuelve true solo si se pulsa el botón de aceptar. */
export interface OpcionesConfirmar { aceptar?: string; cancelar?: string; peligro?: boolean; detalle?: string }
interface Peticion extends OpcionesConfirmar { mensaje: string; resolver: (ok: boolean) => void }

let abrir: ((p: Peticion) => void) | null = null

export function confirmar(mensaje: string, opciones: OpcionesConfirmar = {}): Promise<boolean> {
  return new Promise((resolver) => {
    if (!abrir) { resolver(window.confirm(mensaje)); return } // por si el aviso aún no está montado
    abrir({ mensaje, resolver, ...opciones })
  })
}

/** Se monta una sola vez (en App). */
export function ConfirmarHost() {
  const [p, setP] = useState<Peticion | null>(null)
  const aceptarRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { abrir = setP; return () => { abrir = null } }, [])
  useEffect(() => {
    if (!p) return
    aceptarRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!p) return null
  const peligro = p.peligro ?? /borrar|retirar|eliminar/i.test(p.mensaje)
  function cerrar(ok: boolean) { p?.resolver(ok); setP(null) }
  return (
    <div className="confirmar-fondo" onClick={() => cerrar(false)}>
      <div className="confirmar" role="alertdialog" aria-modal="true" aria-labelledby="confirmar-msg" onClick={(e) => e.stopPropagation()}>
        <p id="confirmar-msg" className="confirmar-msg">{p.mensaje}</p>
        {p.detalle && <p className="muted small">{p.detalle}</p>}
        <div className="confirmar-botones">
          <button type="button" className="btn secondary" onClick={() => cerrar(false)}>{p.cancelar ?? 'Cancelar'}</button>
          <button type="button" ref={aceptarRef} className={'btn ' + (peligro ? 'danger' : '')} onClick={() => cerrar(true)}>{p.aceptar ?? (peligro ? 'Sí, seguro' : 'Aceptar')}</button>
        </div>
      </div>
    </div>
  )
}
