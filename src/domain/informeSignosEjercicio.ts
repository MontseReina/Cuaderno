// Informe semanal para Imohe · partes de signos y síntomas y de ejercicio (0.37.0, 19/10/2026).
// Diseño aprobado por Montserrate (propuesta v4). Solo días cerrados, igual que el resto del informe.
// Signos y síntomas: rangos aceptados el 27/09/2026 (los mismos del informe anterior).
import type { DailyLog, ExerciseSession, Patient, VitalEntry } from '../store/types'
import { addDays, todayStr } from './dates'
import { STOOL_COLORS, SYMPTOMS, VOMIT_KINDS, WALK_AID, WALK_STOP } from './catalogs'
import { temperaturasApuntadas, TEMPS_DIA } from './avisos'
import { tiposBristol } from './deposiciones'

export type Nivel = 'rojo' | 'ambar'
export interface Alerta { nivel: Nivel; dia: string; hora?: string; titulo: string; detalle?: string }

export const RANGOS_SIGNOS = { fiebre: 38, febricula: 37.5, sys: [86, 110] as const, diaMax: 73, pulso: [75, 118] as const, satOk: 95, satRojo: 94, dolorAmbar: 4, dolorRojo: 7 }
const SLOT: Record<string, string> = { manana: 'mañana', tarde: 'tarde', noche: 'noche' }
const es = (x: number) => String(x).replace('.', ',')

export interface FilaSignos {
  d: string
  tempMax: number | null
  tempTomas: number
  ta: { txt: string; mal: boolean } | null
  pulso: { v: number; mal: boolean } | null
  sat: number | null
  dolor: number | null
  fatiga: number | null
  animo: number | null
  micciones: number | null
  menosOrina: boolean
}
export interface InformeSignos {
  alertas: Alerta[]
  filas: FilaSignos[]
  sintomas: string[]
  tempTomas: number
  tempPrevistas: number
  sem: 'verde' | 'ambar' | 'rojo' | 'gris'
  huecos: { que: string; dias: string[] }[]
}

