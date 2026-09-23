import type { DailyLog } from '../store/types'
import type { SymptomDef } from './catalogs'

export interface CheckItem {
  key: string
  label: string
  done: boolean
  /** Dónde se rellena (para el enlace). */
  to: string
}

export interface Completeness {
  items: CheckItem[]
  done: number
  total: number
  /** rojo: nada registrado · amarillo: a medias · verde: todo el registro del día. */
  level: 'rojo' | 'amarillo' | 'verde'
  missing: CheckItem[]
}

/** ¿Está el registro del día completo? Diario + comidas y líquidos + actividad del día.
 *  Rojo si no hay nada, ámbar si está a medias, verde cuando está todo. */
export function dayCompleteness(log: DailyLog | undefined, date: string, symptomDefs: SymptomDef[]): Completeness {
  const diario = `/diario/${date}`
  const has = (v: unknown) => v !== undefined && v !== null && v !== ''
  const symptomsMarked = log ? symptomDefs.some((d) => log.symptoms?.[d.key] != null) || Object.keys(log.symptoms ?? {}).length > 0 : false
  const items: CheckItem[] = [
    { key: 'location', label: 'Dónde está', done: has(log?.location), to: diario },
    { key: 'temp', label: 'Temperatura', done: has(log?.temp_max), to: diario },
    { key: 'orina', label: 'Orina', done: has(log?.urine_color) || has(log?.urine_amount), to: diario },
    { key: 'deposiciones', label: 'Deposiciones', done: has(log?.stools_n), to: diario },
    { key: 'dolor', label: 'Dolor', done: has(log?.pain_max), to: diario },
    { key: 'fatiga', label: 'Fatiga', done: has(log?.fatigue), to: diario },
    { key: 'animo', label: 'Ánimo', done: has(log?.mood_child), to: diario },
    { key: 'sintomas', label: 'Síntomas', done: symptomsMarked || !!log?.extra?.symptoms_ok, to: diario },
    { key: 'preventivos', label: 'Cuidados preventivos', done: Object.values(log?.preventive ?? {}).some(Boolean), to: diario },
    { key: 'comidas', label: 'Comidas', done: (log?.meals?.length ?? 0) >= 3, to: `/nutricion/${date}` },
    {
      key: 'liquidos',
      label: 'Líquidos',
      done: (log?.fluids_total_ml ?? 0) > 0 || (log?.water_ml ?? 0) > 0 || (log?.broth_cups ?? 0) > 0 || (log?.seawater_ml ?? 0) > 0,
      to: `/hidratacion/${date}`,
    },
    {
      key: 'ejercicio',
      label: 'Actividad y pasos',
      done: has(log?.steps) || has(log?.activity_min) || Object.values(log?.activity ?? {}).some(Boolean),
      to: `/ejercicio/${date}`,
    },
  ]
  const done = items.filter((i) => i.done).length
  // Empezado = hay algo anotado, aunque ningún apartado esté terminado (p. ej. una sola comida).
  const started = done > 0 || (log?.meals?.length ?? 0) > 0 || (log?.fluids_total_ml ?? 0) > 0 || !!log?.notes
  return {
    items,
    done,
    total: items.length,
    level: !started ? 'rojo' : done === items.length ? 'verde' : 'amarillo',
    missing: items.filter((i) => !i.done),
  }
}
