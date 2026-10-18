/** 0.34.0 · Avisos al móvil (diseño aprobado por Montserrate el 18/10/2026, `claude/app-avisos-movil-diseno.md`).
 *
 *  A las 12, 16 y 19 h se revisa si Unai va al ritmo que tocaría a esa hora (agua, tomas, temperatura, peso y
 *  deposiciones); a las 21 h, lo que queda por rellenar; a las 21:30, la hora límite del desayuno; y por la mañana,
 *  el reloj de ayuno (máximo 12 h). Se guarda CADA control, se mande aviso o no, para ver en Evaluaciones si el
 *  cuidado va bien durante el día o se recupera con prisas al final.
 *
 *  Este fichero es puro (sin base de datos): lo usan la app (Evaluaciones) y la función del servidor que manda
 *  los avisos. Los textos van en positivo: primero lo hecho y luego el siguiente paso pequeño. */
import type { AvisoRow, Cycle, DailyLog, Intake, Meal, Product, WeekMode, WeightEntry } from '../store/types'
export type { AvisoRow }
import { pautaNueva, TOMAS } from './catalogs'
import { cycleContext } from './cycle'
import { addDays } from './dates'
import { dayCompleteness } from './completeness'
import { medicationProgress } from './medication'
import { totalFluids, weekMode } from './nutrition'
import { tomada } from './kcal'

/** Momentos del día en que se revisa el ritmo. */
export type Momento = '12' | '16' | '19'
export const MOMENTOS: Momento[] = ['12', '16', '19']
export type Area = 'agua' | 'comidas' | 'temperatura' | 'peso' | 'deposiciones'
export const AREA_LABEL: Record<Area, string> = {
  agua: 'Agua', comidas: 'Tomas', temperatura: 'Temperatura', peso: 'Peso', deposiciones: 'Deposiciones',
}
export const AREA_ICO: Record<Area, string> = { agua: '💧', comidas: '🍽', temperatura: '🌡', peso: '⚖️', deposiciones: '🚽' }

/** Meta de líquidos del día (ml): 1.500 (Montserrate, 18/10/2026). */
export const AGUA_DIA_ML = 1500
/** Tomas al día: 4 en semana de quimio (puede ser media mañana o media tarde) y 5 en el resto. */
export const TOMAS_DIA: Record<WeekMode, number> = { quimio: 4, nadir: 5 }
/** Tomas que tocaría llevar a cada hora. Se cuentan, no se mira cuáles. */
export const TOMAS_A_LA_HORA: Record<WeekMode, Record<Momento, number>> = {
  quimio: { '12': 1, '16': 2, '19': 3 },
  nadir: { '12': 2, '16': 3, '19': 4 },
}
/** Temperaturas apuntadas que tocaría llevar (la app tiene 3 huecos: mañana, tarde y noche). */
export const TEMPS_A_LA_HORA: Partial<Record<Momento, number>> = { '12': 1, '19': 2 }
export const TEMPS_DIA = 2
/** Días sin pesar a partir de los que se avisa (a las 12). */
export const DIAS_SIN_PESO = 3
/** Días sin deposición a partir de los que se avisa (a las 19). */
export const DIAS_SIN_DEPOSICION = 2
export const AYUNO_AVISO_H = 11
export const AYUNO_MAX_AVISO_H = 12
/** Hora a partir de la que se pueden mandar los avisos de ayuno (para no despertar a nadie). */
export const AYUNO_DESDE = '07:00'
export const AYUNO_HASTA = '13:00'

export const min = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }
export const hhmmDe = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** «08:40» → «8:40». */
const hora = (hhmm: string) => hhmm.replace(/^0(\d)/, '$1')
export const ml = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Hora de despertar de ese día (Biohacking); si no está apuntada, las 8:00. */
export function horaDespertar(log?: DailyLog): string {
  const s = log?.sleep_end
  if (s && /^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5).padStart(5, '0')
  return '08:00'
}

