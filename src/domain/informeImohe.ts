// Informe semanal de cuidados para Imohe (0.36.0, 19/10/2026). Sustituye al informe semanal anterior.
// Diseño aprobado por Montserrate el 19/10/2026 (proyecto OSTEOSARCOMA: «app-informe-nutricion-semanal-propuesta»).
// Se construye por partes: nutrición y suplementación ya; signos y síntomas y ejercicio, después.
// Reglas:
//  - Semáforo de lo que se mide en %: verde ≥ 80 %, ámbar 60–79 %, rojo < 60 % (cortes del 27/09/2026).
//  - Lo que quedó en blanco («sin registrar») no cuenta ni como sí ni como no: sale aparte y se enseña entre qué
//    valores quedaría el resultado según lo que pasara de verdad.
//  - Los días en el hospital cuentan igual que en casa: come el menú que le lleva la familia y los cuidadores lo
//    registran (Montserrate, 19/10/2026). «Dónde está» solo sale en la cabecera.
import type { Cycle, DailyLog, Intake, Meal, MenuData, Patient, Product, WeightEntry } from '../store/types'
import { addDays, todayStr } from './dates'
import { afterChemoGate, cycleContext, isCisplatinDay, isMtxPerfusionDay, type CycleContext } from './cycle'
import { trafficWindow } from './medication'
import { sesionesTratamiento } from './fases'
import { fatCount, finDe, mealTraffic, overnightFastDetail, totalFluids, weekMode } from './nutrition'
import { AYUNO_MAX_H, TOMAS, pautaNueva } from './catalogs'
import { kcalDia, platosDeToma, tomada } from './kcal'
import { menuDelDia } from './menu'
import { AGUA_DIA_ML, CENA_LIMITE, batidoMl, liquidosDelDia } from './avisos'
import { nauseaMax } from './nausea'
import { bristolRepresentativo, tiposBristol } from './deposiciones'

// ---------- Metas (confirmadas por Montserrate el 19/10/2026) ----------
export const METAS = {
  ingestas: 5, // al día (4 en semana de quimio)
  liquidosMl: AGUA_DIA_ML, // 1.500 ml en todas las fases, con el batido
  ayunoMaxH: AYUNO_MAX_H, // 12 h
  cenaLimite: CENA_LIMITE, // 19:30
  // Peso (Montserrate, 19/10/2026): la meta mínima es llegar a 25 kg lo antes posible, antes del siguiente ciclo.
  // No debe bajar del 5 % por debajo de 25 kg (23,75). La línea del 5 % por debajo de 24 kg (22,8) avisa de que
  // sigue muy lejos de la meta.
  pesoMetaKg: 25,
  pesoLimiteKg: 23.75, // 25 − 5 %
  pesoMuyBajoKg: 22.8, // 24 − 5 %
  pescadoSemana: 3,
  pateSemana: 1, // paté de sardinas o hígado de bacalao
}
export const CORTE_OK = 80
export const CORTE_MEDIO = 60

export type Sem = 'verde' | 'ambar' | 'rojo' | 'gris'
export const semDe = (p: number | null): Sem => (p == null ? 'gris' : p >= CORTE_OK ? 'verde' : p >= CORTE_MEDIO ? 'ambar' : 'rojo')
const peorSem = (xs: Sem[]): Sem => (xs.includes('rojo') ? 'rojo' : xs.includes('ambar') ? 'ambar' : xs.includes('verde') ? 'verde' : 'gris')
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)
const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DOW_C = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
export const diaLargo = (d: string) => DOW[new Date(d + 'T12:00').getDay()]
export const diaCorto = (d: string) => DOW_C[new Date(d + 'T12:00').getDay()]
const HOSPITAL = new Set(['ingreso', 'hospital_dia', 'urgencias'])
const SLOT_LABEL: Record<string, string> = { desayuno: 'Desayuno', media_manana: 'Media mañana (batido)', comida: 'Comida', merienda: 'Media tarde (batido)', cena: 'Cena' }
const SLOT_MIN: Record<string, string> = { desayuno: 'desayuno', media_manana: 'batido de media mañana', comida: 'comida', merienda: 'batido de media tarde', cena: 'cena' }

export interface DatosInforme {
  logs: DailyLog[]
  cycles: Cycle[]
  products: Product[]
  intakes: Intake[]
  weights: WeightEntry[]
  menu: MenuData | null
  patient?: Patient
}

/** Un hueco o un «no» del registro, para el cuadro «Registro de la semana». */
export type TipoHueco = 'no' | 'sr' | 'dudoso'
export interface Hueco { tipo: TipoHueco; apartado: string; que: string; dia: string; nota?: string }
export interface GrupoHueco { tipo: TipoHueco; apartado: string; que: string; dias: string[]; notas: Record<string, string[]> }

/** Margen del resultado según lo no registrado. */
export interface Rango { apartado: string; que: string; dias: string[]; actual: number; min: number; max: number; peso: 'Alto' | 'Medio' | 'Bajo' }

export interface Tarjeta {
  key: 'peso' | 'energia' | 'ingestas' | 'plato' | 'liquidos' | 'horarios' | 'tolerancia' | 'imprescindibles' | 'suplementos'
  titulo: string
  sem: Sem
  /** Cifra grande y su unidad. */
  valor: string
  unidad: string
  meta: string
  linea: string
  /** % para comparar con la semana anterior (si lo hay). */
  pct: number | null
  /** Reparto de ingestas para la barrita (enteras, a medias, no, sin registrar). */
  reparto?: [number, number, number, number]
}
export interface Desviacion { sem: Sem; titulo: string; texto: string; pregunta: string }

