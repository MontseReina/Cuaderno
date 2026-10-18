import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { currentPatientId, remove, save, useRows } from '../store'
import { useDailyDraft } from '../store/useDailyDraft'
import type { Meal, MealMacros, MealSlot, WeekMode, WeightEntry } from '../store/types'
import { addDays, fmtDate, fmtWall, nowLocalInput, toLocalInput, todayStr } from '../domain/dates'
import { cycleContext, isCisplatinDay } from '../domain/cycle'
import { dayNutrition, fastingHours, mealTraffic, overnightFastDetail, totalFluids, weekMode, fatCount } from '../domain/nutrition'
import { AYUNO_MAX_H, FAT_EXAMPLES, MEAL_SLOTS, MODE_LABELS, TOMAS, WEIGHT_SOURCES, pautaNueva, type TomaDef } from '../domain/catalogs'
import { BATIDO, fmtKcal, kcalDia, kcalToma, tomada, type KcalToma } from '../domain/kcal'
import { DateNav } from '../components/DateNav'
import { Plato } from '../components/Plato'
import { RelojAyuno } from '../components/RelojAyuno'
import { MiniChart } from '../components/MiniChart'
import { PautaCard } from '../components/PautaCard'
import { pautaDelDia } from '../domain/pautas'
import { Field, Section, Segmented } from '../components/ui'
import { confirmar } from '../components/Confirmar'
import { diaTratamiento } from '../domain/diaTratamiento'

/** Pilar 6 · Nutrición (0.33.0, como New Version): reloj del ayuno, una ficha por toma (desayuno, media mañana,
 *  comida, media tarde y cena) con cuánto se tomó, lo que se tomó escrito, el plato dibujado en comida y cena y las
 *  horas; kilocalorías estimadas de lo escrito y total del día; resumen de la semana y peso. */
const slotName = (k: string) => TOMAS.find((t) => t.key === k)?.label ?? MEAL_SLOTS.find((x) => x.key === k)?.label ?? k

const TEXTURES = [
  { value: 'normal', label: '🍽️ Normal' },
  { value: 'blando', label: '🍮 Blando' },
  { value: 'triturado', label: '🥣 Triturado' },
  { value: 'liquido', label: '🥤 Líquido' },
]
/** Cuánto se tomó. Comida y cena: Hecha / No (la cantidad sale del plato). El resto: Entera / ¾ / Media / No. */
const ESTADOS: [number, string][] = [[1, 'Entera'], [0.75, '¾'], [0.5, 'Media'], [0, 'No']]
const ESTADOS_PLATO: [number, string][] = [[1, 'Hecha'], [0, 'No']]
const PLACEHOLDER: Record<string, string> = {
  desayuno: 'Lo que ha tomado: tortitas, huevo, yogur…',
  comida: 'Lo que ha tomado: dorada, patata, calabacín…',
  cena: 'Lo que ha tomado: pollo, arroz, brócoli…',
}
const horaAhora = () => new Date().toTimeString().slice(0, 5)