/** Agua que tocaría llevar a una hora: 500 ml a las 4 h de despertarse, 900 a las 8, 1.250 a las 11 y 1.500 a las 13
 *  (con despertar a las 8: 500 a las 12, 900 a las 16 y 1.250 a las 19, lo aprobado). Redondeado a 50 ml. */
export function aguaALaHora(hhmm: string, despertar = '08:00'): number {
  const h = (min(hhmm) - min(despertar)) / 60
  const puntos: [number, number][] = [[0, 0], [4, 500], [8, 900], [11, 1250], [13, AGUA_DIA_ML]]
  if (h <= 0) return 0
  if (h >= 13) return AGUA_DIA_ML
  for (let i = 1; i < puntos.length; i++) {
    const [h1, v1] = puntos[i]
    const [h0, v0] = puntos[i - 1]
    if (h <= h1) return Math.round((v0 + ((v1 - v0) * (h - h0)) / (h1 - h0)) / 50) * 50
  }
  return AGUA_DIA_ML
}

/** Volumen del batido de siempre (un vaso grande). Cuenta como líquido (Montserrate, 18/10/2026). */
export const BATIDO_ML = 250
/** Mililitros de batido del día: media mañana y media tarde con el batido (lo de siempre si no se eligió el menú). */
export function batidoMl(log?: DailyLog): number {
  let total = 0
  for (const m of log?.meals ?? []) {
    const t = TOMAS.find((x) => x.key === m.slot)
    if (!t?.batido || m.choice === 'menu' || m.note?.trim() || !tomada(m)) continue
    total += BATIDO_ML * (m.fraction != null && m.fraction > 0 ? m.fraction : 1)
  }
  return Math.round(total)
}

/** Líquidos del día con el batido incluido. */
export function liquidosDelDia(log?: DailyLog): number {
  const base = totalFluids(log) ?? 0
  return base + (log?.fluids_total_ml != null ? 0 : batidoMl(log))
}

/** Tomas hechas (las marcadas con algo distinto de «No», con algo escrito o con hora). */
export const tomasHechas = (log?: DailyLog) => (log?.meals ?? []).filter((m) => tomada(m)).length

/** Temperaturas apuntadas ese día (mañana, tarde, noche). «No se ha podido medir» cuenta como apuntada. */
export function temperaturasApuntadas(log?: DailyLog): number {
  const v = log?.extra?.vitals ?? {}
  let n = (['manana', 'tarde', 'noche'] as const).filter((k) => v[k]?.temp != null).length
  if (n === 0 && log?.temp_max != null) n = 1
  if (log?.extra?.not_measured?.temp) n = Math.max(n, TEMPS_DIA)
  return n
}

/** Días desde el último peso (pesadas o el peso del registro diario). null si nunca se ha pesado. */
export function diasDesdePeso(date: string, logs: DailyLog[], weights: WeightEntry[]): number | null {
  const fechas = [
    ...weights.map((w) => w.at.slice(0, 10)),
    ...logs.filter((l) => l.weight != null).map((l) => l.date),
  ].filter((d) => d <= date).sort()
  const ultima = fechas.pop()
  if (!ultima) return null
  return Math.round((new Date(date + 'T12:00').getTime() - new Date(ultima + 'T12:00').getTime()) / 86400000)
}

/** Días seguidos, contando hoy, sin deposición apuntada. */
export function diasSinDeposicion(date: string, logs: DailyLog[]): number {
  const por = new Map(logs.map((l) => [l.date, l]))
  let n = 0
  for (let d = date; n < 15; d = addDays(d, -1)) {
    if ((por.get(d)?.stools_n ?? 0) > 0) break
    n++
  }
  return n
}

/** Tomas que pide el registro de ese día: desde la pauta del 18/10/2026, 4 en semana de quimio y 5 en el resto
 *  (las mismas que los avisos); antes, 3. */
export function tomasMetaDelDia(log: DailyLog | undefined, cycles: Cycle[], date: string): number {
  return pautaNueva(date) ? TOMAS_DIA[modoDelDia(log, cycles, date)] : 3
}

export function modoDelDia(log: DailyLog | undefined, cycles: Cycle[], date: string): WeekMode {
  return weekMode(log, cycleContext(cycles, date))
}