export type Celda = { v: number | null; fuera?: boolean } // v: 1 entera · 0,75 · 0,5 · 0,25 · 0 no · null sin registrar
export interface FilaDia {
  d: string
  hospital: boolean
  modo: 'quimio' | 'nadir'
  ingestas: Record<string, Celda>
  ingestasDia: { suma: number; reg: number; previstas: number } | null
  kcal: number | null
  kcalCompleto: boolean
  kcalPrevisto: number | null
  liquidos: number | null
  liquidosDudoso: boolean
  ayunoH: number | null | 'sr' | 'mtx' | 'fuera'
  cenaFin: string | null | 'no' | 'sr' | 'fuera'
  vomitos: number
  noRetiene: boolean
  nausea: number | null
  deposicion: number | null | 'no' | 'sr'
  peso: number | null
}

export interface SupRow { nombre: string; previstas: number; dadas: number; noDadas: number; sr: number; pct: number | null }

export interface InformeImohe {
  ws: string
  we: string
  days: string[]
  enCurso: boolean
  cabecera: { fase: string; pauta: string; ingestasDia: number; casa: number; hospital: number }
  diasConDatos: number
  pesadas: string[]
  datosInsuficientes: boolean
  huecos: GrupoHueco[]
  tarjetas: Tarjeta[]
  desviaciones: Desviacion[]
  rangos: Rango[]
  filas: FilaDia[]
  porToma: { slot: string; label: string; pct: number | null }[]
  plato: { n: number; sr: number; ok: number; hid: number; veg: number; prot: number }
  peso: { ultimo: number | null; faltaKg: number | null; cambioSemana: number | null; proximoCiclo: string | null; serie: { ws: string; kg: number | null }[] }
  suplementos: { filas: SupRow[]; dadas: number; noDadas: number; sr: number; pct: number | null; condicionales: string[] }
  noCome: { dejados: string[]; sustituciones: string[]; postres: number }
}

// ---------- Ayudas ----------
const valorToma = (m?: Meal): number | null => {
  if (!m) return null
  if (m.fraction != null) return m.fraction
  return tomada(m) ? 1 : null
}
const PESCADO = /merluza|dorada|lubina|salm[oó]n|bacalao|at[uú]n|sardina|caballa|pescado|rape|lenguado|boquer[oó]n|trucha|rodaballo|gallo|bonito|pez espada|panga|abadejo|corvina/i
const PATE = /pat[eé] de sardina|h[ií]gado de bacalao/i
const FRUTOS_ROJOS = /frutos? rojos|fresa|frambuesa|ar[aá]ndano|\bmoras?\b|grosella|cereza/i
/** Lo que se tomó en una toma, como texto: lo escrito en «Otro» (sustituye al menú) o los platos del menú tomados, y el postre. */
function textoToma(m: Meal, menu: ReturnType<typeof menuDelDia>): string {
  const base = m.note?.trim() ? m.note : platosDeToma(m, menu).filter((p, i) => i === 0 || m.taken?.[p.id] !== 'no').map((p) => p.n).join(', ')
  return [base, m.dessert ?? ''].join(' ')
}
const pesoDelHueco = (min: number, max: number): Rango['peso'] => (max - min >= 10 ? 'Alto' : max - min >= 4 ? 'Medio' : 'Bajo')

/** Días «de quimio» para la suplementación: semana de quimio o las 48 h antes de una sesión (mismo criterio que el informe anterior). */
function diasQuimioSup(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, data: DatosInforme) {
  const ses = sesionesTratamiento(data.patient?.protocol_start, data.cycles).filter((x) => x.kind !== 'cirugia')
  return new Set(days.filter((d) => weekMode(logOf(d), ctx(d)) === 'quimio' || ses.some((x) => x.date > d && x.date <= addDays(d, 2))))
}

/** Pesadas: tabla de pesos y peso del registro diario, una por día (la última del día). */
function pesadasDe(data: DatosInforme) {
  const m = new Map<string, number>()
  for (const l of data.logs) if (l.weight != null) m.set(l.date, l.weight)
  for (const w of [...data.weights].sort((a, b) => a.at.localeCompare(b.at))) m.set(w.at.slice(0, 10), w.kg)
  return [...m].map(([date, kg]) => ({ date, kg })).sort((a, b) => a.date.localeCompare(b.date))
}

