import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/diagnosticos', ico: '🩺', label: 'Diagnósticos y evolución', desc: 'Línea de tiempo clínica, signos a vigilar, datos del protocolo' },
  { to: '/ciclos', ico: '💉', label: 'Tratamiento y ciclos', desc: 'Quimio, rescate, dosis acumulada, vigilancia por fármaco' },
  { to: '/nutricion', ico: '🥣', label: 'Nutrición', desc: 'Comidas por modo de semana (quimio / nadir), ayuno, plato con semáforo, peso InBody / hospital' },
  { to: '/hidratacion', ico: '💧', label: 'Hidratación', desc: 'Objetivo por semana (quimio / nadir), agua, agua de mar, caldo, infusiones' },
  { to: '/analiticas', ico: '🧪', label: 'Analíticas y marcadores', desc: 'Fuera de rango, tendencias, pruebas de órgano' },
  { to: '/ejercicio', ico: '🏃', label: 'Ejercicio', desc: 'Sesiones de fuerza y aeróbico, capacidad funcional' },
  { to: '/microbiota', ico: '🦠', label: 'Microbiota', desc: 'Tests de heces y comparativa' },
  { to: '/biohacking', ico: '🌙', label: 'Biohacking', desc: 'Sueño y despertares, sincronizadores (hora y tiempo), exposiciones, prácticas con semáforo' },
  { to: '/emocional', ico: '💛', label: 'Emocional y familiar', desc: 'El niño (semanal) y el cuidador' },
  { to: '/equipo', ico: '💬', label: 'Preguntas al equipo', desc: 'Por profesional · informe de consulta' },
  { to: '/biblioteca', ico: '📚', label: 'Biblioteca y evidencia', desc: 'Documentación del Drive' },
  { to: '/datos', ico: '💾', label: 'Datos y copias', desc: 'Exportar copia completa, importar y fusionar, informe para IA, CSV, PIN' },
  { to: '/ajustes', ico: '⚙️', label: 'Ajustes', desc: 'Paciente, teléfonos, usuarios, sesión' },
]

export default function Mas() {
  return (
    <div>
      <h1>Más apartados</h1>
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="card tight" style={{ display: 'flex', gap: '.7rem', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: '1.5rem' }}>{l.ico}</span>
          <span><strong>{l.label}</strong><div className="muted small">{l.desc}</div></span>
        </Link>
      ))}
    </div>
  )
}
