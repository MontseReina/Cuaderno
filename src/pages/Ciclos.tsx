import { useEffect, useState } from 'react'
import { currentPatientId, remove, save, useRows } from '../store'
import type { Cycle, Drug, MedRow } from '../store/types'
import { DRUG_LABELS, DRUG_WATCH, NAUSEA_LABELS, ROUTE_LABELS } from '../domain/catalogs'
import { cumulativeDoses, DOSE_THRESHOLDS } from '../domain/cycle'
import { fmtDate, fmtWall, hoursBetween, toLocalInput, todayStr } from '../domain/dates'
import { Check, Field, MedTable, Section, Segmented, type MedColumn } from '../components/ui'

const DRUGS: Drug[] = ['MTX', 'CDDP', 'ADM', 'HDIFO', 'MTP', 'OTRO']

/** Un ciclo agrupa el metotrexato y el cisplatino + adriamicina de la misma tanda
 *  (ciclo 1 = semanas 0 y 1, ciclo 2 = semanas 4 y 5). Por eso el número solo sube
 *  cuando empieza un metotrexato nuevo después de un cisplatino + adriamicina.
 *  Después de la cirugía habrá que revisarlo: el tratamiento puede cambiar según
 *  el porcentaje de necrosis. */
function suggestNumber(cycles: Cycle[], c: Partial<Cycle>) {
  const prev = cycles
    .filter((x) => x.id !== c.id && x.planned_date <= (c.planned_date ?? '9999-99-99'))
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
    .pop()
  if (!prev) return 1
  const empiezaTanda = (c.drugs ?? []).includes('MTX') && !(prev.drugs ?? []).includes('MTX')
  return empiezaTanda ? (prev.number ?? 0) + 1 : (prev.number ?? 1)
}


export default function Ciclos() {
  const cycles = useRows('cycles').sort((a, b) => b.planned_date.localeCompare(a.planned_date))
  const [editing, setEditing] = useState<Partial<Cycle> | null>(null)
  const acc = cumulativeDoses(cycles)

  if (editing) return <CycleForm initial={editing} cycles={cycles} onClose={() => setEditing(null)} />

  return (
    <div>
      <div className="row between">
        <h1>Tratamiento y ciclos</h1>
        <button className="btn sm" onClick={() => setEditing({ drugs: [], planned_date: todayStr(), corticoid_iv: false })}>+ Ciclo</button>
      </div>
      {Object.keys(acc).length > 0 && (
        <div className="card tight accent">
          <strong>Dosis acumulada</strong>
          {Object.entries(acc).map(([d, v]) => {
            const th = DOSE_THRESHOLDS[d]
            return (
              <div key={d} className="small">
                {DRUG_LABELS[d] ?? d}: <strong>{v} mg/m²</strong>
                {th && v >= th.warn && <span className="tag ambar" style={{ marginLeft: '.4rem' }}>{th.label}</span>}
              </div>
            )
          })}
        </div>
      )}
      {cycles.length === 0 && <div className="empty">Aún no hay ciclos. Añade el primero con la fecha prevista; el resto se completa durante el ingreso.</div>}
      {cycles.map((c) => (
        <div className="card" key={c.id} onClick={() => setEditing(c)} style={{ cursor: 'pointer' }}>
          <div className="row between">
            <strong>Ciclo {c.number} · {c.drugs.map((d) => DRUG_LABELS[d] ?? d).join(' + ')}</strong>
            {c.corticoid_iv && <span className="tag ambar">corticoide IV</span>}
          </div>
          <div className="muted small">
            Previsto {fmtDate(c.planned_date)}
            {c.start_at && ` · Inicio ${fmtWall(c.start_at)}`}
            {c.end_at && ` · Fin ${fmtWall(c.end_at)}`}
            {c.delay_days ? ` · Retraso ${c.delay_days} d (${c.delay_reason || 'sin motivo'})` : c.delay_days === 0 ? ' · Sin retraso' : ''}
          </div>
          {c.actual_dose && <div className="small">Dosis real: {c.actual_dose}</div>}
          {c.rescue?.substance && <div className="small">Rescate: {c.rescue.substance} {c.rescue.start ? `desde ${fmtWall(c.rescue.start)}` : ''} {c.rescue.end ? `hasta ${fmtWall(c.rescue.end)}` : '(en curso)'}</div>}
        </div>
      ))}
    </div>
  )
}

const COLS_BASIC: MedColumn[] = [{ key: 'name', label: 'Medicamento' }, { key: 'mg', label: 'mg' }, { key: 'posology', label: 'Posología' }, { key: 'reason', label: 'Motivo' }]
const COLS_ANTIEMETIC: MedColumn[] = [{ key: 'name', label: 'Medicamento' }, { key: 'mg', label: 'mg' }, { key: 'posology', label: 'Posología' }, { key: 'nausea', label: 'Intensidad de náusea' }, { key: 'sufficient', label: '¿Fue suficiente?' }]
const COLS_BETWEEN: MedColumn[] = [{ key: 'name', label: 'Medicamento' }, { key: 'route', label: 'Vía' }, { key: 'mg', label: 'mg' }, { key: 'posology', label: 'Posología' }, { key: 'reason', label: 'Motivo' }]

