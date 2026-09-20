import { useEffect, useState, type ReactNode } from 'react'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <div className="muted small">{hint}</div>}
    </label>
  )
}

export function Segmented<T extends string | number>({
  options, value, onChange, className,
}: { options: { value: T; label: string; className?: string }[]; value: T | null | undefined; onChange: (v: T | null) => void; className?: string }) {
  return (
    <div className={'seg ' + (className ?? '')}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={(value === o.value ? 'on ' : '') + (o.className ?? '')}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Severity({ value, onChange, labels }: { value: number | undefined; onChange: (v: number) => void; labels: readonly string[] }) {
  return (
    <div className="seg severity">
      {labels.map((l, i) => (
        <button key={i} type="button" className={(value ?? 0) === i ? `on s${i}` : ''} onClick={() => onChange(i)}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1 }: { value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number }) {
  const v = value ?? null
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, (v ?? 0) - step))}>−</button>
      <input type="number" inputMode="decimal" value={v ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      <button type="button" onClick={() => onChange(Math.min(max, (v ?? 0) + step))}>+</button>
    </div>
  )
}

export function Faces({ value, onChange, faces }: { value: number | null | undefined; onChange: (v: number | null) => void; faces: string[] }) {
  return (
    <div className="faces">
      {faces.map((f, i) => (
        <button key={i} type="button" className={value === i + 1 ? 'on' : ''} onClick={() => onChange(value === i + 1 ? null : i + 1)} aria-label={`nivel ${i + 1}`}>
          {f}
        </button>
      ))}
    </div>
  )
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className={'check ' + (checked ? 'done' : '')}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

export function Section({ title, children, open, right }: { title: string; children: ReactNode; open?: boolean; right?: ReactNode }) {
  return (
    <details className="section" open={open}>
      <summary>
        <span>{title}</span>
        {right}
      </summary>
      <div className="body">{children}</div>
    </details>
  )
}

export function Toast({ msg }: { msg: string }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    setShow(true)
    const t = setTimeout(() => setShow(false), 1800)
    return () => clearTimeout(t)
  }, [msg])
  if (!show || !msg) return null
  return <div className="toast">{msg}</div>
}

export function useToast() {
  const [msg, setMsg] = useState('')
  const [n, setN] = useState(0)
  const toast = (m: string) => {
    setMsg(m)
    setN((x) => x + 1)
  }
  return { toast, node: msg ? <Toast key={n} msg={msg} /> : null }
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

/** Escala de Bristol con dibujos (1 = bolas duras … 7 = líquida). */
const BRISTOL_SHAPES: ((c: string) => ReactNode)[] = [
  (c) => <>{[8, 20, 32].map((x) => <circle key={x} cx={x} cy={14} r={5} fill={c} />)}<circle cx={14} cy={24} r={5} fill={c} /><circle cx={27} cy={25} r={5} fill={c} /></>,
  (c) => <><rect x={4} y={12} width={32} height={14} rx={7} fill={c} />{[10, 17, 24, 31].map((x) => <circle key={x} cx={x} cy={12 + (x % 2 ? 2 : 12)} r={4} fill={c} />)}</>,
  (c) => <><rect x={4} y={13} width={32} height={13} rx={6.5} fill={c} />{[11, 18, 25, 31].map((x) => <line key={x} x1={x} y1={13} x2={x} y2={19} stroke="#fff" strokeWidth={1.5} />)}</>,
  (c) => <rect x={4} y={13} width={32} height={13} rx={6.5} fill={c} />,
  (c) => <>{[[8, 14], [22, 12], [32, 22], [14, 26]].map(([x, y]) => <ellipse key={x + '-' + y} cx={x} cy={y} rx={6} ry={4.5} fill={c} />)}</>,
  (c) => <path d="M6 22c2-8 8-10 14-8s10-2 14 4c2 4-2 9-8 9s-9 3-14 1c-4-1-7-3-6-6z" fill={c} />,
  (c) => <><path d="M4 18c6-4 12 4 18 0s10-2 14 2" stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" /><path d="M6 27c6-4 12 3 18-1s8-2 12 1" stroke={c} strokeWidth={4} fill="none" strokeLinecap="round" /></>,
]
export function Bristol({ value, onChange, help }: { value: number | null | undefined; onChange: (v: number | null) => void; help: readonly string[] }) {
  return (
    <div>
      <div className="bristol">
        {BRISTOL_SHAPES.map((draw, i) => {
          const n = i + 1
          const on = value === n
          return (
            <button key={n} type="button" className={on ? 'on' : ''} onClick={() => onChange(on ? null : n)} title={help[n]} aria-label={`Bristol ${n}`}>
              <svg viewBox="0 0 40 36" width="40" height="36">{draw(on ? '#fff' : '#8a6d3b')}</svg>
              <span>{n}</span>
            </button>
          )
        })}
      </div>
      {value ? <div className="muted small">Tipo {value}: {help[value]}</div> : null}
    </div>
  )
}

/** Tabla editable de medicamentos (Nombre · mg · Posología · Motivo · [Vía] · [Náusea / Suficiente]). */
export interface MedColumn { key: 'name' | 'mg' | 'posology' | 'reason' | 'route' | 'nausea' | 'sufficient'; label: string }
export function MedTable<T extends { name: string }>({ rows, onChange, columns, render }: {
  rows: T[]
  onChange: (rows: T[]) => void
  columns: MedColumn[]
  render: (row: T, key: MedColumn['key'], set: (patch: Partial<T>) => void) => ReactNode
}) {
  const setRow = (i: number, patch: Partial<T>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="table-wrap">
      <table className="table medtable">
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c.key}>{render(r, c.key, (p) => setRow(i, p))}</td>)}
              <td><button type="button" className="btn sm ghost" onClick={() => onChange(rows.filter((_, j) => j !== i))} title="Quitar">✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn sm secondary" onClick={() => onChange([...rows, { name: '' } as T])}>+ Añadir fila</button>
    </div>
  )
}
