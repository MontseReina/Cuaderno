import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useRows } from '../store'
import { addDays, todayStr } from '../domain/dates'
import { menuActivo } from '../domain/menu'
import { buildParte, fechaLarga, PUNTO, type DatosParte, type Linea, type RescateFila } from '../domain/parte'
import { DIA_MAX, DIA_MIN, META_PRINCIPAL } from '../domain/proteina'

/** 0.50.0 · Parte del día (llega a las 8:00 del día siguiente). Pedido de Montserrate, 19/11/2026. */
const ESTADO: Record<RescateFila['estado'], string> = { dada: 'Dado', np: 'No precisó', no_dada: 'No dado', sin_marcar: 'Sin marcar' }

function Lineas({ xs }: { xs: Linea[] }) {
  return (
    <ul className="parte-lineas">
      {xs.map((l, i) => (
        <li key={i} className={'parte-' + l.color}>
          <span aria-hidden>{PUNTO[l.color]}</span> {l.texto}{l.detalle && <span className="muted small"> · {l.detalle}</span>}
        </li>
      ))}
    </ul>
  )
}

export default function Parte() {
  const params = useParams()
  const nav = useNavigate()
  const today = todayStr()
  const ayer = addDays(today, -1)
  const date = params.date && params.date < today ? params.date : ayer
  const menus = useRows('menus')
  const data: DatosParte = {
    logs: useRows('daily_logs'),
    cycles: useRows('cycles'),
    products: useRows('products'),
    intakes: useRows('intakes'),
    weights: useRows('weights'),
    menu: menuActivo(menus)?.data ?? null,
    patient: useRows('patients')[0],
  }
  const p = useMemo(() => buildParte(date, data), [date, data.logs, data.cycles, data.products, data.intakes, data.weights, data.menu, data.patient]) // eslint-disable-line react-hooks/exhaustive-deps
  const ir = (d: string) => nav(`/parte/${d}`)
  const signosRojos = p.signos.filter((s) => s.color === 'rojo')
  const signosNaranja = p.signos.filter((s) => s.color === 'naranja')

  return (
    <div className="informe parte">
      <div className="row between noprint">
        <Link to="/informes" className="small">← Evaluaciones</Link>
        <button className="btn sm" onClick={() => window.print()}>⬇️ Descargar PDF</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', margin: '.6rem 0' }}>
        <button className="btn secondary sm noprint" onClick={() => ir(addDays(date, -1))} aria-label="Día anterior">‹</button>
        <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Parte del {fechaLarga(date)}</h1>
          <div className="muted small">{p.fase}{p.lugar ? ` · ${p.lugar}` : ''}</div>
        </div>
        <button className="btn secondary sm noprint" disabled={date >= ayer} onClick={() => ir(addDays(date, 1))} aria-label="Día siguiente">›</button>
      </div>

      {p.sinDatos ? (
        <div className="card"><p>Ese día no se registró nada en Huma.</p></div>
      ) : (
        <>
          <div className="card parte-resumen">
            <strong>{p.rojos ? `🔴 ${p.rojos}` : ''}{p.rojos && p.naranjas ? ' · ' : ''}{p.naranjas ? `🟠 ${p.naranjas}` : ''}{!p.rojos && !p.naranjas ? '🟢 Todo dentro de lo esperado' : ''}</strong>
            {p.sinRellenar.length > 0 && <div className="small">⚪ Se cerró sin rellenar: {p.sinRellenar.join(', ')}. Esos datos faltan: no quiere decir que no se hiciera.</div>}
          </div>

          <div className="card">
            <h3>🩺 Signos y síntomas</h3>
            {signosRojos.length + signosNaranja.length === 0 ? <p className="small">🟢 Sin signos fuera de lo normal.</p> : <Lineas xs={[...signosRojos, ...signosNaranja]} />}
            {p.deposiciones && <Lineas xs={[{ ...p.deposiciones, texto: '🚽 ' + p.deposiciones.texto }]} />}
            {signosRojos.length > 0 && <p className="small error-txt">Lo que sale en rojo se atiende en el momento según las indicaciones del hospital; este parte llega al día siguiente.</p>}
          </div>

          <div className="card">
            <h3>💊 Medicación de rescate</h3>
            {p.rescate.length === 0 ? <p className="muted small">No hay medicación de rescate pautada ese día.</p> : (
              <table className="tabla-avisos small">
                <tbody>
                  {p.rescate.map((r) => (
                    <tr key={r.nombre}>
                      <td><strong>{r.nombre}</strong></td>
                      <td className={r.estado === 'dada' ? 'parte-naranja' : r.estado === 'sin_marcar' ? 'muted' : ''}>
                        {ESTADO[r.estado]}{r.estado === 'dada' ? ` ${r.veces > 1 ? `${r.veces} veces` : ''}${r.momentos.length ? ` (${r.momentos.join(', ')})` : ''}` : ''}{r.motivo ? ` · ${r.motivo}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {p.rescatesNausea.length > 0 && <p className="small">Apuntado en náuseas: {p.rescatesNausea.join(' · ')}</p>}
          </div>

          <div className="card">
            <h3>🍽 Nutrición</h3>
            <Lineas xs={p.nutricion} />
            {p.proteina && (
              <div className="parte-prot">
                <div className="small"><span aria-hidden>{PUNTO[p.proteina.color]}</span> <strong>Proteína del día: {p.proteina.total} g</strong> <span className="muted">· ideal {DIA_MIN}–{DIA_MAX} g</span></div>
                <div className="parte-cuadros">
                  {p.proteina.tomas.map((t) => (
                    <div key={t.label} className={'parte-cuadro parte-' + t.color}>
                      <div className="small">{t.label}</div>
                      <strong>{t.registrada ? `${t.g} g` : '—'}</strong>
                      <div className="muted small">mín. {META_PRINCIPAL} g</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3>💧 Hidratación</h3>
            {p.hidratacion && <Lineas xs={[p.hidratacion]} />}
          </div>

          <div className="card">
            <h3>🌙 Energía y descanso</h3>
            <Lineas xs={p.descanso} />
            <p className="muted small">Sueño y horas entre cena y dormir: la noche que termina la mañana de este día.</p>
          </div>

          <div className="card">
            <h3>➕ Otros</h3>
            <Lineas xs={p.otros} />
            {p.notas && <p className="small"><strong>Notas del día:</strong> {p.notas}</p>}
          </div>
        </>
      )}
    </div>
  )
}
