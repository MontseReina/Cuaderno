/** Control de proteína en Nutrición (0.47.0): la tarjeta del día (arriba del todo) y el bloque de cada ingesta. */
import type { Meal, MealSlot } from '../store/types'
import {
  ALIMENTOS_PROTEICOS, CAZOS, DIA_MAX, DIA_MIN, META_PRINCIPAL, alimentoProteico, itemsDe,
  type ItemProteico, type ProteinaDia, type ProteinaToma,
} from '../domain/proteina'

const NOMBRE: Partial<Record<MealSlot, string>> = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena' }

const ESTADO_DIA: Record<ProteinaDia['estado'], { txt: string; cls: string }> = {
  curso: { txt: 'En curso', cls: 'curso' },
  rango: { txt: 'En rango ideal', cls: 'verde' },
  encima: { txt: `Por encima de ${DIA_MAX}`, cls: 'amarillo' },
  debajo: { txt: 'Por debajo', cls: 'rojo' },
}

/** Tarjeta de arriba: proteína del día (5 ingestas, ideal 360-400 g) y, aparte, el mínimo de 120 g en cada principal. */
export function ProteinaResumen({ d, esHoy }: { d: ProteinaDia; esHoy: boolean }) {
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
    <div className="card prot-dia">
      <div className="row between">
        <strong className="prot-titulo">Proteína del día</strong>
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
      <div className="small muted">{sub} · ≈ {d.proteina} g de proteína</div>
      <div className="small muted">Suma las 5 ingestas, batidos incluidos.</div>
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
    </div>
  )
}

/** Bloque dentro de cada ingesta: alimentos proteicos con su peso y, en las principales, la barra frente a 120 g. */
export function ProteinaFicha({ slot, m, p, poner }: { slot: MealSlot; m?: Meal; p: ProteinaToma; poner: (items: ItemProteico[]) => void }) {
  const { items, anotado } = itemsDe(m, slot)
  const cambiar = (i: number, it: ItemProteico | null) => {
    const next = [...items]
    if (it) next[i] = it
    else next.splice(i, 1)
    poner(next)
  }
  const pct = Math.min(100, Math.round((p.tomado / META_PRINCIPAL) * 100))
  return (
    <div className="prot-toma">
      <div className="row between">
        <strong className="small">🥚 Proteína {p.principal ? '' : 'del batido'}</strong>
        <span className="small">
          {p.principal
            ? <><strong>{p.registrada ? p.tomado : '—'}</strong> / {META_PRINCIPAL} g</>
            : <>{p.registrada ? <><strong>{p.tomado} g</strong> al día</> : 'suma al día al marcarlo'}</>}
        </span>
      </div>
      {p.principal && (
        <div className="prot-barra"><i className={p.nivel} style={{ width: pct + '%' }} /></div>
      )}
      {items.map((it, i) => {
        const a = alimentoProteico(it.food)
        if (!a) return null
        return (
          <div key={i} className="prot-item">
            <div className="prot-item-fila">
              <span className="prot-nombre">{a.label}<span className="muted small"> · {a.hint}</span></span>
              {!a.cazo && <button type="button" className="prot-btn" aria-label={`Restar 10 ${a.unit} de ${a.label}`} onClick={() => cambiar(i, { ...it, g: Math.max(5, it.g - 10) })}>−</button>}
              <span className="prot-g">{it.g} {a.unit}</span>
              {!a.cazo && <button type="button" className="prot-btn" aria-label={`Sumar 10 ${a.unit} de ${a.label}`} onClick={() => cambiar(i, { ...it, g: it.g + 10 })}>+</button>}
              <button type="button" className="prot-quitar" aria-label={`Quitar ${a.label}`} onClick={() => cambiar(i, null)}>✕</button>
            </div>
            {a.cazo && (
              <div className="seg prot-cazos" role="group" aria-label="Cantidad de proteína de guisante">
                {CAZOS.map((c) => (
                  <button type="button" key={c.label} className={it.g === c.g ? 'on' : ''} aria-pressed={it.g === c.g} onClick={() => cambiar(i, { ...it, g: c.g })}>{c.label} · {c.g} g</button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {!items.length && <p className="small muted">{p.principal ? 'Añade los alimentos proteicos que lleva (peso cocinado).' : 'Sin parte proteica anotada.'}</p>}
      <label className="prot-anadir">
        <span className="small">+ Añadir</span>
        <select aria-label="Añadir alimento proteico" value="" onChange={(e) => {
          const a = alimentoProteico(e.target.value)
          if (a) poner([...items, { food: a.id, g: a.def }])
        }}>
          <option value="">Elegir alimento…</option>
          {ALIMENTOS_PROTEICOS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      {p.registrada && p.servido > 0 && <p className="small muted">Servido {p.servido} g · tomado {p.tomado} g · ≈ {p.proteina} g de proteína{!anotado && !p.principal ? ' · lo de siempre' : ''}</p>}
    </div>
  )
}