// ---------- Cálculo ----------
export function buildInformeImohe(ws: string, data: DatosInforme, today = todayStr()): InformeImohe {
  const all = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  // Solo días cerrados (antes de hoy): el día en curso aún se puede rellenar hasta las 00:00.
  const days = all.filter((d) => d < today)
  const enCurso = all[6] >= today
  const byDate = new Map(data.logs.map((l) => [l.date, l]))
  const logOf = (d: string) => byDate.get(d)
  const ctxs = new Map<string, CycleContext>()
  const ctx = (d: string) => { let c = ctxs.get(d); if (!c) { c = cycleContext(data.cycles, d); ctxs.set(d, c) } return c }
  const modoDe = (d: string) => weekMode(logOf(d), ctx(d))
  const hosp = (d: string) => HOSPITAL.has(logOf(d)?.location ?? '')
  const menuDe = (d: string) => menuDelDia(data.menu, d)
  const H: Hueco[] = []
  // Un día sin ningún dato sale una sola vez («Día sin ningún dato»), no apartado por apartado.
  const hueco = (tipo: TipoHueco, apartado: string, que: string, dia: string, nota?: string) => { if (apartado === 'Registro' || (tipo === 'no' && apartado === 'Suplementación') || logOf(dia)) H.push({ tipo, apartado, que, dia, nota }) }
  const enCasa = days

  // Días sin ningún registro
  for (const d of days) if (!logOf(d)) hueco('sr', 'Registro', 'Día sin ningún dato', d)

  // ---------- Ingestas ----------
  const filas: FilaDia[] = days.map((d) => ({ d, hospital: false, modo: modoDe(d), ingestas: {}, ingestasDia: null, kcal: null, kcalCompleto: false, kcalPrevisto: null, liquidos: null, liquidosDudoso: false, ayunoH: null, cenaFin: null, vomitos: 0, noRetiene: false, nausea: null, deposicion: null, peso: null }))
  const filaDe = new Map(filas.map((f) => [f.d, f]))
  const tot = { suma: 0, reg: 0, sr: 0, enteras: 0, parciales: 0, no: 0 }
  const porSlot = new Map<string, { suma: number; reg: number }>()
  for (const f of filas) {
    const l = logOf(f.d)
    const celdas: Record<string, Celda> = {}
    for (const t of TOMAS) celdas[t.key] = { v: valorToma(l?.meals.find((m) => m.slot === t.key)), fuera: f.hospital }
    if (!f.hospital && pautaNueva(f.d) && f.modo === 'quimio') {
      // Semana de quimio: 4 ingestas. Sale de la cuenta el batido que menos se tomó (o el que está sin registrar).
      const a = celdas.media_manana.v, b = celdas.merienda.v
      const quita = (a ?? -1) <= (b ?? -1) ? 'media_manana' : 'merienda'
      celdas[quita] = { ...celdas[quita], fuera: true }
    }
    f.ingestas = celdas
    if (f.hospital) continue
    let suma = 0, reg = 0, prev = 0
    for (const t of TOMAS) {
      const c = celdas[t.key]
      if (c.fuera) continue
      prev++
      const s = porSlot.get(t.key) ?? { suma: 0, reg: 0 }
      if (c.v == null) { tot.sr++; hueco('sr', 'Ingestas', `Si tomó ${SLOT_MIN[t.key]}`, f.d); porSlot.set(t.key, s); continue }
      reg++; suma += c.v; s.reg++; s.suma += c.v
      if (c.v >= 1) tot.enteras++
      else if (c.v > 0) tot.parciales++
      else { tot.no++; hueco('no', 'Ingestas', SLOT_LABEL[t.key], f.d) }
      porSlot.set(t.key, s)
    }
    tot.suma += suma; tot.reg += reg
    f.ingestasDia = { suma, reg, previstas: prev }
  }
  const ingPct = pct(tot.suma, tot.reg)
  const porToma = TOMAS.map((t) => ({ slot: t.key, label: SLOT_LABEL[t.key], pct: (() => { const s = porSlot.get(t.key); return s && s.reg ? pct(s.suma, s.reg) : null })() }))
  const peorToma = [...porToma].filter((x) => x.pct != null).sort((a, b) => a.pct! - b.pct!)[0]
  const peorTomaDet = peorToma ? porSlot.get(peorToma.slot)! : null
  const previstasTot = tot.reg + tot.sr

  // ---------- Energía ----------
  const kDias: { k: number; prev: number | null }[] = []
  for (const f of filas) {
    if (f.hospital || !logOf(f.d)) continue
    const k = kcalDia(logOf(f.d), menuDe(f.d))
    f.kcal = k.total
    f.kcalPrevisto = k.previsto
    const sinReg = Object.values(f.ingestas).some((c) => !c.fuera && c.v == null)
    f.kcalCompleto = !sinReg && !k.sinDato.length
    for (const s of k.sinDato) hueco('dudoso', 'Energía', 'Ingesta hecha sin saber qué tomó (no se pueden contar sus kcal)', f.d, s.toLowerCase())
    if (f.kcalCompleto) kDias.push({ k: k.total, prev: k.previsto })
  }
  const kMedia = kDias.length ? Math.round(kDias.reduce((a, x) => a + x.k, 0) / kDias.length) : null
  const conPrev = kDias.filter((x) => x.prev != null)
  const prevMedia = conPrev.length ? Math.round(conPrev.reduce((a, x) => a + x.prev!, 0) / conPrev.length) : null
  const kPct = conPrev.length && prevMedia ? pct(conPrev.reduce((a, x) => a + x.k, 0) / conPrev.length, prevMedia) : null

  // ---------- Plato ----------
  const plato = { n: 0, sr: 0, ok: 0, hid: 0, veg: 0, prot: 0 }
  for (const d of enCasa) {
    for (const slot of ['comida', 'cena'] as const) {
      const m = logOf(d)?.meals.find((x) => x.slot === slot)
      const v = valorToma(m)
      if (!m || v == null || v === 0) continue
      const mc = m.macros
      if (!mc || (mc.veg == null && mc.prot == null && mc.starch == null)) { plato.sr++; hueco('sr', 'Plato', 'Cómo era el plato (sin dibujar)', d, slot); continue }
      plato.n++
      const minHid = pautaNueva(d) ? 2 : 1
      const hid = (mc.starch ?? 0) >= minHid, veg = (mc.veg ?? 0) >= 2, prot = (mc.prot ?? 0) >= 2
      if (hid) plato.hid++
      if (veg) plato.veg++
      if (prot) plato.prot++
      const ok = pautaNueva(d) ? hid && veg && prot : !(mealTraffic(m, { date: d, cisplatin: isCisplatinDay(ctx(d)) })?.missing ?? []).some((x) => !/grasa|mitad/.test(x))
      if (ok) plato.ok++
    }
  }
  const platoPct = pct(plato.ok, plato.n)

  // ---------- Líquidos ----------
  const liq: number[] = []
  let liqLlega = 0, liqSr = 0
  for (const f of filas) {
    if (f.hospital) continue
    const l = logOf(f.d)
    const tiene = !!l && (totalFluids(l) != null || batidoMl(l) > 0)
    if (!tiene) { liqSr++; hueco('sr', 'Líquidos', 'Líquidos del día', f.d); continue }
    const ml = liquidosDelDia(l)
    f.liquidos = ml
    liq.push(ml)
    if (ml >= METAS.liquidosMl) liqLlega++
    if (ml < METAS.liquidosMl / 2) { f.liquidosDudoso = true; hueco('dudoso', 'Líquidos', 'Muy pocos líquidos apuntados (menos de la mitad de la meta)', f.d, `${ml} ml`) }
  }
  const liqMedia = liq.length ? Math.round(liq.reduce((a, b) => a + b, 0) / liq.length) : null
  const liqPct = liqMedia != null ? pct(liqMedia, METAS.liquidosMl) : null

  // ---------- Horarios ----------
  let ayOk = 0, ayN = 0, aySr = 0, ayMax: { d: string; h: number } | null = null
  let cnOk = 0, cnN = 0
  for (const f of filas) {
    const d = f.d
    if (isMtxPerfusionDay(data.cycles, d)) f.ayunoH = 'mtx'
    else {
      const det = overnightFastDetail(logOf(d), logOf(addDays(d, -1)))
      if (!det) { f.ayunoH = 'sr'; aySr++; hueco('sr', 'Horarios', 'Hora de la cena de la víspera o de la primera ingesta (ayuno de la noche)', d) }
      else { f.ayunoH = det.hours; ayN++; if (det.hours <= METAS.ayunoMaxH) ayOk++; if (!ayMax || det.hours > ayMax.h) ayMax = { d, h: det.hours } }
    }
    if (f.hospital) { f.cenaFin = 'fuera'; continue }
    const cena = logOf(d)?.meals.find((m) => m.slot === 'cena')
    const v = valorToma(cena)
    if (v === 0) f.cenaFin = 'no'
    else if (v == null) f.cenaFin = 'sr'
    else {
      const fin = cena ? finDe(cena) : null
      if (!fin) { f.cenaFin = 'sr'; hueco('sr', 'Horarios', 'Hora de terminar la cena', d) }
      else { f.cenaFin = fin; cnN++; if (fin <= METAS.cenaLimite) cnOk++ }
    }
  }
  const ayPct = pct(ayOk, ayN)
  const cnPct = pct(cnOk, cnN)
  const horSem = peorSem([semDe(ayPct), semDe(cnPct)])

  // ---------- Tolerancia ----------
  let vomDias = 0, maxEp = 0, nau5 = 0, duras = 0, depSr = 0, run = 0, maxRun = 0, depDias = 0, noRet = false
  for (const f of filas) {
    const l = logOf(f.d)
    const ep = l?.extra?.vomits?.length ?? 0
    f.vomitos = ep
    f.noRetiene = !!l?.extra?.vomit_no_liquids
    if (f.noRetiene) noRet = true
    if (ep > 0 || f.noRetiene) vomDias++
    maxEp = Math.max(maxEp, ep)
    const nm = nauseaMax(l?.extra?.nausea)
    f.nausea = nm != null ? nm : l?.symptoms?.nauseas != null ? [0, 2, 5, 8][l.symptoms.nauseas] ?? null : null
    if ((f.nausea ?? 0) >= 5) nau5++
    if (l?.stools_n == null) { f.deposicion = 'sr'; depSr++; run = 0; hueco('sr', 'Tolerancia', 'Si hizo deposición', f.d) }
    else if (l.stools_n === 0) { f.deposicion = 'no'; run++; maxRun = Math.max(maxRun, run) }
    else { run = 0; depDias++; const b = bristolRepresentativo(tiposBristol(l)); f.deposicion = b; if (tiposBristol(l).some((x) => x <= 2)) duras++ }
  }
  const tolSem: Sem = !days.some((d) => logOf(d)) ? 'gris'
    : vomDias >= 2 || maxEp >= 3 || nau5 >= 2 || maxRun >= 3 || duras >= 3 || noRet ? 'rojo'
      : vomDias === 1 || nau5 === 1 || duras >= 1 ? 'ambar' : 'verde'

  // ---------- Imprescindibles ----------
  let grasaSi = 0, grasaN = 0, grasaSr = 0, pescado = 0, pate = 0
  const rojosDias = new Set<string>()
  const noCome = { dejados: [] as string[], sustituciones: [] as string[], postres: 0 }
  const dejados = new Map<string, number>()
  for (const d of enCasa) {
    const l = logOf(d)
    if (!l) continue
    const menu = menuDe(d)
    let postre = false
    for (const m of l.meals) {
      if (!tomada(m)) continue
      const txt = textoToma(m, menu)
      if (PATE.test(txt)) pate++
      else if (PESCADO.test(txt)) pescado++
      if (FRUTOS_ROJOS.test(txt)) rojosDias.add(d)
      if (m.dessert?.trim()) postre = true
      if (m.note?.trim() && (m.slot === 'comida' || m.slot === 'cena' || m.slot === 'desayuno')) noCome.sustituciones.push(`${diaLargo(d)} ${SLOT_MIN[m.slot] ?? m.slot}: ${m.note.trim()}`)
      for (const p of platosDeToma(m, menu)) if (m.taken?.[p.id] === 'no') dejados.set(p.n, (dejados.get(p.n) ?? 0) + 1)
      if (m.slot === 'comida' || m.slot === 'cena') {
        const fc = fatCount(m.macros)
        if (fc == null) { grasaSr++; hueco('sr', 'Imprescindibles', 'Si llevaba grasa añadida', d, m.slot) }
        else { grasaN++; if (fc >= 1) grasaSi++ }
      }
    }
    if (postre) noCome.postres++
  }
  noCome.dejados = [...dejados].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n} (${k} ${k === 1 ? 'vez' : 'veces'})`)
  const grasaPct = pct(grasaSi, grasaN)
  const pescPct = Math.min(100, Math.round((pescado / METAS.pescadoSemana) * 100))
  const patePct = Math.min(100, Math.round((pate / METAS.pateSemana) * 100))
  const impSem = peorSem([semDe(grasaPct), enCurso && pescado < METAS.pescadoSemana ? 'gris' : semDe(pescPct), enCurso && pate < METAS.pateSemana ? 'gris' : semDe(patePct)])

  // ---------- Suplementación ----------
  const MOM: Record<string, string> = { ayunas: 'ayunas', manana: 'mañana', media_manana: 'media mañana', comida: 'comida', media_tarde: 'media tarde', cena: 'cena', dormir: 'antes de dormir' }
  const quimioSup = diasQuimioSup(days, logOf, ctx, data)
  const sup = new Map<string, SupRow>()
  const condicionales: string[] = []
  for (const d of days) {
    const c = ctx(d)
    const wk = trafficWindow(c, d)
    const dow = new Date(d + 'T12:00').getDay()
    for (const p of data.products) {
      if (p.block !== 'sup_ciclo' && p.block !== 'sup_fuera') continue
      if (p.end_date && p.end_date <= d) continue
      if (p.start_date && p.start_date > d) continue
      if (!p.moments?.length) continue
      if (p.weekdays?.length && !p.weekdays.includes(dow)) continue
      if (afterChemoGate(p, data.cycles, d)?.waiting) continue
      if (wk && p.traffic?.[wk] === 'rojo') continue
      if (quimioSup.has(d) && p.block === 'sup_fuera') continue
      for (const mo of p.moments) {
        const it = data.intakes.find((i) => i.product_id === p.id && i.date === d && i.moment === mo)
        if (it?.status === 'no_precisa') continue
        const dada = !!(it?.taken || it?.status === 'dada')
        if (p.condition) { if (dada) condicionales.push(`${p.name}: ${diaLargo(d)} ${MOM[mo] ?? mo}`); continue }
        const r = sup.get(p.id) ?? { nombre: p.name, previstas: 0, dadas: 0, noDadas: 0, sr: 0, pct: null }
        r.previstas++
        if (dada) r.dadas++
        else if (it?.status === 'no_dada') r.noDadas++
        else { r.sr++; hueco('sr', 'Suplementación', p.name, d, MOM[mo] ?? mo) }
        sup.set(p.id, r)
      }
    }
  }
  const supFilas = [...sup.values()].map((r) => ({ ...r, pct: pct(r.dadas, r.dadas + r.noDadas) })).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101))
  const sD = supFilas.reduce((a, r) => a + r.dadas, 0), sN = supFilas.reduce((a, r) => a + r.noDadas, 0), sS = supFilas.reduce((a, r) => a + r.sr, 0)
  if (sN) hueco('no', 'Suplementación', `${sN} toma${sN > 1 ? 's' : ''} no dada${sN > 1 ? 's' : ''} (detalle en Suplementación)`, days[days.length - 1] ?? ws)
  const supPct = pct(sD, sD + sN)
  const supBajos = supFilas.filter((r) => r.pct != null && r.pct < CORTE_MEDIO)

  // ---------- Peso ----------
  const pes = pesadasDe(data)
  const semana = pes.filter((p) => p.date >= ws && p.date <= all[6] && p.date < today)
  for (const p of semana) { const f = filaDe.get(p.date); if (f) f.peso = p.kg }
  const ultimo = semana[semana.length - 1] ?? null
  const faltaKg = ultimo ? Math.round(Math.max(0, METAS.pesoMetaKg - ultimo.kg) * 10) / 10 : null
  const proximoCiclo = sesionesTratamiento(data.patient?.protocol_start, data.cycles).find((x) => x.kind !== 'cirugia' && x.date >= today)?.date ?? null
  const cambioSemana = semana.length >= 2 ? Math.round((semana[semana.length - 1].kg - semana[0].kg) * 10) / 10 : null
  const pesoSem: Sem = !ultimo ? 'gris' : ultimo.kg >= METAS.pesoMetaKg ? 'verde' : ultimo.kg >= METAS.pesoLimiteKg ? 'ambar' : 'rojo'
  const dias = (a: string, b: string) => Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 86400000)
  const serie = Array.from({ length: 6 }, (_, i) => addDays(ws, -7 * (5 - i))).map((w) => {
    const xs = pes.filter((p) => p.date >= w && p.date <= addDays(w, 6)).map((p) => p.kg)
    return { ws: w, kg: xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null }
  })

  // ---------- Tarjetas ----------
  const n = (x: number) => x.toLocaleString('es-ES')
  const es = (x: number) => String(x).replace('.', ',')
  const tarjetas: Tarjeta[] = [
    {
      key: 'peso', titulo: 'Peso', sem: pesoSem, pct: ultimo ? Math.round((ultimo.kg / METAS.pesoMetaKg) * 100) : null,
      valor: ultimo ? es(ultimo.kg) : '—', unidad: 'kg',
      meta: ultimo ? `Meta: ${METAS.pesoMetaKg} kg${faltaKg ? ` · faltan ${es(faltaKg)} kg` : ' · alcanzada'}${ultimo.kg < METAS.pesoLimiteKg ? ` · por debajo del límite (${es(METAS.pesoLimiteKg)} kg)` : ''}${proximoCiclo ? ` · próximo ciclo ${proximoCiclo.slice(8)}/${proximoCiclo.slice(5, 7)} (en ${dias(today, proximoCiclo)} días)` : ''}` : 'Sin pesadas esta semana',
      linea: cambioSemana != null ? `${cambioSemana > 0 ? '↑ +' : cambioSemana < 0 ? '↓ ' : '= '}${es(cambioSemana)} kg esta semana` : ultimo ? 'Una sola pesada esta semana' : 'Sin pesadas esta semana',
    },
    {
      key: 'energia', titulo: 'Energía', sem: semDe(kPct), pct: kPct,
      valor: kMedia != null ? n(kMedia) : '—', unidad: 'kcal/día',
      meta: kPct != null && prevMedia ? `${kPct} % de las ${n(prevMedia)} previstas en el menú*` : 'Sin menú para comparar*',
      linea: `${kDias.length} día${kDias.length === 1 ? '' : 's'} completo${kDias.length === 1 ? '' : 's'} en la media`,
    },
    {
      key: 'ingestas', titulo: `Ingestas (${METAS.ingestas}/día)`, sem: semDe(ingPct), pct: ingPct,
      valor: ingPct != null ? String(ingPct) : '—', unidad: '% de lo previsto',
      meta: `De ${previstasTot}: ${tot.enteras} enteras · ${tot.parciales} a medias · ${tot.no} no hechas · ${tot.sr} sin registrar`,
      linea: peorToma && peorToma.pct! < 100 ? `La que más falla: ${SLOT_MIN[peorToma.slot]} (${peorToma.pct} %)` : 'Todas las registradas, enteras',
      reparto: [tot.enteras, tot.parciales, tot.no, tot.sr],
    },
    {
      key: 'plato', titulo: 'Plato', sem: semDe(platoPct), pct: platoPct,
      valor: String(plato.ok), unidad: `de ${plato.n} comidas`,
      meta: `Siguen la pauta (½ hidratos · ⅓ verdura · resto proteína)${plato.sr ? ` · ${plato.sr} sin dibujar` : ''}`,
      linea: plato.n ? `Hidratos en su parte ${plato.hid} · verdura ${plato.veg} · proteína ${plato.prot}` : 'Sin platos dibujados',
    },
    {
      key: 'liquidos', titulo: 'Líquidos', sem: semDe(liqPct), pct: liqPct,
      valor: liqMedia != null ? n(liqMedia) : '—', unidad: 'ml/día',
      meta: liqPct != null ? `${liqPct} % de ${n(METAS.liquidosMl)} · llega ${liqLlega} de ${liq.length} días` : 'Sin líquidos apuntados',
      linea: 'Batido incluido',
    },
    {
      key: 'horarios', titulo: 'Horarios', sem: horSem, pct: ayPct != null && cnPct != null ? Math.min(ayPct, cnPct) : ayPct ?? cnPct,
      valor: String(ayOk), unidad: `de ${ayN} noches`,
      meta: `Ayuno de noche ≤ ${METAS.ayunoMaxH} h · cena antes de las ${METAS.cenaLimite}: ${cnOk} de ${cnN}`,
      linea: ayMax ? `Ayuno más largo: ${es(ayMax.h)} h (${diaLargo(ayMax.d)})` : 'Sin ayunos calculados',
    },
    {
      key: 'tolerancia', titulo: 'Tolerancia', sem: tolSem, pct: null,
      valor: String(vomDias), unidad: vomDias === 1 ? 'día con vómitos' : 'días con vómitos',
      meta: `Heces duras (Bristol 1–2): ${duras} de ${depDias} días con deposición${depSr ? ` · ${depSr} sin registrar` : ''}`,
      linea: `Náusea máxima: ${Math.max(0, ...filas.map((f) => f.nausea ?? 0))}/10${maxRun >= 2 ? ` · ${maxRun} días seguidos sin deposición` : ''}`,
    },
    {
      key: 'imprescindibles', titulo: 'Imprescindibles', sem: impSem, pct: grasaPct,
      valor: String(grasaSi), unidad: `de ${grasaN} con grasa`,
      meta: `Pescado ${pescado} ${pescado === 1 ? 'vez' : 'veces'} (meta ${METAS.pescadoSemana}) · paté de sardinas o hígado de bacalao ${pate} (meta ${METAS.pateSemana}) · frutos rojos ${rojosDias.size} día${rojosDias.size === 1 ? '' : 's'}`,
      linea: grasaSr ? `${grasaSr} comida${grasaSr > 1 ? 's' : ''} sin marcar la grasa` : enCurso ? 'Semana en curso: las veces por semana aún pueden subir' : 'Grasa añadida en comida y cena',
    },
    {
      key: 'suplementos', titulo: 'Suplementación', sem: semDe(supPct), pct: supPct,
      valor: supPct != null ? String(supPct) : '—', unidad: '% tomas correctas',
      meta: `${sD} dadas de ${sD + sN} registradas${sS ? ` · ${sS} sin registrar` : ''}`,
      linea: supBajos.length ? `Más bajas: ${supBajos.slice(0, 3).map((r) => `${r.nombre} ${r.pct} %`).join(', ')}` : supFilas.length ? 'Ningún suplemento por debajo del 60 %' : 'Sin tomas previstas',
    },
  ]

  // ---------- Desviaciones principales ----------
  const des: (Desviacion & { orden: number })[] = []
  const T = (k: Tarjeta['key']) => tarjetas.find((t) => t.key === k)!
  const add = (k: Tarjeta['key'], titulo: string, texto: string, pregunta: string) => { const t = T(k); if (t.sem === 'rojo' || t.sem === 'ambar') des.push({ sem: t.sem, titulo, texto, pregunta, orden: (t.sem === 'rojo' ? 0 : 1000) + (t.pct ?? 50) }) }
  if (ultimo) add('peso', ultimo.kg < METAS.pesoLimiteKg ? 'Peso por debajo del límite' : 'Peso por debajo de la meta', `Última pesada ${es(ultimo.kg)} kg; la meta es ${METAS.pesoMetaKg} kg (faltan ${es(faltaKg ?? 0)} kg) y no debe bajar de ${es(METAS.pesoLimiteKg)} kg.${ultimo.kg < METAS.pesoMuyBajoKg ? ` Está por debajo de ${es(METAS.pesoMuyBajoKg)} kg: muy lejos de la meta.` : ''}${cambioSemana != null ? ` Esta semana: ${cambioSemana > 0 ? '+' : ''}${es(cambioSemana)} kg.` : ''}${proximoCiclo ? ` Próximo ciclo en ${dias(today, proximoCiclo)} días.` : ''}`, `Con ${kMedia != null ? n(kMedia) + ' kcal de media' : 'lo que come'}, ¿qué cifra diaria debería alcanzar para llegar a ${METAS.pesoMetaKg} kg antes del próximo ciclo?`)
  add('energia', 'Come menos de lo previsto', `Media de ${kMedia != null ? n(kMedia) : '—'} kcal al día, el ${kPct} % de lo previsto en el menú.`, '¿Qué cifra de kcal al día debería alcanzar?')
  if (peorToma && peorTomaDet) add('ingestas', 'Ingestas', `Hace el ${ingPct} % de lo previsto. La que más falla es el ${SLOT_MIN[peorToma.slot]}: ${es(peorTomaDet.suma)} de ${peorTomaDet.reg} registradas (${peorToma.pct} %).`, `¿Hay otra opción para el ${SLOT_MIN[peorToma.slot]} que le cueste menos?`)
  const falta = [plato.hid < plato.n ? `hidratos (${plato.n - plato.hid})` : '', plato.veg < plato.n ? `verdura (${plato.n - plato.veg})` : '', plato.prot < plato.n ? `proteína (${plato.n - plato.prot})` : ''].filter(Boolean).join(', ')
  add('plato', 'El plato no sigue la pauta', `Solo ${plato.ok} de ${plato.n} comidas y cenas con plato dibujado siguen la pauta.${falta ? ` Les falta su parte de ${falta}.` : ''}`, data.menu ? 'El menú cargado es low carb (⅓ de hidratos). ¿Se adapta a la pauta del 18/10 o hay un menú nuevo?' : '¿Cómo acercamos el plato a la pauta?')
  add('liquidos', 'Bebe menos de la meta', `Media de ${liqMedia != null ? n(liqMedia) : '—'} ml al día (${liqPct} % de ${n(METAS.liquidosMl)}); llega a la meta ${liqLlega} de ${liq.length} días.`, '¿Alguna forma de que beba más a lo largo del día?')
  add('horarios', 'Horarios', `Ayuno de noche de ${METAS.ayunoMaxH} h o menos: ${ayOk} de ${ayN} noches${ayMax && ayMax.h > METAS.ayunoMaxH ? ` (el más largo, ${es(ayMax.h)} h el ${diaLargo(ayMax.d)})` : ''}. Cena terminada antes de las ${METAS.cenaLimite}: ${cnOk} de ${cnN}.`, '¿Cómo ajustamos los horarios para no pasar de 12 h de ayuno?')
  add('tolerancia', 'Tolerancia digestiva', `${vomDias ? `Vómitos ${vomDias} día${vomDias > 1 ? 's' : ''} (hasta ${maxEp} en un día). ` : ''}${nau5 ? `Náusea de 5 o más ${nau5} día${nau5 > 1 ? 's' : ''}. ` : ''}${duras ? `Heces duras ${duras} día${duras > 1 ? 's' : ''}. ` : ''}${maxRun >= 2 ? `${maxRun} días seguidos sin deposición.` : ''}`.trim(), '¿Hace falta ajustar algo para las náuseas o el estreñimiento?')
  add('imprescindibles', 'Imprescindibles', `Grasa añadida en ${grasaSi} de ${grasaN} comidas y cenas. Pescado ${pescado} de ${METAS.pescadoSemana} veces; paté de sardinas o hígado de bacalao ${pate} de ${METAS.pateSemana}.`, '¿Cómo podemos meter mejor los imprescindibles?')
  add('suplementos', supBajos.length ? `${supBajos.length === 1 ? 'Un suplemento' : `${supBajos.length} suplementos`} por debajo del 60 %` : 'Suplementación', supBajos.length ? supBajos.map((r) => `${r.nombre}: ${r.dadas} de ${r.dadas + r.noDadas} tomas (${r.pct} %)`).join('; ') + '.' : `${sD} de ${sD + sN} tomas dadas (${supPct} %).`, '¿Hay otro formato o alternativa que tolere mejor?')
  const desviaciones: Desviacion[] = des.sort((a, b) => a.orden - b.orden).slice(0, 3).map((x) => ({ sem: x.sem, titulo: x.titulo, texto: x.texto, pregunta: x.pregunta }))

  // ---------- Rangos (cuánto cambia el resultado por lo no registrado) ----------
  const rangos: Rango[] = []
  const diasDe = (ap: string) => Array.from(new Set(H.filter((h) => h.tipo === 'sr' && h.apartado === ap).map((h) => h.dia))).sort()
  const rango = (ap: string, que: string, si: number, base: number, sr: number) => {
    if (!sr || base + sr === 0) return
    const actual = pct(si, base) ?? 0, min = pct(si, base + sr)!, max = pct(si + sr, base + sr)!
    rangos.push({ apartado: ap, que, dias: diasDe(ap), actual, min, max, peso: pesoDelHueco(min, max) })
  }
  rango('Ingestas', `${tot.sr} ingesta${tot.sr > 1 ? 's' : ''} sin marcar`, tot.suma, tot.reg, tot.sr)
  rango('Plato', `${plato.sr} plato${plato.sr > 1 ? 's' : ''} sin dibujar (comida marcada «hecha»)`, plato.ok, plato.n, plato.sr)
  rango('Horarios', `${aySr} noche${aySr > 1 ? 's' : ''} sin hora para calcular el ayuno`, ayOk, ayN, aySr)
  rango('Imprescindibles', `${grasaSr} comida${grasaSr > 1 ? 's' : ''} sin marcar la grasa añadida`, grasaSi, grasaN, grasaSr)
  rango('Suplementación', `${sS} toma${sS > 1 ? 's' : ''} sin marcar`, sD, sD + sN, sS)
  if (liqSr) rangos.push({ apartado: 'Líquidos', que: `${liqSr} día${liqSr > 1 ? 's' : ''} sin líquidos apuntados`, dias: diasDe('Líquidos'), actual: liqPct ?? 0, min: liqPct ?? 0, max: liqPct ?? 0, peso: liqSr >= 2 ? 'Alto' : 'Medio' })
  if (depSr) rangos.push({ apartado: 'Tolerancia', que: `${depSr} día${depSr > 1 ? 's' : ''} sin marcar la deposición`, dias: diasDe('Tolerancia'), actual: 0, min: 0, max: 0, peso: depSr >= 2 ? 'Medio' : 'Bajo' })
  rangos.sort((a, b) => ['Alto', 'Medio', 'Bajo'].indexOf(a.peso) - ['Alto', 'Medio', 'Bajo'].indexOf(b.peso))

  // ---------- Agrupar huecos ----------
  const grupos = new Map<string, GrupoHueco>()
  for (const h of H) {
    const k = `${h.tipo}|${h.apartado}|${h.que}`
    const g = grupos.get(k) ?? { tipo: h.tipo, apartado: h.apartado, que: h.que, dias: [], notas: {} }
    if (!g.dias.includes(h.dia)) g.dias.push(h.dia)
    if (h.nota) (g.notas[h.dia] ??= []).push(h.nota)
    grupos.set(k, g)
  }

  // ---------- Cabecera ----------
  const qd = days.filter((d) => modoDe(d) === 'quimio').length
  const nd = days.length - qd
  const nh = days.filter(hosp).length
  const fase = [qd ? `${qd} día${qd > 1 ? 's' : ''} de quimio` : '', nd ? `${nd} de nadir` : ''].filter(Boolean).join(' · ')
  const diasConDatos = days.filter((d) => !!logOf(d)).length

  return {
    ws, we: all[6], days, enCurso,
    cabecera: { fase: fase || '—', pauta: pautaNueva(all[6]) ? '18/10 · subir de peso' : 'pauta anterior al 18/10', ingestasDia: METAS.ingestas, casa: days.length - nh, hospital: nh },
    diasConDatos,
    pesadas: semana.map((p) => p.date),
    datosInsuficientes: diasConDatos < 4,
    huecos: [...grupos.values()],
    tarjetas, desviaciones, rangos, filas, porToma, plato,
    peso: { ultimo: ultimo?.kg ?? null, faltaKg, cambioSemana, proximoCiclo, serie },
    suplementos: { filas: supFilas, dadas: sD, noDadas: sN, sr: sS, pct: supPct, condicionales },
    noCome,
  }
}
