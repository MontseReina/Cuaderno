import { Link } from 'react-router-dom'
import { useRows } from '../store'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import { carbProfile, eatingWindow, meanIntake, overnightFast } from '../domain/nutrition'
import { CARB_HELP, CUP_ML } from '../domain/catalogs'
import { Section } from '../components/ui'

/** Pilar 6 · Nutrición, hidratación y eje metabólico — vista de análisis.
 *  Los datos se introducen en el Registro diario; aquí se leen y se comparan. */
export default function Nutricion() {
  const today = todayStr()
  const logs = useRows('daily_logs')
  const cycles = useRows('cycles')
  const products = useRows('products')
  const panels = useRows('lab_panels').sort((a, b) => a.date.localeCompare(b.date))
  const results = useRows('lab_results')
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const t = byDate.get(today)

  const corticoidDays = new Set<string>()
  for (const c of cycles.filter((c) => c.corticoid_iv)) {
    const d0 = (c.start_at ?? c.planned_date).slice(0, 10)
    for (let i = 0; i <= 3; i++) corticoidDays.add(addDays(d0, i))
  }
  const oralCortico = products.filter((p) => /dexametasona|prednis|corticoi|metilpred|hidrocortisona/i.test(p.name + ' ' + (p.composition ?? '')))

  const gluco = ['glucosa', 'insulina', 'hba1c'].map((k) => ({
    key: k,
    rows: panels.map((p) => ({ date: p.date, r: results.find((r) => r.panel_id === p.id && r.analyte === k) })).filter((x) => x.r),
  }))
  const weights = logs.filter((l) => l.weight != null).sort((a, b) => a.date.localeCompare(b.date)).slice(-8)

  const pct = (v: number | null) => (v == null ? '—' : Math.round(v * 100) + ' %')
  const bar = (v: number | null | undefined, max: number, color = 'var(--primary)') => (
    <span style={{ display: 'inline-block', width: 60, height: 8, background: 'var(--line)', borderRadius: 4, verticalAlign: 'middle' }}>
      <span style={{ display: 'block', width: `${Math.min(100, ((v ?? 0) / max) * 100)}%`, height: 8, background: color, borderRadius: 4 }} />
    </span>
  )

  return (
    <div>
      <h1>Nutrición, hidratación y eje metabólico</h1>
      <p className="muted small">Todo se registra en el <Link to="/diario">Registro diario</Link> (comidas por fracción del plato y carga de hidratos, líquidos). Aquí se ve la evolución.</p>

      <div className="card">
        <div className="row between"><strong>Hoy</strong><Link className="btn sm secondary" to={`/diario/${today}`}>Registrar</Link></div>
        {!t ? <div className="muted">Sin registro de hoy.</div> : (
          <div className="grid2" style={{ marginTop: '.4rem' }}>
            <div><div className="muted small">Ingesta media</div><strong>{pct(meanIntake(t.meals))}</strong></div>
            <div><div className="muted small">Perfil de hidratos</div><strong>{carbProfile(t.meals)}</strong></div>
            <div><div className="muted small">Líquidos</div><strong>{t.fluids_total_ml ?? '—'} ml</strong> <span className="muted small">(agua {t.water_ml ?? '—'} · agua de mar {t.seawater_ml ?? '—'})</span></div>
            <div><div className="muted small">Caldo de Santa Paciencia</div><strong>{t.broth_cups ?? 0} × {CUP_ML} ml</strong></div>
            <div><div className="muted small">Ventana de alimentación</div><strong>{eatingWindow(t.meals) ? `${eatingWindow(t.meals)!.first}–${eatingWindow(t.meals)!.last} (${eatingWindow(t.meals)!.hours} h)` : '—'}</strong></div>
            <div><div className="muted small">Ayuno nocturno</div><strong>{overnightFast(t, byDate.get(addDays(today, -1))) ?? '—'} h</strong></div>
          </div>
        )}
      </div>

      <Section title="Últimos 14 días" open>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Día</th><th>Ingesta</th><th>Hidratos</th><th>Líquidos</th><th>Ventana</th><th>Ayuno</th></tr></thead>
            <tbody>
              {days.map((d) => {
                const l = byDate.get(d)
                const w = l ? eatingWindow(l.meals) : null
                const f = l ? overnightFast(l, byDate.get(addDays(d, -1))) : null
                return (
                  <tr key={d} style={corticoidDays.has(d) ? { background: '#fdf5dd' } : undefined}>
                    <td><Link to={`/diario/${d}`}>{d.slice(5)}</Link>{corticoidDays.has(d) && <span className="tag ambar" title="corticoide IV">C</span>}</td>
                    <td>{l ? <>{bar(meanIntake(l.meals), 1)} {pct(meanIntake(l.meals))}</> : '—'}</td>
                    <td className="small">{l ? carbProfile(l.meals).replace(' (orientativo)', '') : '—'}</td>
                    <td>{l?.fluids_total_ml != null ? <>{bar(l.fluids_total_ml, 1500, '#3b82c4')} {l.fluids_total_ml}</> : '—'}</td>
                    <td className="small">{w ? `${w.hours} h` : '—'}</td>
                    <td className="small">{f != null ? `${f} h` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Filas sombreadas: días con corticoide intravenoso (afecta a la glucosa y al apetito). Ventana = de la primera a la última ingesta del día; la regularidad de horarios se ve comparando la columna.</p>
      </Section>

      <Section title="Peso">
        {weights.length === 0 ? <div className="muted">Sin pesadas.</div> : (
          <div>
            <div className="spark">{weights.map((l) => { const min = Math.min(...weights.map((x) => x.weight!)) - 1; const max = Math.max(...weights.map((x) => x.weight!)); return <span key={l.id} style={{ height: `${Math.max(4, ((l.weight! - min) / (max - min || 1)) * 40)}px` }} title={`${l.date}: ${l.weight} kg`} /> })}</div>
            <div className="muted small">{weights.map((l) => `${l.date.slice(5)}: ${l.weight} kg`).join(' · ')}</div>
          </div>
        )}
      </Section>

      <Section title="Eje glucosa – insulina">
        <p className="muted small">Se lee de las analíticas (no se vuelve a teclear). Días con corticoide: {corticoidDays.size ? Array.from(corticoidDays).sort().slice(-6).map((d) => d.slice(5)).join(', ') : 'ninguno registrado'}{oralCortico.length ? ` · corticoide oral en la pauta: ${oralCortico.map((p) => p.name).join(', ')}` : ''}.</p>
        {gluco.every((g) => g.rows.length === 0) && <div className="muted">Sin glucosa, insulina ni HbA1c en las analíticas registradas.</div>}
        {gluco.filter((g) => g.rows.length).map((g) => (
          <div key={g.key} style={{ marginBottom: '.5rem' }}>
            <strong className="small">{{ glucosa: 'Glucosa (mg/dL)', insulina: 'Insulina (µU/mL)', hba1c: 'HbA1c (%)' }[g.key]}</strong>
            <div className="muted small">{g.rows.map((x) => `${fmtDate(x.date)}: ${x.r!.value}${corticoidDays.has(x.date) ? ' (corticoide)' : ''}`).join(' · ')}</div>
          </div>
        ))}
      </Section>

      <Section title="Qué significa cada carga de hidratos">
        {Object.values(CARB_HELP).map((c) => <p key={c.label} className="small"><strong>{c.label}:</strong> {c.help}</p>)}
        <p className="muted small">El perfil diario (cetogénico / low carb / moderado / alto) es orientativo: se calcula con la media de las etiquetas del día. No se miden cetonas.</p>
      </Section>
    </div>
  )
}
