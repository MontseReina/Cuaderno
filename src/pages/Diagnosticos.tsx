import { useState } from 'react'
import { backend, currentPatientId, remove, save, useRows } from '../store'
import type { Diagnosis, DiagnosisKind, DiagnosisStatus, Finding, Patient } from '../store/types'
import { fmtDate, todayStr } from '../domain/dates'
import { Field, Section, Segmented } from '../components/ui'
import { DX_SIGNS_GENERIC, suggestSigns } from '../domain/catalogs'

const KINDS: { value: DiagnosisKind; label: string }[] = [
  { value: 'principal', label: 'Principal' }, { value: 'metastasis', label: 'Metástasis' }, { value: 'complicacion', label: 'Complicación' }, { value: 'infeccion', label: 'Infección' }, { value: 'otro', label: 'Otro' },
]
const STATUS: { value: DiagnosisStatus; label: string }[] = [
  { value: 'activo', label: 'Activo' }, { value: 'resuelto', label: 'Resuelto' },
]
const statusOf = (d: { status: string }): DiagnosisStatus => (d.status === 'resuelto' ? 'resuelto' : 'activo')

export default function Diagnosticos() {
  const dxs = useRows('diagnoses').sort((a, b) => b.date.localeCompare(a.date))
  const [editing, setEditing] = useState<Partial<Diagnosis> | null>(null)
  const patient = backend.all('patients')[0]
  const [showProto, setShowProto] = useState(false)

  if (editing) return <DxForm initial={editing} onClose={() => setEditing(null)} />

  return (
    <div>
      <div className="row between">
        <h1>Diagnósticos y evolución</h1>
        <button className="btn sm" onClick={() => setEditing({ kind: 'otro', status: 'activo', date: todayStr(), watch_signs: [], evolution: [] })}>+ Diagnóstico</button>
      </div>
      {dxs.length === 0 && <div className="empty">Sin diagnósticos registrados. Añade el principal y los que vayan apareciendo.</div>}
      {dxs.map((d) => (
        <div className="card" key={d.id} onClick={() => setEditing(d)} style={{ cursor: 'pointer' }}>
          <div className="row between">
            <strong>{d.name}</strong>
            <span className={'tag ' + (statusOf(d) === 'activo' ? 'rojo' : 'verde')}>{STATUS.find((s) => s.value === statusOf(d))?.label}</span>
          </div>
          <div className="muted small">{KINDS.find((k) => k.value === d.kind)?.label} · {fmtDate(d.date)}{d.confirmed_by ? ` · confirmado por ${d.confirmed_by}` : ''}</div>
          {d.watch_signs.length > 0 && <div className="small">Vigilar: {d.watch_signs.join(', ')}</div>}
          {(d.findings ?? []).filter((f) => f.name && f.size_mm != null).length > 0 && (
            <div className="small">
              {Object.values((d.findings ?? []).filter((f) => f.name && f.size_mm != null).reduce<Record<string, Finding>>((acc, f) => {
                const k = f.name.toLowerCase() + '|' + (f.location ?? '').toLowerCase()
                if (!acc[k] || f.date > acc[k].date) acc[k] = f
                return acc
              }, {})).map((f) => `${f.name}${f.location ? ` (${f.location})` : ''}: ${String(f.size_mm).replace('.', ',')} mm el ${fmtDate(f.date)}`).join(' · ')}
            </div>
          )}
          {d.evolution.length > 0 && <div className="small muted">Última nota: {fmtDate(d.evolution[d.evolution.length - 1].date)} — {d.evolution[d.evolution.length - 1].text.slice(0, 80)}</div>}
        </div>
      ))}

      <Section title="Datos del protocolo (se rellenan cuando lleguen)" open={showProto}>
        <ProtocolForm patient={patient} onOpen={() => setShowProto(true)} />
      </Section>
    </div>
  )
}