/** Un control: qué se revisa, cuánto hay y cuánto tocaría. */
export interface Control {
  area: Area
  valor: number | null
  meta: number | null
  ok: boolean
  /** Línea del aviso, si va por detrás. */
  linea?: string
}

export interface DatosDia {
  date: string
  log?: DailyLog
  ayer?: DailyLog
  /** Registros de los últimos días (para peso y deposiciones). */
  logs: DailyLog[]
  weights: WeightEntry[]
  cycles: Cycle[]
  products?: Product[]
  intakes?: Intake[]
}

/** «un vaso», «un vaso y medio», «2 vasos»… (vaso = 200 ml). */
export function vasos(mlFaltan: number): string {
  const medios = Math.max(1, Math.ceil(mlFaltan / 100))
  const enteros = Math.floor(medios / 2)
  const medio = medios % 2 === 1
  if (enteros === 0) return 'medio vaso'
  if (enteros === 1) return medio ? 'un vaso y medio' : 'un vaso'
  return `${enteros} vasos${medio ? ' y medio' : ''}`
}

const ARTICULO: Record<string, string> = {
  desayuno: 'el desayuno', media_manana: 'la media mañana', comida: 'la comida', merienda: 'la media tarde', cena: 'la cena',
}
function siguienteToma(log?: DailyLog): string | null {
  const t = TOMAS.find((x) => !tomada((log?.meals ?? []).find((m) => m.slot === x.key)))
  return t ? ARTICULO[t.key] ?? t.label.toLowerCase() : null
}
const tomasTxt = (n: number) => `${n} ${n === 1 ? 'toma hecha' : 'tomas hechas'}`

/** Controles de un momento del día (12, 16 o 19 h), con las líneas del aviso para lo que va por detrás. */
export function controlesDelMomento(m: Momento, d: DatosDia): Control[] {
  const { log } = d
  const modo = modoDelDia(log, d.cycles, d.date)
  const out: Control[] = []

  // Agua
  const agua = liquidosDelDia(log)
  const metaAgua = aguaALaHora(m === '12' ? '12:00' : m === '16' ? '16:00' : '19:00', horaDespertar(log))
  const okAgua = agua >= metaAgua
  out.push({
    area: 'agua', valor: agua, meta: metaAgua, ok: okAgua,
    linea: okAgua ? undefined
      : m === '19'
        ? `💧 ${ml(agua)} ml apuntados. Con ${vasos(AGUA_DIA_ML - agua)} más antes de dormir, completa el día.`
        : agua === 0
          ? `💧 Buen momento para empezar con el agua: ${vasos(metaAgua)} y estará en su ritmo ${m === '12' ? 'de mediodía' : 'de la tarde'}.`
          : `💧 ${ml(agua)} ml apuntados${m === '16' ? ', buen camino' : ''}. Con ${vasos(metaAgua - agua)} más estará en su ritmo ${m === '12' ? 'de mediodía' : 'de la tarde'}.`,
  })

  // Tomas
  const n = tomasHechas(log)
  const metaT = TOMAS_A_LA_HORA[modo][m]
  const okT = n >= metaT
  const sig = siguienteToma(log)
  out.push({
    area: 'comidas', valor: n, meta: metaT, ok: okT,
    linea: okT ? undefined
      : n === 0
        ? '🍽 El desayuno le dará energía para empezar el día.'
        : modo === 'quimio' || !sig
          ? `🍽 ${tomasTxt(n)}. Con una más, va a su ritmo.`
          : `🍽 ${tomasTxt(n)}. Ahora toca ${sig}.`,
  })

  // Temperatura
  const metaTemp = TEMPS_A_LA_HORA[m]
  if (metaTemp != null) {
    const t = temperaturasApuntadas(log)
    const ok = t >= metaTemp
    out.push({
      area: 'temperatura', valor: t, meta: metaTemp, ok,
      linea: ok ? undefined
        : m === '12' ? '🌡 Cuando podáis, tomad la temperatura de la mañana y apuntadla.'
        : t === 0 ? '🌡 Cuando podáis, tomad la temperatura y apuntadla.'
        : '🌡 Un momento para la temperatura de la tarde y listo.',
    })
  }

  // Peso (a las 12)
  if (m === '12') {
    const dias = diasDesdePeso(d.date, d.logs, d.weights)
    const ok = dias != null && dias < DIAS_SIN_PESO
    out.push({
      area: 'peso', valor: dias, meta: DIAS_SIN_PESO, ok,
      linea: ok ? undefined : dias == null ? '⚖️ Hoy toca pesarle.' : `⚖️ Hoy toca pesarle: el último peso fue hace ${dias} días.`,
    })
  }

  // Deposiciones (a las 19)
  if (m === '19') {
    const dias = diasSinDeposicion(d.date, d.logs)
    const ok = dias < DIAS_SIN_DEPOSICION
    out.push({
      area: 'deposiciones', valor: dias, meta: DIAS_SIN_DEPOSICION, ok,
      linea: ok ? undefined : `🚽 Llevamos ${dias} días sin deposición apuntada. Si ha ido al baño, apuntadlo; si no, vigilad cómo sigue mañana.`,
    })
  }
  return out
}

