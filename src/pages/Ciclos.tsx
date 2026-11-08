import { useEffect, useState } from 'react'
import { currentPatientId, remove, save, useRows } from '../store'
import type { Cycle, Drug, MedRow } from '../store/types'
import { DRUG_LABELS, DRUG_WATCH, NAUSEA_LABELS, PROTOCOL_34, ROUTE_LABELS } from '../domain/catalogs'
import { cumulativeDoses, DOSE_THRESHOLDS, hasCorticoid } from '../domain/cycle'
import { addDays, fmtDate, fmtWall, hoursBetween, toLocalInput, todayStr } from '../domain/dates'
import { sesionesTratamiento, type Sesion } from '../domain/fases'
import { resumenDeCiclo } from '../domain/nausea'
import { Check, Field, MedTable, Section, Segmented, type MedColumn } from '../components/ui'
import { confirmar } from '../components/Confirmar'
import { esSesionDeQuimio, fechaSesion } from '../domain/numeroCiclo'

const DRUGS: Drug[] = ['MTX', 'CDDP', 'ADM', 'HDIFO', 'MTP', 'OTRO']

/** 0.41.0 · Numeración de corrido (Montserrate, 08/11/2026): cada sesión de quimio es un ciclo y se numera
 *  por orden de fecha. Al guardar se propone el número que le toca; la app lo recalcula siempre por fecha. */
function suggestNumber(cycles: Cycle[], c: Partial<Cycle>) {
  const fecha = (c.start_at ?? c.planned_date ?? '9999-99-99').slice(0, 16)
  return cycles.filter((x) => x.id !== c.id && esSesionDeQuimio(x) && fechaSesion(x) <= fecha).length + 1
}


export default function Ciclos() {
  const cycles = useRows('cycles').sort((a, b) => b.planned_date.localeCompare(a.planned_date))
  const [editing, setEditing] = useState<Partial<Cycle> | null>(null)
  const acc = cumulativeDoses(cycles)
  const patient = useRows('patients')[0]
  const logs = useRows('daily_logs')
  // Sesiones del protocolo que aún no están en Tratamiento: fecha de la hoja (miércoles). Al registrarlas se pone la fecha definitiva.
  const pendientes = sesionesTratamiento(patient?.protocol_start, cycles).filter((x) => x.delProtocolo && x.date >= addDays(todayStr(), -7))
  const DRUGS_OF: Record<string, Drug[]> = { mtx: ['MTX'], cddp: ['CDDP', 'ADM'] }
  // 0.39.1 · La cirugía (fechas de Medicación → ventana de cirugía) se ve en la lista, en su sitio por fecha.
  const cirugia = patient?.surgery_from ? { from: patient.surgery_from.slice(0, 10), to: patient.surgery_to ? patient.surgery_to.slice(0, 10) : null } : null
  const tarjetaCirugia = cirugia && (
    <div className="card">
      <strong>Cirugía · semana 8 del protocolo</strong>
      <div className="muted small">{fmtDate(cirugia.from)}{cirugia.to ? ` · Alta ${fmtDate(cirugia.to)}` : ' · Sin alta apuntada'} · Las fechas se cambian en Medicación (ventana de cirugía).</div>
    </div>
  )

  const filaSesion = (x: Sesion) => {
      const plan = PROTOCOL_34.find((p) => p.week === x.week)?.label ?? ''
      const nombre = plan === 'CDP + ADM' ? 'Cisplatino y Adriamicina' : plan === 'CDP' ? 'Cisplatino' : plan === 'ADM*' ? 'Adriamicina (tras la cirugía)' : plan === 'Cirugía' ? 'Cirugía (posible)' : 'Metotrexato'
      const drugs: Drug[] = plan === 'CDP' ? ['CDDP'] : plan === 'ADM*' ? ['ADM'] : DRUGS_OF[x.kind] ?? []
      return (
        <div className="item" key={x.week}>
          <div className="main">
            <div><strong>{nombre}</strong></div>
            <div className="meta">Semana {x.week} · {fmtDate(x.date)}</div>
          </div>
          {x.kind !== 'cirugia' && (
            <button className="btn sm secondary" onClick={() => setEditing({ drugs, planned_date: x.date, protocol_week: x.week, corticoid_iv: false })}>Poner fecha definitiva</button>
          )}
        </div>
      )
  }

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
      {pendientes.length > 0 && (
        <Section title={`Próximas sesiones del protocolo (${pendientes.length})`} open>
          <p className="muted small">Fechas calculadas con la hoja de tratamiento a partir de la última sesión registrada (si una sesión se retrasa, las siguientes se corren con ella). Son las que usan el calendario y las pautas de alimentación hasta que se registra la fecha definitiva.</p>
          {pendientes.slice(0, 5).map(filaSesion)}
          {pendientes.length > 5 && (
            <details style={{ marginTop: '.3rem' }}>
              <summary className="small muted">Ver las {pendientes.length - 5} siguientes</summary>
              {pendientes.slice(5).map(filaSesion)}
            </details>
          )}
        </Section>
      )}
      {cycles.length === 0 && <div className="empty">Aún no hay ciclos. Añade el primero con la fecha prevista; el resto se completa durante el ingreso.</div>}
      {cycles.map((c, i) => (
        <div key={c.id}>
        {cirugia && cirugia.from > c.planned_date && (i === 0 || cirugia.from <= cycles[i - 1].planned_date) && tarjetaCirugia}
        <div className="card" onClick={() => setEditing(c)} style={{ cursor: 'pointer' }}>
          <div className="row between">
            <strong>Ciclo {c.number} · {c.drugs.map((d) => DRUG_LABELS[d] ?? d).join(' + ')}</strong>
            {hasCorticoid(c) && <span className="tag ambar">corticoide IV</span>}
          </div>
          <div className="muted small">
            Previsto {fmtDate(c.planned_date)}
            {c.start_at && ` · Inicio ${fmtWall(c.start_at)}`}
            {c.end_at && ` · Fin ${fmtWall(c.end_at)}`}
            {c.delay_days ? ` · Retraso ${c.delay_days} d (${c.delay_reason || 'sin motivo'})` : c.delay_days === 0 ? ' · Sin retraso' : ''}
          </div>
          {c.actual_dose && <div className="small">Dosis real: {c.actual_dose}</div>}
          {c.rescue?.substance && <div className="small">Rescate: {c.rescue.substance} {c.rescue.start ? `desde ${fmtWall(c.rescue.start)}` : ''} {c.rescue.end ? `hasta ${fmtWall(c.rescue.end)}` : '(en curso)'}</div>}
          {(() => { const r = resumenDeCiclo(c, logs, todayStr()); return r ? <div className="small">Náuseas: aguda {r.aguda.dias ? `${r.aguda.completos}/${r.aguda.dias}` : '—'} · retardada {r.retardada.dias ? `${r.retardada.completos}/${r.retardada.dias}` : '—'} días con control completo{r.rescates ? ` · ${r.rescates} rescate${r.rescates > 1 ? 's' : ''}` : ''}</div> : null })()}
        </div>
        </div>
      ))}
      {cirugia && cycles.every((c) => cirugia.from <= c.planned_date) && tarjetaCirugia}
    </div>
  )
}

