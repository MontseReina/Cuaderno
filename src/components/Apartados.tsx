import { Link, useLocation } from 'react-router-dom'
import { useRows } from '../store'
import { todayStr } from '../domain/dates'
import { apartadoDeRuta, fechaDeRuta, resumenDelDia, type EstadoApartado } from '../domain/apartados'

export const esApartado = (path: string) => !!apartadoDeRuta(path)
const esHoy = (path: string) => path === '/' || path === '/inicio'
/** La rejilla de apartados se ve en «Hoy» y dentro de cada apartado. */
export const conApartados = (path: string) => esHoy(path) || esApartado(path)

/** Lo que queda por rellenar en un día, apartado por apartado. */
export function useResumenDia(date: string) {
  const logs = useRows('daily_logs')
  const products = useRows('products')
  const intakes = useRows('intakes')
  const cycles = useRows('cycles')
  return resumenDelDia(logs.find((l) => l.date === date), date, products, intakes, cycles)
}

/** Enlace al apartado para ese día (hoy va sin fecha, como siempre). */
export const rutaApartado = (a: EstadoApartado, date: string, hoy: string) => (date === hoy ? a.to : `${a.to}/${date}`)

/** 0.30.0 · Los seis apartados del día siempre a la vista, cada uno con ✓ si está completo
 *  o con el número de cosas que le faltan. Así se ve lo que queda sin volver a «Hoy». */
export function ApartadosNav() {
  const { pathname } = useLocation()
  const hoy = todayStr()
  const date = fechaDeRuta(pathname, hoy)
  const { apartados } = useResumenDia(date)
  const actual = apartadoDeRuta(pathname)
  return (
    <nav className="apartados noprint" aria-label="Apartados del registro">
      {apartados.map((a) => (
        <Link key={a.to} to={rutaApartado(a, date, hoy)} className={actual?.to === a.to ? 'on' : ''} aria-current={actual?.to === a.to ? 'page' : undefined}>
          <span className="apartados-ico" aria-hidden="true">{a.ico}</span>
          <span className="apartados-txt">{a.label}</span>
          <Marca a={a} />
        </Link>
      ))}
    </nav>
  )
}

/** ✓ si el apartado está completo; si no, cuántas cosas le faltan. */
export function Marca({ a }: { a: EstadoApartado }) {
  return a.completo
    ? <span className="marca hecha" role="img" aria-label="completo">✓</span>
    : <span className="marca" role="img" aria-label={a.faltan === 1 ? 'falta 1' : `faltan ${a.faltan}`}>{a.faltan}</span>
}

/** Al final de cada apartado: salto al siguiente que tenga algo sin apuntar. */
export function SiguienteApartado() {
  const { pathname } = useLocation()
  const hoy = todayStr()
  const date = fechaDeRuta(pathname, hoy)
  const { apartados } = useResumenDia(date)
  const i = apartados.findIndex((a) => a.to === apartadoDeRuta(pathname)?.to)
  if (i < 0) return null
  // Primero los que vienen después de este; si no queda ninguno, los de antes.
  const resto = [...apartados.slice(i + 1), ...apartados.slice(0, i)]
  const sig = resto.find((a) => !a.completo)
  if (sig) return (
    <Link className="btn block siguiente noprint" to={rutaApartado(sig, date, hoy)}>
      Siguiente: {sig.nombre} ({sig.faltan === 1 ? 'falta 1' : `faltan ${sig.faltan}`}) ›
    </Link>
  )
  if (!apartados[i].completo) return null
  return <Link className="btn secondary block siguiente noprint" to="/">✓ Todo apuntado · volver a Hoy</Link>
}