export default function Nutricion() {
  const params = useParams()
  const date = params.date ?? todayStr()
  const esHoy = date === todayStr()
  const { draft, set, setExtra, logs, toastNode } = useDailyDraft(date)
  const cycles = useRows('cycles')
  const ctx = cycleContext(cycles, date)
  const byDate = new Map(logs.map((l) => [l.date, l]))
  byDate.set(date, draft)
  const yesterday = byDate.get(addDays(date, -1))
  const mode = weekMode(draft, ctx)
  const autoMode = weekMode({ ...draft, extra: { ...draft.extra, mode: undefined } }, ctx)
  const cisplatin = isCisplatinDay(ctx)
  const patient = useRows('patients')[0]
  const pauta = pautaDelDia(patient?.protocol_start, cycles, date)
  const nueva = pautaNueva(date)
  const day = dayNutrition(draft, mode, { cisplatin })
  const kc = kcalDia(draft)
  const fast = fastingHours(draft, yesterday)
  const fastDet = draft.extra?.fasting_h == null ? overnightFastDetail(draft, yesterday) : null
  const [showWeights, setShowWeights] = useState(false)
  // Talla: una vez al mes. Aviso si la última medida tiene más de 30 días (o no hay ninguna).
  const ultimaTalla = useRows('weights').filter((w) => w.height_cm).sort((a, b) => b.at.localeCompare(a.at))[0]
  const tallaPendiente = !ultimaTalla || ultimaTalla.at.slice(0, 10) < addDays(todayStr(), -30)

  const meal = (slot: string) => draft.meals.find((m) => m.slot === slot)
  const setMeal = (slot: MealSlot, patch: Partial<Meal>) => {
    const meals = [...draft.meals]
    const i = meals.findIndex((m) => m.slot === slot)
    const base: Meal = i >= 0 ? meals[i] : { slot }
    const next = { ...base, ...patch }
    if (i >= 0) meals[i] = next
    else meals.push(next)
    set('meals', meals)
  }
  const setMacro = (slot: MealSlot, patch: Partial<MealMacros>) => setMeal(slot, { macros: { ...(meal(slot)?.macros ?? {}), ...patch } })
  /** Un toque marca la toma; otro toque en la misma la deja sin marcar. Hoy, además, anota la hora de ahora
   *  (en las principales, la de terminar, porque se suele marcar al acabar). */
  const marcar = (t: TomaDef, v: number) => {
    const m = meal(t.key)
    if (m?.fraction === v) { setMeal(t.key, { fraction: undefined }); return }
    const patch: Partial<Meal> = { fraction: v as Meal['fraction'] }
    // Solo si no hay ninguna hora escrita: si la familia rellena más tarde, no se pisa la hora que haya puesto.
    if (v > 0 && esHoy && !m?.time && !m?.end) {
      if (t.principal) patch.end = horaAhora()
      else patch.time = horaAhora()
    }
    setMeal(t.key, patch)
  }

  // Tomas de la pauta y, si ese día hay apuntadas otras de antes (snacks de grasa, «otra»), también se enseñan.
  const extras: TomaDef[] = draft.meals.filter((m) => !TOMAS.some((t) => t.key === m.slot)).map((m) => ({ key: m.slot, label: slotName(m.slot) }))
  const tomas = [...TOMAS, ...extras]
  const hechas = TOMAS.filter((t) => tomada(meal(t.key))).length
  const semana = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6))

  return (
    <div>
      {toastNode}
      <h1>Nutrición</h1>
      <DateNav date={date} base="/nutricion" sub={`${diaTratamiento(patient?.protocol_start, cycles, date)?.texto ?? 'sin ciclo'}${cisplatin && ctx.day ? ' · sigue el cisplatino' : ''}`} />

      {esHoy && <RelojAyuno ayer={yesterday} hoy={draft} />}

      <div className={'card nutri-resumen ' + day.level}>
        <div className="row between">
          <strong><span className={'dot ' + day.level} />{day.level === 'verde' ? 'Objetivos del día cumplidos' : day.level === 'amarillo' ? 'Casi' : 'Lejos de la pauta'}</strong>
          <span><strong>{hechas}</strong> de {TOMAS.length} tomas</span>
        </div>
        <div className="barra"><i className={day.level} style={{ width: Math.round((hechas / TOMAS.length) * 100) + '%' }} /></div>
        {day.reasons.length > 0 && <div className="small muted">{day.reasons.join(' · ')}</div>}
        <div className="small nutri-kcal">
          {kc.porToma.length
            ? <>Unas <strong>{fmtKcal(kc.total)} kcal</strong> {esHoy ? 'hoy' : 'ese día'} (estimadas)</>
            : <span className="muted">Las kilocalorías se cuentan al escribir lo que ha tomado.</span>}
          {kc.sinDato.length > 0 && <span className="muted"> · sin contar: {kc.sinDato.join(', ').toLowerCase()}</span>}
          {kc.enParte.length > 0 && <span className="muted"> · en parte: {kc.enParte.join(', ').toLowerCase()}</span>}
        </div>
      </div>

      {nueva && (
        <div className="card pauta-nueva">
          <strong>Pauta del 18/10/2026 · objetivo: subir de peso</strong>
          <ul className="small">
            <li>5 tomas: desayuno, media mañana (batido), comida, media tarde (batido) y cena.</li>
            <li>Plato: ½ hidratos · ⅓ verdura · el resto proteína.</li>
            <li>Las kilocalorías del día ayudan a ver si come lo suficiente.</li>
          </ul>
        </div>
      )}
      {pauta
        ? <PautaCard key={pauta.pauta} auto={pauta.pauta} tramo={pauta.tramo} abierta={!nueva} />
        : (
        <Section title="Pauta de la nutricionista">
          <p className="small"><strong>Plato:</strong> {nueva ? '½ hidratos · ⅓ verdura · el resto proteína (pauta del 18/10/2026).' : '½ verdura cocida · ⅓ proteína · ¼ almidón resistente (menos en cisplatino) · grasas por encima.'}</p>
          <p className="small"><strong>Tomas:</strong> desayuno, media mañana (batido), comida, media tarde (batido) y cena.</p>
          <p className="small"><strong>Invisibles en todas las comidas:</strong> {FAT_EXAMPLES}.</p>
        </Section>
          )}

      {tomas.map((t) => {
        const m = meal(t.key)
        return <Ficha key={t.key} t={t} m={m} nueva={nueva} cisplatin={cisplatin} date={date} esHoy={esHoy}
          marcar={(v) => marcar(t, v)} poner={(p) => setMeal(t.key, p)} macro={(p) => setMacro(t.key, p)} />
      })}
      <div className="muted small" style={{ margin: '-.2rem 0 .8rem' }}>Líquidos: {totalFluids(draft) ?? '—'} ml → <Link to={`/hidratacion/${date}`}>Hidratación</Link></div>

      <Section title="Modo de la semana y ayuno">
        <Field label="Modo" hint={draft.extra?.mode ? `Elegido a mano (por la semana del tratamiento sería "${MODE_LABELS[autoMode]}")` : 'Sale de la semana del tratamiento: semana nadir desde el 8.º día del cisplatino; semanas de metotrexato y de cisplatino = semana de quimio. Se puede forzar.'}>
          <Segmented
            options={(['quimio', 'nadir'] as WeekMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            value={mode}
            onChange={(v) => setExtra({ mode: v && v !== autoMode ? v : undefined })}
          />
        </Field>
        {mode === 'nadir' && <div className="aviso-nutrir">🌱 Semana de nutrir y recuperar</div>}
        <p className="small">
          <strong>Ayuno de la noche:</strong>{' '}
          {fast != null
            ? <>{fast} h{draft.extra?.fasting_h != null ? ' (tecleadas a mano)' : fastDet ? ` (${slotName(fastDet.last.slot).toLowerCase()} de ayer ${fastDet.last.time} → ${slotName(fastDet.first.slot).toLowerCase()} de hoy ${fastDet.first.time})` : ''}{fast > AYUNO_MAX_H ? <span className="reloj-aviso"> · más de {AYUNO_MAX_H} h</span> : ''}</>
            : <span className="muted">se calcula al escribir la hora de la última comida de ayer y de la primera de hoy.</span>}
        </p>
      </Section>

      <Section title="Resumen de la semana">
        <div className="table-wrap">
          <table className="table nutri-sem">
            <thead><tr><th>Día</th><th>Tomas</th><th>Kcal</th><th>Ayuno</th></tr></thead>
            <tbody>
              {semana.map((d) => {
                const l = byDate.get(d)
                const n = (l?.meals ?? []).filter((m) => tomada(m)).length
                if (!l || !(l.meals ?? []).length) return <tr key={d}><td><Link to={`/nutricion/${d}`}>{fmtDate(d)}</Link></td><td className="muted" colSpan={3}>Sin registrar</td></tr>
                const k = kcalDia(l)
                const f = fastingHours(l, byDate.get(addDays(d, -1)))
                return (
                  <tr key={d}>
                    <td><Link to={`/nutricion/${d}`}>{fmtDate(d)}</Link></td>
                    <td>{n}{pautaNueva(d) ? ` de ${TOMAS.length}` : ''}</td>
                    <td className="small">{k.porToma.length ? `≈ ${fmtKcal(k.total)}` : '—'}{k.sinDato.length ? <span className="muted"> ({k.sinDato.length} sin contar)</span> : ''}</td>
                    <td className="small">{f != null ? <>{f > AYUNO_MAX_H && <span className="dot rojo" />}{String(f).replace('.', ',')} h</> : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Kilocalorías estimadas de lo escrito en cada toma (raciones caseras). Ayuno: de la última comida de un día a la primera del siguiente (máximo {AYUNO_MAX_H} h).</p>
      </Section>

      {tallaPendiente && <div className="notice small">📏 Toca medir la talla{ultimaTalla ? ` (última: ${fmtWall(ultimaTalla.at)}, ${ultimaTalla.height_cm} cm)` : ''}. Se apunta con la pesada, una vez al mes.</div>}
      <Section title="Peso y altura" open={showWeights} right={<button className="btn sm ghost" onClick={(e) => { e.preventDefault(); setShowWeights(true) }}>+</button>}>
        <Weights open={showWeights} />
      </Section>

    </div>
  )
}

/** Ficha de una toma, como en New Version: lo previsto (el batido), cuánto se tomó, lo que se tomó escrito con sus
 *  kilocalorías, el plato dibujado en comida y cena, y las horas. */
function Ficha({ t, m, nueva, cisplatin, date, esHoy, marcar, poner, macro }: {
  t: TomaDef; m?: Meal; nueva: boolean; cisplatin: boolean; date: string; esHoy: boolean
  marcar: (v: number) => void; poner: (p: Partial<Meal>) => void; macro: (p: Partial<MealMacros>) => void
}) {
  const f = m?.fraction
  const no = f === 0
  const estados = t.plato ? ESTADOS_PLATO : ESTADOS
  // Un día antiguo de comida o cena puede tener ¾ o Media: se enseña también ese botón.
  const lista = t.plato && f != null && f > 0 && f < 1 ? [...estados.slice(0, 1), [f, f === 0.75 ? '¾' : f === 0.5 ? 'Media' : '¼'] as [number, string], ...estados.slice(1)] : estados
  const check = m && t.plato ? mealTraffic(m, { cisplatin, date }) : null
  const k: KcalToma | null = m && (m.note?.trim() || (t.batido && tomada(m))) ? kcalToma(m) : null
  const conPlato = !!t.plato && !no
  return (
    <div className={'card nutri-toma ' + (no ? 'no' : f === 0.5 ? 'media' : f != null ? 'hecha' : tomada(m) ? 'hecha' : '')}>
      <div className="row between">
        <h3>{check && <span className={'dot ' + check.level} />}{t.label}{t.batido && <span className="muted small"> · batido</span>}</h3>
        {no && <span className="tag rojo">No hecha</span>}
        {f === 0.5 && <span className="tag ambar">Media</span>}
        {f === 0.75 && <span className="tag verde">¾</span>}
        {f === 1 && <span className="tag verde">{t.plato ? 'Hecha' : 'Entera'}</span>}
        {f == null && tomada(m) && <span className="tag verde">Anotada</span>}
      </div>
      {t.batido && (
        <ul className={'nutri-platos' + (m?.note?.trim() ? ' sustituido' : '')}>
          <li><span>Batido de siempre <span className="muted small">· ≈ {fmtKcal(BATIDO.k)} kcal</span></span></li>
        </ul>
      )}
      {!no && (
        <label className="nutri-otro">
          <span className="muted small">{t.batido ? 'Otro' : 'Qué'}</span>
          <input type="text" aria-label={`Lo que ha tomado en ${t.label}`} placeholder={t.batido ? 'Si no ha sido el batido: yogur, nueces, fruta…' : PLACEHOLDER[t.key] ?? 'Lo que ha tomado'}
            value={m?.note ?? ''} onChange={(e) => poner({ note: e.target.value })} />
        </label>
      )}
      {!no && k && (m?.note?.trim() ? <OtroKcal o={k} conPlato={conPlato} /> : <p className="small nutri-otro-kcal muted">Cuenta el batido: unas {fmtKcal(k.total)} kcal.</p>)}
      <div className="seg" role="group" aria-label={`Cómo ha ido: ${t.label}`}>
        {lista.map(([v, l]) => (
          <button type="button" key={l} className={(f === v ? 'on ' : '') + (v === 0 ? 'e-no' : v === 0.5 ? 'e-media' : '')} aria-pressed={f === v} aria-label={l === '¾' ? 'Tres cuartos' : l} onClick={() => marcar(v)}>{l}</button>
        ))}
      </div>
      {conPlato && (
        <Plato nueva={nueva} veg={m?.macros?.veg} prot={m?.macros?.prot} starch={m?.macros?.starch} onChange={(p) => macro(p)} />
      )}
      {check && check.level !== 'verde' && !no && <div className="muted small">Falta: {check.missing.join(', ')}</div>}
      {!no && (
        <div className="nutri-horas">
          <Hora label={t.principal ? 'Empiezo' : 'Hora'} nombre={t.label} value={m?.time} esHoy={esHoy} onChange={(v) => poner({ time: v ?? undefined })} />
          {t.principal && <Hora label="Termino" nombre={t.label} value={m?.end} esHoy={esHoy} onChange={(v) => poner({ end: v ?? undefined })} />}
        </div>
      )}
      {!no && t.plato && (
        <div className="nutri-mas">
          <Field label="Grasas añadidas" hint={FAT_EXAMPLES}>
            <Segmented options={[{ value: 0, label: 'Ninguna' }, { value: 1, label: '🫒 1' }, { value: 2, label: '🫒🫒 2 o más' }]} value={fatCount(m?.macros)} onChange={(v) => macro({ fat_n: v == null ? undefined : (v as 0 | 1 | 2), fat: v == null ? undefined : v > 0 })} />
          </Field>
          <Field label="Almidón resistente (cocido y enfriado: quinoa, patata, boniato, arroz)">
            <Segmented options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} value={m?.macros?.resistant == null ? null : m.macros.resistant ? 'si' : 'no'} onChange={(v) => macro({ resistant: v == null ? undefined : v === 'si' })} />
          </Field>
          <Field label="Textura">
            <Segmented options={TEXTURES} value={m?.texture ?? null} onChange={(v) => poner({ texture: (v ?? undefined) as Meal['texture'] })} />
          </Field>
        </div>
      )}
    </div>
  )
}

const FRACCION: { [k: number]: string } = { 0: 'nada', 0.5: '½', 0.75: '¾', 1.5: '1½' }
const fraccion = (n: number) => FRACCION[n] ?? String(n).replace('.', ',')

/** Lo que se cuenta de lo escrito: cada alimento con su ración y la parte que se toma. */
function OtroKcal({ o, conPlato }: { o: KcalToma; conPlato: boolean }) {
  if (!o.items.length) {
    return <p className="small nutri-otro-kcal"><span className="dot amarillo" />No reconozco ningún alimento: esta toma no cuenta en las kilocalorías. Escríbelo con otras palabras, separando con comas.</p>
  }
  return (
    <div className="small nutri-otro-kcal">
      <ul>
        {o.items.map((i, n) => (
          <li key={n}>
            <span>
              {i.alimento.nombre}
              <span className="muted"> · {i.unidades !== 1 ? `${fraccion(i.unidades)} × ${i.alimento.u}` : i.alimento.u}
                {i.factor !== 1 && <> · {fraccion(i.factor)} {i.segun === 'plato' ? 'según el plato' : 'según lo marcado'}</>}</span>
            </span>
            <span className="nowrap">{fmtKcal(i.kcalContadas)} kcal</span>
          </li>
        ))}
      </ul>
      <div><strong>Cuenta unas {fmtKcal(o.total)} kcal</strong></div>
      {o.sinReconocer.length > 0 && <div className="muted">No reconozco: {o.sinReconocer.map((w) => `«${w}»`).join(', ')}. No suma; prueba con otra palabra.</div>}
      {conPlato && <div className="muted">Verdura, proteína e hidratos cuentan la cantidad que marques en el plato.</div>}
    </div>
  )
}

function Hora({ label, nombre, value, esHoy, onChange }: { label: string; nombre: string; value?: string | null; esHoy: boolean; onChange: (v: string | null) => void }) {
  return (
    <label className="nutri-hora">
      <span className="muted small">{label}</span>
      <input type="time" aria-label={`${label}: ${nombre}`} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
      {esHoy && !value && <button type="button" className="btn sm secondary" onClick={() => onChange(horaAhora())}>Ahora</button>}
    </label>
  )
}

function Weights({ open }: { open: boolean }) {
  const weights = useRows('weights').sort((a, b) => b.at.localeCompare(a.at))
  const [w, setW] = useState<Partial<WeightEntry>>({ at: nowLocalInput(), source: 'inbody' })
  const [adding, setAdding] = useState(open)
  const last = weights[0]
  const lastH = weights.find((x) => x.height_cm)?.height_cm
  return (
    <div>
      {last && <p className="small">Última: <strong>{last.kg} kg</strong> · {fmtWall(last.at)} · {WEIGHT_SOURCES.find((s) => s.value === last.source)?.label}{lastH ? ` · altura ${lastH} cm` : ''}{last.muscle_kg ? ` · músculo ${last.muscle_kg} kg` : ''}{last.fat_pct ? ` · grasa ${last.fat_pct} %` : ''}</p>}
      {(adding || open) && (
        <div className="card tight">
          <div className="grid2">
            <Field label="Fecha y hora"><input type="datetime-local" value={toLocalInput(w.at)} onChange={(e) => setW({ ...w, at: e.target.value })} /></Field>
            <Field label="Peso (kg)"><input type="number" inputMode="decimal" step="0.1" min={5} max={150} value={w.kg ?? ''} onChange={(e) => setW({ ...w, kg: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          </div>
          <Field label="Báscula">
            <Segmented options={WEIGHT_SOURCES} value={w.source} onChange={(v) => setW({ ...w, source: v ?? 'casa' })} />
          </Field>
          <div className="grid2">
            <Field label="Altura (cm)"><input type="number" inputMode="decimal" step="0.5" min={50} max={220} value={w.height_cm ?? ''} onChange={(e) => setW({ ...w, height_cm: e.target.value === '' ? null : Number(e.target.value) })} placeholder={lastH ? String(lastH) : ''} /></Field>
            {w.source === 'inbody' && <Field label="Masa muscular (kg)"><input type="number" inputMode="decimal" step="0.1" value={w.muscle_kg ?? ''} onChange={(e) => setW({ ...w, muscle_kg: e.target.value === '' ? null : Number(e.target.value) })} /></Field>}
            {w.source === 'inbody' && <Field label="Grasa (%)"><input type="number" inputMode="decimal" step="0.1" value={w.fat_pct ?? ''} onChange={(e) => setW({ ...w, fat_pct: e.target.value === '' ? null : Number(e.target.value) })} /></Field>}
            {w.source === 'inbody' && <Field label="Agua corporal (%)"><input type="number" inputMode="decimal" step="0.1" value={w.water_pct ?? ''} onChange={(e) => setW({ ...w, water_pct: e.target.value === '' ? null : Number(e.target.value) })} /></Field>}
          </div>
          <Field label="Notas"><input type="text" value={w.notes ?? ''} onChange={(e) => setW({ ...w, notes: e.target.value })} /></Field>
          <div className="row">
            <button className="btn sm" disabled={!w.kg || !w.at} onClick={async () => { await save('weights', { ...w, patient_id: currentPatientId() } as WeightEntry); setW({ at: nowLocalInput(), source: w.source }); setAdding(false) }}>Guardar pesada</button>
          </div>
        </div>
      )}
      {!adding && !open && <button className="btn sm secondary" onClick={() => setAdding(true)}>+ Nueva pesada</button>}
      {(() => {
        // Una columna por día de medición, de la más antigua a la más reciente.
        const asc = [...weights].reverse()
        const serie = (f: (x: WeightEntry) => number | null | undefined) => asc.filter((x) => f(x) != null).map((x) => ({ x: fmtDate(x.at.slice(0, 10)).replace(/^\S+,\s*/, ''), y: f(x)! }))
        return (
          <div className="charts">
            <MiniChart title="Peso" unit="kg" kind="bar" points={serie((x) => x.kg)} />
            <MiniChart title="Altura" unit="cm" kind="line" decimals={0} points={serie((x) => x.height_cm)} />
            <MiniChart title="Grasa" unit="%" kind="line" points={serie((x) => x.fat_pct)} />
            <MiniChart title="Músculo" unit="kg" kind="line" points={serie((x) => x.muscle_kg)} />
            <MiniChart title="Agua corporal" unit="%" kind="line" points={serie((x) => x.water_pct)} />
          </div>
        )
      })()}
      {/* 28/09: la lista de pesadas va plegada; se abre al tocar. */}
      {weights.length > 0 && (
      <details className="pesadas">
        <summary>Pesadas apuntadas ({Math.min(weights.length, 8)})</summary>
      {weights.slice(0, 8).map((x) => (
        <div className="item" key={x.id}>
          <div className="main">
            <div>{x.kg} kg <span className="tag gray">{WEIGHT_SOURCES.find((s) => s.value === x.source)?.label}</span></div>
            <div className="meta">{fmtWall(x.at)}{x.height_cm ? ` · ${x.height_cm} cm` : ''}{x.muscle_kg ? ` · músculo ${x.muscle_kg} kg` : ''}{x.fat_pct ? ` · grasa ${x.fat_pct} %` : ''}{x.notes ? ` · ${x.notes}` : ''}</div>
          </div>
          <button className="btn sm ghost" onClick={async () => { if (await confirmar('¿Borrar esta pesada?')) remove('weights', x.id) }}>✕</button>
        </div>
      ))}
      </details>
      )}
    </div>
  )
}