const COLS_BASIC: MedColumn[] = [{ key: 'name', label: 'Medicamento' }, { key: 'mg', label: 'mg' }, { key: 'posology', label: 'Posología' }, { key: 'reason', label: 'Motivo' }]
const COLS_ANTIEMETIC: MedColumn[] = [{ key: 'name', label: 'Medicamento' }, { key: 'mg', label: 'mg' }, { key: 'posology', label: 'Posología' }, { key: 'nausea', label: 'Intensidad de náusea' }, { key: 'sufficient', label: '¿Fue suficiente?' }, { key: 'corticoid', label: '¿Corticoide IV?' }]
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
    case 'corticoid':
      return (
        <div style={{ textAlign: 'center' }}>
          <input type="checkbox" aria-label="Es corticoide intravenoso" title="Repercute en glucosa y sueño: se avisa en la portada" checked={!!r.corticoid} onChange={(e) => set({ corticoid: e.target.checked || undefined })} />
        </div>
      )
    default:
      return <input type="text" value={(r[key] as string | undefined) ?? ''} onChange={(e) => set({ [key]: e.target.value } as Partial<MedRow>)} placeholder={key === 'mg' ? 'mg' : ''} inputMode={key === 'mg' ? 'decimal' : undefined} />
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

const CORTICO_RE = /dexametasona|metilpred|hidrocortisona|prednis|corticoide/i
/** 0.41.1 · El corticoide pasa al protocolo antiemético: las filas de corticoide de «durante la perfusión»
 *  se mueven allí marcadas, y la casilla suelta antigua se convierte en una fila (solo al abrir; se guarda con «Guardar»). */
