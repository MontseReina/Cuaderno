import { useState } from 'react'
import { currentPatientId, remove, save, useRows } from '../store'
import type { MicrobiomeTest } from '../store/types'
import { fmtDate, todayStr } from '../domain/dates'
import { Field, Section } from '../components/ui'

const SUGGESTED = ['Diversidad (Shannon)', 'Firmicutes/Bacteroidetes', 'Akkermansia muciniphila', 'Faecalibacterium prausnitzii', 'Bifidobacterium', 'Lactobacillus', 'Escherichia coli', 'Candida', 'Parásitos', 'Calprotectina', 'Zonulina', 'IgA secretora', 'Butirato / AGCC', 'pH fecal']

export default function Microbiota() {
  const tests = useRows('microbiome_tests').sort((a, b) => b.date.localeCompare(a.date))
  const [editing, setEditing] = useState<Partial<MicrobiomeTest> | null>(null)
  const antibiotics = useRows('products', (p) => p.block === 'alopatico' && /antibi|amoxi|cefta|mero|vanco|cipro|clinda|azitro|piper|tazo/i.test(p.name + ' ' + (p.composition ?? '')))

  if (editing) return <TestForm initial={editing} onClose={() => setEditing(null)} />

  const names = Array.from(new Set(tests.flatMap((t) => t.results.map((r) => r.name))))
  return (
    <div>
      <div className="row between">
        <h1>Microbiota</h1>
        <button className="btn sm" onClick={() => setEditing({ date: todayStr(), results: SUGGESTED.slice(0, 6).map((n) => ({ name: n, value: '' })) })}>+ Test de heces</button>
      </div>
      <p className="muted small">La función digestiva diaria está en el Registro diario y los antibióticos en Medicación. Aquí solo van los tests y su comparación.</p>
      {antibiotics.length > 0 && <div className="notice">Antibióticos en la pauta (afectan a la microbiota): {antibiotics.map((a) => `${a.name}${a.start_date ? ` desde ${a.start_date}` : ''}${a.end_date ? ` hasta ${a.end_date}` : ''}`).join(' · ')}</div>}
      {tests.length === 0 && <div className="empty">Sin tests registrados.</div>}
      {tests.length >= 1 && (
        <Section title="Comparativa test a test" open>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Parámetro</th>{tests.slice().reverse().map((t) => <th key={t.id}>{t.date.slice(5)}</th>)}</tr></thead>
              <tbody>
                {names.map((n) => (
                  <tr key={n}><td>{n}</td>{tests.slice().reverse().map((t) => { const r = t.results.find((x) => x.name === n); return <td key={t.id}>{r ? <span className={r.flag && r.flag !== 'normal' ? 'tag ' + (r.flag === 'alto' ? 'rojo' : 'ambar') : ''}>{r.value} {r.unit ?? ''}</span> : '—'}</td> })}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {tests.map((t) => (
        <div className="card tight" key={t.id} onClick={() => setEditing(t)} style={{ cursor: 'pointer', marginBottom: '.4rem' }}>
          <strong>{fmtDate(t.date)}</strong> <span className="muted small">{t.lab_name} {t.test_type}</span>
          <div className="small">{t.results.filter((r) => r.flag && r.flag !== 'normal').map((r) => `${r.name}: ${r.flag}`).join(' · ') || 'Sin alteraciones marcadas'}</div>
        </div>
      ))}
    </div>
  )
}

function TestForm({ initial, onClose }: { initial: Partial<MicrobiomeTest>; onClose: () => void }) {
  const [t, setT] = useState<Partial<MicrobiomeTest>>(initial)
  const rows = t.results ?? []
  const setRow = (i: number, patch: Partial<MicrobiomeTest['results'][number]>) => setT({ ...t, results: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  return (
    <div>
      <div className="row between"><h1>Test de heces</h1><button className="btn sm ghost" onClick={onClose}>Cancelar</button></div>
      <div className="card">
        <div className="grid3">
          <Field label="Fecha"><input type="date" value={t.date ?? ''} onChange={(e) => setT({ ...t, date: e.target.value })} /></Field>
          <Field label="Laboratorio"><input type="text" value={t.lab_name ?? ''} onChange={(e) => setT({ ...t, lab_name: e.target.value })} /></Field>
          <Field label="Tipo de test"><input type="text" value={t.test_type ?? ''} onChange={(e) => setT({ ...t, test_type: e.target.value })} /></Field>
        </div>
        <h3>Resultados</h3>
        {rows.map((r, i) => (
          <div key={i} className="card tight" style={{ marginBottom: '.3rem' }}>
            <div className="row">
              <input type="text" list="mbnames" placeholder="parámetro" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} style={{ flex: 2 }} />
              <input type="text" placeholder="valor" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} style={{ flex: 1 }} />
              <input type="text" placeholder="unidad" value={r.unit ?? ''} onChange={(e) => setRow(i, { unit: e.target.value })} style={{ width: 70 }} />
              <select style={{ width: 'auto' }} value={r.flag ?? ''} onChange={(e) => setRow(i, { flag: (e.target.value || undefined) as never })}>
                <option value="">—</option><option value="bajo">Bajo</option><option value="normal">Normal</option><option value="alto">Alto</option>
              </select>
              <button className="btn sm ghost" onClick={() => setT({ ...t, results: rows.filter((_, j) => j !== i) })}>✕</button>
            </div>
          </div>
        ))}
        <datalist id="mbnames">{SUGGESTED.map((n) => <option key={n} value={n} />)}</datalist>
        <button className="btn sm secondary" onClick={() => setT({ ...t, results: [...rows, { name: '', value: '' }] })}>+ Parámetro</button>
        <Field label="Notas / nombre del PDF en el Drive"><textarea value={t.notes ?? ''} onChange={(e) => setT({ ...t, notes: e.target.value })} /></Field>
      </div>
      <div className="row">
        <button className="btn" disabled={!t.date} onClick={async () => { await save('microbiome_tests', { ...t, results: rows.filter((r) => r.name.trim()), patient_id: currentPatientId() } as MicrobiomeTest); onClose() }}>Guardar</button>
        {t.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar?')) { await remove('microbiome_tests', t.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
