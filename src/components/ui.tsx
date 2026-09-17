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
