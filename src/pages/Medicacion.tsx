import { useState } from 'react'
import { currentPatientId, remove, save, useRows } from '../store'
import type { Intake, MedRoute, Moment, Product, ProductBlock, Traffic } from '../store/types'
import {
  ANTICOAG_KEYWORDS, ANTIPLATELET_SUPP, BLOCK_DEFAULT_TRAFFIC, BLOCK_HELP, BLOCK_LABELS, CONSULT_FIRST, MOMENTS,
  OUTCOME_LABELS, PRESCRIBERS, ROUTE_LABELS, TRAFFIC_LABELS, WEEKDAYS,
} from '../domain/catalogs'
import { afterChemoGate, cycleContext } from '../domain/cycle'
import { trafficWindow } from '../domain/medication'
import { fmtDate, todayStr } from '../domain/dates'
import { Field, Section, Segmented } from '../components/ui'
import { SEED_PRODUCTS } from '../domain/seed'

const BLOCKS: ProductBlock[] = ['hospital', 'sup_ciclo', 'sup_fuera']
type Outcome = NonNullable<Product['outcome']>

/** Activo = sin fecha de retirada o con retirada futura. Retirado = fecha de retirada hoy o antes. */
const isActive = (p: Product, today: string) => !p.end_date || p.end_date > today
const dow = (d: string) => new Date(d + 'T12:00').getDay()
/** Días de la semana en texto: «solo Sáb, Dom». */
const weekdaysText = (w?: number[] | null) => (w && w.length && w.length < 7 ? 'solo ' + [1, 2, 3, 4, 5, 6, 0].filter((d) => w.includes(d)).map((d) => WEEKDAYS[d]).join(', ') : '')
/** Línea de detalle común: vía · días · condición. */
const extraMeta = (p: Product) => [p.route ? ROUTE_LABELS[p.route] : '', weekdaysText(p.weekdays), p.condition ? `solo si ${p.condition}` : ''].filter(Boolean).join(' · ')

