// Tipos de datos de la app. Reflejan 1:1 el esquema SQL de supabase/schema.sql.

export interface BaseRow {
  id: string
  patient_id: string
  created_at: string
  created_by: string
  updated_at: string
  updated_by: string
  deleted_at?: string | null
}

export interface Patient extends Omit<BaseRow, 'patient_id'> {
  name: string
  birth_year?: number | null
  hospital?: string
  phone_oncology?: string
  phone_emergency?: string
  catheter_type?: string
  catheter_since?: string
  catheter_last_dressing?: string | null
  catheter_dressing_days?: number | null
  bsa_m2?: number | null
  protocol?: string
  arm?: string
  pgp?: string
  necrosis_pct?: number | null
  load_limits?: string
  notes?: string
}

export interface Profile {
  id: string
  name: string
  email?: string
  color?: string
}

/** Hallazgo medible tomado de un informe (nódulo, lesión, adenopatía…). */
export interface Finding {
  date: string // fecha del informe
  name: string // p. ej. "Nódulo pulmonar"
  location?: string // p. ej. "lóbulo superior derecho"
  size_mm?: number | null
  count?: number | null
  source?: string // informe del que sale (TAC, PET-TAC…)
  notes?: string
}

export type DiagnosisKind = 'principal' | 'metastasis' | 'complicacion' | 'infeccion' | 'otro'
export type DiagnosisStatus = 'activo' | 'resuelto'
export interface Diagnosis extends BaseRow {
  name: string
  kind: DiagnosisKind
  date: string
  confirmed_by?: string
  status: DiagnosisStatus
  status_date?: string
  watch_signs: string[]
  treatment_ref?: string
  evolution: { date: string; text: string; by: string }[]
  findings?: Finding[]
}

export type MedRoute = 'oral' | 'im' | 'iv'
export interface MedRow {
  name: string
  mg?: string
  posology?: string
  reason?: string
  route?: MedRoute
  nausea?: 0 | 1 | 2 | 3
  sufficient?: 'si' | 'parcial' | 'no'
}

export type Drug = 'MTX' | 'CDDP' | 'ADM' | 'HDIFO' | 'MTP' | 'OTRO'
export interface Cycle extends BaseRow {
  number: number
  protocol_week?: number | null
  drugs: Drug[]
  planned_date: string
  start_at?: string | null
  end_at?: string | null
  planned_dose?: string
  actual_dose?: string
  actual_dose_mg_m2?: Record<string, number>
  delay_days?: number | null
  delay_reason?: string
  admission_at?: string | null
  discharge_at?: string | null
  fasting_last_meal_at?: string | null
  infusion_meds?: string
  corticoid_iv: boolean
  corticoid_detail?: string
  rescue?: {
    substance?: string
    start?: string
    end?: string
    dose?: string
    posology?: string
    reason?: string
    mtx24?: number | null
    mtx48?: number | null
    mtx72?: number | null
  }
  /** Protocolo antiemético: filas Nombre · mg · Posología · Intensidad de náusea · ¿Fue suficiente? */
  antiemetic?: { items?: MedRow[]; drug?: string; scheme?: string; sufficient?: 'si' | 'parcial' | 'no' }
  /** Bolsa JSON de medicación: durante la perfusión y entre quimio y quimio. */
  other_meds?: { infusion?: MedRow[]; between?: MedRow[]; oral_alopatico?: string; oral_suplemento?: string; iv?: string }
  drug_watch?: Record<string, string> // observaciones específicas por fármaco
  mtp?: { given?: boolean; reaction?: string }
  procedure?: { type?: 'cirugia' | 'radioterapia' | 'otro'; date?: string; notes?: string }
  notes?: string
}

