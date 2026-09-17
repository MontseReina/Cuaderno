import { useState } from 'react'
import { currentPatientId, remove, save, useRows } from '../store'
import type { Intake, Moment, Product, ProductBlock, Traffic } from '../store/types'
import { ANTICOAG_KEYWORDS, ANTIPLATELET_SUPP, BLOCK_LABELS, CONSULT_FIRST, MOMENTS, TRAFFIC_LABELS } from '../domain/catalogs'
import { cycleContext } from '../domain/cycle'
import { todayStr } from '../domain/dates'
import { Field, Section, Segmented } from '../components/ui'
import { SEED_PRODUCTS } from '../domain/seed'

export default function Medicacion() {
  const products = useRows('products', (p) => !p.end_date || p.end_date >= todayStr())
  const ended = useRows('products', (p) => !!p.end_date && p.end_date < todayStr())
  const intakes = useRows('intakes', (i) => i.date === todayStr())
  const cycles = useRows('cycles')
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const ctx = cycleContext(cycles, todayStr())

  const windowKey: keyof Product['traffic'] | null = ctx.cycle
    ? ctx.day === 0 || (ctx.inCycle && ctx.cycle.end_at && todayStr() <= ctx.cycle.end_at.slice(0, 10))
      ? 'infusion'
      : ctx.inCycle
        ? ctx.cycle.drugs.includes('MTX') ? 'mtx' : 'cddp_adm'
        : ctx.nadir ? 'nadir' : null
    : null
  const windowLabel = { infusion: 'día de infusión', mtx: 'ciclo de metotrexato', cddp_adm: 'ciclo cisplatino + adriamicina', nadir: 'nadir plaquetario (D7-14)' }
  const trafficNow = (p: Product): Traffic | undefined => (windowKey ? p.traffic[windowKey] : undefined)

  const anticoag = products.some((p) => ANTICOAG_KEYWORDS.some((k) => (p.name + ' ' + (p.composition ?? '')).toLowerCase().includes(k)))
  const antiplateletActive = anticoag ? products.filter((p) => ANTIPLATELET_SUPP.some((k) => (p.name + ' ' + (p.composition ?? '')).toLowerCase().includes(k))) : []

  if (editing) return <ProductForm initial={editing} onClose={() => setEditing(null)} />

  const toggle = async (p: Product, m: Moment) => {
    const ex = intakes.find((i) => i.product_id === p.id && i.moment === m)
    await save('intakes', { ...(ex ?? {}), patient_id: currentPatientId(), product_id: p.id, date: todayStr(), moment: m, taken: !(ex?.taken ?? false) } as Intake)
  }
  const markAll = async (m: Moment) => {
    for (const p of products.filter((x) => x.moments.includes(m) && trafficNow(x) !== 'rojo')) {
      const ex = intakes.find((i) => i.product_id === p.id && i.moment === m)
      if (!ex?.taken) await save('intakes', { ...(ex ?? {}), patient_id: currentPatientId(), product_id: p.id, date: todayStr(), moment: m, taken: true } as Intake)
    }
  }

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
      {products.length === 0 && (
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
                  {MOMENTS.map((m) => (
                    <th key={m.key} style={{ textAlign: 'center' }}>
                      <button className="btn sm ghost" style={{ padding: '.2rem .4rem', fontSize: '.75rem' }} onClick={() => markAll(m.key as Moment)} title="Marcar todo lo de este momento">{m.label}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const t = trafficNow(p)
                  return (
                    <tr key={p.id} style={t === 'rojo' ? { opacity: 0.55 } : undefined}>
                      <td onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                        {p.name} {t && <span className={'tag ' + t}>{TRAFFIC_LABELS[t]}</span>}
                        <div className="meta">{p.dose}</div>
                      </td>
                      {MOMENTS.map((m) => {
                        const planned = p.moments.includes(m.key as Moment)
                        const taken = intakes.find((i) => i.product_id === p.id && i.moment === m.key)?.taken
                        return (
                          <td key={m.key} style={{ textAlign: 'center' }}>
                            {planned && (
                              <button type="button" className={'chip ' + (taken ? 'on' : '')} style={{ padding: '.3rem .6rem' }} onClick={() => toggle(p, m.key as Moment)} disabled={t === 'rojo'}>
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
        </Section>
      )}

      {(['alopatico', 'sup_ciclo', 'sup_fuera'] as ProductBlock[]).map((b) => {
        const list = products.filter((p) => p.block === b)
        if (!list.length) return null
        return (
          <Section key={b} title={`${BLOCK_LABELS[b]} (${list.length})`}>
            {list.map((p) => (
              <div className="item" key={p.id} onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                <div className="main">
                  <div>{p.name} <span className="muted small">{p.dose}</span></div>
                  <div className="meta">{p.moments.map((m) => MOMENTS.find((x) => x.key === m)?.label).join(', ')}{p.prescribed_by ? ` · ${p.prescribed_by}` : ''}</div>
                  <div>
                    {(['mtx', 'cddp_adm', 'nadir', 'infusion'] as const).map((k) => p.traffic[k] && <span key={k} className={'tag ' + p.traffic[k]}>{k === 'mtx' ? 'MTX' : k === 'cddp_adm' ? 'CDDP+ADM' : k === 'nadir' ? 'nadir' : 'infusión'}: {TRAFFIC_LABELS[p.traffic[k]!]}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </Section>
        )
      })}
      {ended.length > 0 && (
        <Section title={`Retirados (${ended.length})`}>
          {ended.map((p) => (
            <div className="item" key={p.id} onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
              <div className="main"><div>{p.name}</div><div className="meta">hasta {p.end_date}{p.end_reason ? ` · ${p.end_reason}` : ''}</div></div>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function ProductForm({ initial, onClose }: { initial: Partial<Product>; onClose: () => void }) {
  const [p, setP] = useState<Partial<Product>>({ moments: [], traffic: {}, ...initial })
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const consult = CONSULT_FIRST.some((k) => (p.name ?? '').toLowerCase().includes(k) || (p.composition ?? '').toLowerCase().includes(k))
  const TR: { value: Traffic; label: string; className: string }[] = [
    { value: 'verde', label: 'Verde', className: 's1' }, { value: 'ambar', label: 'Ámbar', className: 's2' }, { value: 'rojo', label: 'Rojo', className: 's3' },
  ]
  return (
    <div>
      <div className="row between">
        <h1>{p.id ? p.name : 'Nuevo producto'}</h1>
        <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
      </div>
      <div className="card">
        <Field label="Nombre comercial"><input type="text" value={p.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
        {consult && <div className="notice"><strong>Consultar antes de dar.</strong> Este producto (o su composición) está en la lista de interacciones importantes con el tratamiento (AINE, IBP, fólico, hierro, ginseng, curcumina…).</div>}
        <Field label="Bloque">
          <Segmented options={(['alopatico', 'sup_ciclo', 'sup_fuera'] as ProductBlock[]).map((b) => ({ value: b, label: BLOCK_LABELS[b] }))} value={p.block} onChange={(v) => set('block', v ?? 'sup_fuera')} />
        </Field>
        <Field label="Composición (copiar de la etiqueta)"><textarea value={p.composition ?? ''} onChange={(e) => set('composition', e.target.value)} /></Field>
        <div className="grid2">
          <Field label="Dosis por toma"><input type="text" value={p.dose ?? ''} onChange={(e) => set('dose', e.target.value)} placeholder="1 cápsula, 5 ml…" /></Field>
          <Field label="Pautado / autorizado por"><input type="text" value={p.prescribed_by ?? ''} onChange={(e) => set('prescribed_by', e.target.value)} placeholder="oncología, Dra. X, familia…" /></Field>
        </div>
        <Field label="Momentos del día">
          <div className="chips">
            {MOMENTS.map((m) => (
              <button key={m.key} type="button" className={'chip ' + (p.moments?.includes(m.key as Moment) ? 'on' : '')} onClick={() => set('moments', p.moments?.includes(m.key as Moment) ? p.moments.filter((x) => x !== m.key) : [...(p.moments ?? []), m.key as Moment])}>{m.label}</button>
            ))}
          </div>
        </Field>
        <div className="grid2">
          <Field label="Inicio"><input type="date" value={p.start_date ?? ''} onChange={(e) => set('start_date', e.target.value)} /></Field>
          <Field label="Retirada (si se retira)"><input type="date" value={p.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} /></Field>
        </div>
        {p.end_date && <Field label="Motivo de la retirada"><input type="text" value={p.end_reason ?? ''} onChange={(e) => set('end_reason', e.target.value)} /></Field>}
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
      <div className="row">
        <button className="btn" disabled={!p.name?.trim()} onClick={async () => { await save('products', { ...p, patient_id: currentPatientId() } as Product); onClose() }}>Guardar</button>
        {p.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar este producto? Mejor ponerle fecha de retirada para conservar el historial.')) { await remove('products', p.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
