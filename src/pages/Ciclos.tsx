import { useState } from 'react'
import { currentPatientId, remove, save, useRows } from '../store'
import type { Cycle, Drug } from '../store/types'
import { DRUG_LABELS, DRUG_WATCH } from '../domain/catalogs'
import { cumulativeDoses, DOSE_THRESHOLDS } from '../domain/cycle'
import { fmtDate, fmtDateTime, hoursBetween, todayStr } from '../domain/dates'
import { Check, Field, Section, Segmented } from '../components/ui'

const DRUGS: Drug[] = ['MTX', 'CDDP', 'ADM', 'HDIFO', 'MTP', 'OTRO']

export default function Ciclos() {
  const cycles = useRows('cycles').sort((a, b) => b.planned_date.localeCompare(a.planned_date))
  const [editing, setEditing] = useState<Partial<Cycle> | null>(null)
  const acc = cumulativeDoses(cycles)

  if (editing) return <CycleForm initial={editing} onClose={() => setEditing(null)} />

  return (
    <div>
      <div className="row between">
        <h1>Tratamiento y ciclos</h1>
        <button className="btn sm" onClick={() => setEditing({ number: (cycles[0]?.number ?? 0) + 1, drugs: [], planned_date: todayStr(), corticoid_iv: false })}>+ Ciclo</button>
      </div>
      {Object.keys(acc).length > 0 && (
        <div className="card tight">
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
            {c.start_at && ` · Inicio ${fmtDateTime(c.start_at)}`}
            {c.end_at && ` · Fin ${fmtDateTime(c.end_at)}`}
            {c.delay_days ? ` · Retraso ${c.delay_days} d (${c.delay_reason ?? 'sin motivo'})` : ''}
          </div>
          {c.actual_dose && <div className="small">Dosis real: {c.actual_dose}</div>}
          {c.rescue?.substance && <div className="small">Rescate: {c.rescue.substance} {c.rescue.start ? `desde ${fmtDateTime(c.rescue.start)}` : ''} {c.rescue.end ? `hasta ${fmtDateTime(c.rescue.end)}` : '(en curso)'}</div>}
        </div>
      ))}
    </div>
  )
}