export function buildSignos(days: string[], logs: DailyLog[], patient?: Patient): InformeSignos {
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const logOf = (d: string) => byDate.get(d)
  const A: Alerta[] = []
  const add = (nivel: Nivel, dia: string, titulo: string, hora?: string, detalle?: string) => A.push({ nivel, dia, titulo, hora, detalle })
  const usual = patient?.usual_voids ?? null
  const filas: FilaSignos[] = []
  const sinTemp: string[] = [], sinDolor: string[] = []
  let tomasT = 0
  const menosOrinaDias: string[] = []

  for (const d of days) {
    const l = logOf(d)
    const vit = Object.entries(l?.extra?.vitals ?? {}).filter((x): x is [string, VitalEntry] => !!x[1])
    // Temperatura
    const temps = vit.filter(([, v]) => v.temp != null).map(([s, v]) => ({ s, t: v.temp! }))
    if (l?.temp_max != null && !temps.some((x) => x.t === l.temp_max)) temps.push({ s: '', t: l.temp_max })
    const tmax = temps.length ? Math.max(...temps.map((x) => x.t)) : null
    const n = l ? temperaturasApuntadas(l) : 0
    tomasT += Math.min(n, TEMPS_DIA)
    if (l && n < TEMPS_DIA) sinTemp.push(d)
    const fiebre = temps.filter((x) => x.t >= RANGOS_SIGNOS.fiebre)
    const feb = temps.filter((x) => x.t >= RANGOS_SIGNOS.febricula && x.t < RANGOS_SIGNOS.fiebre)
    if (fiebre.length) { const x = fiebre.sort((a, b) => b.t - a.t)[0]; add('rojo', d, `Fiebre ${es(x.t)} °C`, SLOT[x.s], l?.extra?.fever_cause ? `foco marcado: ${l.extra.fever_cause.replace('_', ' ')}` : undefined) }
    else if (feb.length >= 2) add('rojo', d, `37,5 °C o más repetida (${feb.map((x) => es(x.t)).join(' y ')} °C)`)
    else if (feb.length === 1) add('ambar', d, `Febrícula ${es(feb[0].t)} °C`, SLOT[feb[0].s])
    // Tensión, pulso, saturación
    let ta: FilaSignos['ta'] = null, pulso: FilaSignos['pulso'] = null, sat: number | null = null
    for (const [s, v] of vit) {
      if (v.sys != null) {
        const mal = v.sys < RANGOS_SIGNOS.sys[0] || v.sys > RANGOS_SIGNOS.sys[1] || (v.dia != null && v.dia > RANGOS_SIGNOS.diaMax)
        if (!ta || (mal && !ta.mal)) ta = { txt: `${v.sys}/${v.dia ?? '—'}`, mal }
        if (mal) add('ambar', d, `Tensión ${v.sys}/${v.dia ?? '—'}`, SLOT[s], 'rango: sistólica 86–110, diastólica hasta 73')
      }
      if (v.pulse != null) {
        const mal = v.pulse < RANGOS_SIGNOS.pulso[0] || v.pulse > RANGOS_SIGNOS.pulso[1]
        if (!pulso || (mal && !pulso.mal) || (mal === pulso.mal && Math.abs(v.pulse - 96) > Math.abs(pulso.v - 96))) pulso = { v: v.pulse, mal }
        if (mal) add('ambar', d, `Pulso ${v.pulse} lpm`, SLOT[s], 'rango: 75–118 en reposo')
      }
      if (v.spo2 != null) {
        sat = sat == null ? v.spo2 : Math.min(sat, v.spo2)
        if (v.spo2 < RANGOS_SIGNOS.satRojo) add('rojo', d, `Saturación ${v.spo2} %`, SLOT[s])
        else if (v.spo2 < RANGOS_SIGNOS.satOk) add('ambar', d, `Saturación ${v.spo2} %`, SLOT[s])
      }
    }
    // Dolor
    const dolor = l?.pain_max ?? null
    if (l && dolor == null) sinDolor.push(d)
    if (dolor != null && dolor >= RANGOS_SIGNOS.dolorRojo) add('rojo', d, `Dolor ${dolor}/10`, undefined, l?.pain_location || undefined)
    else if (dolor != null && dolor >= RANGOS_SIGNOS.dolorAmbar) add('ambar', d, `Dolor ${dolor}/10`, undefined, l?.pain_location || undefined)
    // Vómitos de alarma y líquidos
    for (const e of l?.extra?.vomits ?? []) { const k = VOMIT_KINDS.find((x) => x.value === e.kind); if (k?.alerta) add('rojo', d, `Vómito ${k.label.toLowerCase()}`, e.time || undefined) }
    if (l?.extra?.vomit_no_liquids) add('rojo', d, 'No retiene ni líquidos')
    // Heces
    if (l?.stool_color === 'oscuro' || l?.stool_color === 'sangre' || l?.stool_color === 'palido') add('rojo', d, `Heces: ${STOOL_COLORS.find((x) => x.key === l.stool_color)?.label.toLowerCase()}`)
    const diarrea = tiposBristol(l).some((b) => b >= 6) && (l?.stools_n ?? 0) >= 3
    if (diarrea) add((tmax ?? 0) >= RANGOS_SIGNOS.fiebre ? 'rojo' : 'ambar', d, (tmax ?? 0) >= RANGOS_SIGNOS.fiebre ? 'Diarrea con fiebre' : 'Diarrea')
    // Flemas
    if (l?.extra?.phlegm_color === 'verde' || l?.extra?.phlegm_color === 'rojo') add('rojo', d, `Flemas ${l.extra.phlegm_color === 'rojo' ? 'con sangre' : 'verdes'}`)
    // Síntomas (0–3): intensos de los que avisan → rojo; moderados → ámbar. Náuseas y vómitos van en Tolerancia.
    for (const [k, v] of Object.entries(l?.symptoms ?? {})) {
      if (k === 'nauseas' || k === 'vomitos' || k === 'fiebre') continue
      const def = SYMPTOMS.find((s) => s.key === k)
      const label = def?.label ?? k.replace(/^dx_/, '').replace(/_/g, ' ')
      if (v >= 3 && def?.redAt3) add('rojo', d, `${label}: intenso`)
      else if (v >= 2) add('ambar', d, `${label}: moderado`)
    }
    if ((l?.fatigue ?? 0) >= 3) add('ambar', d, `Cansancio ${l!.fatigue}/4`, undefined, 'descansa más de lo normal o casi todo el día tumbado')
    if (l?.mood_child != null && l.mood_child <= 2) add('ambar', d, `Ánimo ${l.mood_child}/5`)
    // Orina
    const menos = l?.urine_amount === 'menos' || (usual != null && l?.urine_count != null && l.urine_count < usual)
    if (menos) menosOrinaDias.push(d)
    filas.push({ d, tempMax: tmax, tempTomas: n, ta, pulso, sat, dolor, fatiga: l?.fatigue ?? null, animo: l?.mood_child ?? null, micciones: l?.urine_count ?? null, menosOrina: menos })
  }
  if (menosOrinaDias.length >= 2) add('ambar', menosOrinaDias[0], `Orina menos de lo habitual ${menosOrinaDias.length} días`, undefined, usual != null ? `lo habitual: ${usual} micciones` : undefined)

  // Síntomas que aparecen en la semana (días e intensidad máxima)
  const keys = new Set<string>()
  for (const d of days) for (const k of Object.keys(logOf(d)?.symptoms ?? {})) keys.add(k)
  const sintomas: string[] = []
  for (const k of keys) {
    if (k === 'nauseas' || k === 'vomitos') continue
    const vals = days.map((d) => logOf(d)?.symptoms?.[k] ?? 0).filter((v) => v > 0)
    if (!vals.length) continue
    const label = SYMPTOMS.find((s) => s.key === k)?.label ?? k.replace(/^dx_/, '').replace(/_/g, ' ')
    sintomas.push(`${label} (${vals.length} día${vals.length > 1 ? 's' : ''}, máx. ${['', 'leve', 'moderado', 'intenso'][Math.max(...vals)]})`)
  }

  A.sort((a, b) => (a.nivel === b.nivel ? a.dia.localeCompare(b.dia) : a.nivel === 'rojo' ? -1 : 1))
  const conDatos = days.some((d) => logOf(d))
  return {
    alertas: A, filas, sintomas,
    tempTomas: tomasT, tempPrevistas: days.filter((d) => logOf(d)).length * TEMPS_DIA,
    sem: !conDatos ? 'gris' : A.some((a) => a.nivel === 'rojo') ? 'rojo' : A.length ? 'ambar' : 'verde',
    huecos: [
      ...(sinTemp.length ? [{ que: `Tomas de temperatura (menos de ${TEMPS_DIA} al día)`, dias: sinTemp }] : []),
      ...(sinDolor.length ? [{ que: 'Dolor (0–10)', dias: sinDolor }] : []),
    ],
  }
}

