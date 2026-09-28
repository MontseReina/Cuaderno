import type { DailyLog } from '../store/types'
import { addDays } from '../domain/dates'
import { SYNC_ITEMS } from '../domain/catalogs'

/** Sueño y ritmo circadiano de la semana (lunes a domingo). Estaba en Biohacking con 14 días;
 *  desde la 0.23.0 va en Evaluaciones y es semanal (pedido en «New mock up v2»). */
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
function horas(s?: string | null, e?: string | null) {
  if (!s || !e) return null
  const [sh, sm] = s.split(':').map(Number)
  const [eh, em] = e.split(':').map(Number)
  let h = eh + em / 60 - (sh + sm / 60)
  if (h < 0) h += 24
  return Math.round(h * 10) / 10
}

export function SuenoSemana({ lunes, logs }: { lunes: string; logs: DailyLog[] }) {
  const dias = Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const conSueno = dias.map((d) => byDate.get(d)).filter((l): l is DailyLog => !!l)
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
  const hs = conSueno.map((l) => horas(l.sleep_start, l.sleep_end)).filter((x): x is number => x != null)
  const adherencia = (k: (typeof SYNC_ITEMS)[number]['key']) => (conSueno.length ? Math.round((conSueno.filter((l) => l[k] || l.extra?.sync?.[k]?.done).length / conSueno.length) * 100) : 0)
  const causas: Record<string, number> = {}
  for (const l of conSueno) if (l.wakeup_cause && (l.wakeups ?? 0) > 0) causas[l.wakeup_cause] = (causas[l.wakeup_cause] ?? 0) + 1
  if (!conSueno.length) return <div className="muted small">Sin registros de sueño esta semana.</div>
  const maxH = 12
  return (
    <div>
      <div className="grid3">
        <div><div className="muted small">Horas dormidas</div><strong>{avg(hs) != null ? `${String(avg(hs)).replace('.', ',')} h` : '—'}</strong></div>
        <div><div className="muted small">Despertares / noche</div><strong>{String(avg(conSueno.map((l) => l.wakeups ?? 0)) ?? '—').replace('.', ',')}</strong></div>
        <div><div className="muted small">Causa más frecuente</div><strong>{Object.entries(causas).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'}</strong></div>
      </div>
      <div className="sueno-barras" role="img" aria-label="Horas dormidas cada noche de la semana">
        {dias.map((d, i) => {
          const l = byDate.get(d)
          const h = l ? horas(l.sleep_start, l.sleep_end) : null
          return (
            <div key={d} className="sueno-dia" title={h != null ? `${h} h` : 'sin dato'}>
              <span className="sueno-val">{h != null ? String(h).replace('.', ',') : ''}</span>
              <span className="sueno-bar" style={{ height: `${h ? Math.min(100, (h / maxH) * 100) : 3}%`, opacity: h ? 1 : 0.25 }} />
              <span className="sueno-lbl">{DIAS[i]}</span>
            </div>
          )
        })}
      </div>
      <h3>Cumplimiento de los sincronizadores</h3>
      <div className="table-wrap"><table className="table"><tbody>
        {SYNC_ITEMS.map(({ key: k, label }) => (
          <tr key={k}><td>{label}</td><td style={{ width: '3.5rem', textAlign: 'right' }}>{adherencia(k)} %</td><td style={{ width: 90 }}><span style={{ display: 'block', width: 80, height: 8, background: 'var(--line)', borderRadius: 4 }}><span style={{ display: 'block', width: `${adherencia(k)}%`, height: 8, background: 'var(--primary)', borderRadius: 4 }} /></span></td></tr>
        ))}
      </tbody></table></div>
    </div>
  )
}