export type Fraction = 0 | 0.25 | 0.5 | 0.75 | 1
export type Carb = 'sin' | 'baja' | 'media' | 'alta'
export type Texture = 'normal' | 'blando' | 'triturado' | 'liquido'
export type MealSlot = 'desayuno' | 'media_manana' | 'comida' | 'merienda' | 'cena' | 'otra' | 'snack_grasa_1' | 'snack_grasa_2'
/** Estimación del plato según la pauta de la nutricionista (½ verdura · ⅓ proteína · ¼ almidón · grasas añadidas). */
export interface MealMacros {
  veg?: 0 | 1 | 2 // nada · poca · ≈ medio plato
  prot?: 0 | 1 | 2 // nada · poca · ≈ un tercio
  starch?: 0 | 1 | 2 | 3 // nada · poca · ≈ un cuarto · más
  fat?: boolean // grasa "invisible" añadida (AOVE, ghee, tahine, coco…)
}
export interface Meal {
  slot: MealSlot
  time?: string // HH:MM
  fraction?: Fraction
  carb?: Carb
  texture?: Texture
  note?: string
  macros?: MealMacros
}
export type WeekMode = 'quimio' | 'nadir'
export interface SyncEntry { done?: boolean; time?: string; minutes?: number | null }
/** Capacidad funcional del día (antes era semanal). */
export interface FunctionalDaily {
  stairs?: boolean
  stands_alone?: boolean
  walk_min?: number | null
  falls?: string
}
/** Campos añadidos en la v0.4 (columna JSONB `extra`). */
export interface DailyExtra {
  mode?: WeekMode // modo manual de la semana (si no, se deduce del ciclo)
  fasting_h?: number | null // horas de ayuno tecleadas (si no, se calculan)
  infusion_cups?: number | null // infusiones manzanilla / jengibre (medias tazas)
  sync?: Partial<Record<'ir_morning' | 'ir_night' | 'glasses' | 'daylight_morning' | 'daylight_afternoon' | 'sun_exposure', SyncEntry>>
  functional?: FunctionalDaily // capacidad funcional del día
}

export interface DailyLog extends BaseRow {
  date: string // YYYY-MM-DD
  location?: 'casa' | 'ingreso' | 'hospital_dia'
  temp_max?: number | null
  weight?: number | null
  height_cm?: number | null
  urine_color?: number | null // 1-6
  urine_amount?: 'menos' | 'normal' | 'mas' | null
  urine_count?: number | null
  urine_ml?: number | null
  urine_ph?: number | null
  stools_n?: number | null
  bristol?: number | null
  stool_color?: 'normal' | 'oscuro' | 'sangre' | 'palido' | 'verdoso' | null
  pain_max?: number | null
  pain_location?: string
  fatigue?: number | null // 0-4
  symptoms: Record<string, number> // clave → 0..3
  mood_child?: number | null // 1-5
  preventive: Record<string, boolean>
  meals: Meal[]
  fluids_total_ml?: number | null
  water_ml?: number | null
  seawater_ml?: number | null
  broth_cups?: number | null
  sleep_start?: string | null
  sleep_end?: string | null
  wakeups?: number | null
  wakeup_cause?: string
  nap_min?: number | null
  ir_morning?: boolean
  ir_night?: boolean
  glasses?: boolean
  daylight_morning?: boolean
  daylight_afternoon?: boolean
  sun_exposure?: boolean
  activity: Record<string, boolean>
  activity_min?: number | null
  steps?: number | null
  notes?: string
  extra?: DailyExtra
}

export type WeightSource = 'inbody' | 'hospital' | 'casa'
export interface WeightEntry extends BaseRow {
  at: string // fecha y hora (datetime-local)
  kg: number
  height_cm?: number | null
  source: WeightSource
  muscle_kg?: number | null
  fat_pct?: number | null
  water_pct?: number | null
  notes?: string
}

export type ProductBlock = 'alopatico' | 'sup_ciclo' | 'sup_fuera'
export type Traffic = 'verde' | 'ambar' | 'rojo'
export type Moment = 'ayunas' | 'manana' | 'comida' | 'cena' | 'dormir'
export interface Product extends BaseRow {
  name: string
  block: ProductBlock
  composition?: string
  dose?: string
  moments: Moment[]
  start_date?: string
  end_date?: string | null
  end_reason?: string
  prescribed_by?: string
  traffic: { mtx?: Traffic; cddp_adm?: Traffic; nadir?: Traffic; infusion?: Traffic }
  traffic_reason?: string
  notes?: string
}

export interface Intake extends BaseRow {
  product_id: string
  date: string
  moment: Moment
  taken: boolean
}

export interface LabPanel extends BaseRow {
  date: string
  context?: 'rutina' | 'pre_ciclo' | 'urgencia' | 'ingreso' | 'otro'
  lab_name?: string
  notes?: string
}
export interface LabResult extends BaseRow {
  panel_id: string
  analyte: string
  value: number
  unit?: string
  ref_low?: number | null
  ref_high?: number | null
}
export interface OrganTest extends BaseRow {
  type: 'fevi' | 'audiometria' | 'tubular' | 'otro'
  date: string
  result?: string
  next_date?: string | null
  notes?: string
}
export interface MicrobiomeTest extends BaseRow {
  date: string
  lab_name?: string
  test_type?: string
  results: { name: string; value: string; unit?: string; ref?: string; flag?: 'bajo' | 'normal' | 'alto' }[]
  notes?: string
}