export const TITULOS: Record<string, string> = {
  '12': 'Huma · Mediodía 🌿',
  '16': 'Huma · Tarde 🌿',
  '19': 'Huma · Recta final 🌿',
  '21': 'Huma · Cierre del día',
  '2130': 'Huma · Para mañana',
  ayuno11: 'Huma · Buenos días 🌅',
  ayuno12: 'Huma · Buenos días 🌅',
  prueba: 'Huma · Aviso de prueba',
}

export interface Aviso { title: string; body: string }

/** Aviso de las 12, 16 o 19 h: solo las líneas de lo que va por detrás; null si todo va bien. */
export function avisoDelMomento(m: Momento, controles: Control[]): Aviso | null {
  const lineas = controles.filter((c) => !c.ok && c.linea).map((c) => c.linea!)
  if (!lineas.length) return null
  return { title: TITULOS[m], body: lineas.join('\n') }
}

/** Controles del día entero (al cerrarlo a medianoche): cómo terminó cada apartado. */
export function controlesFinales(d: DatosDia): Control[] {
  const modo = modoDelDia(d.log, d.cycles, d.date)
  const agua = liquidosDelDia(d.log)
  const n = tomasHechas(d.log)
  const t = temperaturasApuntadas(d.log)
  return [
    { area: 'agua', valor: agua, meta: AGUA_DIA_ML, ok: agua >= AGUA_DIA_ML },
    { area: 'comidas', valor: n, meta: TOMAS_DIA[modo], ok: n >= TOMAS_DIA[modo] },
    { area: 'temperatura', valor: t, meta: TEMPS_DIA, ok: t >= TEMPS_DIA },
  ]
}

/** Lo que queda por rellenar del día (los apartados del registro). */
export function pendientesDelDia(d: DatosDia): string[] {
  const med = d.products ? medicationProgress(d.products, d.intakes ?? [], d.cycles, d.date) : undefined
  const comp = dayCompleteness(d.log, d.date, med, tomasMetaDelDia(d.log, d.cycles, d.date))
  return comp.missingGroups.map((g) => g.group.toLowerCase())
}

