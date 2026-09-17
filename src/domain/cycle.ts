import type { Cycle, DailyLog, Diagnosis } from '../store/types'
import { diffDays } from './dates'
import { SYMPTOMS, type SymptomDef } from './catalogs'

export interface CycleContext {
  cycle: Cycle | null
  day: number | null // D0 = día de inicio de la infusión (o fecha prevista si aún no hay real)
  inCycle: boolean // ingreso + ventana del fármaco
  nadir: boolean // D7-14
  mtxDay: boolean // día de MTX o rescate en curso
  phase: 'sin_ciclos' | 'previo' | 'en_ciclo' | 'valle' | 'recuperacion'
}

/** Ventana "en ciclo": desde el inicio hasta 48 h tras el fin de la infusión (CDDP/ADM)
 *  o hasta el fin del rescate con folinato (MTX). Si no hay datos, D0-D4. */
export function cycleContext(cycles: Cycle[], date: string): CycleContext {
  const started = cycles
    .filter((c) => (c.start_at ?? c.planned_date) <= date + 'T23:59')
    .sort((a, b) => (b.start_at ?? b.planned_date).localeCompare(a.start_at ?? a.planned_date))
  const cycle = started[0] ?? null
  if (!cycle) return { cycle: null, day: null, inCycle: false, nadir: false, mtxDay: false, phase: 'sin_ciclos' }
  const d0 = (cycle.start_at ?? cycle.planned_date).slice(0, 10)
  const day = diffDays(date, d0)
  let windowEnd = 4
  if (cycle.drugs.includes('MTX') && cycle.rescue?.end) windowEnd = Math.max(0, diffDays(cycle.rescue.end.slice(0, 10), d0))
  else if (cycle.end_at) windowEnd = diffDays(cycle.end_at.slice(0, 10), d0) + 2
  if (cycle.discharge_at) windowEnd = Math.max(windowEnd, diffDays(cycle.discharge_at.slice(0, 10), d0))
  const inCycle = day >= 0 && day <= windowEnd
  const nadir = day >= 7 && day <= 14
  const mtxDay = cycle.drugs.includes('MTX') && day >= 0 && (cycle.rescue?.end ? date <= cycle.rescue.end.slice(0, 10) : day <= 4)
  const phase = inCycle ? 'en_ciclo' : nadir ? 'valle' : day < 0 ? 'previo' : 'recuperacion'
  return { cycle, day, inCycle, nadir, mtxDay, phase }
}

/** Lista de síntomas a mostrar hoy: siempre + (en ciclo | fuera) + signos de diagnósticos activos. */
export function symptomsForToday(ctx: CycleContext, diagnoses: Diagnosis[]): SymptomDef[] {
  const base = SYMPTOMS.filter((s) => s.when === 'siempre' || (ctx.inCycle ? s.when === 'ciclo' : s.when === 'fuera'))
  const extra: SymptomDef[] = []
  for (const dx of diagnoses.filter((d) => d.status === 'activo')) {
    for (const sign of dx.watch_signs) {
      const key = 'dx_' + sign.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, '_')
      if (!extra.some((e) => e.key === key)) extra.push({ key, label: `${sign} (${dx.name})`, when: 'siempre', redAt3: true })
    }
  }
  return [...base, ...extra]
}

export type Traffic = 'verde' | 'amarillo' | 'rojo'
export interface TrafficResult {
  level: Traffic
  reasons: string[]
  score: number
}

/** Semáforo diario. Regla propuesta, pendiente de validación por oncología. */
export function dailyTraffic(log: DailyLog | undefined, prev: DailyLog[], ctx: CycleContext, symptomDefs: SymptomDef[]): TrafficResult {
  const reasons: string[] = []
  const red: string[] = []
  if (!log) return { level: 'verde', reasons: ['Sin registro hoy'], score: 0 }
  const s = log.symptoms ?? {}
  let score = 0
  for (const def of symptomDefs) {
    const v = s[def.key] ?? 0
    score += v
    if (v === 3 && def.redAt3) red.push(def.label)
  }
  if (log.temp_max != null && log.temp_max >= 38) red.push('Temperatura ≥ 38 °C')
  else if (log.temp_max != null && log.temp_max >= 37.5 && ctx.nadir) reasons.push('Temperatura ≥ 37,5 °C en el valle (D7-14): repetir en 1 h')
  if (log.pain_max != null && log.pain_max >= 7) red.push('Dolor intenso (≥ 7)')
  if (log.stool_color === 'sangre' || log.stool_color === 'oscuro') red.push('Deposición con sangre o negra')
  if (log.urine_color != null && log.urine_color >= 6) red.push('Orina marrón o rojiza')
  if ((s['mucositis'] ?? 0) >= 2 && (log.fluids_total_ml ?? 999) < 300) red.push('Dolor de boca y apenas bebe')

  if (red.length) return { level: 'rojo', reasons: red, score }

  const moderate = symptomDefs.filter((d) => (s[d.key] ?? 0) === 2).length
  if (moderate >= 2) reasons.push(`${moderate} síntomas moderados el mismo día`)
  if (score >= 6) reasons.push(`Suma de síntomas alta (${score})`)
  const yesterday = prev[0]
  const before = prev[1]
  if (yesterday && before) {
    for (const def of symptomDefs) {
      const a = before.symptoms?.[def.key] ?? 0
      const b = yesterday.symptoms?.[def.key] ?? 0
      const c = s[def.key] ?? 0
      if (c > b && b > a) reasons.push(`${def.label}: empeora dos días seguidos`)
    }
  }
  const intake = (l: DailyLog) => {
    const fr = l.meals.map((m) => m.fraction).filter((f): f is NonNullable<typeof f> => f != null)
    return fr.length ? (fr as number[]).reduce((x, y) => x + y, 0) / fr.length : null
  }
  const iToday = intake(log)
  const iYest = yesterday ? intake(yesterday) : null
  if (iToday != null && iYest != null && iToday < 0.5 && iYest < 0.5) reasons.push('Come menos de la mitad dos días seguidos')
  const noStool = [log, ...prev.slice(0, 2)].every((l) => l && (l.stools_n ?? 0) === 0 && l.stools_n != null)
  if (noStool && prev.length >= 2) reasons.push('Sin deposición 3 días')
  if (log.urine_amount === 'menos' && (log.urine_color ?? 0) >= 4) reasons.push('Orina escasa y oscura')
  const weights = [log, ...prev].map((l) => l?.weight).filter((w): w is number => w != null)
  if (weights.length >= 3 && weights[0] < weights[1] && weights[1] < weights[2]) reasons.push('Peso bajando en dos pesadas seguidas')

  if (reasons.length) return { level: 'amarillo', reasons, score }
  return { level: 'verde', reasons: [], score }
}

/** Dosis acumulada por fármaco (mg/m²) a partir de las dosis reales registradas. */
export function cumulativeDoses(cycles: Cycle[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const c of cycles) {
    for (const [drug, dose] of Object.entries(c.actual_dose_mg_m2 ?? {})) acc[drug] = (acc[drug] ?? 0) + (dose || 0)
  }
  return acc
}
export const DOSE_THRESHOLDS: Record<string, { warn: number; label: string }> = {
  ADM: { warn: 360, label: 'Antraciclina: umbral clásico de cardiotoxicidad 450-500 mg/m²' },
  CDDP: { warn: 480, label: 'Cisplatino: vigilancia renal y auditiva intensiva' },
}