export default function Medicacion() {
  const today = todayStr()
  const all = useRows('products')
  const products = all.filter((p) => isActive(p, today))
  const retired = all.filter((p) => !isActive(p, today)).sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))
  const intakes = useRows('intakes', (i) => i.date === today)
  const cycles = useRows('cycles')
  const panels = useRows('lab_panels')
  const labResults = useRows('lab_results', (r) => r.analyte === 'plaquetas')
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const [retiring, setRetiring] = useState<Product | null>(null)
  const ctx = cycleContext(cycles, today)

  const windowKey = trafficWindow(ctx, today)
  const windowLabel = { infusion: 'día de infusión', mtx: 'ciclo de metotrexato', cddp_adm: 'ciclo cisplatino + adriamicina', nadir: 'nadir plaquetario (D7-14)' }
  const trafficNow = (p: Product): Traffic | undefined => (windowKey ? p.traffic?.[windowKey] : undefined)

  const anticoag = products.some((p) => ANTICOAG_KEYWORDS.some((k) => (p.name + ' ' + (p.composition ?? '')).toLowerCase().includes(k)))
  const antiplateletActive = anticoag ? products.filter((p) => ANTIPLATELET_SUPP.some((k) => (p.name + ' ' + (p.composition ?? '')).toLowerCase().includes(k))) : []
  // Última cifra de plaquetas registrada (×10³/µL) para el aviso de la enoxaparina (< 50.000).
  const lastPlt = labResults
    .map((r) => ({ r, date: panels.find((x) => x.id === r.panel_id)?.date ?? '' }))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const pltValue = lastPlt ? (lastPlt.r.value >= 1000 ? lastPlt.r.value / 1000 : lastPlt.r.value) : null
  // Días de la semana y regla «N días tras la quimio».
  const notToday = (p: Product) => !!p.weekdays?.length && !p.weekdays.includes(dow(today))
  const gateOf = (p: Product) => afterChemoGate(p, cycles, today)
  const waiting = (p: Product) => !!gateOf(p)?.waiting
  const gated = products.filter((p) => gateOf(p))

  if (editing) return <ProductForm initial={editing} onClose={() => setEditing(null)} />

  const toggle = async (p: Product, m: Moment) => {
    const ex = intakes.find((i) => i.product_id === p.id && i.moment === m)
    await save('intakes', { ...(ex ?? {}), patient_id: currentPatientId(), product_id: p.id, date: today, moment: m, taken: !(ex?.taken ?? false) } as Intake)
  }
  const markAll = async (m: Moment) => {
    for (const p of products.filter((x) => x.moments.includes(m) && trafficNow(x) !== 'rojo' && !waiting(x) && !notToday(x) && !x.condition)) {
      const ex = intakes.find((i) => i.product_id === p.id && i.moment === m)
      if (!ex?.taken) await save('intakes', { ...(ex ?? {}), patient_id: currentPatientId(), product_id: p.id, date: today, moment: m, taken: true } as Intake)
    }
  }
  // Solo las columnas de momentos que usa algún producto (para que la tabla quepa en el móvil).
  const usedMoments = MOMENTS.filter((m) => products.some((p) => p.moments.includes(m.key as Moment)))
  const onDemand = products.filter((p) => p.moments.length === 0)
  const scheduled = products.filter((p) => p.moments.length > 0 && !notToday(p))
  const skippedToday = products.filter((p) => p.moments.length > 0 && notToday(p))
  const legacy = products.filter((p) => !BLOCKS.includes(p.block))

  return (
    <div>
      <div className="row between">
        <h1>Medicación y suplementos</h1>
        <button className="btn sm" onClick={() => setEditing({ block: 'sup_fuera', moments: [], traffic: {} })}>+ Producto</button>
      </div>
      {windowKey && <div className="notice">Hoy estamos en <strong>{windowLabel[windowKey]}</strong>: los productos en rojo para esta ventana no deben darse; los ámbar, solo si el equipo lo ha autorizado.</div>}
      {antiplateletActive.length > 0 && (
        <div className="notice">
          <strong>Hay un anticoagulante en la pauta.</strong> Revisar con el equipo estos productos con efecto antiagregante: {antiplateletActive.map((p) => p.name).join(', ')}.
        </div>
      )}
      {anticoag && pltValue != null && pltValue < 50 && (
        <div className="notice">
          <strong>Plaquetas {Math.round(pltValue * 1000).toLocaleString('es-ES')} (analítica del {fmtDate(lastPlt!.date)}).</strong> El informe de alta indica suspender la enoxaparina si las plaquetas bajan de 50.000: llamar a oncología antes de la siguiente dosis.
        </div>
      )}
      {gated.map((p) => {
        const g = gateOf(p)!
        return (
          <div className="notice" key={'g' + p.id}>
            <strong>{p.name}:</strong>{' '}
            {g.waiting
              ? <>todavía no. Se puede empezar el <strong>{fmtDate(g.from)}</strong>, {p.after_chemo_days} días después de la última quimio ({fmtDate(g.chemo)}){p.condition ? `, solo si ${p.condition}` : ''}.</>
              : <>desde el {fmtDate(g.from)} ({p.after_chemo_days} días tras la última quimio, {fmtDate(g.chemo)}) {p.condition ? <>se puede dar <strong>si {p.condition}</strong></> : 'se puede dar'}.</>}
          </div>
        )
      })}
      {retiring && <RetirePanel product={retiring} onClose={() => setRetiring(null)} />}
      {products.length === 0 && retired.length === 0 && (
        <div className="empty">
          Sin productos. <button className="btn sm secondary" onClick={async () => { for (const s of SEED_PRODUCTS) await save('products', { ...s, patient_id: currentPatientId() } as Product) }}>Cargar la lista actual de la familia</button>
        </div>
      )}

      {products.length > 0 && (
        <Section title="Tomas de hoy" open>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  {usedMoments.map((m) => (
                    <th key={m.key} style={{ textAlign: 'center' }}>
                      <button className="btn sm ghost" style={{ padding: '.2rem .4rem', fontSize: '.75rem' }} onClick={() => markAll(m.key as Moment)} title="Marcar todo lo de este momento">{m.label}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduled.map((p) => {
                  const t = trafficNow(p)
                  const wait = waiting(p)
                  const blocked = t === 'rojo' || wait
                  return (
                    <tr key={p.id} style={blocked ? { opacity: 0.55 } : undefined}>
                      <td>
                        <div onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                          {p.name} {t && <span className={'tag ' + t}>{TRAFFIC_LABELS[t]}</span>}
                          {wait && <span className="tag gray">desde {fmtDate(gateOf(p)!.from)}</span>}
                          {p.condition && !wait && <span className="tag amarillo">si {p.condition}</span>}
                          <div className="meta">{p.dose}{p.lab ? ` · ${p.lab}` : ''}{p.route ? ` · ${ROUTE_LABELS[p.route]}` : ''}</div>
                        </div>
                        <button className="linkbtn" onClick={() => setRetiring(p)}>Retirar</button>
                      </td>
                      {usedMoments.map((m) => {
                        const planned = p.moments.includes(m.key as Moment)
                        const taken = intakes.find((i) => i.product_id === p.id && i.moment === m.key)?.taken
                        return (
                          <td key={m.key} style={{ textAlign: 'center' }}>
                            {planned && (
                              <button type="button" className={'chip ' + (taken ? 'on' : '')} style={{ padding: '.3rem .6rem' }} onClick={() => toggle(p, m.key as Moment)} disabled={blocked}>
                                {taken ? '✓' : '○'}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {skippedToday.length > 0 && <p className="muted small">Hoy no toca: {skippedToday.map((p) => `${p.name} (${weekdaysText(p.weekdays)})`).join('; ')}.</p>}
          {onDemand.length > 0 && (
            <div style={{ marginTop: '.5rem' }}>
              <h3>A demanda</h3>
              {onDemand.map((p) => (
                <div className="item" key={p.id}>
                  <div className="main" onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                    <div>{p.name} {trafficNow(p) && <span className={'tag ' + trafficNow(p)}>{TRAFFIC_LABELS[trafficNow(p)!]}</span>}</div>
                    <div className="meta">{p.dose}{extraMeta(p) ? ` · ${extraMeta(p)}` : ''}</div>
                  </div>
                  <button className="btn sm ghost" onClick={() => setRetiring(p)}>Retirar</button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {[...BLOCKS, ...(legacy.length ? (['alopatico'] as ProductBlock[]) : [])].map((b) => {
        const list = products.filter((p) => p.block === b)
        if (!list.length) return null
        return (
          <Section key={b} title={`${BLOCK_LABELS[b]} (${list.length})`}>
            {BLOCK_HELP[b] && <p className="muted small">{BLOCK_HELP[b]}</p>}
            {list.map((p) => (
              <div className="item" key={p.id}>
                <div className="main" onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                  <div>{p.name} <span className="muted small">{p.dose}</span></div>
                  <div className="meta">
                    {p.moments.length ? p.moments.map((m) => MOMENTS.find((x) => x.key === m)?.label).join(', ') : 'a demanda'}
                    {p.lab ? ` · ${p.lab}` : ''}{p.prescribed_by ? ` · ${p.prescribed_by}` : ''}
                    {extraMeta(p) ? ` · ${extraMeta(p)}` : ''}{p.after_chemo_days ? ` · desde ${p.after_chemo_days} días tras la quimio` : ''}
                  </div>
                  <div>
                    {(['mtx', 'cddp_adm', 'nadir', 'infusion'] as const).map((k) => p.traffic?.[k] && <span key={k} className={'tag ' + p.traffic[k]}>{k === 'mtx' ? 'MTX' : k === 'cddp_adm' ? 'CDDP+ADM' : k === 'nadir' ? 'nadir' : 'infusión'}: {TRAFFIC_LABELS[p.traffic[k]!]}</span>)}
                  </div>
                </div>
                <button className="btn sm ghost" onClick={() => setRetiring(p)}>Retirar</button>
              </div>
            ))}
          </Section>
        )
      })}

      <Section title={`Medicación y suplementos anteriores (${retired.length})`}>
        <p className="muted small">Lo que se ha retirado, con el motivo y si funcionó. Sirve para no repetir lo que no fue bien y recordar lo que sí.</p>
        {retired.length === 0 && <div className="muted small">Todavía no se ha retirado nada. Cuando la doctora quite algo, pulsa «Retirar» en ese producto.</div>}
        {retired.map((p) => {
          const o = p.outcome ? OUTCOME_LABELS[p.outcome] : null
          return (
            <div className="item" key={p.id}>
              <div className="main" onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                <div>{p.name}{p.lab ? <span className="muted small"> · {p.lab}</span> : null} {o && <span className={'tag ' + o.tag}>{o.label}</span>}</div>
                <div className="meta">
                  {p.dose}{p.start_date ? ` · desde ${fmtDate(p.start_date)}` : ''} · retirado {fmtDate(p.end_date)}{p.prescribed_by ? ` · ${p.prescribed_by}` : ''}
                </div>
                {(p.end_reason || p.outcome_notes) && <div className="small">{p.end_reason}{p.end_reason && p.outcome_notes ? ' — ' : ''}{p.outcome_notes}</div>}
              </div>
              <button className="btn sm ghost" title="Volver a añadirlo a la pauta actual" onClick={() => save('products', { ...p, end_date: null } as Product)}>Volver a pautar</button>
            </div>
          )
        })}
      </Section>
    </div>
  )
}

/** Retirar un producto de la pauta: fecha, motivo y si funcionó. Pasa a "anteriores". */
function RetirePanel({ product, onClose }: { product: Product; onClose: () => void }) {
  const [date, setDate] = useState(todayStr())
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [notes, setNotes] = useState('')
  return (
    <div className="card accent">
      <div className="row between"><strong>Retirar «{product.name}» de la pauta</strong><button className="btn sm ghost" onClick={onClose}>Cancelar</button></div>
      <p className="muted small">No se borra: pasa a «Medicación y suplementos anteriores» con todo su historial de tomas.</p>
      <div className="grid2">
        <Field label="Fecha de retirada"><input type="date" max={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Motivo"><input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="La doctora lo quita, no lo tolera, se acabó la pauta…" /></Field>
      </div>
      <Field label="¿Funcionó?">
        <Segmented options={(Object.keys(OUTCOME_LABELS) as Outcome[]).map((k) => ({ value: k, label: OUTCOME_LABELS[k].label }))} value={outcome} onChange={setOutcome} />
      </Field>
      <Field label="Qué se notó (opcional)"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mejoró el apetito, le sentaba mal al estómago…" /></Field>
      <button className="btn sm" onClick={async () => { await save('products', { ...product, end_date: date, end_reason: reason, outcome: outcome ?? undefined, outcome_notes: notes } as Product); onClose() }}>Confirmar retirada</button>
    </div>
  )
}

function ProductForm({ initial, onClose }: { initial: Partial<Product>; onClose: () => void }) {
  const [p, setP] = useState<Partial<Product>>({ moments: [], traffic: {}, ...initial })
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const consult = CONSULT_FIRST.some((k) => (p.name ?? '').toLowerCase().includes(k) || (p.composition ?? '').toLowerCase().includes(k))
  const presetPrescriber = (PRESCRIBERS as readonly string[]).includes(p.prescribed_by ?? '')
  const [otherPrescriber, setOtherPrescriber] = useState(!!p.prescribed_by && !presetPrescriber)
  const retiredNow = !!p.end_date && p.end_date <= todayStr()
  const TR: { value: Traffic; label: string; className: string }[] = [
    { value: 'verde', label: 'Verde', className: 's1' }, { value: 'ambar', label: 'Ámbar', className: 's2' }, { value: 'rojo', label: 'Rojo', className: 's3' },
  ]
  const chooseBlock = (b: ProductBlock | null) => {
    const block = b ?? 'sup_fuera'
    const empty = !p.traffic || Object.values(p.traffic).every((v) => !v)
    setP((x) => ({ ...x, block, traffic: empty ? { ...BLOCK_DEFAULT_TRAFFIC[block] } : x.traffic }))
  }
  return (
    <div>
      <div className="row between">
        <h1>{p.id ? p.name : 'Nuevo producto'}</h1>
        <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
      </div>
      <div className="card">
        <Field label="Nombre comercial"><input type="text" value={p.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
        {consult && <div className="notice"><strong>Consultar antes de dar.</strong> Este producto (o su composición) está en la lista de interacciones importantes con el tratamiento (AINE, IBP, fólico, hierro, ginseng, curcumina…).</div>}
        <Field label="Laboratorio / marca"><input type="text" value={p.lab ?? ''} onChange={(e) => set('lab', e.target.value)} placeholder="Cobas, Solgar, Pileje…" /></Field>
        <Field label="Bloque" hint={p.block && BLOCK_HELP[p.block] ? BLOCK_HELP[p.block] : undefined}>
          <Segmented options={BLOCKS.map((b) => ({ value: b, label: BLOCK_LABELS[b] }))} value={p.block} onChange={chooseBlock} />
        </Field>
        <Field label="Composición (copiar de la etiqueta)"><textarea value={p.composition ?? ''} onChange={(e) => set('composition', e.target.value)} /></Field>
        <div className="grid2">
          <Field label="Dosis por toma"><input type="text" value={p.dose ?? ''} onChange={(e) => set('dose', e.target.value)} placeholder="1 cápsula, 5 ml…" /></Field>
          <Field label="Pautado por">
            <select value={otherPrescriber ? '__otro' : p.prescribed_by ?? ''} onChange={(e) => {
              if (e.target.value === '__otro') { setOtherPrescriber(true); set('prescribed_by', '') }
              else { setOtherPrescriber(false); set('prescribed_by', e.target.value) }
            }}>
              <option value="">Elegir…</option>
              {PRESCRIBERS.map((x) => <option key={x} value={x}>{x}</option>)}
              <option value="__otro">Otro…</option>
            </select>
            {otherPrescriber && <input type="text" style={{ marginTop: '.3rem' }} value={p.prescribed_by ?? ''} onChange={(e) => set('prescribed_by', e.target.value)} placeholder="Quién lo pauta" />}
          </Field>
        </div>
        <Field label="Momentos del día" hint="Si no se marca ninguno, aparece como «a demanda».">
          <div className="chips">
            {MOMENTS.map((m) => (
              <button key={m.key} type="button" className={'chip ' + (p.moments?.includes(m.key as Moment) ? 'on' : '')} onClick={() => set('moments', p.moments?.includes(m.key as Moment) ? p.moments.filter((x) => x !== m.key) : [...(p.moments ?? []), m.key as Moment])}>{m.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Días de la semana" hint="Si no se marca ninguno, todos los días.">
          <div className="chips">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" className={'chip ' + (p.weekdays?.includes(d) ? 'on' : '')} onClick={() => set('weekdays', p.weekdays?.includes(d) ? p.weekdays.filter((x) => x !== d) : [...(p.weekdays ?? []), d])}>{WEEKDAYS[d]}</button>
            ))}
          </div>
        </Field>
        <div className="grid2">
          <Field label="Vía">
            <select value={p.route ?? ''} onChange={(e) => set('route', (e.target.value || null) as MedRoute | null)}>
              <option value="">—</option>
              {Object.entries(ROUTE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Inicio"><input type="date" value={p.start_date ?? ''} onChange={(e) => set('start_date', e.target.value)} /></Field>
        </div>
        <div className="grid2">
          <Field label="Empezar … días después de la última quimio" hint="Déjalo vacío si no aplica.">
            <input type="number" min={1} max={30} value={p.after_chemo_days ?? ''} onChange={(e) => set('after_chemo_days', e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Solo si…" hint="Condición para darlo, p. ej. «hay fatiga».">
            <input type="text" value={p.condition ?? ''} onChange={(e) => set('condition', e.target.value || null)} placeholder="hay fatiga" />
          </Field>
        </div>
      </div>
      <div className="card">
        <h3>Semáforo por ventana</h3>
        <p className="muted small">Verde: se mantiene · Ámbar: solo con autorización del equipo · Rojo: no se da en esa ventana.</p>
        {(['mtx', 'cddp_adm', 'nadir', 'infusion'] as const).map((k) => (
          <Field key={k} label={{ mtx: 'Ciclo de metotrexato (hasta fin del rescate)', cddp_adm: 'Ciclo cisplatino + adriamicina (hasta 48 h tras la infusión)', nadir: 'Nadir plaquetario (D7-14)', infusion: 'Día de infusión' }[k]}>
            <Segmented className="severity" options={TR} value={p.traffic?.[k]} onChange={(v) => set('traffic', { ...(p.traffic ?? {}), [k]: v ?? undefined })} />
          </Field>
        ))}
        <Field label="Motivo del semáforo"><input type="text" value={p.traffic_reason ?? ''} onChange={(e) => set('traffic_reason', e.target.value)} /></Field>
        <Field label="Notas"><textarea value={p.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
      {(p.id || p.end_date) && (
        <div className="card">
          <h3>{retiredNow ? 'Retirado' : 'Retirada'}</h3>
          <div className="grid2">
            <Field label="Fecha de retirada"><input type="date" value={p.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} /></Field>
            <Field label="Motivo"><input type="text" value={p.end_reason ?? ''} onChange={(e) => set('end_reason', e.target.value)} /></Field>
          </div>
          <Field label="¿Funcionó?">
            <Segmented options={(Object.keys(OUTCOME_LABELS) as Outcome[]).map((k) => ({ value: k, label: OUTCOME_LABELS[k].label }))} value={p.outcome} onChange={(v) => set('outcome', v ?? undefined)} />
          </Field>
          <Field label="Qué se notó"><input type="text" value={p.outcome_notes ?? ''} onChange={(e) => set('outcome_notes', e.target.value)} /></Field>
        </div>
      )}
      <div className="row">
        <button className="btn" disabled={!p.name?.trim()} onClick={async () => { await save('products', { ...p, patient_id: currentPatientId() } as Product); onClose() }}>Guardar</button>
        {p.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar este producto? Si la doctora lo ha quitado, mejor usa «Retirar» para que quede en el historial.')) { await remove('products', p.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