export type EventType =
  | 'ingreso' | 'hospital_dia' | 'consulta' | 'prueba' | 'extraccion' | 'resultado'
  | 'mifamurtida' | 'cura_cateter' | 'cita_equipo' | 'fisio' | 'otro'
export type EventStatus = 'previsto' | 'realizado' | 'pospuesto' | 'cancelado'
export interface CalendarEvent extends BaseRow {
  type: EventType
  title: string
  start_at: string
  all_day: boolean
  place?: string
  companion?: string
  professional?: string
  notes?: string
  status: EventStatus
  expected_result_date?: string | null
  parent_id?: string | null
}

export type Priority = 'normal' | 'importante' | 'urgente'
export interface Todo extends BaseRow {
  title: string
  pillar?: string
  assignees: string[]
  due_date?: string | null
  priority: Priority
  origin: 'manual' | 'alerta' | 'calendario' | 'semaforo' | 'cuidadora'
  status: 'pendiente' | 'hecho'
  done_at?: string | null
  done_by?: string | null
  notes?: string
}

export const PROFESSIONALS = [
  'Oncología tradicional', 'Oncología integrativa', 'Nutricionista', 'Psicóloga',
  'Entrenador', 'Biohacker', 'Digestivo-Microbiota',
] as const
export type Professional = (typeof PROFESSIONALS)[number]
export interface Question extends BaseRow {
  professional: Professional
  question: string
  pillar?: string
  status: 'pendiente' | 'respondida'
  answer?: string
  answered_by?: string
  answered_at?: string | null
}

export interface WeeklyChild extends BaseRow {
  week_start: string
  mood?: number | null
  emotions: Record<string, number>
  body_image?: number | null
  psych_session?: boolean
  friends_contact?: 'no' | 'presencial' | 'video' | 'mensajes'
  decided?: string
  notes?: string
}
export interface WeeklyCaregiver extends BaseRow {
  week_start: string
  user_id: string
  zarit: number[] // 7 ítems 0-4
  relief?: boolean
  self_time?: boolean
  hardest?: string
}
export interface CaregiverDaily extends BaseRow {
  date: string
  user_id: string
  sleep_h?: number | null
  ate_ok?: boolean | null
  tired?: number | null // 1-5
}
export interface ExerciseSession extends BaseRow {
  date: string
  kind: 'fuerza' | 'aerobico'
  exercises: { name: string; sets?: number; reps?: number; load?: string }[]
  minutes?: number | null
  intensity?: 'ligera' | 'moderada' | 'costo'
  notes?: string
}
export interface FunctionalWeekly extends BaseRow {
  week_start: string
  stairs?: boolean
  walk_min?: number | null
  stands_alone?: boolean
  falls?: string
}

export interface ExposuresWeekly extends BaseRow {
  week_start: string
  items: Record<string, boolean>
  notes?: string
}
export type Safety = 'verde' | 'ambar' | 'rojo'
export interface Practice extends BaseRow {
  name: string
  safety: Safety
  safety_reason?: string
  authorized_by?: string
  active: boolean
  notes?: string
}
export interface PracticeLog extends BaseRow {
  date: string
  practice_id: string
}

export interface Tables {
  patients: Patient
  profiles: Profile
  diagnoses: Diagnosis
  cycles: Cycle
  daily_logs: DailyLog
  products: Product
  intakes: Intake
  lab_panels: LabPanel
  lab_results: LabResult
  organ_tests: OrganTest
  microbiome_tests: MicrobiomeTest
  calendar_events: CalendarEvent
  todos: Todo
  questions: Question
  weekly_child: WeeklyChild
  weekly_caregiver: WeeklyCaregiver
  caregiver_daily: CaregiverDaily
  exercise_sessions: ExerciseSession
  functional_weekly: FunctionalWeekly
  exposures_weekly: ExposuresWeekly
  practices: Practice
  practice_log: PracticeLog
  weights: WeightEntry
}
export type TableName = keyof Tables
export const TABLE_NAMES = [
  'patients', 'profiles', 'diagnoses', 'cycles', 'daily_logs', 'products', 'intakes',
  'lab_panels', 'lab_results', 'organ_tests', 'microbiome_tests', 'calendar_events',
  'todos', 'questions', 'weekly_child', 'weekly_caregiver', 'caregiver_daily',
  'exercise_sessions', 'functional_weekly', 'exposures_weekly', 'practices', 'practice_log', 'weights',
] as const satisfies readonly TableName[]
