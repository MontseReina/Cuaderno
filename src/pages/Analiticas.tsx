import { useMemo, useState } from 'react'
import { currentPatientId, remove, save, useRows } from '../store'
import type { LabPanel, LabResult, OrganTest } from '../store/types'
import { ANALYTES } from '../domain/catalogs'
import { fmtDate, todayStr } from '../domain/dates'
import { cycleContext } from '../domain/cycle'
import { Field, Section, Segmented } from '../components/ui'

type Flag = 'bajo' | 'alto' | 'ok'
const flagOf = (r: LabResult): Flag => (r.ref_low != null && r.value < r.ref_low ? 'bajo' : r.ref_high != null && r.value > r.ref_high ? 'alto' : 'ok')

export default function Analiticas() {
  const panels = useRows('lab_panels').sort((a, b) => b.date.localeCompare(a.date))
  const results = useRows('lab_results')
  const organ = useRows('organ_tests').sort((a, b) => b.date.localeCompare(a.date))
  const cycles = useRows('cycles')
  const [editing, setEditing] = useState<{ panel: Partial<LabPanel>; results: Partial<LabResult>[] } | null>(null)
  const [organEdit, setOrganEdit] = useState<Partial<OrganTest> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const byPanel = useMemo(() => {
    const m = new Map<string, LabResult[]>()
    for (const r of results) m.set(r.panel_id, [...(m.get(r.panel_id) ?? []), r])
    return m
  }, [results])
  const latest = panels[0]
  const previous = panels[1]
  const latestOut = latest ? (byPanel.get(latest.id) ?? []).filter((r) => flagOf(r) !== 'ok') : []
  const trend = (r: LabResult) => {
    if (!previous) return ''
    const p = (byPanel.get(previous.id) ?? []).find((x) => x.analyte === r.analyte)
    if (!p) return ''
    const towardsNormal = flagOf(r) === 'alto' ? r.value < p.value : r.value > p.value
    if (r.value === p.value) return '→ igual'
    return towardsNormal ? '↗ mejora' : '↘ empeora'
  }
  const series = (analyte: string) =>
    panels.slice().reverse().map((p) => ({ date: p.date, r: (byPanel.get(p.id) ?? []).find((x) => x.analyte === analyte) })).filter((x) => x.r)
  const label = (key: string) => ANALYTES.find((a) => a.key === key)?.label ?? key

  if (editing) return <PanelForm state={editing} onClose={() => setEditing(null)} />
  if (organEdit) return <OrganForm initial={organEdit} onClose={() => setOrganEdit(null)} />

  return (
    <div>
      <div className="row between">
        <h1>Analíticas y marcadores</h1>
        <button className="btn sm" onClick={() => setEditing({ panel: { date: todayStr(), context: 'rutina' }, results: [] })}>+ Analítica</button>
      </div>
      <p className="muted small">Los informes completos están en la carpeta del Drive; aquí se ve lo que está fuera de rango y su tendencia. Los rangos son los del laboratorio del hospital.</p>

      {latest && (
        <div className="card">
          <div className="row between">
            <strong>Última: {fmtDate(latest.date)}</strong>
            <span className="tag gray">{cycleContext(cycles, latest.date).cycle ? `D${cycleContext(cycles, latest.date).day}` : ''} {latest.context}</span>
          </div>
          {latestOut.length === 0 && <div className="muted">Todo dentro de rango.</div>}
          {latestOut.sort((a, b) => Math.abs(dev(b)) - Math.abs(dev(a))).map((r) => (
            <div className="item" key={r.id} onClick={() => setSelected(selected === r.analyte ? null : r.analyte)} style={{ cursor: 'pointer' }}>
              <div className="main">
                <div>
                  <span className={'tag ' + (flagOf(r) === 'alto' ? 'rojo' : 'ambar')}>{flagOf(r)}</span>
                  {label(r.analyte)}: <strong>{r.value}</strong> {r.unit} <span className="muted small">(ref. {r.ref_low ?? '—'}–{r.ref_high ?? '—'})</span>
                </div>
                <div className="meta">{trend(r)}</div>
                {selected === r.analyte && <Spark data={series(r.analyte)} />}
              </div>
            </div>
          ))}
          <button className="btn sm ghost" style={{ marginTop: '.5rem' }} onClick={() => setEditing({ panel: latest, results: byPanel.get(latest.id) ?? [] })}>Ver / editar completa</button>
        </div>
      )}

      <Section title="Curvas por analito">
        {ANALYTES.filter((a) => series(a.key).length > 0).map((a) => (
          <div key={a.key} style={{ marginBottom: '.6rem' }}>
            <div className="small"><strong>{a.label}</strong> <span className="muted">({a.unit})</span></div>
            <Spark data={series(a.key)} />
          </div>
        ))}
        {panels.length === 0 && <div className="muted">Sin analíticas aún.</div>}
      </Section>

      <Section title={`Historial (${panels.length})`}>
        {panels.map((p) => (
          <div className="item" key={p.id} onClick={() => setEditing({ panel: p, results: byPanel.get(p.id) ?? [] })} style={{ cursor: 'pointer' }}>
            <div className="main">
              <div>{fmtDate(p.date)} · {p.context}</div>
              <div className="meta">{(byPanel.get(p.id) ?? []).length} analitos · {(byPanel.get(p.id) ?? []).filter((r) => flagOf(r) !== 'ok').length} fuera de rango</div>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Pruebas de órgano (FEVI, audiometría, función tubular)" right={<button className="btn sm ghost" onClick={(e) => { e.preventDefault(); setOrganEdit({ type: 'fevi', date: todayStr() }) }}>+</button>}>
        {organ.length === 0 && <div className="muted">Sin pruebas registradas.</div>}
        {organ.map((o) => (
          <div className="item" key={o.id} onClick={() => setOrganEdit(o)} style={{ cursor: 'pointer' }}>
            <div className="main">
              <div>{{ fevi: 'FEVI / ecocardio', audiometria: 'Audiometría', tubular: 'Función tubular', otro: 'Otra' }[o.type]} · {fmtDate(o.date)}</div>
              <div className="meta">{o.result}{o.next_date ? ` · siguiente ${fmtDate(o.next_date)}` : ''}</div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  )
}

function dev(r: LabResult) {
  if (r.ref_low != null && r.value < r.ref_low) return (r.value - r.ref_low) / (r.ref_low || 1)
  if (r.ref_high != null && r.value > r.ref_high) return (r.value - r.ref_high) / (r.ref_high || 1)
  return 0
}

function Spark({ data }: { data: { date: string; r?: LabResult }[] }) {
  const vals = data.map((d) => d.r!.value)
  const max = Math.max(...vals, ...data.map((d) => d.r!.ref_high ?? 0))
  const min = Math.min(...vals, ...data.map((d) => d.r!.ref_low ?? Infinity), 0)
  const range = max - min || 1
  return (
    <div>
      <div className="spark">
        {data.map((d, i) => (
          <span key={i} className={flagOf(d.r!) !== 'ok' ? 'out' : ''} style={{ height: `${Math.max(4, ((d.r!.value - min) / range) * 40)}px` }} title={`${fmtDate(d.date)}: ${d.r!.value}`} />
        ))}
      </div>
      <div className="muted small">{data.map((d) => `${d.date.slice(5)}: ${d.r!.value}`).join(' · ')}</div>
    </div>
  )
}

function PanelForm({ state, onClose }: { state: { panel: Partial<LabPanel>; results: Partial<LabResult>[] }; onClose: () => void }) {
  const [panel, setPanel] = useState(state.panel)
  const [rows, setRows] = useState<Partial<LabResult>[]>(state.results.length ? state.results : [{ analyte: '' }])
  const setRow = (i: number, patch: Partial<LabResult>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <div>
      <div className="row between">
        <h1>{panel.id ? 'Analítica' : 'Nueva analítica'}</h1>
        <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
      </div>
      <div className="card">
        <div className="grid2">
          <Field label="Fecha"><input type="date" value={panel.date ?? ''} onChange={(e) => setPanel({ ...panel, date: e.target.value })} /></Field>
          <Field label="Laboratorio"><input type="text" value={panel.lab_name ?? ''} onChange={(e) => setPanel({ ...panel, lab_name: e.target.value })} /></Field>
        </div>
        <Field label="Contexto">
          <Segmented options={[{ value: 'rutina', label: 'Rutina' }, { value: 'pre_ciclo', label: 'Pre-ciclo' }, { value: 'ingreso', label: 'Ingreso' }, { value: 'urgencia', label: 'Urgencia' }, { value: 'otro', label: 'Otro' }]} value={panel.context} onChange={(v) => setPanel({ ...panel, context: v ?? undefined })} />
        </Field>
        <Field label="Notas / nombre del archivo en el Drive"><input type="text" value={panel.notes ?? ''} onChange={(e) => setPanel({ ...panel, notes: e.target.value })} /></Field>
      </div>
      <div className="card">
        <h3>Resultados</h3>
        <p className="muted small">Escribe solo los que te interesen (o todos los fuera de rango). Rango de referencia: el que aparece en el informe.</p>
        {rows.map((r, i) => {
          const def = ANALYTES.find((a) => a.key === r.analyte)
          return (
            <div key={i} className="card tight" style={{ marginBottom: '.4rem' }}>
              <div className="row">
                <select style={{ flex: 2 }} value={ANALYTES.some((a) => a.key === r.analyte) ? r.analyte : r.analyte ? '__custom' : ''} onChange={(e) => setRow(i, { analyte: e.target.value === '__custom' ? 'otro' : e.target.value, unit: ANALYTES.find((a) => a.key === e.target.value)?.unit ?? r.unit })}>
                  <option value="">Analito…</option>
                  {ANALYTES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                  <option value="__custom">Otro (escribir)</option>
                </select>
                {!def && r.analyte && <input type="text" style={{ flex: 2 }} placeholder="nombre" value={r.analyte === 'otro' ? '' : r.analyte} onChange={(e) => setRow(i, { analyte: e.target.value })} />}
                <button className="btn sm ghost" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>✕</button>
              </div>
              <div className="grid3" style={{ marginTop: '.3rem' }}>
                <input type="number" inputMode="decimal" step="any" placeholder="valor" value={r.value ?? ''} onChange={(e) => setRow(i, { value: e.target.value === '' ? undefined : Number(e.target.value) })} />
                <input type="number" inputMode="decimal" step="any" placeholder="ref. mín" value={r.ref_low ?? ''} onChange={(e) => setRow(i, { ref_low: e.target.value === '' ? null : Number(e.target.value) })} />
                <input type="number" inputMode="decimal" step="any" placeholder="ref. máx" value={r.ref_high ?? ''} onChange={(e) => setRow(i, { ref_high: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
              <input type="text" placeholder="unidad" value={r.unit ?? ''} onChange={(e) => setRow(i, { unit: e.target.value })} style={{ marginTop: '.3rem' }} />
            </div>
          )
        })}
        <button className="btn sm secondary" onClick={() => setRows((r) => [...r, { analyte: '' }])}>+ Analito</button>
      </div>
      <div className="row">
        <button
          className="btn"
          disabled={!panel.date}
          onClick={async () => {
            const saved = await save('lab_panels', { ...panel, patient_id: currentPatientId() } as LabPanel)
            for (const r of rows) {
              if (!r.analyte || r.value == null) continue
              await save('lab_results', { ...r, panel_id: saved.id, patient_id: currentPatientId() } as LabResult)
            }
            onClose()
          }}
        >
          Guardar
        </button>
        {panel.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar esta analítica?')) { await remove('lab_panels', panel.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}

function OrganForm({ initial, onClose }: { initial: Partial<OrganTest>; onClose: () => void }) {
  const [o, setO] = useState(initial)
  return (
    <div>
      <div className="row between"><h1>Prueba de órgano</h1><button className="btn sm ghost" onClick={onClose}>Cancelar</button></div>
      <div className="card">
        <Field label="Tipo"><Segmented options={[{ value: 'fevi', label: 'FEVI / eco' }, { value: 'audiometria', label: 'Audiometría' }, { value: 'tubular', label: 'Función tubular' }, { value: 'otro', label: 'Otra' }]} value={o.type} onChange={(v) => setO({ ...o, type: v ?? 'otro' })} /></Field>
        <div className="grid2">
          <Field label="Fecha"><input type="date" value={o.date ?? ''} onChange={(e) => setO({ ...o, date: e.target.value })} /></Field>
          <Field label="Siguiente prevista" hint="Se crea el aviso en el calendario"><input type="date" value={o.next_date ?? ''} onChange={(e) => setO({ ...o, next_date: e.target.value || null })} /></Field>
        </div>
        <Field label="Resultado"><input type="text" value={o.result ?? ''} onChange={(e) => setO({ ...o, result: e.target.value })} placeholder="p. ej. FEVI 62 %" /></Field>
        <Field label="Notas"><textarea value={o.notes ?? ''} onChange={(e) => setO({ ...o, notes: e.target.value })} /></Field>
      </div>
      <button className="btn" disabled={!o.date} onClick={async () => {
        await save('organ_tests', { ...o, patient_id: currentPatientId() } as OrganTest)
        if (o.next_date) await save('calendar_events', { patient_id: currentPatientId(), type: 'prueba', title: `Prueba: ${{ fevi: 'FEVI / eco', audiometria: 'audiometría', tubular: 'función tubular', otro: 'otra' }[o.type ?? 'otro']}`, start_at: o.next_date + 'T09:00', all_day: true, status: 'previsto' })
        onClose()
      }}>Guardar</button>
    </div>
  )
}
