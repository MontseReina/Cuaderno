import { useRef, useState } from 'react'
import { backend, isDemo, useStoreVersion } from '../store'
import { TABLE_NAMES } from '../store/types'
import { LocalBackend } from '../store/local'
import { addDays, fmtDateTime, todayStr } from '../domain/dates'
import { APP_VERSION, SCHEMA_VERSION, exportAiReport, exportBackup, exportCsv, importBackup, lastExportAt } from '../domain/exporter'
import { loadSampleData } from '../domain/sample'
import { Field, Section, Segmented, useToast } from '../components/ui'
import { getPin, setPin } from '../domain/pin'

const TABLE_LABELS: Record<string, string> = {
  patients: 'Paciente', profiles: 'Usuarios', diagnoses: 'Diagnósticos', cycles: 'Ciclos', daily_logs: 'Registro diario', products: 'Medicación y suplementos',
  intakes: 'Tomas', lab_panels: 'Analíticas', lab_results: 'Resultados analíticos', organ_tests: 'Pruebas de órgano', microbiome_tests: 'Tests de microbiota',
  calendar_events: 'Calendario', todos: 'Pendientes', questions: 'Preguntas al equipo', weekly_child: 'Emocional niño', weekly_caregiver: 'Cuidador semanal',
  caregiver_daily: 'Cuidador diario', exercise_sessions: 'Sesiones de ejercicio', functional_weekly: 'Capacidad funcional', exposures_weekly: 'Exposiciones', practices: 'Prácticas', practice_log: 'Prácticas hechas', weights: 'Pesos', challenges: 'Reto de la semana',
}

export default function Datos() {
  useStoreVersion()
  const { toast, node } = useToast()
  const [from, setFrom] = useState(addDays(todayStr(), -7))
  const [to, setTo] = useState(todayStr())
  const [range, setRange] = useState<'semana' | 'mes' | 'todo' | 'otro'>('semana')
  const [importMsg, setImportMsg] = useState('')
  const [pin1, setPin1] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const last = lastExportAt()
  const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null
  const counts = TABLE_NAMES.map((t) => [t, backend.all(t).length] as const).filter(([, n]) => n > 0)
  const total = counts.reduce((a, [, n]) => a + n, 0)

  const pickRange = (r: typeof range) => {
    setRange(r)
    if (r === 'semana') { setFrom(addDays(todayStr(), -7)); setTo(todayStr()) }
    if (r === 'mes') { setFrom(addDays(todayStr(), -30)); setTo(todayStr()) }
    if (r === 'todo') { const dates = backend.all('daily_logs').map((l) => l.date).sort(); setFrom(dates[0] ?? addDays(todayStr(), -30)); setTo(todayStr()) }
  }

  return (
    <div>
      {node}
      <h1>Datos y copias</h1>
      {isDemo && (
        <div className={'notice'} style={daysSince == null || daysSince > 2 ? { background: '#fbe4e4', borderColor: '#e39999' } : undefined}>
          <strong>Copia de seguridad:</strong> {last ? `última exportación ${fmtDateTime(last)} (hace ${daysSince} día${daysSince === 1 ? '' : 's'})` : 'nunca se ha exportado'}.
          {(daysSince == null || daysSince > 2) && ' Los datos viven solo en este aparato: exporta una copia completa y envíala.'}
        </div>
      )}
      {!isDemo && <p className="muted small">Conectado a Supabase: los datos están en la nube con copia diaria. Las exportaciones sirven para análisis y para los médicos.</p>}

      <Section title="1 · Copia completa (JSON)" open>
        <p className="small">Todo el almacén (perfil + todos los registros) en un archivo <code>cuaderno_{todayStr()}.json</code>. Sirve como copia de seguridad y para poner al día otro aparato. Se puede enviar por WhatsApp, correo o Drive.</p>
        <div className="row">
          <button className="btn" onClick={() => { exportBackup(); toast('Copia exportada') }}>Exportar copia completa</button>
          <button className="btn secondary" onClick={() => fileRef.current?.click()}>Importar y fusionar…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            try { const r = await importBackup(await f.text()); setImportMsg(`Fusión hecha: ${r.added} nuevos, ${r.updated} actualizados, ${r.skipped} sin cambios (ya teníamos la versión más reciente).`) }
            catch (err) { setImportMsg('No se pudo importar: ' + (err as Error).message) }
            e.target.value = ''
          }} />
        </div>
        {importMsg && <p className="small" style={{ marginTop: '.5rem' }}>{importMsg}</p>}
        <p className="muted small">Importar nunca sobrescribe: se unen los registros por identificador y, si uno existe en los dos aparatos, gana el modificado más recientemente.</p>
      </Section>

      <Section title="2 · Informe para IA (Markdown)" open>
        <p className="small">Documento de texto ordenado (solo iniciales) con perfil y pautas, cronología día a día, tablas de analíticas con rangos, cambios de medicación y resumen numérico. Para subirlo al proyecto de análisis de Claude o llevarlo a consulta.</p>
        <Segmented options={[{ value: 'semana', label: 'Última semana' }, { value: 'mes', label: 'Último mes' }, { value: 'todo', label: 'Todo' }, { value: 'otro', label: 'Fechas…' }]} value={range} onChange={(v) => pickRange(v ?? 'semana')} />
        {range === 'otro' && (
          <div className="grid2" style={{ marginTop: '.4rem' }}>
            <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        )}
        <button className="btn" style={{ marginTop: '.5rem' }} onClick={() => { exportAiReport(from, to); toast('Informe exportado') }}>Exportar informe {from} → {to}</button>
      </Section>

      <Section title="3 · Tablas CSV (para hojas de cálculo o médicos)">
        <div className="chips">
          {counts.map(([t, n]) => <button key={t} className="chip" onClick={() => exportCsv(t)}>{TABLE_LABELS[t] ?? t} ({n})</button>)}
        </div>
        {counts.length === 0 && <div className="muted">Aún no hay datos.</div>}
      </Section>

      {isDemo && (
        <Section title="Acceso con PIN">
          <p className="small">{getPin() ? 'PIN activado. Se pide al abrir la app en este aparato.' : 'Sin PIN. Cualquiera que coja el teléfono puede abrir la app.'}</p>
          <div className="row">
            <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="4-6 cifras" value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, ''))} style={{ width: 140 }} />
            <button className="btn sm" disabled={pin1.length < 4} onClick={() => { setPin(pin1); setPin1(''); toast('PIN guardado') }}>Guardar PIN</button>
            {getPin() && <button className="btn sm ghost" onClick={() => { setPin(''); toast('PIN eliminado') }}>Quitar PIN</button>}
          </div>
        </Section>
      )}

      <Section title="Pruebas y mantenimiento">
        <p className="small">Registros guardados: <strong>{total}</strong>. Versión de la app <strong>{APP_VERSION}</strong> · esquema de datos v{SCHEMA_VERSION}.</p>
        <div className="row">
          <button className="btn secondary sm" onClick={async () => { if (confirm('Se añadirán datos INVENTADOS de ejemplo (14 días, ciclos, analíticas…). ¿Continuar?')) { await loadSampleData(); toast('Datos de ejemplo cargados') } }}>Cargar datos de ejemplo</button>
          {isDemo && <button className="btn danger sm" onClick={() => { if (confirm('¿Borrar TODOS los datos de este aparato?') && confirm('Segunda confirmación: esta acción no se puede deshacer si no has exportado una copia. ¿Borrar?')) { (backend as LocalBackend).reset(); location.reload() } }}>Borrar todo</button>}
        </div>
      </Section>
    </div>
  )
}
