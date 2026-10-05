import { NavLink } from 'react-router-dom'

/** Los seis apartados del registro diario. Antes eran pestañas; ahora son secciones dentro de «Hoy». */
export const APARTADOS: { to: string; ico: string; label: string }[] = [
  { to: '/diario', ico: '📝', label: 'Signos' },
  { to: '/medicacion', ico: '💊', label: 'Medicación' },
  { to: '/nutricion', ico: '🥣', label: 'Nutrición' },
  { to: '/hidratacion', ico: '💧', label: 'Hidratación' },
  { to: '/ejercicio', ico: '🏃', label: 'Ejercicio' },
  { to: '/biohacking', ico: '🌙', label: 'Biohacking' },
]

export const esApartado = (path: string) => APARTADOS.some((a) => path === a.to || path.startsWith(a.to + '/'))

/** Tira para saltar de un apartado a otro sin volver a «Hoy». */
export function ApartadosNav() {
  return (
    <nav className="apartados noprint" aria-label="Apartados del registro">
      <NavLink to="/" end className="apartados-volver">‹ Hoy</NavLink>
      {APARTADOS.map((a) => (
        <NavLink key={a.to} to={a.to} className={({ isActive }) => (isActive ? 'on' : '')}>
          <span aria-hidden="true">{a.ico}</span> {a.label}
        </NavLink>
      ))}
    </nav>
  )
}
