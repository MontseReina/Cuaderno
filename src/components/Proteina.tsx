/** Nutrición (0.48.0, como New Version): la tarjeta de arriba con la proteína total y las kilocalorías del día, y la
 *  barra de proteína de cada ingesta. Todo se calcula solo, a partir del menú, lo escrito y el batido. */
import type { MealSlot } from '../store/types'
import { DIA_MAX, DIA_MIN, META_PRINCIPAL, type ProteinaDia, type ProteinaToma } from '../domain/proteina'
import { fmtKcal, type KcalDia } from '../domain/kcal'

const NOMBRE: Partial<Record<MealSlot, string>> = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena' }

const ESTADO_DIA: Record<ProteinaDia['estado'], { txt: string; cls: string }> = {
  curso: { txt: 'En curso', cls: 'curso' },
  rango: { txt: 'En rango ideal', cls: 'verde' },
  encima: { txt: `Por encima de ${DIA_MAX}`, cls: 'amarillo' },
  debajo: { txt: 'Por debajo', cls: 'rojo' },
}

/** Tarjeta de arriba, como el «Balance» de New Version: proteína total del día (ideal 360-400 g), el mínimo de
 *  120 g en cada principal y, debajo, las kilocalorías frente a lo previsto en el menú. */
export function Balance({ d, kc, esHoy }: { d: ProteinaDia | null; kc: KcalDia; esHoy: boolean }) {
  return (
    <div className="card prot-dia nutri-balance">
      {d && <ProteinaDelDia d={d} esHoy={esHoy} />}
      <div className={d ? 'nutri-balance-kcal' : ''}>
        <div className="row between">
          <strong className="prot-titulo">Kilocalorías</strong>
          <span className="vaso-total"><strong>{fmtKcal(kc.total)}</strong>{kc.previsto != null ? <> de {fmtKcal(kc.previsto)}</> : null}</span>
        </div>
        {kc.previsto != null && kc.previsto > 0 && (
          <div className="prot-barra"><i className={kc.total >= kc.previsto * 0.9 ? 'verde' : 'amarillo'} style={{ width: Math.min(100, Math.round((kc.total / kc.previsto) * 100)) + '%' }} /></div>
        )}
        <div className="small muted">
          {kc.porToma.length ? <>Unas {fmtKcal(kc.total)} kcal {esHoy ? 'hoy' : 'ese día'}</> : 'Se cuentan al marcar cada ingesta'}
          {kc.previsto != null ? <> · previstas en el menú (con los batidos): unas {fmtKcal(kc.previsto)}</> : ''}
          {kc.sinDato.length > 0 && <> · sin contar: {kc.sinDato.join(', ').toLowerCase()}</>}
          {kc.enParte.length > 0 && <> · en parte: {kc.enParte.join(', ').toLowerCase()}</>}
        </div>
      </div>
    </div>
  )
}

function ProteinaDelDia({ d, esHoy }: { d: ProteinaDia; esHoy: boolean }) {
  const escala = Math.max(DIA_MAX * 1.1, d.total)
  const pos = (v: number) => Math.round((v / escala) * 1000) / 10
  const e = ESTADO_DIA[d.estado]
  const falta = DIA_MIN - d.total
  const sub = d.estado === 'encima' ? `${d.total - DIA_MAX} g por encima del rango ideal`
    : d.estado === 'rango' ? `Dentro de ${DIA_MIN}–${DIA_MAX} g`
    : d.estado === 'curso' ? `Faltan ${falta} g para ${DIA_MIN} · ${d.pendientes} ${d.pendientes === 1 ? 'ingesta' : 'ingestas'} sin registrar`
    : `${esHoy ? 'Faltan' : 'Faltaron'} ${falta} g para ${DIA_MIN}`
  const ps = d.tomas.filter((t) => t.principal)
  const metaCls = d.principalesEnMeta === 3 ? 'verde' : d.principalesRegistradas < 3 ? 'curso' : d.principalesEnMeta === 2 ? 'amarillo' : 'rojo'
  return (
    <>
      <div className="row between">
        <strong className="prot-titulo">Proteína total</strong>
        <span className={'prot-pill ' + e.cls}>{e.txt}</span>
      </div>
      <div className="prot-cifra"><strong>{d.total} g</strong> <span className="muted">ideal {DIA_MIN}–{DIA_MAX} g</span></div>
      <div className="prot-barra-dia" role="img" aria-label={`${d.total} gramos de ${DIA_MIN} a ${DIA_MAX}`}>
        <span className="prot-franja" style={{ left: pos(DIA_MIN) + '%', width: pos(DIA_MAX) - pos(DIA_MIN) + '%' }} />
        <i className={e.cls} style={{ width: pos(d.total) + '%' }} />
      </div>
      <div className="prot-marcas" aria-hidden="true">
        <span style={{ left: pos(DIA_MIN) + '%' }}>{DIA_MIN}</span>
        <span style={{ left: pos(DIA_MAX) + '%' }}>{DIA_MAX}</span>
      </div>
      <div className="small muted">{sub}. Peso cocinado de carne, pescado, marisco, huevo, leche, queso, yogur, jamón y proteína de guisante; suma las 5 ingestas.</div>
      <div className="prot-principales">
        <div className="row between">
          <strong className="small">Mínimo {META_PRINCIPAL} g en cada principal</strong>
          <span className={'prot-pill ' + metaCls}>{d.principalesEnMeta} de 3</span>
        </div>
        <div className="prot-casillas">
          {ps.map((t) => (
            <div key={t.slot} className={'prot-casilla ' + t.nivel}>
              {NOMBRE[t.slot]} {t.registrada ? `${t.tomado} g` : '—'}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/** Dentro de cada ingesta: la barra de proteína (principales, frente a 120 g) y de dónde sale. Sin añadir ni elegir:
 *  se calcula con lo marcado (Entera, ¾, Media, Casi nada) y el plato dibujado. */
export function ProteinaFicha({ p }: { p: ProteinaToma }) {
  const pct = Math.min(100, Math.round((p.tomado / META_PRINCIPAL) * 100))
  const desglose = p.lineas.filter((l) => l.g > 0).map((l) => `${l.n} ${l.g} g`).join(' · ')
  return (
    <div className="prot-toma">
      <div className="row between">
        <strong className="small">🥚 Proteína total{p.principal ? '' : ' del batido'}</strong>
        <span className="small">
          {p.principal
            ? <><strong>{p.registrada ? p.tomado : '—'}</strong> / {META_PRINCIPAL} g</>
            : p.registrada ? <><strong>{p.tomado} g</strong></> : <span className="muted">{p.previsto ? `${p.previsto} g si se toma entero` : '—'}</span>}
        </span>
      </div>
      {p.principal && <div className="prot-barra"><i className={p.nivel} style={{ width: (p.registrada ? pct : 0) + '%' }} /></div>}
      {!p.registrada && p.principal && <p className="small muted">{p.previsto ? `Si se come entero, el menú lleva unos ${p.previsto} g.` : 'Se calcula al marcar cuánto ha comido.'}</p>}
      {p.registrada && desglose && <p className="small muted">{desglose}</p>}
      {p.registrada && !desglose && p.sinDato.length === 0 && <p className="small muted">Sin alimentos proteicos{p.fuente === 'escrito' ? ' en lo escrito' : ''}.</p>}
      {p.sinDato.length > 0 && <p className="small muted"><span className="dot amarillo" />Sin dato de proteína en el menú: {p.sinDato.join(', ')}.</p>}
    </div>
  )
}
