import type { DailyLog } from '../store/types'
import type { MedProgress } from './medication'

export type CheckGroup = 'Diario' | 'Medicación' | 'Nutrición' | 'Hidratación' | 'Ejercicio' | 'Biohacking'

export interface CheckItem {
  key: string
  label: string
  done: boolean
  /** El Diario es el registro principal. */
  diario?: boolean
  /** Pantalla donde se rellena. */
  group: CheckGroup
  /** Dónde se rellena (para el enlace). */
  to: string
}

/** Lo que falta, agrupado por pantalla, para el aviso de la portada. */
export interface MissingGroup {
  group: CheckGroup
  to: string
  n: number
  labels: string[]
}

export interface Completeness {
  items: CheckItem[]
  done: number
  total: number
  /** rojo: nada registrado · amarillo: a medias · verde: todo el registro del día. */
  level: 'rojo' | 'amarillo' | 'verde'
  missing: CheckItem[]
  /** Lo que falta, agrupado por pantalla (Diario, Nutrición, Hidratación, Ejercicio). */
  missingGroups: MissingGroup[]
}

/** ¿Está el registro del día completo? Diario + comidas y líquidos + actividad del día.
 *  Protocolo: menos de la mitad → rojo · de la mitad en adelante → naranja · todo → verde. */
/** Los síntomas no son un punto obligatorio: si no se marca nada, es que no hay síntomas. */
export function dayCompleteness(log: DailyLog | undefined, date: string, med?: MedProgress): Completeness {
  const diario = `/diario/${date}`
  const has = (v: unknown) => v !== undefined && v !== null && v !== ''
  const items: CheckItem[] = [
    { key: 'location', label: 'Dónde está', done: has(log?.location), to: diario, diario: true, group: 'Diario' },
    { key: 'temp', label: 'Temperatura', done: has(log?.temp_max), to: diario, diario: true, group: 'Diario' },
    { key: 'orina', label: 'Orina', done: has(log?.urine_color) || has(log?.urine_amount), to: diario, diario: true, group: 'Diario' },
    { key: 'deposiciones', label: 'Deposiciones', done: has(log?.stools_n), to: diario, diario: true, group: 'Diario' },
    { key: 'dolor', label: 'Dolor', done: has(log?.pain_max), to: diario, diario: true, group: 'Diario' },
    { key: 'fatiga', label: 'Fatiga', done: has(log?.fatigue), to: diario, diario: true, group: 'Diario' },
    { key: 'animo', label: 'Ánimo', done: has(log?.mood_child), to: diario, diario: true, group: 'Diario' },
    { key: 'preventivos', label: 'Cuidados preventivos', done: Object.values(log?.preventive ?? {}).some(Boolean), to: diario, diario: true, group: 'Diario' },
    {
      key: 'medicacion',
      label: med && med.planned > 0 ? `Tomas de medicación (${med.taken}/${med.planned})` : 'Tomas de medicación',
      done: !med || med.planned === 0 || med.taken >= med.planned,
      to: '/medicacion',
      group: 'Medicación',
    },
    { key: 'comidas', label: 'Comidas', done: (log?.meals?.length ?? 0) >= 3, to: `/nutricion/${date}`, group: 'Nutrición' },
    {
      key: 'liquidos',
      label: 'Líquidos',
      done: (log?.fluids_total_ml ?? 0) > 0 || (log?.water_ml ?? 0) > 0 || (log?.broth_cups ?? 0) > 0 || (log?.seawater_ml ?? 0) > 0,
      to: `/hidratacion/${date}`,
      group: 'Hidratación',
    },
    {
      key: 'biohacking',
      label: 'Sueño y sincronizadores',
      done: has(log?.sleep_start) || has(log?.sleep_end) || !!log?.wakeups
        || [log?.ir_morning, log?.ir_night, log?.glasses, log?.daylight_morning, log?.daylight_afternoon, log?.sun_exposure].some(Boolean)
        || Object.keys(log?.extra?.sync ?? {}).length > 0,
      to: `/biohacking/${date}`,
      group: 'Biohacking',
    },
    {
      key: 'ejercicio',
      label: 'Actividad y pasos',
      done: has(log?.steps) || has(log?.activity_min) || Object.values(log?.activity ?? {}).some(Boolean),
      to: `/ejercicio/${date}`,
      group: 'Ejercicio',
    },
  ]
  const done = items.filter((i) => i.done).length
  const total = items.length
  const half = Math.ceil(total / 2)
  return {
    items,
    done,
    total,
    level: done === total ? 'verde' : done >= half ? 'amarillo' : 'rojo',
    missing: items.filter((i) => !i.done),
    missingGroups: groupMissing(items),
  }
}

function groupMissing(items: CheckItem[]): MissingGroup[] {
  const out: MissingGroup[] = []
  for (const i of items.filter((x) => !x.done)) {
    const g = out.find((x) => x.group === i.group)
    if (g) { g.n++; g.labels.push(i.label.toLowerCase()) }
    else out.push({ group: i.group, to: i.to, n: 1, labels: [i.label.toLowerCase()] })
  }
  return out
}
