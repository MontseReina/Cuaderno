import { currentPatientId, save } from '../store'
import { addDays, todayStr } from './dates'
import { SEED_PRODUCTS } from './seed'
import type { DailyLog, Product } from '../store/types'

/** Datos de ejemplo INVENTADOS para probar las pantallas. Nunca datos reales. */
export async function loadSampleData() {
  const pid = currentPatientId()
  const today = todayStr()
  const d0 = addDays(today, -9)
  await save('diagnoses', { patient_id: pid, name: 'Osteosarcoma de fémur (ejemplo)', kind: 'principal', date: addDays(today, -40), confirmed_by: 'Biopsia (ejemplo)', status: 'activo', watch_signs: ['Dolor en la pierna'], evolution: [{ date: addDays(today, -40), text: 'Diagnóstico de ejemplo', by: 'demo' }] })
  await save('cycles', { patient_id: pid, number: 1, protocol_week: 0, drugs: ['MTX'], planned_date: addDays(today, -30), start_at: addDays(today, -30) + 'T10:00', end_at: addDays(today, -30) + 'T14:00', actual_dose: '12 g/m²', actual_dose_mg_m2: { MTX: 12000 }, corticoid_iv: false, rescue: { substance: 'folinato', start: addDays(today, -29) + 'T10:00', end: addDays(today, -26) + 'T10:00', mtx24: 8.2, mtx48: 0.9, mtx72: 0.15 }, antiemetic: { drug: 'ondansetrón', sufficient: 'si' } })
  await save('cycles', { patient_id: pid, number: 2, protocol_week: 1, drugs: ['CDDP', 'ADM'], planned_date: addDays(today, -23), start_at: addDays(today, -23) + 'T09:00', end_at: addDays(today, -21) + 'T09:00', actual_dose_mg_m2: { CDDP: 120, ADM: 75 }, corticoid_iv: true, corticoid_detail: 'dexametasona 3 días', antiemetic: { drug: 'ondansetrón + dexametasona', sufficient: 'parcial' } })
  await save('cycles', { patient_id: pid, number: 3, protocol_week: 4, drugs: ['MTX'], planned_date: d0, start_at: d0 + 'T10:00', end_at: d0 + 'T14:00', actual_dose_mg_m2: { MTX: 12000 }, corticoid_iv: false, rescue: { substance: 'folinato', start: addDays(d0, 1) + 'T10:00', end: addDays(d0, 4) + 'T10:00' } })
  for (const s of SEED_PRODUCTS.slice(0, 8)) await save('products', { ...s, patient_id: pid } as Product)
  const rnd = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 10) / 10
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i)
    const day = i <= 9 ? 9 - i : null
    const mucositis = day != null && day >= 5 && day <= 10 ? (day === 7 ? 2 : 1) : 0
    const log: Partial<DailyLog> = {
      patient_id: pid, date, location: day != null && day <= 3 ? 'ingreso' : 'casa',
      temp_max: rnd(36.4, 37.3), weight: i % 3 === 0 ? rnd(26.2, 27.1) : null, urine_color: 2 + (i % 2), urine_amount: 'normal',
      stools_n: i % 4 === 0 ? 0 : 1, bristol: 4, stool_color: 'normal', pain_max: day != null && day < 3 ? 3 : 1, fatigue: day != null && day >= 5 && day <= 12 ? 2 : 1,
      symptoms: { mucositis, nauseas: day != null && day <= 2 ? 2 : 0 }, mood_child: 3 + (i % 2),
      preventive: { cepillado: true, enj_coco: true, enj_lactoferrina: i % 3 !== 0, enj_marromero: true, emoliente: true, aposito: true, nada_rectal: true },
      meals: [
        { slot: 'desayuno', time: '08:30', fraction: 0.75, carb: 'baja', texture: 'normal' },
        { slot: 'comida', time: '14:00', fraction: mucositis ? 0.5 : 1, carb: 'media', texture: mucositis ? 'blando' : 'normal' },
        { slot: 'merienda', time: '17:30', fraction: 0.5, carb: 'baja' },
        { slot: 'cena', time: '20:30', fraction: 0.75, carb: 'baja', texture: 'normal' },
      ],
      fluids_total_ml: 1000 + (i % 3) * 200, water_ml: 600, seawater_ml: 50, broth_cups: 2,
      sleep_start: '21:30', sleep_end: '07:45', wakeups: i % 3, wakeup_cause: 'Pipí', ir_morning: i % 2 === 0, ir_night: true, glasses: true, daylight_morning: i % 2 === 1, daylight_afternoon: true,
      activity: { paseo: true, juego: i % 2 === 0 }, activity_min: 30, steps: 2500 + i * 150,
      notes: i === 7 ? 'Ejemplo: le costó comer por la boca; caldo bien.' : undefined,
    }
    await save('daily_logs', log)
  }
  const p1 = await save('lab_panels', { patient_id: pid, date: addDays(today, -16), context: 'pre_ciclo', lab_name: 'Hospital (ejemplo)' })
  const p2 = await save('lab_panels', { patient_id: pid, date: addDays(today, -2), context: 'rutina', lab_name: 'Hospital (ejemplo)' })
  const labs: [string, number, number, string, number, number][] = [
    ['neutrofilos', 1.9, 0.8, '×10³/µL', 1.5, 8], ['plaquetas', 210, 95, '×10³/µL', 150, 400], ['hemoglobina', 11.8, 10.9, 'g/dL', 11.5, 15.5],
    ['creatinina', 0.42, 0.48, 'mg/dL', 0.3, 0.7], ['magnesio', 1.9, 1.5, 'mg/dL', 1.7, 2.4], ['pcr', 3, 12, 'mg/L', 0, 5], ['glucosa', 88, 104, 'mg/dL', 70, 100], ['vitd', 24, 26, 'ng/mL', 30, 100], ['fa', 210, 180, 'U/L', 120, 400], ['ldh', 240, 230, 'U/L', 120, 300],
  ]
  for (const [k, v1, v2, u, lo, hi] of labs) {
    await save('lab_results', { patient_id: pid, panel_id: p1.id, analyte: k, value: v1, unit: u, ref_low: lo, ref_high: hi })
    await save('lab_results', { patient_id: pid, panel_id: p2.id, analyte: k, value: v2, unit: u, ref_low: lo, ref_high: hi })
  }
  await save('organ_tests', { patient_id: pid, type: 'fevi', date: addDays(today, -35), result: 'FEVI 64 % (ejemplo)', next_date: addDays(today, 20) })
  await save('calendar_events', { patient_id: pid, type: 'ingreso', title: 'Ciclo 4 · cisplatino + adriamicina', start_at: addDays(today, 5) + 'T08:00', all_day: true, status: 'previsto', place: 'Hospital', companion: 'Mamá' })
  await save('calendar_events', { patient_id: pid, type: 'extraccion', title: 'Analítica pre-ciclo', start_at: addDays(today, 3) + 'T09:00', all_day: false, status: 'previsto', expected_result_date: addDays(today, 4) })
  await save('calendar_events', { patient_id: pid, type: 'cita_equipo', title: 'Consulta nutricionista', start_at: addDays(today, 2) + 'T17:00', all_day: false, status: 'previsto', professional: 'Nutricionista' })
  await save('todos', { patient_id: pid, title: 'Pedir la etiqueta de Micelinone Plus (ejemplo)', pillar: 'Medicación', assignees: [], priority: 'importante', origin: 'manual', status: 'pendiente' })
  await save('questions', { patient_id: pid, professional: 'Oncología tradicional', question: '¿Antioxidantes los días de infusión? (ejemplo)', pillar: 'Medicación', status: 'pendiente' })
  await save('questions', { patient_id: pid, professional: 'Nutricionista', question: '¿Cómo subir proteína en los días de mucositis? (ejemplo)', pillar: 'Nutrición', status: 'pendiente' })
}
