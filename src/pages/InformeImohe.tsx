import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { currentPatientId, save, useRows } from '../store'
import { addDays, todayStr, weekStart } from '../domain/dates'
import { menuActivo } from '../domain/menu'
import { initials } from '../domain/exporter'
import { TOMAS } from '../domain/catalogs'
import { buildInformeImohe, diaCorto, diaLargo, METAS, type Celda, type DatosInforme, type FilaDia, type GrupoHueco, type Sem, type Tarjeta } from '../domain/informeImohe'

/** Informe semanal de cuidados para Imohe (0.36.0). Diseño aprobado por Montserrate el 19/10/2026. */
const SEM_TXT: Record<Sem, string> = { verde: 'Cumple', ambar: 'Se queda corto', rojo: 'Desviado', gris: 'Sin datos' }
const ddmm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
const es = (x: number) => String(x).replace('.', ',')
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)

export default function InformeImohe() {
  const params = useParams()
  const nav = useNavigate()
  const today = todayStr()
  // Por defecto, la semana de ayer: el lunes se abre la semana que acaba de cerrarse.
  const ws = params.date ? weekStart(params.date) : weekStart(addDays(today, -1))
  const menus = useRows('menus')
  const data: DatosInforme = {
    logs: useRows('daily_logs'),
    cycles: useRows('cycles'),
    products: useRows('products'),
    intakes: useRows('intakes'),
    weights: useRows('weights'),
    menu: menuActivo(menus)?.data ?? null,
    patient: useRows('patients')[0],
  }
  const deps = [ws, today, data.logs, data.cycles, data.products, data.intakes, data.weights, data.menu, data.patient]
  const r = useMemo(() => buildInformeImohe(ws, data, today), deps) // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => buildInformeImohe(addDays(ws, -7), data, today), deps) // eslint-disable-line react-hooks/exhaustive-deps
  const [enviadas, setEnviadas] = useState<Record<number, boolean>>({})
  const aPreguntas = async (i: number, texto: string) => {
    await save('questions', { patient_id: currentPatientId(), professional: 'Oncología integrativa', question: `${texto} (semana del ${ddmm(r.ws)} al ${ddmm(r.we)})`, status: 'pendiente' } as never)
    setEnviadas((s) => ({ ...s, [i]: true }))
  }
  const flecha = (t: Tarjeta) => {
    const p = prev.tarjetas.find((x) => x.key === t.key)
    if (t.pct == null || p?.pct == null) return null
    return t.pct > p.pct ? '↑' : t.pct < p.pct ? '↓' : '='
  }
  const huecos = (tipo: GrupoHueco['tipo']) => r.huecos.filter((h) => h.tipo === tipo)

  return (
    <div className="informe ii">
      <div className="row between noprint">
        <Link to="/informes" className="small">← Evaluaciones</Link>
        <button className="btn sm" onClick={() => window.print()}>⬇️ Descargar PDF</button>
      </div>
      <div className="row between noprint" style={{ margin: '.4rem 0 .6rem' }}>
        <button className="btn sm ghost" aria-label="Semana anterior" onClick={() => nav(`/informes/semanal/${addDays(ws, -7)}`)}>‹</button>
        <strong className="small">Cambiar de semana</strong>
        <button className="btn sm ghost" aria-label="Semana siguiente" disabled={r.enCurso} onClick={() => nav(`/informes/semanal/${addDays(ws, 7)}`)}>›</button>
      </div>

      {/* Cabecera */}
      <div className="ii-head">
        <div className="ii-eyebrow">Informe semanal de cuidados · Imohe · {initials(data.patient?.name)}</div>
        <h1>Del lunes {ddmm(r.ws)} al domingo {ddmm(r.we)}/{r.we.slice(0, 4)}</h1>
        <div className="muted small">
          Datos tomados del {ddmm(r.ws)} a las 00:00 al {ddmm(r.we)} a las 23:59
          {r.enCurso && <> · <strong>semana en curso</strong> ({r.days.length} de 7 días cerrados)</>}
        </div>
        <div className="ii-meta">
          <span><b>Fase:</b> {r.cabecera.fase}</span>
          <span><b>Pauta:</b> {r.cabecera.pauta}</span>
          <span><b>Ingestas:</b> {METAS.ingestas} al día (4 en semana de quimio)</span>
          <span><b>Dónde:</b> {r.cabecera.casa} en casa{r.cabecera.hospital ? ` · ${r.cabecera.hospital} en el hospital` : ''}</span>
        </div>
      </div>

      {/* Registro de la semana */}
      <section className="ii-reg">
        <div className="row between" style={{ flexWrap: 'wrap', gap: '.3rem' }}>
          <strong>Registro de la semana</strong>
          <span className="muted small">{r.diasConDatos} de {r.days.length} días con datos · {r.pesadas.length ? `se pesó ${r.pesadas.length} ${r.pesadas.length === 1 ? 'día' : 'días'} (${r.pesadas.map(diaCorto).join(', ')})` : 'sin pesadas'}</span>
        </div>
        {r.datosInsuficientes && <div className="ii-aviso">Hay menos de 4 días con datos: los resultados de esta semana son poco fiables («datos insuficientes»).</div>}
        <div className="ii-reg-cols">
          <ColHuecos titulo="No se hizo" clase="t-no" ayuda="Está apuntado que no se hizo. Cuenta como «no» en el informe." items={huecos('no')} />
          <ColHuecos titulo="No se registró" clase="t-sr" ayuda="Quedó en blanco al cerrar el día. No sabemos si se hizo: no cuenta ni como «sí» ni como «no»." items={huecos('sr')} />
          <ColHuecos titulo="Posible olvido" clase="t-dud" ayuda="Está apuntado, pero parece incompleto. Cuenta tal cual, con aviso." items={huecos('dudoso')} />
        </div>
      </section>

      {/* Resumen */}
      <h2>Resumen de la semana</h2>
      <div className="ii-tiles">
        {r.tarjetas.map((t) => {
          const f = flecha(t)
          return (
            <div key={t.key} className={'ii-tile s-' + t.sem}>
              <div className="ii-lab"><span>{t.titulo}</span><span className="ii-state">● {SEM_TXT[t.sem]}</span></div>
              <div className="ii-val">{t.valor} <small>{t.unidad}</small></div>
              {t.reparto && <Reparto r={t.reparto} />}
              <div className="ii-goal">{t.meta}</div>
              <div className="ii-line">{t.linea}{f && <span className="muted"> · {f} semana anterior</span>}</div>
            </div>
          )
        })}
      </div>
      <p className="muted small">* Energía: referencia provisional, lo previsto en el menú cargado, hasta tener la cifra de kcal al día. Peso: meta mínima {METAS.pesoMetaKg} kg antes del próximo ciclo; verde al llegar, ámbar entre {es(METAS.pesoLimiteKg)} y {METAS.pesoMetaKg} kg, rojo por debajo de {es(METAS.pesoLimiteKg)} kg.</p>

      {/* Desviaciones */}
      <h2>Las tres desviaciones principales</h2>
      {r.desviaciones.length === 0 && <p className="muted small">Ningún apartado en ámbar ni en rojo esta semana.</p>}
      <div className="ii-devs">
        {r.desviaciones.map((d, i) => (
          <div key={i} className={'ii-dev s-' + d.sem}>
            <span className="ii-n">{i + 1}</span>
            <div>
              <div className="small"><strong>{d.titulo}.</strong> {d.texto}</div>
              <div className="muted small">Pregunta: {d.pregunta}</div>
              <button className="btn sm ghost noprint" style={{ marginTop: '.3rem' }} disabled={enviadas[i]} onClick={() => aPreguntas(i, `${d.titulo}: ${d.texto} ${d.pregunta}`)}>{enviadas[i] ? 'En Preguntas ✓' : '→ Preguntas (Imohe)'}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Rangos */}
      {r.rangos.length > 0 && (
        <>
          <h2>Lo que no se registró: cuánto puede cambiar cada resultado</h2>
          <p className="muted small">El informe calcula sin lo que falta y enseña entre qué valores quedaría el resultado según lo que pasara de verdad. Cuanto más ancho es ese margen, menos fiable es la cifra.</p>
          <div className="table-wrap">
            <table className="table small ii-table">
              <thead><tr><th>Apartado</th><th>Qué falta</th><th>Días</th><th>Cómo cambia el resultado</th><th>Peso del hueco</th></tr></thead>
              <tbody>
                {r.rangos.map((g, i) => (
                  <tr key={i}>
                    <td><strong>{g.apartado}</strong></td>
                    <td>{g.que}</td>
                    <td>{g.dias.map(diaCorto).join(', ')}</td>
                    <td>{g.min === g.max ? (g.apartado === 'Líquidos' ? 'La media se calcula solo con los días apuntados.' : 'No cambia el semáforo, pero falta el dato.') : `${g.actual} % ahora. Si no se hizo, ${g.min} %; si se hizo, ${g.max} %.`}</td>
                    <td><span className={'tag ' + (g.peso === 'Alto' ? 'rojo' : g.peso === 'Medio' ? 'ambar' : 'verde')}>{g.peso}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Día a día */}
      <h2>Nutrición día a día</h2>
      <DiaADia filas={r.filas} porToma={r.porToma} />

      <div className="ii-two">
        <section className="card tight">
          <h3 style={{ marginTop: 0 }}>Cómo es el plato</h3>
          {r.plato.n === 0 ? <p className="muted small">Sin platos dibujados esta semana.</p> : (
            <>
              <BarraParte label="Hidratos (½ del plato)" si={r.plato.hid} n={r.plato.n} />
              <BarraParte label="Verdura (⅓ del plato)" si={r.plato.veg} n={r.plato.n} />
              <BarraParte label="Proteína (el resto)" si={r.plato.prot} n={r.plato.n} />
              <p className="muted small">Comidas y cenas con plato dibujado en las que cada parte llega a la suya{r.plato.sr ? ` (${r.plato.sr} sin dibujar)` : ''}. Siguen la pauta entera: {r.plato.ok} de {r.plato.n}.</p>
            </>
          )}
        </section>
        <section className="card tight">
          <h3 style={{ marginTop: 0 }}>Peso, últimas 6 semanas</h3>
          <GraficoPeso serie={r.peso.serie} />
          <p className="muted small">Media de las pesadas de cada semana. Línea de puntos: meta de {METAS.pesoMetaKg} kg. Línea roja: límite, 5 % menos que {METAS.pesoMetaKg} kg ({es(METAS.pesoLimiteKg)} kg); de ahí no debe bajar. Línea granate: 5 % menos que 24 kg ({es(METAS.pesoMuyBajoKg)} kg); por debajo, sigue muy lejos de la meta.</p>
        </section>
      </div>

      {/* Suplementación */}
      <h2>Suplementación</h2>
      {r.suplementos.filas.length === 0 ? <p className="muted small">Sin tomas de suplementos previstas esta semana.</p> : (
        <div className="table-wrap">
          <table className="table small ii-table">
            <thead><tr><th>Suplemento</th><th>Previstas</th><th>Dadas</th><th>No dadas</th><th>Sin registrar</th><th>% correctas</th></tr></thead>
            <tbody>
              {r.suplementos.filas.map((s) => (
                <tr key={s.nombre}><td>{s.nombre}</td><td>{s.previstas}</td><td>{s.dadas}</td><td>{s.noDadas}</td><td>{s.sr}</td><td className={'ii-c ' + cls(s.pct)}>{s.pct == null ? '—' : `${s.pct} %`}</td></tr>
              ))}
              <tr className="ii-total"><td>Total</td><td>{r.suplementos.dadas + r.suplementos.noDadas + r.suplementos.sr}</td><td>{r.suplementos.dadas}</td><td>{r.suplementos.noDadas}</td><td>{r.suplementos.sr}</td><td>{r.suplementos.pct == null ? '—' : `${r.suplementos.pct} %`}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">% correctas = dadas ÷ (dadas + no dadas). Las sin registrar no cuentan. En semana de quimio (y 48 h antes) solo cuentan los suplementos «en ciclo». «No precisa» no cuenta.{r.suplementos.condicionales.length ? ` Condicionales dados: ${r.suplementos.condicionales.join('; ')}.` : ''}</p>

      <div className="ii-two">
        <section className="ii-todo"><h3 style={{ marginTop: 0 }}>Signos y síntomas</h3><p className="small">Próxima parte, por construir.</p></section>
        <section className="ii-todo"><h3 style={{ marginTop: 0 }}>Ejercicio</h3><p className="small">Próxima parte, por construir.</p></section>
      </div>

      <section className="card tight">
        <h3 style={{ marginTop: 0 }}>Lo que no come</h3>
        <ul className="small informe-lista">
          <li>Platos del menú que deja: {r.noCome.dejados.length ? r.noCome.dejados.join(', ') : 'ninguno marcado'}.</li>
          <li>Sustituidos por otra cosa: {r.noCome.sustituciones.length ? r.noCome.sustituciones.join(' · ') : 'ninguna vez'}.</li>
          <li>Postre en {r.noCome.postres} de {r.days.length} días.</li>
        </ul>
      </section>

      <p className="muted small">Huma registra y organiza; no da indicaciones médicas. Pescado, paté y frutos rojos se detectan por el nombre de los platos del menú tomados y de lo escrito en «Otro» y «Postre».</p>
    </div>
  )
}

const cls = (p: number | null) => (p == null ? '' : p >= 80 ? 'c-ok' : p >= 60 ? 'c-warn' : 'c-bad')

function ColHuecos({ titulo, clase, ayuda, items }: { titulo: string; clase: string; ayuda: string; items: GrupoHueco[] }) {
  return (
    <div className="ii-reg-col">
      <span className={'ii-tag ' + clase}>{titulo}</span>
      <span className="muted small">{ayuda}</span>
      {items.length === 0 ? <span className="small">Nada esta semana.</span> : (
        <ul className="small">
          {items.map((h, i) => {
            const sinDias = h.apartado === 'Suplementación' && h.tipo === 'no'
            return (
              <li key={i}>
                <strong>{h.apartado}</strong> · {h.que}{sinDias ? '' : `: ${lista(h.dias.map((d) => (h.notas[d]?.length ? `${diaLargo(d)} (${lista(h.notas[d])})` : diaLargo(d))))}`}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Reparto({ r }: { r: [number, number, number, number] }) {
  const t = r.reduce((a, b) => a + b, 0) || 1
  return (
    <div className="ii-mini" aria-hidden="true">
      <span className="m-ok" style={{ width: `${(r[0] / t) * 100}%` }} />
      <span className="m-part" style={{ width: `${(r[1] / t) * 100}%` }} />
      <span className="m-no" style={{ width: `${(r[2] / t) * 100}%` }} />
      <span className="m-sr" style={{ width: `${(r[3] / t) * 100}%` }} />
    </div>
  )
}

function BarraParte({ label, si, n }: { label: string; si: number; n: number }) {
  const p = Math.round((si / n) * 100)
  return (
    <div className="ii-parte">
      <div className="small row between"><span>{label}</span><strong>{si} de {n}</strong></div>
      <div className="ii-barra"><span className={cls(p)} style={{ width: `${p}%` }} /></div>
    </div>
  )
}

const MARCA: Record<string, string> = { '1': '✓', '0.75': '¾', '0.5': '½', '0.25': '¼', '0': '✗' }
function celdaToma(c: Celda) {
  if (c.fuera) return { txt: '', cls: 'ii-fuera' }
  if (c.v == null) return { txt: 'sin reg.', cls: 'c-sr' }
  return { txt: MARCA[String(c.v)] ?? es(c.v), cls: c.v >= 0.75 ? 'c-ok' : c.v > 0 ? 'c-warn' : 'c-bad' }
}

function DiaADia({ filas, porToma }: { filas: FilaDia[]; porToma: { slot: string; label: string; pct: number | null }[] }) {
  const n = (x: number) => x.toLocaleString('es-ES')
  const fila = (label: string, cell: (f: FilaDia) => { txt: string; cls?: string }, semana: string, semCls = '') => (
    <tr>
      <th scope="row">{label}</th>
      {filas.map((f) => { const c = f.hospital && label !== 'Vómitos' && label !== 'Náusea máxima (0–10)' && label !== 'Deposición (Bristol)' && label !== 'Peso (kg)' ? { txt: 'hosp.', cls: 'ii-fuera' } : cell(f); return <td key={f.d} className={c.cls}>{c.txt}</td> })}
      <td className={'ii-wk ' + semCls}>{semana}</td>
    </tr>
  )
  const kc = filas.filter((f) => f.kcalCompleto && f.kcal != null)
  const kMedia = kc.length ? Math.round(kc.reduce((a, f) => a + f.kcal!, 0) / kc.length) : null
  const lq = filas.filter((f) => f.liquidos != null)
  const lMedia = lq.length ? Math.round(lq.reduce((a, f) => a + f.liquidos!, 0) / lq.length) : null
  const ay = filas.filter((f) => typeof f.ayunoH === 'number')
  const cn = filas.filter((f) => f.cenaFin && /^\d/.test(f.cenaFin))
  const depReg = filas.filter((f) => f.deposicion !== 'sr' && f.deposicion != null)
  const pesos = filas.filter((f) => f.peso != null)
  return (
    <>
      <div className="table-wrap">
        <table className="table small ii-grid">
          <thead><tr><th />{filas.map((f) => <th key={f.d}>{diaCorto(f.d)} {Number(f.d.slice(8))}</th>)}<th>Semana</th></tr></thead>
          <tbody>
            <tr className="ii-grp"><th colSpan={filas.length + 2}>Ingestas · ✓ entera · ¾ · ½ · ✗ no se hizo · «sin reg.» = sin registrar (quedó en blanco)</th></tr>
            {TOMAS.map((t) => {
              const p = porToma.find((x) => x.slot === t.key)?.pct ?? null
              return fila(porToma.find((x) => x.slot === t.key)!.label, (f) => celdaToma(f.ingestas[t.key]), p == null ? '—' : `${p} %`, cls(p))
            })}
            <tr className="ii-grp"><th colSpan={filas.length + 2}>Energía y líquidos</th></tr>
            {fila('Kcal', (f) => (f.kcal == null ? { txt: '—' } : { txt: n(f.kcal) + (f.kcalCompleto ? '' : '*'), cls: f.kcalCompleto ? cls(f.kcalPrevisto ? (f.kcal / f.kcalPrevisto) * 100 : null) : 'c-sr' }), kMedia != null ? n(kMedia) : '—')}
            {fila('% de lo previsto', (f) => ({ txt: f.kcal != null && f.kcalPrevisto ? String(Math.round((f.kcal / f.kcalPrevisto) * 100)) + (f.kcalCompleto ? '' : '*') : '—' }), '')}
            {fila('Líquidos (ml)', (f) => (f.liquidos == null ? { txt: 'sin reg.', cls: 'c-sr' } : { txt: n(f.liquidos) + (f.liquidosDudoso ? ' ⚠' : ''), cls: cls((f.liquidos / METAS.liquidosMl) * 100) }), lMedia != null ? n(lMedia) : '—')}
            <tr className="ii-grp"><th colSpan={filas.length + 2}>Horarios</th></tr>
            {fila('Ayuno de la noche (h)', (f) => (f.ayunoH === 'sr' ? { txt: 'sin reg.', cls: 'c-sr' } : f.ayunoH === 'mtx' ? { txt: 'MTX' } : f.ayunoH === 'fuera' || f.ayunoH == null ? { txt: '—' } : { txt: es(f.ayunoH), cls: f.ayunoH > METAS.ayunoMaxH ? 'c-bad' : '' }), `${ay.filter((f) => (f.ayunoH as number) <= METAS.ayunoMaxH).length} de ${ay.length}`)}
            {fila('Fin de la cena', (f) => (f.cenaFin === 'sr' ? { txt: 'sin reg.', cls: 'c-sr' } : f.cenaFin === 'no' ? { txt: 'no cenó', cls: 'c-bad' } : f.cenaFin === 'fuera' || f.cenaFin == null ? { txt: '—' } : { txt: f.cenaFin, cls: f.cenaFin > METAS.cenaLimite ? 'c-warn' : '' }), `${cn.filter((f) => (f.cenaFin as string) <= METAS.cenaLimite).length} de ${cn.length}`)}
            <tr className="ii-grp"><th colSpan={filas.length + 2}>Tolerancia y peso</th></tr>
            {fila('Vómitos', (f) => ({ txt: f.noRetiene ? `${f.vomitos} · no retiene` : String(f.vomitos), cls: f.vomitos || f.noRetiene ? 'c-bad' : '' }), `${filas.filter((f) => f.vomitos || f.noRetiene).length} días`)}
            {fila('Náusea máxima (0–10)', (f) => ({ txt: f.nausea == null ? '—' : String(f.nausea), cls: (f.nausea ?? 0) >= 5 ? 'c-bad' : (f.nausea ?? 0) >= 3 ? 'c-warn' : '' }), `máx. ${Math.max(0, ...filas.map((f) => f.nausea ?? 0))}`)}
            {fila('Deposición (Bristol)', (f) => (f.deposicion === 'sr' || f.deposicion == null ? { txt: 'sin reg.', cls: 'c-sr' } : f.deposicion === 'no' ? { txt: 'no hizo' } : { txt: String(f.deposicion), cls: f.deposicion <= 2 || f.deposicion >= 6 ? 'c-warn' : '' }), `${depReg.filter((f) => typeof f.deposicion === 'number').length} de ${depReg.length} días`)}
            {fila('Peso (kg)', (f) => ({ txt: f.peso != null ? es(f.peso) : '' }), pesos.length >= 2 ? `${es(Math.round((pesos[pesos.length - 1].peso! - pesos[0].peso!) * 10) / 10)}` : '')}
          </tbody>
        </table>
      </div>
      <p className="muted small">* Día con ingestas sin registrar o sin saber qué tomó: sus kcal no son el total y no entran en la media. ⚠ = posible olvido. MTX = día de metotrexato (el ayuno lo marca la quimio). En semana de quimio sale de la cuenta el batido que menos se tomó (casilla en blanco).</p>
    </>
  )
}

function GraficoPeso({ serie }: { serie: { ws: string; kg: number | null }[] }) {
  const vals = serie.map((s) => s.kg).filter((x): x is number => x != null)
  if (!vals.length) return <p className="muted small">Sin pesadas en las últimas 6 semanas.</p>
  const lineas = [
    { kg: METAS.pesoMetaKg, cls: 'ii-meta', txt: `meta · ${METAS.pesoMetaKg} kg` },
    { kg: METAS.pesoLimiteKg, cls: 'ii-lim', txt: `límite (25 − 5 %) · ${es(METAS.pesoLimiteKg)}` },
    { kg: METAS.pesoMuyBajoKg, cls: 'ii-lim2', txt: `muy por debajo (24 − 5 %) · ${es(METAS.pesoMuyBajoKg)}` },
  ]
  const all = [...vals, ...lineas.map((l) => l.kg)]
  const lo = Math.floor((Math.min(...all) - 0.2) * 2) / 2, hi = Math.ceil((Math.max(...all) + 0.2) * 2) / 2
  const W = 340, H = 150, x0 = 34, x1 = 325, y0 = 12, y1 = 118
  const y = (v: number) => y0 + ((hi - v) / (hi - lo)) * (y1 - y0)
  const x = (i: number) => x0 + (i * (x1 - x0)) / 5
  const ticks: number[] = []
  const paso = hi - lo > 3 ? 1 : 0.5
  for (let t = lo; t <= hi + 1e-9; t += paso) ticks.push(Math.round(t * 10) / 10)
  const pts = serie.map((s, i) => (s.kg != null ? [x(i), y(s.kg)] as const : null))
  const linea = pts.filter((p): p is readonly [number, number] => !!p).map((p) => `${p[0]},${p[1]}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Peso medio por semana" className="ii-svg">
      {ticks.map((t) => <g key={t}><line x1={x0} x2={x1} y1={y(t)} y2={y(t)} className="ii-gl" /><text x={0} y={y(t) + 4}>{es(t)}</text></g>)}
      {lineas.map((l) => <g key={l.cls}><line x1={x0} x2={x1} y1={y(l.kg)} y2={y(l.kg)} className={l.cls} /><text x={x1} y={y(l.kg) - 3} textAnchor="end" className={l.cls + 't'}>{l.txt}</text></g>)}
      <polyline points={linea} className="ii-ln" />
      {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={i === 5 ? 4.5 : 3.5} className={i === 5 ? 'ii-end' : 'ii-pt'} />)}
      {serie.map((s, i) => <text key={s.ws} x={x(i)} y={H - 6} textAnchor="middle">{i === 5 ? 'esta' : `−${5 - i}`}</text>)}
    </svg>
  )
}