function moverCorticoide(c: Partial<Cycle>): Partial<Cycle> {
  const infusion = c.other_meds?.infusion ?? []
  const mover = infusion.filter((m) => CORTICO_RE.test(m.name ?? ''))
  let items = [...(c.antiemetic?.items ?? legacyAntiemetic(c)), ...mover.map((m) => ({ name: m.name, mg: m.mg, posology: m.posology, corticoid: true }))]
  if (c.corticoid_iv && !items.some((m) => m.corticoid)) {
    if (items.some((m) => CORTICO_RE.test(m.name ?? ''))) items = items.map((m) => (CORTICO_RE.test(m.name ?? '') ? { ...m, corticoid: true } : m))
    else items = [...items, { name: c.corticoid_detail?.trim() || 'Corticoide intravenoso', corticoid: true }]
  }
  if (!mover.length && !c.corticoid_iv) return c
  return { ...c, antiemetic: { ...c.antiemetic, items }, other_meds: { ...c.other_meds, infusion: infusion.filter((m) => !mover.includes(m)) } }
}

function CycleForm({ initial, cycles, onClose }: { initial: Partial<Cycle>; cycles: Cycle[]; onClose: () => void }) {
  const [c, setC] = useState<Partial<Cycle>>(() => moverCorticoide({ drugs: [], corticoid_iv: false, rescue: {}, antiemetic: {}, other_meds: {}, drug_watch: {}, actual_dose_mg_m2: {}, ...initial }))
  const logsN = useRows('daily_logs')
  const nauseaCiclo = c.id && c.planned_date ? resumenDeCiclo(c as Cycle, logsN, todayStr()) : null
  const set = <K extends keyof Cycle>(k: K, v: Cycle[K]) => setC((x) => ({ ...x, [k]: v }))
  // 0.41.0 · El número sale solo, de corrido por fecha (se recalcula si cambian la fecha o los fármacos).
  const drugsKey = (c.drugs ?? []).join('+')
  useEffect(() => {
    if (!esSesionDeQuimio({ drugs: c.drugs ?? [] })) return
    setC((x) => {
      const n = suggestNumber(cycles, x)
      return x.number === n ? x : { ...x, number: n }
    })
  }, [drugsKey, c.planned_date, c.start_at, cycles])
  const fasting = hoursBetween(c.fasting_last_meal_at, c.start_at)
  const delay = c.start_at && c.planned_date ? Math.max(0, Math.round((new Date(toLocalInput(c.start_at)).getTime() - new Date(c.planned_date.slice(0, 10) + 'T00:00').getTime()) / 86400000)) : null

  return (
    <div>
      <div className="row between">
        <h1>{c.id ? `Ciclo ${c.number}` : 'Nuevo ciclo'}</h1>
        <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
      </div>
      <Section title="Quimioterápico" open>
        <div className="grid2">
          <Field label="Nº de ciclo" hint="Se numera solo, de corrido por fecha: cada sesión de quimio es un ciclo">
            <input type="number" value={c.number ?? ''} readOnly />
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
        <p className="muted small">Una fila por medicamento (hidratación, alcalinización, protectores…). El corticoide va en el protocolo antiemético. Cuando se pueda subir el informe en PDF, estas filas se rellenarán solas y se podrán corregir a mano.</p>
        <MedTable<MedRow>
          rows={c.other_meds?.infusion ?? []}
          onChange={(rows) => set('other_meds', { ...c.other_meds, infusion: rows })}
          columns={COLS_BASIC}
          render={renderMedCell}
        />
        {/^\s*$/.test(c.infusion_meds ?? '') ? null : <Field label="Texto libre anterior"><textarea value={c.infusion_meds ?? ''} onChange={(e) => set('infusion_meds', e.target.value)} /></Field>}
        <h3>Protocolo antiemético</h3>
        <p className="muted small">Incluido el corticoide intravenoso (p. ej. dexametasona): márcalo en «¿Corticoide IV?» y se avisa en la portada, porque repercute en glucosa y sueño.</p>
        <MedTable<MedRow>
          rows={c.antiemetic?.items ?? legacyAntiemetic(c)}
          onChange={(rows) => set('antiemetic', { ...c.antiemetic, items: rows })}
          columns={COLS_ANTIEMETIC}
          render={renderMedCell}
        />
        {nauseaCiclo && (
          <div className="notice small">
            <strong>Según lo apuntado en Signos y síntomas:</strong> {nauseaCiclo.texto}. Sirve para rellenar «¿Fue suficiente?».
          </div>
        )}
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
        <button className="btn" disabled={!c.drugs?.length || !c.planned_date} onClick={async () => { const cortico = (c.antiemetic?.items ?? []).some((m) => m.corticoid); await save('cycles', { ...c, corticoid_iv: cortico, corticoid_detail: '', patient_id: currentPatientId() } as Cycle); onClose() }}>Guardar</button>
        {c.id && <button className="btn danger" onClick={async () => { if (await confirmar('¿Borrar este ciclo? Se puede recuperar desde el registro.')) { await remove('cycles', c.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