function renderMedCell(r: MedRow, key: MedColumn['key'], set: (p: Partial<MedRow>) => void) {
  switch (key) {
    case 'route':
      return (
        <select value={r.route ?? ''} onChange={(e) => set({ route: (e.target.value || undefined) as MedRow['route'] })}>
          <option value="">Vía…</option>
          {Object.entries(ROUTE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      )
    case 'nausea':
      return (
        <select value={r.nausea ?? ''} onChange={(e) => set({ nausea: (e.target.value === '' ? undefined : Number(e.target.value)) as MedRow['nausea'] })}>
          <option value="">—</option>
          {NAUSEA_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
        </select>
      )
    case 'sufficient':
      return (
        <select value={r.sufficient ?? ''} onChange={(e) => set({ sufficient: (e.target.value || undefined) as MedRow['sufficient'] })}>
          <option value="">—</option>
          <option value="si">Sí</option>
          <option value="parcial">Parcialmente</option>
          <option value="no">No</option>
        </select>
      )
    default:
      return <input type="text" value={r[key] ?? ''} onChange={(e) => set({ [key]: e.target.value } as Partial<MedRow>)} placeholder={key === 'mg' ? 'mg' : ''} inputMode={key === 'mg' ? 'decimal' : undefined} />
  }
}
/** Ciclos guardados con la versión anterior (campos de texto) → filas. */
function legacyAntiemetic(c: Partial<Cycle>): MedRow[] {
  if (!c.antiemetic?.drug) return []
  return [{ name: c.antiemetic.drug, posology: c.antiemetic.scheme, sufficient: c.antiemetic.sufficient }]
}
function legacyBetween(c: Partial<Cycle>): MedRow[] {
  const o = c.other_meds ?? {}
  const rows: MedRow[] = []
  if (o.oral_alopatico) rows.push({ name: o.oral_alopatico, route: 'oral' })
  if (o.oral_suplemento) rows.push({ name: o.oral_suplemento, route: 'oral' })
  if (o.iv) rows.push({ name: o.iv, route: 'iv' })
  return rows
}

function CycleForm({ initial, cycles, onClose }: { initial: Partial<Cycle>; cycles: Cycle[]; onClose: () => void }) {
  const [c, setC] = useState<Partial<Cycle>>({ drugs: [], corticoid_iv: false, rescue: {}, antiemetic: {}, other_meds: {}, drug_watch: {}, actual_dose_mg_m2: {}, ...initial })
  const set = <K extends keyof Cycle>(k: K, v: Cycle[K]) => setC((x) => ({ ...x, [k]: v }))
  // En un ciclo nuevo el número se propone solo contando por medicamento; se puede corregir a mano.
  const [numeroAMano, setNumeroAMano] = useState(false)
  const drugsKey = (c.drugs ?? []).join('+')
  useEffect(() => {
    if (initial.id || numeroAMano) return
    setC((x) => {
      const n = suggestNumber(cycles, x)
      return x.number === n ? x : { ...x, number: n }
    })
  }, [drugsKey, c.planned_date, initial.id, numeroAMano, cycles])
  const fasting = hoursBetween(c.fasting_last_meal_at, c.start_at)
  const hasCorticoRow = /dexametasona|metilpred|hidrocortisona|prednis|corticoide/i.test((c.other_meds?.infusion ?? []).map((m) => m.name).join(' '))
  const delay = c.start_at && c.planned_date ? Math.max(0, Math.round((new Date(toLocalInput(c.start_at)).getTime() - new Date(c.planned_date.slice(0, 10) + 'T00:00').getTime()) / 86400000)) : null

  return (
    <div>
      <div className="row between">
        <h1>{c.id ? `Ciclo ${c.number}` : 'Nuevo ciclo'}</h1>
        <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
      </div>
      <Section title="Quimioterápico" open>
        <div className="grid2">
          <Field label="Nº de ciclo" hint="Un ciclo agrupa el metotrexato y el cisplatino + adriamicina de la misma tanda">
            <input type="number" value={c.number ?? ''} onChange={(e) => { setNumeroAMano(true); set('number', Number(e.target.value)) }} />
          </Field>
          <Field label="Semana del protocolo"><input type="number" value={c.protocol_week ?? ''} onChange={(e) => set('protocol_week', e.target.value === '' ? null : Number(e.target.value))} /></Field>
        </div>
        <Field label="Fármacos">
          <div className="chips">
            {DRUGS.map((d) => (
              <button key={d} type="button" className={'chip ' + (c.drugs?.includes(d) ? 'on' : '')} onClick={() => set('drugs', c.drugs?.includes(d) ? c.drugs.filter((x) => x !== d) : [...(c.drugs ?? []), d])}>{DRUG_LABELS[d]}</button>
            ))}
          </div>
        </Field>
        <div className="grid2">
          <Field label="Fecha prevista"><input type="date" value={(c.planned_date ?? '').slice(0, 10)} onChange={(e) => set('planned_date', e.target.value)} /></Field>
          <Field label="Dosis prevista"><input type="text" value={c.planned_dose ?? ''} onChange={(e) => set('planned_dose', e.target.value)} placeholder="p. ej. 12 g/m²" /></Field>
          <Field label="Inicio real de la perfusión"><input type="datetime-local" value={toLocalInput(c.start_at)} onChange={(e) => set('start_at', e.target.value || null)} /></Field>
          <Field label="Fin de la perfusión"><input type="datetime-local" value={toLocalInput(c.end_at)} onChange={(e) => set('end_at', e.target.value || null)} /></Field>
        </div>
        <Field label="Dosis real (texto)"><input type="text" value={c.actual_dose ?? ''} onChange={(e) => set('actual_dose', e.target.value)} /></Field>
        {(c.drugs ?? []).filter((d) => d !== 'MTP' && d !== 'OTRO').length > 0 && (
          <Field label="Dosis real en mg/m² por fármaco (para el acumulado)">
            <div className="grid2">
              {(c.drugs ?? []).filter((d) => d !== 'MTP' && d !== 'OTRO').map((d) => (
                <label key={d} className="field"><span>{DRUG_LABELS[d]}</span>
                  <input type="number" inputMode="decimal" value={c.actual_dose_mg_m2?.[d] ?? ''} onChange={(e) => set('actual_dose_mg_m2', { ...(c.actual_dose_mg_m2 ?? {}), [d]: Number(e.target.value) })} />
                </label>
              ))}
            </div>
          </Field>
        )}
        {delay != null && delay > 0 && c.delay_days !== 0 && <div className="notice">Retraso respecto a lo previsto: <strong>{delay} días</strong></div>}
        <Field label="Retraso">
          <Segmented
            options={[{ value: 'no', label: 'Sin retraso' }, { value: 'si', label: 'Con retraso' }]}
            value={c.delay_days == null ? (delay ? 'si' : null) : c.delay_days === 0 ? 'no' : 'si'}
            onChange={(v) => { if (v === 'no') { set('delay_days', 0); set('delay_reason', '') } else if (v === 'si') set('delay_days', delay || 1); else set('delay_days', null) }}
          />
        </Field>
        {(c.delay_days ?? 0) > 0 && (
          <div className="grid2">
            <Field label="Días de retraso"><input type="number" min={1} value={c.delay_days ?? ''} onChange={(e) => set('delay_days', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            <Field label="Motivo del retraso"><input type="text" value={c.delay_reason ?? ''} onChange={(e) => set('delay_reason', e.target.value)} /></Field>
          </div>
        )}
        <div className="grid2">
          <Field label="Ingreso"><input type="datetime-local" value={toLocalInput(c.admission_at)} onChange={(e) => set('admission_at', e.target.value || null)} /></Field>
          <Field label="Alta"><input type="datetime-local" value={toLocalInput(c.discharge_at)} onChange={(e) => set('discharge_at', e.target.value || null)} /></Field>
        </div>
        <Field label="Última comida antes de la quimio" hint={fasting != null ? `Horas de ayuno: ${fasting} h` : 'Se calculan las horas de ayuno con el inicio de la perfusión'}>
          <input type="datetime-local" value={toLocalInput(c.fasting_last_meal_at)} onChange={(e) => set('fasting_last_meal_at', e.target.value || null)} />
        </Field>
      </Section>

      <Section title="Medicación durante la perfusión">
        <p className="muted small">Una fila por medicamento (hidratación, alcalinización, protectores, corticoide…). Cuando se pueda subir el informe en PDF, estas filas se rellenarán solas y se podrán corregir a mano.</p>
        <MedTable<MedRow>
          rows={c.other_meds?.infusion ?? []}
          onChange={(rows) => set('other_meds', { ...c.other_meds, infusion: rows })}
          columns={COLS_BASIC}
          render={renderMedCell}
        />
        {/^\s*$/.test(c.infusion_meds ?? '') ? null : <Field label="Texto libre anterior"><textarea value={c.infusion_meds ?? ''} onChange={(e) => set('infusion_meds', e.target.value)} /></Field>}
        <Check checked={!!c.corticoid_iv || hasCorticoRow} onChange={(v) => set('corticoid_iv', v)}><strong>Corticoide intravenoso</strong> (repercute en glucosa y sueño: se avisa en la portada)</Check>
        {(c.corticoid_iv || hasCorticoRow) && <Field label="Cuál, dosis, días"><input type="text" value={c.corticoid_detail ?? ''} onChange={(e) => set('corticoid_detail', e.target.value)} /></Field>}
        <h3>Protocolo antiemético</h3>
        <MedTable<MedRow>
          rows={c.antiemetic?.items ?? legacyAntiemetic(c)}
          onChange={(rows) => set('antiemetic', { ...c.antiemetic, items: rows })}
          columns={COLS_ANTIEMETIC}
          render={renderMedCell}
        />
      </Section>

      <Section title="Rescate">
        <div className="grid2">
          <Field label="Sustancia"><input type="text" value={c.rescue?.substance ?? ''} onChange={(e) => set('rescue', { ...c.rescue, substance: e.target.value })} placeholder="folinato (leucovorin)" /></Field>
          <Field label="Dosis"><input type="text" value={c.rescue?.dose ?? ''} onChange={(e) => set('rescue', { ...c.rescue, dose: e.target.value })} /></Field>
          <Field label="Posología"><input type="text" value={c.rescue?.posology ?? ''} onChange={(e) => set('rescue', { ...c.rescue, posology: e.target.value })} placeholder="cada 6 h…" /></Field>
          <Field label="Motivo"><input type="text" value={c.rescue?.reason ?? ''} onChange={(e) => set('rescue', { ...c.rescue, reason: e.target.value })} placeholder="rescate de metotrexato…" /></Field>
          <Field label="Inicio"><input type="datetime-local" value={toLocalInput(c.rescue?.start)} onChange={(e) => set('rescue', { ...c.rescue, start: e.target.value })} /></Field>
          <Field label="Cese"><input type="datetime-local" value={toLocalInput(c.rescue?.end)} onChange={(e) => set('rescue', { ...c.rescue, end: e.target.value })} /></Field>
        </div>
        {c.drugs?.includes('MTX') && (
          <div className="grid3">
            <Field label="MTX 24 h (µmol/L)"><input type="number" inputMode="decimal" step="0.01" value={c.rescue?.mtx24 ?? ''} onChange={(e) => set('rescue', { ...c.rescue, mtx24: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="MTX 48 h"><input type="number" inputMode="decimal" step="0.01" value={c.rescue?.mtx48 ?? ''} onChange={(e) => set('rescue', { ...c.rescue, mtx48: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="MTX 72 h"><input type="number" inputMode="decimal" step="0.01" value={c.rescue?.mtx72 ?? ''} onChange={(e) => set('rescue', { ...c.rescue, mtx72: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
          </div>
        )}
      </Section>

      <Section title="Medicamentos entre quimio y quimio">
        <p className="muted small">Lo que se da en casa o en hospital de día entre este ciclo y el siguiente. La suplementación fija va en <em>Medicación</em>.</p>
        <MedTable<MedRow>
          rows={c.other_meds?.between ?? legacyBetween(c)}
          onChange={(rows) => set('other_meds', { ...c.other_meds, between: rows })}
          columns={COLS_BETWEEN}
          render={renderMedCell}
        />
      </Section>

      {(c.drugs ?? []).some((d) => DRUG_WATCH[d]?.length) && (
        <Section title="Vigilancia específica por fármaco">
          {(c.drugs ?? []).filter((d) => DRUG_WATCH[d]?.length).map((d) => (
            <Field key={d} label={DRUG_LABELS[d]} hint={DRUG_WATCH[d].join(' · ')}>
              <textarea value={c.drug_watch?.[d] ?? ''} onChange={(e) => set('drug_watch', { ...(c.drug_watch ?? {}), [d]: e.target.value })} />
            </Field>
          ))}
        </Section>
      )}

      {c.drugs?.includes('MTP') && (
        <Section title="Mifamurtida" open>
          <Check checked={!!c.mtp?.given} onChange={(v) => set('mtp', { ...c.mtp, given: v })}>Dosis administrada</Check>
          <Field label="Reacción posinfusión (fiebre, escalofríos, cefalea, dolores musculares)"><input type="text" value={c.mtp?.reaction ?? ''} onChange={(e) => set('mtp', { ...c.mtp, reaction: e.target.value })} /></Field>
          <p className="muted small">Recordatorio: en neutropenia, la fiebre tras mifamurtida obliga igualmente a descartar infección.</p>
        </Section>
      )}
      <Field label="Notas"><textarea value={c.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      <div className="row">
        <button className="btn" disabled={!c.drugs?.length || !c.planned_date} onClick={async () => { await save('cycles', { ...c, patient_id: currentPatientId() } as Cycle); onClose() }}>Guardar</button>
        {c.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar este ciclo? Se puede recuperar desde el registro.')) { await remove('cycles', c.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
