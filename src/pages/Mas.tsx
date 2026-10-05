import { Link } from 'react-router-dom'

/** Pestaña «Más» (0.29.0): lo que se toca de vez en cuando. El registro diario está en «Hoy»
 *  y lo clínico en «Seguimiento». */
const LINKS = [
  { to: '/biblioteca', ico: '📚', label: 'Biblioteca y evidencia', desc: 'Documentación del Drive' },
  { to: '/datos', ico: '💾', label: 'Datos y copias', desc: 'Exportar copia completa, importar y fusionar, informe para IA, CSV, PIN' },
  { to: '/ajustes', ico: '⚙️', label: 'Ajustes', desc: 'Paciente, teléfonos, reto de la semana, usuarios, sesión' },
]

export default function Mas() {
  return (
    <div>
      <h1>Más</h1>
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="card tight" style={{ display: 'flex', gap: '.7rem', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: '1.5rem' }}>{l.ico}</span>
          <span><strong>{l.label}</strong><div className="muted small">{l.desc}</div></span>
        </Link>
      ))}
    </div>
  )
}