// ---------------------------------------------------------------- Ejercicio
export interface FilaEjercicio {
  d: string
  caminar: number | null
  para: string | null
  ayuda: string | null
  paseos: (boolean | null)[] // desayuno, comida, cena; null = no cuenta (fiebre u hospital)
  pasos: number | null
  fuerza: string[]
  aerobico: string[]
  esfuerzo: number | null
  caida: boolean
}
export interface InformeEjercicio {
  filas: FilaEjercicio[]
  caminarMax: number | null
  caminarMedia: number | null
  caminarPrev: number | null
  paraMasFrecuente: string | null
  ayudaMasFrecuente: string | null
  paseosHechos: number
  paseosPrevistos: number
  paseoQueMasFalla: string | null
  pasosMedia: number | null
  pasosPrev: number | null
  esfuerzoMedia: number | null
  esfuerzoPrev: number | null
  fuerza: { n: number; min: number }
  aerobico: { n: number; min: number }
  prueba: number | null
  pruebaPrev: number | null
  caidas: number
  tolerancia: 'verde' | 'ambar' | 'rojo' | 'gris'
  toleranciaTexto: string
}
const media = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
const moda = (xs: string[]) => { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null }
const HOSPITAL = new Set(['ingreso', 'hospital_dia', 'urgencias'])
const INT: Record<string, string> = { ligera: 'ligera', moderada: 'moderada', costo: 'le costó', facil: 'fácil', bien: 'bien' }
const caida = (l?: DailyLog) => { const f = l?.extra?.functional?.falls; return !!f && !/^(no|ninguna?|nada|-+|0|sin caídas?|no hay)\.?$/i.test(f.trim()) }