function ProtocolForm({ patient, onOpen }: { patient: Patient | undefined; onOpen: () => void }) {
  const [p, setP] = useState<Partial<Patient>>(patient ?? {})
  if (!patient) return null
  return (
    <div onFocus={onOpen}>
      <div className="grid2">
        <Field label="Protocolo"><input type="text" value={p.protocol ?? ''} onChange={(e) => setP({ ...p, protocol: e.target.value })} /></Field>
        <Field label="Brazo"><input type="text" value={p.arm ?? ''} onChange={(e) => setP({ ...p, arm: e.target.value })} placeholder="pendiente" /></Field>
        <Field label="Pgp / ABCB1"><input type="text" value={p.pgp ?? ''} onChange={(e) => setP({ ...p, pgp: e.target.value })} placeholder="pendiente" /></Field>
        <Field label="% necrosis (Huvos)"><input type="number" value={p.necrosis_pct ?? ''} onChange={(e) => setP({ ...p, necrosis_pct: e.target.value === '' ? null : Number(e.target.value) })} placeholder="pendiente" /></Field>
      </div>
      <button className="btn sm secondary" onClick={() => save('patients', { ...patient, ...p } as never)}>Guardar datos del protocolo</button>
    </div>
  )
}

function DxForm({ initial, onClose }: { initial: Partial<Diagnosis>; onClose: () => void }) {
  const [d, setD] = useState<Partial<Diagnosis>>({ ...initial, status: initial.status === 'resuelto' ? 'resuelto' : 'activo' })
  const [sign, setSign] = useState('')
  const suggested = suggestSigns(d.name ?? '')
  const pending = suggested.filter((x) => !(d.watch_signs ?? []).includes(x))
  const [note, setNote] = useState('')
  const set = <K extends keyof Diagnosis>(k: K, v: Diagnosis[K]) => setD((x) => ({ ...x, [k]: v }))
  return (
    <div>
      <div className="row between">
        <h1>{d.id ? d.name : 'Nuevo diagnóstico'}</h1>
        <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
      </div>
      <div className="card">
        <Field label="Diagnóstico" hint="Al escribirlo, se proponen solos los signos a vigilar (abajo)."><input type="text" value={d.name ?? ''} onChange={(e) => {
          const name = e.target.value
          const auto = suggestSigns(name)
          const oldAuto = suggestSigns(d.name ?? '')
          const manual = (d.watch_signs ?? []).filter((x) => !oldAuto.includes(x))
          setD((x) => ({ ...x, name, watch_signs: d.id ? x.watch_signs : Array.from(new Set([...auto, ...manual])) }))
        }} placeholder="p. ej. Osteosarcoma de fémur, Neutropenia febril, Mucositis…" /></Field>
        <Field label="Tipo"><Segmented options={KINDS} value={d.kind} onChange={(v) => set('kind', v ?? 'otro')} /></Field>
        <div className="grid2">
          <Field label="Fecha"><input type="date" value={d.date ?? ''} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Prueba o informe que lo confirma"><input type="text" value={d.confirmed_by ?? ''} onChange={(e) => set('confirmed_by', e.target.value)} placeholder="TAC, biopsia, eco…" /></Field>
        </div>
        <Field label="Estado"><Segmented options={STATUS} value={d.status} onChange={(v) => { set('status', v ?? 'activo'); set('status_date', todayStr()) }} /></Field>
        {d.status === 'resuelto' && d.status_date && <p className="muted small">Resuelto el {fmtDate(d.status_date)}. Sus signos dejan de aparecer en el Registro diario.</p>}
        <Field label="Tratamiento asociado (texto o referencia al ciclo / medicación)"><input type="text" value={d.treatment_ref ?? ''} onChange={(e) => set('treatment_ref', e.target.value)} /></Field>
        <Field label="Signos y síntomas a observar" hint="Mientras el diagnóstico esté activo, aparecen automáticamente en el checklist del Registro diario y cuentan como criterio rojo si son intensos.">
          <div className="row">
            <input type="text" value={sign} onChange={(e) => setSign(e.target.value)} placeholder="p. ej. dificultad para respirar" style={{ flex: 1 }} />
            <button className="btn sm secondary" type="button" disabled={!sign.trim()} onClick={() => { set('watch_signs', [...(d.watch_signs ?? []), sign.trim()]); setSign('') }}>Añadir</button>
          </div>
          <div className="chips" style={{ marginTop: '.4rem' }}>
            {(d.watch_signs ?? []).map((s) => (
              <button key={s} type="button" className="chip on" onClick={() => set('watch_signs', (d.watch_signs ?? []).filter((x) => x !== s))}>{s} ✕</button>
            ))}
          </div>
          {(pending.length > 0 || (suggested.length === 0 && (d.watch_signs ?? []).length === 0 && (d.name ?? '').length > 2)) && (
            <div className="muted small" style={{ marginTop: '.4rem' }}>
              Sugeridos{suggested.length === 0 ? ' (generales)' : ''}:{' '}
              {(pending.length ? pending : DX_SIGNS_GENERIC.filter((x) => !(d.watch_signs ?? []).includes(x))).map((x) => (
                <button key={x} type="button" className="chip" style={{ margin: '.15rem' }} onClick={() => set('watch_signs', [...(d.watch_signs ?? []), x])}>+ {x}</button>
              ))}
            </div>
          )}
        </Field>
      </div>
      <div className="card">
        <h3>Hallazgos medibles (del informe)</h3>
        <p className="muted small">Lo que se puede medir y comparar entre informes: nódulos, lesiones, adenopatías… Una fila por hallazgo y fecha. Cuando llegue el informe siguiente, se añade otra fila con la misma descripción y la app calcula sola la evolución.</p>
        <FindingsTable rows={d.findings ?? []} onChange={(rows) => set('findings', rows)} defaultDate={d.date ?? todayStr()} defaultSource={d.confirmed_by ?? ''} />
        <FindingsEvolution rows={d.findings ?? []} />
      </div>
      <div className="card">
        <h3>Evolución</h3>
        {(d.evolution ?? []).map((e, i) => (
          <div className="item" key={i}><div className="main"><div>{e.text}</div><div className="meta">{fmtDate(e.date)} · {e.by}</div></div></div>
        ))}
        <div className="row" style={{ marginTop: '.5rem' }}>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nueva nota de evolución" style={{ flex: 1 }} />
          <button className="btn sm secondary" type="button" disabled={!note.trim()} onClick={() => { set('evolution', [...(d.evolution ?? []), { date: todayStr(), text: note.trim(), by: backend.currentUserName() }]); setNote('') }}>Añadir</button>
        </div>
      </div>
      <div className="row">
        <button className="btn" disabled={!d.name?.trim() || !d.date} onClick={async () => { await save('diagnoses', { ...d, patient_id: currentPatientId() } as Diagnosis); onClose() }}>Guardar</button>
        {d.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar este diagnóstico?')) { await remove('diagnoses', d.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}

/** Tabla de hallazgos medibles: fecha · hallazgo · localización · tamaño (mm) · nº · informe. */
function FindingsTable({ rows, onChange, defaultDate, defaultSource }: {
  rows: Finding[]
  onChange: (rows: Finding[]) => void
  defaultDate: string
  defaultSource: string
}) {
  const set = (i: number, patch: Partial<Finding>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="table-wrap">
      <table className="table medtable">
        <thead><tr><th>Fecha</th><th>Hallazgo</th><th>Localización</th><th>Tamaño (mm)</th><th>Nº</th><th>Informe</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input type="date" value={r.date ?? ''} onChange={(e) => set(i, { date: e.target.value })} /></td>
              <td><input type="text" list="findingnames" value={r.name ?? ''} onChange={(e) => set(i, { name: e.target.value })} placeholder="Nódulo pulmonar" /></td>
              <td><input type="text" value={r.location ?? ''} onChange={(e) => set(i, { location: e.target.value })} placeholder="lóbulo sup. derecho" /></td>
              <td><input type="number" inputMode="decimal" step="0.1" min={0} value={r.size_mm ?? ''} onChange={(e) => set(i, { size_mm: e.target.value === '' ? null : Number(e.target.value) })} style={{ minWidth: '4.5rem' }} /></td>
              <td><input type="number" inputMode="numeric" min={0} value={r.count ?? ''} onChange={(e) => set(i, { count: e.target.value === '' ? null : Number(e.target.value) })} style={{ minWidth: '3.5rem' }} /></td>
              <td><input type="text" value={r.source ?? ''} onChange={(e) => set(i, { source: e.target.value })} placeholder="TAC" /></td>
              <td><button type="button" className="btn sm ghost" title="Quitar" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="findingnames">{Array.from(new Set(rows.map((r) => r.name).filter(Boolean))).map((n) => <option key={n} value={n} />)}</datalist>
      <div className="row">
        <button type="button" className="btn sm secondary" onClick={() => onChange([...rows, { date: defaultDate, name: '', source: defaultSource }])}>+ Añadir hallazgo</button>
        {rows.length > 0 && (
          <button type="button" className="btn sm ghost" title="Copiar los hallazgos del último informe con la fecha de hoy para poner las medidas nuevas" onClick={() => {
            const last = rows.reduce((acc, r) => (r.date > acc ? r.date : acc), rows[0].date)
            const copia = rows.filter((r) => r.date === last).map((r) => ({ ...r, date: todayStr(), size_mm: null, source: '' }))
            onChange([...rows, ...copia])
          }}>Repetir hallazgos del último informe</button>
        )}
      </div>
    </div>
  )
}

/** Agrupa por hallazgo + localización y muestra la evolución del tamaño entre informes. */
function FindingsEvolution({ rows }: { rows: Finding[] }) {
  const conDatos = rows.filter((r) => r.name?.trim() && r.date)
  if (conDatos.length < 2) return null
  const grupos = new Map<string, Finding[]>()
  for (const r of conDatos) {
    const k = `${r.name.trim().toLowerCase()}|${(r.location ?? '').trim().toLowerCase()}`
    grupos.set(k, [...(grupos.get(k) ?? []), r])
  }
  const lineas = Array.from(grupos.values())
    .map((g) => g.slice().sort((a, b) => a.date.localeCompare(b.date)))
    .filter((g) => g.length > 1)
  if (!lineas.length) return null
  return (
    <div style={{ marginTop: '.6rem' }}>
      <h3>Evolución de los hallazgos</h3>
      {lineas.map((g) => {
        const medidos = g.filter((r) => r.size_mm != null)
        const primero = medidos[0]
        const ultimo = medidos[medidos.length - 1]
        const delta = medidos.length > 1 ? Math.round((ultimo.size_mm! - primero.size_mm!) * 10) / 10 : null
        const tag = delta == null ? '' : delta < 0 ? 'verde' : delta > 0 ? 'rojo' : 'gray'
        return (
          <div className="item" key={g[0].name + (g[0].location ?? '')}>
            <div className="main">
              <div>
                <strong>{g[0].name}</strong>{g[0].location ? ` · ${g[0].location}` : ''}
                {delta != null && <span className={'tag ' + tag} style={{ marginLeft: '.4rem' }}>{delta > 0 ? '+' : ''}{delta.toString().replace('.', ',')} mm</span>}
              </div>
              <div className="meta">
                {g.map((r) => `${r.size_mm != null ? r.size_mm.toString().replace('.', ',') + ' mm' : 'sin medida'} (${fmtDate(r.date)}${r.source ? `, ${r.source}` : ''})`).join('  →  ')}
              </div>
            </div>
          </div>
        )
      })}
      <p className="muted small">Verde = ha disminuido, rojo = ha aumentado. Es solo la comparación de lo que se ha escrito; la interpretación la hace el equipo.</p>
    </div>
  )
}