function CycleForm({ initial, onClose }: { initial: Partial<Cycle>; onClose: () => void }) {
  const [c, setC] = useState<Partial<Cycle>>({ drugs: [], corticoid_iv: false, rescue: {}, antiemetic: {}, other_meds: {}, drug_watch: {}, actual_dose_mg_m2: {}, ...initial })
  const set = <K extends keyof Cycle>(k: K, v: Cycle[K]) => setC((x) => ({ ...x, [k]: v }))
  const fasting = hoursBetween(c.fasting_last_meal_at, c.start_at)
  const delay = c.start_at && c.planned_date ? Math.max(0, Math.round((new Date(c.start_at).getTime() - new Date(c.planned_date + 'T00:00').getTime()) / 86400000)) : null

  return (
    <div>
      <div className="row between">
        <h1>{c.id ? `Ciclo ${c.number}` : 'Nuevo ciclo'}</h1>
        <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
      </div>
      <Section title="Quimioterápico" open>
        <div className="grid2">
          <Field label="Nº de ciclo"><input type="number" value={c.number ?? ''} onChange={(e) => set('number', Number(e.target.value))} /></Field>
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
          <Field label="Fecha prevista"><input type="date" value={c.planned_date ?? ''} onChange={(e) => set('planned_date', e.target.value)} /></Field>
          <Field label="Dosis prevista"><input type="text" value={c.planned_dose ?? ''} onChange={(e) => set('planned_dose', e.target.value)} placeholder="p. ej. 12 g/m²" /></Field>
          <Field label="Inicio real de la perfusión"><input type="datetime-local" value={c.start_at ?? ''} onChange={(e) => set('start_at', e.target.value || null)} /></Field>
          <Field label="Fin de la perfusión"><input type="datetime-local" value={c.end_at ?? ''} onChange={(e) => set('end_at', e.target.value || null)} /></Field>
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
        {delay != null && delay > 0 && <div className="notice">Retraso respecto a lo previsto: <strong>{delay} días</strong></div>}
        <div className="grid2">
          <Field label="Días de retraso"><input type="number" value={c.delay_days ?? delay ?? ''} onChange={(e) => set('delay_days', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Motivo del retraso"><input type="text" value={c.delay_reason ?? ''} onChange={(e) => set('delay_reason', e.target.value)} /></Field>
          <Field label="Ingreso"><input type="datetime-local" value={c.admission_at ?? ''} onChange={(e) => set('admission_at', e.target.value || null)} /></Field>
          <Field label="Alta"><input type="datetime-local" value={c.discharge_at ?? ''} onChange={(e) => set('discharge_at', e.target.value || null)} /></Field>
        </div>
        <Field label="Última comida antes de la quimio" hint={fasting != null ? `Horas de ayuno: ${fasting} h` : 'Se calculan las horas de ayuno con el inicio de la perfusión'}>
          <input type="datetime-local" value={c.fasting_last_meal_at ?? ''} onChange={(e) => set('fasting_last_meal_at', e.target.value || null)} />
        </Field>
      </Section>

      <Section title="Medicación durante la perfusión">
        <Field label="Qué se administró (hidratación, alcalinización, antieméticos, protectores…)"><textarea value={c.infusion_meds ?? ''} onChange={(e) => set('infusion_meds', e.target.value)} /></Field>
        <Check checked={!!c.corticoid_iv} onChange={(v) => set('corticoid_iv', v)}><strong>Corticoide intravenoso</strong> (repercute en glucosa y sueño)</Check>
        {c.corticoid_iv && <Field label="Cuál, dosis, días"><input type="text" value={c.corticoid_detail ?? ''} onChange={(e) => set('corticoid_detail', e.target.value)} /></Field>}
        <h3>Protocolo antiemético</h3>
        <div className="grid2">
          <Field label="Antiemético"><input type="text" value={c.antiemetic?.drug ?? ''} onChange={(e) => set('antiemetic', { ...c.antiemetic, drug: e.target.value })} /></Field>
          <Field label="Pauta"><input type="text" value={c.antiemetic?.scheme ?? ''} onChange={(e) => set('antiemetic', { ...c.antiemetic, scheme: e.target.value })} /></Field>
        </div>
        <Field label="¿Fue suficiente?">
          <Segmented options={[{ value: 'si', label: 'Sí' }, { value: 'parcial', label: 'Parcialmente' }, { value: 'no', label: 'No' }]} value={c.antiemetic?.sufficient} onChange={(v) => set('antiemetic', { ...c.antiemetic, sufficient: v ?? undefined })} />
        </Field>
      </Section>

      <Section title="Rescate">
        <div className="grid2">
          <Field label="Sustancia"><input type="text" value={c.rescue?.substance ?? ''} onChange={(e) => set('rescue', { ...c.rescue, substance: e.target.value })} placeholder="folinato (leucovorin)" /></Field>
          <Field label="Dosis"><input type="text" value={c.rescue?.dose ?? ''} onChange={(e) => set('rescue', { ...c.rescue, dose: e.target.value })} /></Field>
          <Field label="Inicio"><input type="datetime-local" value={c.rescue?.start ?? ''} onChange={(e) => set('rescue', { ...c.rescue, start: e.target.value })} /></Field>
          <Field label="Cese"><input type="datetime-local" value={c.rescue?.end ?? ''} onChange={(e) => set('rescue', { ...c.rescue, end: e.target.value })} /></Field>
        </div>
        {c.drugs?.includes('MTX') && (
          <div className="grid3">
            <Field label="MTX 24 h (µmol/L)"><input type="number" inputMode="decimal" step="0.01" value={c.rescue?.mtx24 ?? ''} onChange={(e) => set('rescue', { ...c.rescue, mtx24: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="MTX 48 h"><input type="number" inputMode="decimal" step="0.01" value={c.rescue?.mtx48 ?? ''} onChange={(e) => set('rescue', { ...c.rescue, mtx48: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="MTX 72 h"><input type="number" inputMode="decimal" step="0.01" value={c.rescue?.mtx72 ?? ''} onChange={(e) => set('rescue', { ...c.rescue, mtx72: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
          </div>
        )}
      </Section>

      <Section title="Otros medicamentos durante el ciclo">
        <Field label="Vía oral — alopáticos"><textarea value={c.other_meds?.oral_alopatico ?? ''} onChange={(e) => set('other_meds', { ...c.other_meds, oral_alopatico: e.target.value })} /></Field>
        <Field label="Vía oral — suplementos / homeopatía"><textarea value={c.other_meds?.oral_suplemento ?? ''} onChange={(e) => set('other_meds', { ...c.other_meds, oral_suplemento: e.target.value })} /></Field>
        <Field label="Vía endovenosa"><textarea value={c.other_meds?.iv ?? ''} onChange={(e) => set('other_meds', { ...c.other_meds, iv: e.target.value })} /></Field>
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
      <Section title="Cirugía / radioterapia (si aplica en este ciclo)">
        <Field label="Tipo"><Segmented options={[{ value: 'cirugia', label: 'Cirugía' }, { value: 'radioterapia', label: 'Radioterapia' }, { value: 'otro', label: 'Otro' }]} value={c.procedure?.type} onChange={(v) => set('procedure', { ...c.procedure, type: v ?? undefined })} /></Field>
        <div className="grid2">
          <Field label="Fecha"><input type="date" value={c.procedure?.date ?? ''} onChange={(e) => set('procedure', { ...c.procedure, date: e.target.value })} /></Field>
        </div>
        <Field label="Notas (tipo de intervención, reconstrucción, márgenes, % necrosis…)"><textarea value={c.procedure?.notes ?? ''} onChange={(e) => set('procedure', { ...c.procedure, notes: e.target.value })} /></Field>
      </Section>
      <Field label="Notas"><textarea value={c.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      <div className="row">
        <button className="btn" disabled={!c.drugs?.length || !c.planned_date} onClick={async () => { await save('cycles', { ...c, patient_id: currentPatientId() } as Cycle); onClose() }}>Guardar</button>
        {c.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar este ciclo? Se puede recuperar desde el registro.')) { await remove('cycles', c.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