export function buildEjercicio(ws: string, days: string[], logs: DailyLog[], sessions: ExerciseSession[], today = todayStr()): InformeEjercicio {
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const logOf = (d: string) => byDate.get(d)
  const prevDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i - 7)).filter((d) => d < today)
  const COM = ['desayuno', 'comida', 'cena'] as const
  const filas: FilaEjercicio[] = days.map((d) => {
    const l = logOf(d)
    const f = l?.extra?.functional ?? {}
    const fiebre = (l?.temp_max ?? 0) >= 38 || Object.values(l?.extra?.vitals ?? {}).some((v) => (v?.temp ?? 0) >= 38)
    const fuera = fiebre || HOSPITAL.has(l?.location ?? '')
    const ses = sessions.filter((s) => s.date === d && !s.deleted_at)
    return {
      d,
      caminar: f.walk_min ?? null,
      para: f.walk_stop ? WALK_STOP.find((x) => x.value === f.walk_stop)?.label ?? null : null,
      ayuda: f.walk_aid ? WALK_AID.find((x) => x.value === f.walk_aid)?.label ?? null : null,
      paseos: COM.map((c) => (fuera ? null : !!l?.extra?.move_after?.[c])),
      pasos: l?.steps ?? null,
      // Fuerza: nº de ejercicios, minutos y cómo le fue. Aeróbico: actividad, minutos e intensidad.
      fuerza: ses.filter((s) => s.kind === 'fuerza').map((s) => [s.exercises.length ? `${s.exercises.length} ej.` : '', s.minutes ? `${s.minutes} min` : '', INT[s.intensity ?? ''] ?? ''].filter(Boolean).join(' · ') || 'hecha'),
      aerobico: ses.filter((s) => s.kind === 'aerobico').map((s) => [s.exercises.map((e) => e.name).join(', ').toLowerCase(), s.minutes ? `${s.minutes} min` : '', INT[s.intensity ?? ''] ?? ''].filter(Boolean).join(' · ') || 'hecho'),
      esfuerzo: l?.extra?.effort ?? null,
      caida: caida(l),
    }
  })
  const camin = filas.map((f) => f.caminar).filter((x): x is number => x != null && x > 0)
  const caminPrev = prevDays.map((d) => logOf(d)?.extra?.functional?.walk_min).filter((x): x is number => x != null && x > 0)
  const pasos = filas.map((f) => f.pasos).filter((x): x is number => x != null && x > 0)
  const pasosPrev = prevDays.map((d) => logOf(d)?.steps).filter((x): x is number => x != null && x > 0)
  const esf = filas.map((f) => f.esfuerzo).filter((x): x is number => x != null)
  const esfPrev = prevDays.map((d) => logOf(d)?.extra?.effort).filter((x): x is number => x != null)
  let hechos = 0, previstos = 0
  const fallos: Record<string, number> = { desayuno: 0, comida: 0, cena: 0 }
  for (const f of filas) f.paseos.forEach((p, i) => { if (p == null) return; previstos++; if (p) hechos++; else fallos[COM[i]]++ })
  const peor = Object.entries(fallos).sort((a, b) => b[1] - a[1])[0]
  const ses = sessions.filter((s) => days.includes(s.date) && !s.deleted_at)
  const prueba = [...days].reverse().map((d) => logOf(d)?.extra?.functional?.sts30).find((x) => x != null) ?? null
  const pruebaPrev = [...prevDays].reverse().map((d) => logOf(d)?.extra?.functional?.sts30).find((x) => x != null) ?? null
  const caidas = filas.filter((f) => f.caida).length
  const cm = media(camin), cp = media(caminPrev), pm = media(pasos), pp = media(pasosPrev), em = media(esf), ep = media(esfPrev)
  // Tolerancia al esfuerzo frente a la semana anterior.
  const bajadas = [cm != null && cp ? (cp - cm) / cp : null, pm != null && pp ? (pp - pm) / pp : null, prueba != null && pruebaPrev ? (pruebaPrev - prueba) / pruebaPrev : null].filter((x): x is number => x != null)
  const peorBajada = bajadas.length ? Math.max(...bajadas) : null
  const subeEsfuerzo = em != null && ep != null && em - ep >= 2
  const sintomaFuerte = filas.some((f) => f.para === 'Mareo' || f.para === 'Falta de aire')
  let tolerancia: InformeEjercicio['tolerancia'] = 'gris'
  let toleranciaTexto = 'Sin datos de la semana anterior para comparar'
  if (caidas) { tolerancia = 'rojo'; toleranciaTexto = `${caidas} caída${caidas > 1 ? 's' : ''} o golpe en el miembro afectado` }
  else if (peorBajada != null || subeEsfuerzo) {
    const pct = peorBajada != null ? Math.round(peorBajada * 100) : 0
    tolerancia = pct >= 20 ? 'rojo' : pct >= 10 || subeEsfuerzo || sintomaFuerte ? 'ambar' : 'verde'
    toleranciaTexto = pct >= 10 ? `Baja un ${pct} % frente a la semana anterior` : subeEsfuerzo ? 'Le cuesta más hacer lo mismo (sube el esfuerzo)' : sintomaFuerte ? 'Paró por mareo o falta de aire' : 'Igual o mejor que la semana anterior'
  }
  return {
    filas,
    caminarMax: camin.length ? Math.max(...camin) : null, caminarMedia: cm, caminarPrev: cp,
    paraMasFrecuente: moda(filas.map((f) => f.para).filter((x): x is string => !!x && x !== 'No paró')),
    ayudaMasFrecuente: moda(filas.map((f) => f.ayuda).filter((x): x is string => !!x)),
    paseosHechos: hechos, paseosPrevistos: previstos, paseoQueMasFalla: peor && peor[1] > 0 ? peor[0] : null,
    pasosMedia: pm != null ? Math.round(pm) : null, pasosPrev: pp != null ? Math.round(pp) : null,
    esfuerzoMedia: em, esfuerzoPrev: ep,
    fuerza: { n: ses.filter((s) => s.kind === 'fuerza').length, min: ses.filter((s) => s.kind === 'fuerza').reduce((a, s) => a + (s.minutes ?? 0), 0) },
    aerobico: { n: ses.filter((s) => s.kind === 'aerobico').length, min: ses.filter((s) => s.kind === 'aerobico').reduce((a, s) => a + (s.minutes ?? 0), 0) },
    prueba, pruebaPrev, caidas, tolerancia, toleranciaTexto,
  }
}
