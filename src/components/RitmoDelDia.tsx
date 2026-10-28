import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useRows } from '../store'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import {
  AREA_ICO, AREA_LABEL, desviaciones, grupoDe, GRUPO_LABEL, MOMENTOS, ml, ritmoDe, RITMO_LABEL, RITMO_NIVEL,
  type Area, type AvisoRow, type Desviacion, type Momento,
  MANO_HORAS, MANO_MOMENTOS,
} from '../domain/avisos'

/** 0.34.0 · Evaluaciones → Ritmo del día y desviaciones. Lee los controles de las 12, 16 y 19 h y el cierre de cada día
 *  (tabla `avisos`, la escribe el servidor). Objetivo de Montserrate: ver si el cuidado va bien durante el día o se
 *  recupera con prisas al final. */

const AREAS_RITMO: Area[] = ['agua', 'comidas', 'temperatura']
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
const hora = (m: string) => `${m} h`
const valorTxt = (area: string, v?: number | null) => v == null ? '—' : area === 'agua' ? `${ml(v)} ml` : String(v)
const GRUPO_CORTO: Record<string, string> = { quimio: 'Quimio', nadir: 'Nadir', hospital: 'Hospital', otro: '' }
const fechaCorta = (f: string) => new Date(f + 'T12:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })

function useRango(defDias = 14) {
  const [sp, setSp] = useSearchParams()
  const hasta = sp.get('hasta') ?? todayStr()
  const desde = sp.get('desde') ?? addDays(hasta, -(defDias - 1))
  const set = (k: 'desde' | 'hasta', v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }
  return { desde, hasta, set }
}

function TablaDesviaciones({ d }: { d: Desviacion[] }) {
  return (
    <div className="desv">
      {d.filter((x) => AREAS_RITMO.includes(x.area)).map((x) => {
        const peor = (Object.entries(x.porMomento) as [Momento, number][]).sort((a, b) => b[1] - a[1])[0]
        const grupos = Object.entries(x.porModo).filter(([, v]) => v.dias > 0)
        return (
          <div key={x.area} className="desv-fila">
            <div className="desv-cab"><strong>{AREA_ICO[x.area]} {AREA_LABEL[x.area]}</strong><span className="muted small">{x.dias} {x.dias === 1 ? 'día' : 'días'}</span></div>
            <div className="ritmo-barra" role="img" aria-label={`A tiempo ${x.aTiempo}, llega al final ${x.alFinal}, no llega ${x.noLlega}`}>
              {x.aTiempo > 0 && <span className="verde" style={{ flexGrow: x.aTiempo }}>{x.aTiempo}</span>}
              {x.alFinal > 0 && <span className="amarillo" style={{ flexGrow: x.alFinal }}>{x.alFinal}</span>}
              {x.noLlega > 0 && <span className="rojo" style={{ flexGrow: x.noLlega }}>{x.noLlega}</span>}
            </div>
            <div className="small muted">
              🟢 {pct(x.aTiempo, x.dias)} % · 🟡 {pct(x.alFinal, x.dias)} % · 🔴 {pct(x.noLlega, x.dias)} %
              {peor && peor[1] > 0 ? ` · va por detrás sobre todo a las ${hora(peor[0])}` : ''}
            </div>
            {grupos.length > 1 && (
              <div className="small muted">{grupos.map(([k, v]) => `${GRUPO_LABEL[k] ?? k}: ${v.dias - v.noLlega - v.alFinal} 🟢 ${v.alFinal} 🟡 ${v.noLlega} 🔴`).join(' · ')}</div>
            )}
          </div>
        )
      })}
      {d.filter((x) => !AREAS_RITMO.includes(x.area)).map((x) => (
        <div key={x.area} className="desv-fila small">
          <strong>{AREA_ICO[x.area]} {AREA_LABEL[x.area]}</strong>: {x.noLlega ? `${x.noLlega} ${x.noLlega === 1 ? 'día' : 'días'} con aviso (${x.area === 'peso' ? '3 días o más sin pesar' : x.area === 'cena' ? 'cena sin apuntar a las 19 h' : x.area === 'paseos' ? 'sin caminar tras alguna comida principal' : '2 días o más sin deposición'})` : 'ningún aviso'}
        </div>
      ))}
    </div>
  )
}

/** Celda de un apartado en un día: los tres controles (✓ a su hora / • por detrás) y cómo terminó. */
function Celda({ rows, date, area }: { rows: AvisoRow[]; date: string; area: Area }) {
  const del = rows.filter((r) => r.date === date && r.area === area)
  if (!del.length) return <td className="muted">—</td>
  const rt = ritmoDe(rows, date, area)
  const fin = del.find((r) => r.momento === 'final')
  return (
    <td className={'ritmo-celda ' + (rt ? RITMO_NIVEL[rt] : '')} title={rt ? RITMO_LABEL[rt] : 'Día sin cerrar'}>
      <span className="ritmo-puntos">
        {MOMENTOS.map((m) => {
          const c = del.find((r) => r.momento === m)
          return <span key={m} className={'rp ' + (c == null ? 'nd' : c.ok ? 'ok' : 'tarde')} title={c ? `${m} h: ${valorTxt(area, c.valor)} de ${valorTxt(area, c.meta)}` : `${m} h: sin control`}>{c == null ? '·' : c.ok ? '✓' : '•'}</span>
        })}
      </span>
      <span className="ritmo-fin">{fin ? (area === 'agua' ? ml(fin.valor ?? 0) : `${fin.valor ?? '—'}/${fin.meta ?? '—'}`) : 'abierto'}</span>
    </td>
  )
}

function TablaDias({ rows, fechas }: { rows: AvisoRow[]; fechas: string[] }) {
  return (
    <div className="tabla-scroll">
      <table className="tabla-ritmo tabla-dias small">
        <thead><tr><th>Día</th><th>💧 Agua (ml)</th><th>🍽 Tomas</th><th>🌡 Temp.</th><th>🔔</th></tr></thead>
        <tbody>
          {fechas.map((f) => {
            const env = rows.filter((r) => r.date === f && r.area === 'envio' && r.titulo && !r.momento.startsWith('prueba'))
            const extra = rows.filter((r) => r.date === f && (r.area === 'peso' || r.area === 'deposiciones' || r.area === 'cena' || r.area === 'paseos') && r.ok === false)
            const g = grupoDe(rows.find((r) => r.date === f && r.area === 'agua'))
            return (
              <tr key={f}>
                <th>{fechaCorta(f)}<div className="muted">{GRUPO_CORTO[g] ?? ''}</div></th>
                {AREAS_RITMO.map((a) => <Celda key={a} rows={rows} date={f} area={a} />)}
                <td>{env.length}{extra.map((x) => <span key={x.id}> {AREA_ICO[x.area as Area]}</span>)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Bloque de la portada de Evaluaciones. */
export function RitmoResumen() {
  const rows = useRows('avisos')
  const { desde, hasta, set } = useRango(14)
  const enRango = useMemo(() => rows.filter((r) => r.date >= desde && r.date <= hasta), [rows, desde, hasta])
  const fechas = [...new Set(enRango.filter((r) => r.area !== 'envio' || !r.momento.startsWith('prueba')).map((r) => r.date))].sort().reverse()
  const d = useMemo(() => desviaciones(enRango, desde, hasta), [enRango, desde, hasta])
  return (
    <div className="ritmo">
      <p className="muted small">Cada día se mira a las 12, 16 y 19 h si el agua, las tomas y la temperatura van a su ritmo, y a medianoche cómo terminó. <strong>🟢 A tiempo</strong>: iba bien en los tres controles. <strong>🟡 Llega al final</strong>: cumplió, pero recuperando por la tarde o la noche. <strong>🔴 No llega</strong>: terminó el día sin la meta.</p>
      <div className="row wrap noprint" style={{ gap: '.5rem', alignItems: 'flex-end' }}>
        <label className="field small"><span>Desde</span><input type="date" value={desde} max={hasta} onChange={(e) => set('desde', e.target.value)} /></label>
        <label className="field small"><span>Hasta</span><input type="date" value={hasta} min={desde} onChange={(e) => set('hasta', e.target.value)} /></label>
        <Link className="btn sm secondary" to={`/informes/avisos?desde=${desde}&hasta=${hasta}`}>🖨 Ver e imprimir todos los avisos</Link>
      </div>
      {!fechas.length ? (
        <p className="muted small">Todavía no hay controles en estas fechas. Se guardan solos desde el primer día con avisos.</p>
      ) : (
        <>
          <h3>Desviaciones</h3>
          <TablaDesviaciones d={d} />
          <h3>Día a día</h3>
          <p className="muted small">✓ iba a su ritmo a esa hora · • iba por detrás (12, 16 y 19 h) · al lado, cómo terminó el día.</p>
          <TablaDias rows={enRango} fechas={fechas} />
        </>
      )}
    </div>
  )
}

const MOMENTO_TXT: Record<string, string> = { '12': '12:00', '16': '16:00', '19': '19:00', '21': '21:00', cama: 'A dormir', caminar_desayuno: 'Caminar (desayuno)', caminar_comida: 'Caminar (comida)', caminar_cena: 'Caminar (cena)', '2130': '21:30', ayuno11: 'Ayuno 11 h', ayuno12: 'Ayuno 12 h', final: 'Cierre', prueba: 'Prueba', ...Object.fromEntries(MANO_HORAS.map((h) => [`mano_${h}`, `Mano ${h}:00`])) }
/** Orden por hora aproximada; los de la mano van justo antes del control de su misma hora. */
const HORA_ORDEN: Record<string, string> = { ayuno11: '08:59', ayuno12: '09:00', caminar_desayuno: '09:30', '12': '12:01', caminar_comida: '15:00', '16': '16:01', '19': '19:01', caminar_cena: '20:30', '21': '21:01', cama: '21:10', '2130': '21:31', final: '23:59' }
const ORDEN = [...Object.keys(HORA_ORDEN), ...MANO_MOMENTOS].sort((a, b) => (HORA_ORDEN[a] ?? `${a.slice(5)}:00`).localeCompare(HORA_ORDEN[b] ?? `${b.slice(5)}:00`))

/** Evaluaciones → Avisos (para imprimir o guardar en PDF): todos los avisos enviados y los controles, día a día. */
export function AvisosImprimir() {
  const rows = useRows('avisos')
  const patient = useRows('patients')[0]
  const { desde, hasta, set } = useRango(14)
  const enRango = rows.filter((r) => r.date >= desde && r.date <= hasta && !r.momento.startsWith('prueba'))
  const fechas = [...new Set(enRango.map((r) => r.date))].sort()
  const d = desviaciones(enRango, desde, hasta)
  return (
    <div className="informe avisos-informe">
      <div className="noprint row between" style={{ marginBottom: '.6rem' }}>
        <Link to="/informes" className="small">← Evaluaciones</Link>
        <button className="btn sm" onClick={() => window.print()}>🖨 Imprimir o guardar en PDF</button>
      </div>
      <h1>Avisos y ritmo del día</h1>
      <p className="muted small">{patient?.name ? `${patient.name} · ` : ''}del {fmtDate(desde)} al {fmtDate(hasta)}</p>
      <div className="row wrap noprint" style={{ gap: '.5rem' }}>
        <label className="field small"><span>Desde</span><input type="date" value={desde} max={hasta} onChange={(e) => set('desde', e.target.value)} /></label>
        <label className="field small"><span>Hasta</span><input type="date" value={hasta} min={desde} onChange={(e) => set('hasta', e.target.value)} /></label>
      </div>
      {!fechas.length ? <p className="muted">No hay avisos en estas fechas.</p> : (
        <>
          <h2>Desviaciones</h2>
          <TablaDesviaciones d={d} />
          <h2>Día a día</h2>
          {fechas.map((f) => {
            const del = enRango.filter((r) => r.date === f)
            const momentos = ORDEN.filter((m) => del.some((r) => r.momento === m))
            const g = grupoDe(del.find((r) => r.area === 'agua'))
            return (
              <div key={f} className="card avisos-dia">
                <strong>{fmtDate(f)}</strong> <span className="muted small">{GRUPO_LABEL[g] ?? ''}</span>
                <table className="tabla-ritmo small">
                  <tbody>
                    {momentos.map((m) => {
                      const env = del.find((r) => r.momento === m && r.area === 'envio')
                      const ctrl = del.filter((r) => r.momento === m && r.area !== 'envio')
                      return (
                        <tr key={m}>
                          <th>{MOMENTO_TXT[m] ?? m}</th>
                          <td>
                            {ctrl.length > 0 && (
                              <div className="ctrl-linea">
                                {ctrl.map((c) => (
                                  <span key={c.id} className={c.ok ? 'ok-txt' : 'error-txt'}>
                                    {c.area === 'registro'
                                      ? (c.ok ? '✓ Todo rellenado' : `Sin rellenar: ${c.texto ?? ''}`)
                                      : <>{AREA_ICO[c.area as Area]} {c.area === 'cena' ? '' : valorTxt(c.area, c.valor)}{c.area === 'cena' ? (c.ok ? ' cena apuntada' : ' cena sin apuntar') : c.area === 'paseos' ? ` de ${c.meta} paseos tras comer` : c.area === 'peso' || c.area === 'deposiciones' ? ' días' : ` de ${valorTxt(c.area, c.meta)}`} {c.ok ? '✓' : '•'}</>}
                                  </span>
                                ))}
                              </div>
                            )}
                            {env?.titulo
                              ? <div className="aviso-texto">🔔 <em>{env.texto}</em>{env.enviados != null && <span className="muted"> · llegó a {env.enviados} {env.enviados === 1 ? 'móvil' : 'móviles'}</span>}</div>
                              : MOMENTOS.includes(m as Momento) && <div className="muted">Iba a su ritmo: sin aviso.</div>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </>
      )}
      <p className="muted small">Los avisos se mandan a los móviles con los avisos activados (Más → 🔔 Avisos al móvil). Los controles miran lo apuntado en la app a esa hora.</p>
    </div>
  )
}