const lista = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`

/** Aviso de las 21 h: lo que queda por apuntar o, si está todo, el día completo. Siempre se manda. */
export function avisoCierre(d: DatosDia): Aviso {
  const p = pendientesDelDia(d)
  if (p.length) return { title: TITULOS['21'], body: `Ya casi está 🌙. Queda por apuntar: ${lista(p)}. Tenéis hasta las 00:00.` }
  const n = tomasHechas(d.log)
  return { title: TITULOS['21'], body: `Día completo ✓. Gracias por cuidar cada detalle: hoy ${ml(liquidosDelDia(d.log))} ml y ${n} ${n === 1 ? 'toma' : 'tomas'}.` }
}

/** Última ingesta con hora (fin si la tiene; si no, la de empezar). El agua y las infusiones no cuentan. */
export function ultimaIngesta(log?: DailyLog): { meal: Meal; at: string } | null {
  const conHora = (log?.meals ?? []).filter((m) => tomada(m) && (m.end || m.time))
    .map((m) => ({ meal: m, at: (m.end || m.time)!.slice(0, 5) }))
    .sort((a, b) => a.at.localeCompare(b.at))
  return conHora.pop() ?? null
}

/** Aviso de las 21:30: hasta qué hora puede desayunar mañana sin pasar de 12 h de ayuno. */
export function avisoParaManana(d: DatosDia): Aviso {
  const u = ultimaIngesta(d.log)
  if (!u || u.at < '17:00') {
    return { title: TITULOS['2130'], body: '🌅 Apuntad la hora de la cena y Huma os dirá a qué hora desayunar mañana.' }
  }
  const limite = hora(hhmmDe(min(u.at) + AYUNO_MAX_AVISO_H * 60))
  const que = u.meal.slot === 'cena' ? 'La cena fue' : 'La última toma fue'
  return { title: TITULOS['2130'], body: `🌅 ${que} a las ${hora(u.at)}. Mañana, desayuno antes de las ${limite}.` }
}

/** Reloj de ayuno de la mañana: horas desde la última ingesta de ayer si hoy aún no ha tomado nada. */
export function ayunoAhora(d: DatosDia, ahora: string): { horas: number; desde: string; limite: string } | null {
  if ((d.log?.meals ?? []).some((m) => tomada(m))) return null
  const u = ultimaIngesta(d.ayer)
  if (!u) return null
  const horas = (24 * 60 - min(u.at) + min(ahora)) / 60
  return { horas, desde: u.at, limite: hhmmDe(min(u.at) + AYUNO_MAX_AVISO_H * 60) }
}

/** Aviso de ayuno que toca mandar ahora (11 h o 12 h), si toca. `yaMandados` = momentos ya enviados hoy. */
export function avisoAyuno(d: DatosDia, ahora: string, yaMandados: Set<string>): { momento: 'ayuno11' | 'ayuno12'; aviso: Aviso; horas: number } | null {
  if (ahora < AYUNO_DESDE || ahora > AYUNO_HASTA) return null
  const a = ayunoAhora(d, ahora)
  if (!a) return null
  if (a.horas >= AYUNO_MAX_AVISO_H) {
    if (yaMandados.has('ayuno12')) return null
    return { momento: 'ayuno12', horas: a.horas, aviso: { title: TITULOS.ayuno12, body: 'Ya son 12 h de ayuno. Buen momento para el desayuno o el batido.' } }
  }
  if (a.horas >= AYUNO_AVISO_H && !yaMandados.has('ayuno11')) {
    return { momento: 'ayuno11', horas: a.horas, aviso: { title: TITULOS.ayuno11, body: `Buenos días 🌅. Mejor desayunar antes de las ${hora(a.limite)} para que no pase de 12 h de ayuno.` } }
  }
  return null
}

/** Qué toca hacer en este minuto (hora de Madrid). El servidor lo llama cada 5 minutos; cada momento se hace una
 *  sola vez al día (se guarda en la tabla `avisos`). */
export type Tarea = { tipo: 'momento'; momento: Momento } | { tipo: '21' } | { tipo: '2130' } | { tipo: 'ayuno' } | { tipo: 'cierre' }
export function tareasALaHora(ahora: string): Tarea[] {
  const out: Tarea[] = []
  const entre = (a: string, b: string) => ahora >= a && ahora < b
  if (entre('12:00', '12:45')) out.push({ tipo: 'momento', momento: '12' })
  if (entre('16:00', '16:45')) out.push({ tipo: 'momento', momento: '16' })
  if (entre('19:00', '19:45')) out.push({ tipo: 'momento', momento: '19' })
  if (entre('21:00', '21:25')) out.push({ tipo: '21' })
  if (entre('21:30', '22:15')) out.push({ tipo: '2130' })
  if (entre(AYUNO_DESDE, AYUNO_HASTA)) out.push({ tipo: 'ayuno' })
  if (entre('00:00', '02:00')) out.push({ tipo: 'cierre' })
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Evaluaciones: ritmo del día y desviaciones (lee la tabla `avisos`).

export type Ritmo = 'a_tiempo' | 'al_final' | 'no_llega'
export const RITMO_LABEL: Record<Ritmo, string> = { a_tiempo: 'A tiempo', al_final: 'Llega, pero al final', no_llega: 'No llega' }
export const RITMO_NIVEL: Record<Ritmo, 'verde' | 'amarillo' | 'rojo'> = { a_tiempo: 'verde', al_final: 'amarillo', no_llega: 'rojo' }

/** Ritmo de un apartado en un día, con sus controles de 12, 16 y 19 h y el final. null si el día no se cerró. */
export function ritmoDe(rows: AvisoRow[], date: string, area: Area): Ritmo | null {
  const del = rows.filter((r) => r.date === date && r.area === area)
  const fin = del.find((r) => r.momento === 'final')
  if (!fin) return null
  if (!fin.ok) return 'no_llega'
  return del.some((r) => MOMENTOS.includes(r.momento as Momento) && r.ok === false) ? 'al_final' : 'a_tiempo'
}

export interface Desviacion {
  area: Area
  dias: number
  aTiempo: number
  alFinal: number
  noLlega: number
  /** Veces que iba por detrás en cada momento. */
  porMomento: Record<Momento, number>
  /** Días que no llegó, por modo/lugar. */
  porModo: Record<string, { dias: number; noLlega: number; alFinal: number }>
}

export function desviaciones(rows: AvisoRow[], desde: string, hasta: string): Desviacion[] {
  const fechas = [...new Set(rows.filter((r) => r.date >= desde && r.date <= hasta).map((r) => r.date))].sort()
  const areas: Area[] = ['agua', 'comidas', 'temperatura']
  const out: Desviacion[] = areas.map((area) => {
    const d: Desviacion = { area, dias: 0, aTiempo: 0, alFinal: 0, noLlega: 0, porMomento: { '12': 0, '16': 0, '19': 0 }, porModo: {} }
    for (const f of fechas) {
      for (const r of rows) if (r.date === f && r.area === area && MOMENTOS.includes(r.momento as Momento) && r.ok === false) d.porMomento[r.momento as Momento]++
      const rt = ritmoDe(rows, f, area)
      if (!rt) continue
      d.dias++
      if (rt === 'a_tiempo') d.aTiempo++
      else if (rt === 'al_final') d.alFinal++
      else d.noLlega++
      const fin = rows.find((r) => r.date === f && r.area === area && r.momento === 'final')
      const k = grupoDe(fin)
      const g = (d.porModo[k] ??= { dias: 0, noLlega: 0, alFinal: 0 })
      g.dias++
      if (rt === 'no_llega') g.noLlega++
      if (rt === 'al_final') g.alFinal++
    }
    return d
  })
  // Peso y deposiciones: días con aviso.
  for (const area of ['peso', 'deposiciones'] as const) {
    const d: Desviacion = { area, dias: 0, aTiempo: 0, alFinal: 0, noLlega: 0, porMomento: { '12': 0, '16': 0, '19': 0 }, porModo: {} }
    for (const f of fechas) {
      const c = rows.find((r) => r.date === f && r.area === area)
      if (!c) continue
      d.dias++
      if (c.ok) d.aTiempo++
      else { d.noLlega++; if (MOMENTOS.includes(c.momento as Momento)) d.porMomento[c.momento as Momento]++ }
    }
    out.push(d)
  }
  return out
}

/** Grupo para comparar: hospital (si estaba ingresado) o la semana (quimio / nadir). */
export function grupoDe(r?: AvisoRow): string {
  if (!r) return 'otro'
  if (r.lugar && r.lugar !== 'casa') return 'hospital'
  return r.modo === 'quimio' ? 'quimio' : 'nadir'
}
export const GRUPO_LABEL: Record<string, string> = { quimio: 'Semana de quimio', nadir: 'Semana nadir', hospital: 'En el hospital', otro: 'Otro' }
