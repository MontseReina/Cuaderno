import { backend } from '../store'
import { TABLE_NAMES, type TableName } from '../store/types'
import { addDays, fmtDate, todayStr } from './dates'
import { cycleContext, dailyTraffic, isCisplatinDay, symptomsForToday } from './cycle'
import { ANALYTES, BLOCK_LABELS, DRUG_LABELS, FRACTION_LABELS, MODE_LABELS, PREVENTIVE, SEVERITY_LABELS, SYMPTOMS } from './catalogs'
import { carbProfile, dayNutrition, fastingHours, meanIntake, mealTraffic, weekMode } from './nutrition'

export const APP_VERSION = '0.10.0'
export const SCHEMA_VERSION = 1
const LAST_EXPORT_KEY = 'cuaderno-last-export'

export function lastExportAt(): string | null {
  try { return localStorage.getItem(LAST_EXPORT_KEY) } catch { return null }
}
function markExported() {
  try { localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString()) } catch { /* ignore */ }
}

/** Iniciales para no exportar nombres completos. */
export function initials(name?: string) {
  if (!name) return 'N.'
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() + '.').join(' ')
}

declare global { interface Window { claude?: { use?: (name: string) => Promise<{ save: (r: { filename: string; data: string }) => Promise<unknown> } | null> } } }

/** Descarga un archivo. En la demo publicada en claude.ai pasa por el permiso de descargas del visor; en el resto, descarga normal. */
async function download(filename: string, content: string, mime = 'application/json') {
  if (window.claude?.use) {
    try {
      const dl = await window.claude.use('downloads')
      if (dl) { await dl.save({ filename, data: content }); return }
    } catch (e) { const code = (e as { code?: string })?.code; if (code === 'declined') return; /* si no, descarga normal */ }
  }
  const blob = new Blob([content], { type: mime + ';charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
}

// ---------- 1. Copia completa (JSON) ----------
export interface FullBackup {
  app: 'cuaderno-cuidados'
  app_version: string
  schema_version: number
  exported_at: string
  exported_by: string
  tables: Record<string, unknown[]>
}
export function buildBackup(): FullBackup {
  const tables: Record<string, unknown[]> = {}
  for (const t of TABLE_NAMES) tables[t] = backend.all(t)
  return { app: 'cuaderno-cuidados', app_version: APP_VERSION, schema_version: SCHEMA_VERSION, exported_at: new Date().toISOString(), exported_by: backend.currentUserName(), tables }
}
export function exportBackup() {
  const b = buildBackup()
  download(`cuaderno_${todayStr()}.json`, JSON.stringify(b, null, 1))
  markExported()
}

/** Importar y fusionar: por id; si existe en ambos, gana el updated_at más reciente. Nunca sobrescribe sin más. */
export async function importBackup(text: string): Promise<{ added: number; updated: number; skipped: number }> {
  const b = JSON.parse(text) as Partial<FullBackup>
  if (b.app !== 'cuaderno-cuidados' || !b.tables) throw new Error('El archivo no es una copia de Huma')
  const migrated = migrate(b as FullBackup)
  let added = 0, updated = 0, skipped = 0
  for (const t of TABLE_NAMES) {
    const incoming = (migrated.tables[t] ?? []) as { id: string; updated_at?: string }[]
    const current = new Map(backend.all(t).map((r) => [r.id, r as { id: string; updated_at?: string }]))
    for (const row of incoming) {
      const ex = current.get(row.id)
      if (!ex) { await backend.upsert(t, row as never); added++ }
      else if ((row.updated_at ?? '') > (ex.updated_at ?? '')) { await backend.upsert(t, row as never); updated++ }
      else skipped++
    }
  }
  return { added, updated, skipped }
}

/** Migraciones entre versiones de esquema (de momento solo la 1). */
function migrate(b: FullBackup): FullBackup {
  const v = b.schema_version ?? 1
  if (v === SCHEMA_VERSION) return b
  // Futuras migraciones: if (v === 1) { ...; b.schema_version = 2 }
  return b
}

// ---------- 2. CSV por tabla ----------
export function exportCsv(table: TableName) {
  const rows = backend.all(table) as unknown as Record<string, unknown>[]
  if (!rows.length) return false
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n')
  download(`${table}_${todayStr()}.csv`, '﻿' + csv, 'text/csv')
  return true
}

// ---------- 3. Informe para IA (Markdown) ----------
export function buildAiReport(from: string, to: string): string {
  const patient = backend.all('patients')[0]
  const name = initials(patient?.name)
  const inRange = (d: string) => d >= from && d <= to
  const logs = backend.all('daily_logs').filter((l) => inRange(l.date)).sort((a, b) => a.date.localeCompare(b.date))
  const cycles = backend.all('cycles')
  const diagnoses = backend.all('diagnoses')
  const products = backend.all('products')
  const intakes = backend.all('intakes').filter((i) => inRange(i.date) && i.taken)
  const events = backend.all('calendar_events').filter((e) => inRange(e.start_at.slice(0, 10)))
  const todos = backend.all('todos').filter((t) => t.done_at && inRange(t.done_at.slice(0, 10)))
  const panels = backend.all('lab_panels').filter((p) => inRange(p.date)).sort((a, b) => a.date.localeCompare(b.date))
  const results = backend.all('lab_results')
  const questions = backend.all('questions')
  const weeklyChild = backend.all('weekly_child').filter((w) => inRange(w.week_start))
  const weeklyCg = backend.all('weekly_caregiver').filter((w) => inRange(w.week_start))
  const sessions = backend.all('exercise_sessions').filter((s) => inRange(s.date))
  const micro = backend.all('microbiome_tests').filter((m) => inRange(m.date))
  const organ = backend.all('organ_tests').filter((o) => inRange(o.date))
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? id
  const sym = (k: string) => SYMPTOMS.find((s) => s.key === k)?.label ?? k.replace(/^dx_/, '').replace(/_/g, ' ')

  const L: string[] = []
  L.push(`# Informe de seguimiento — ${name} — ${fmtDate(from)} a ${fmtDate(to)}`)
  L.push('')
  L.push(`Generado por Huma v${APP_VERSION} el ${new Date().toLocaleString('es-ES')}. Solo iniciales; sin datos identificativos. La IA ordena información y prepara preguntas; no diagnostica ni propone cambios de tratamiento.`)
  L.push('')
  L.push('## 1. Perfil y pautas vigentes')
  L.push(`- Paciente: ${name}${patient?.birth_year ? ` (nacido en ${patient.birth_year})` : ''} · Protocolo: ${patient?.protocol ?? '—'}${patient?.arm ? ` · brazo ${patient.arm}` : ''}${patient?.pgp ? ` · Pgp ${patient.pgp}` : ''}${patient?.necrosis_pct != null ? ` · necrosis ${patient.necrosis_pct} %` : ''}`)
  L.push(`- Catéter: ${patient?.catheter_type ?? '—'} · Límites de traumatología: ${patient?.load_limits ?? '—'}`)
  L.push('- Diagnósticos:')
  for (const d of diagnoses) L.push(`  - ${d.name} (${d.kind}, ${d.date}) — ${d.status}${d.watch_signs.length ? ` · vigilar: ${d.watch_signs.join(', ')}` : ''}${d.evolution.length ? `\n    - evolución: ${d.evolution.map((e) => `${e.date}: ${e.text}`).join(' | ')}` : ''}${(d.findings ?? []).length ? `\n    - hallazgos medibles: ${(d.findings ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)).map((f) => `${f.date} ${f.name}${f.location ? ` (${f.location})` : ''}${f.size_mm != null ? ` ${f.size_mm} mm` : ''}${f.count != null ? ` ×${f.count}` : ''}${f.source ? ` [${f.source}]` : ''}`).join(' | ')}` : ''}`)
  L.push('- Todo lo que toma (vigente a fecha del informe):')
  for (const b of ['hospital', 'alopatico', 'sup_ciclo', 'sup_fuera'] as const) {
    const list = products.filter((p) => p.block === b && (!p.end_date || p.end_date >= to))
    if (list.length) L.push(`  - ${BLOCK_LABELS[b]}: ${list.map((p) => `${p.name}${p.lab ? ` [${p.lab}]` : ''} (${p.dose ?? ''}${p.route ? ` · vía ${p.route}` : ''} · ${p.moments.join('/') || 'a demanda'}${p.weekdays?.length ? ` · días ${p.weekdays.join(',')} (0=dom)` : ''}${p.after_chemo_days ? ` · desde ${p.after_chemo_days} días tras la quimio` : ''}${p.condition ? ` · solo si ${p.condition}` : ''}${p.prescribed_by ? ` · ${p.prescribed_by}` : ''})`).join('; ')}`)
  }
  const prev = products.filter((p) => p.end_date && p.end_date < to)
  if (prev.length) L.push(`- Retirado anteriormente (y resultado): ${prev.map((p) => `${p.name}${p.lab ? ` [${p.lab}]` : ''} hasta ${p.end_date}${p.end_reason ? ` (${p.end_reason})` : ''}${p.outcome ? ` · ${{ funciono: 'funcionó', parcial: 'funcionó en parte', no_funciono: 'no funcionó / no lo toleró', no_se: 'no se sabe' }[p.outcome]}` : ''}${p.outcome_notes ? ` · ${p.outcome_notes}` : ''}`).join('; ')}`)
  const changes = products.filter((p) => (p.start_date && inRange(p.start_date)) || (p.end_date && inRange(p.end_date)))
  if (changes.length) {
    L.push('- Cambios de medicación/suplementación en el período:')
    for (const p of changes) L.push(`  - ${p.name}: ${p.start_date && inRange(p.start_date) ? `inicio ${p.start_date}` : ''}${p.end_date && inRange(p.end_date) ? ` retirada ${p.end_date}${p.end_reason ? ` (${p.end_reason})` : ''}` : ''}`)
  }
  L.push('')
  L.push('## 2. Tratamiento en el período')
  const cyc = cycles.filter((c) => inRange((c.start_at ?? c.planned_date).slice(0, 10)))
  if (!cyc.length) L.push('Sin ciclos iniciados en el período.')
  for (const c of cyc) {
    L.push(`- Ciclo ${c.number} · ${c.drugs.map((d) => DRUG_LABELS[d]).join(' + ')} · previsto ${c.planned_date}${c.start_at ? ` · inicio ${c.start_at.replace('T', ' ')}` : ''}${c.end_at ? ` · fin ${c.end_at.replace('T', ' ')}` : ''}${c.delay_days ? ` · retraso ${c.delay_days} d (${c.delay_reason ?? ''})` : ''}`)
    if (c.actual_dose) L.push(`  - dosis real: ${c.actual_dose}`)
    if (c.corticoid_iv) L.push(`  - corticoide IV: ${c.corticoid_detail ?? 'sí'}`)
    if (c.rescue?.substance) L.push(`  - rescate: ${c.rescue.substance} ${c.rescue.start ?? ''} → ${c.rescue.end ?? 'en curso'}; MTX 24/48/72 h: ${c.rescue.mtx24 ?? '—'} / ${c.rescue.mtx48 ?? '—'} / ${c.rescue.mtx72 ?? '—'}`)
    const medRow = (m: { name: string; mg?: string; posology?: string; reason?: string; route?: string }) => `${m.name}${m.route ? ` [${m.route}]` : ''}${m.mg ? ` ${m.mg} mg` : ''}${m.posology ? ` · ${m.posology}` : ''}${m.reason ? ` (${m.reason})` : ''}`
    if (c.other_meds?.infusion?.length) L.push(`  - durante la perfusión: ${c.other_meds.infusion.map(medRow).join('; ')}`)
    if (c.antiemetic?.items?.length) L.push(`  - antiemético: ${c.antiemetic.items.map((m) => `${medRow(m)}${m.nausea != null ? ` · náusea ${m.nausea}/3` : ''}${m.sufficient ? ` · suficiente: ${m.sufficient}` : ''}`).join('; ')}`)
    else if (c.antiemetic?.drug) L.push(`  - antiemético: ${c.antiemetic.drug} ${c.antiemetic.scheme ?? ''} · suficiente: ${c.antiemetic.sufficient ?? '—'}`)
    if (c.other_meds?.between?.length) L.push(`  - entre quimio y quimio: ${c.other_meds.between.map(medRow).join('; ')}`)
    if (c.fasting_last_meal_at && c.start_at) L.push(`  - ayuno previo: desde ${c.fasting_last_meal_at.replace('T', ' ')}`)
    if (c.notes) L.push(`  - notas: ${c.notes}`)
  }
  L.push('')
  L.push('## 3. Cronología día a día')
  const byDate = new Map(backend.all('daily_logs').map((l) => [l.date, l]))
  for (const l of logs) {
    const ctx = cycleContext(cycles, l.date)
    const defs = symptomsForToday(ctx, diagnoses)
    const prev = [1, 2, 3].map((n) => byDate.get(addDays(l.date, -n))).filter((x): x is NonNullable<typeof x> => !!x)
    const tr = dailyTraffic(l, prev, ctx, defs)
    L.push(`### ${fmtDate(l.date)} (${l.date}) — ${ctx.cycle ? `ciclo ${ctx.cycle.number} D${ctx.day}, ${ctx.inCycle ? 'en ciclo' : ctx.nadir ? 'valle' : 'fuera de ciclo'}` : 'sin ciclo'} · semáforo ${tr.level.toUpperCase()}${tr.reasons.length ? ` (${tr.reasons.join('; ')})` : ''} · ${l.location ?? ''}`)
    const c: string[] = []
    if (l.temp_max != null) c.push(`Tª máx ${l.temp_max} °C`)
    const vit = l.extra?.vitals
    if (vit) {
      const det = (['manana', 'tarde', 'noche'] as const)
        .map((k) => { const v = vit[k]; if (!v) return null
          const parts = [v.temp != null ? `${v.temp} °C` : null, v.sys != null || v.dia != null ? `TA ${v.sys ?? '—'}/${v.dia ?? '—'}` : null, v.pulse != null ? `${v.pulse} lpm` : null, v.spo2 != null ? `SatO2 ${v.spo2} %` : null].filter(Boolean)
          return parts.length ? `${k === 'manana' ? 'mañana' : k} ${parts.join(' ')}` : null })
        .filter(Boolean)
      if (det.length) c.push(`constantes: ${det.join(' · ')}`)
    }
    if (l.weight != null) c.push(`peso ${l.weight} kg`)
    for (const w of backend.all('weights').filter((w) => w.at.slice(0, 10) === l.date)) c.push(`peso ${w.kg} kg (${w.source}${w.height_cm ? `, ${w.height_cm} cm` : ''})`)
    if (l.urine_color) c.push(`orina color ${l.urine_color}/6${l.urine_amount ? ` ${l.urine_amount}` : ''}${l.urine_ph ? ` pH ${l.urine_ph}` : ''}${l.urine_ml ? ` ${l.urine_ml} ml` : ''}`)
    if (l.stools_n != null) c.push(`deposiciones ${l.stools_n}${l.bristol ? ` Bristol ${l.bristol}` : ''}${l.stool_color && l.stool_color !== 'normal' ? ` ${l.stool_color}` : ''}`)
    if (l.pain_max != null) c.push(`dolor ${l.pain_max}/10${l.pain_location ? ` (${l.pain_location})` : ''}`)
    if (l.fatigue != null) c.push(`fatiga ${l.fatigue}/4`)
    if (l.mood_child) c.push(`ánimo ${l.mood_child}/5`)
    if (c.length) L.push(`- Constantes: ${c.join(' · ')}`)
    const s = Object.entries(l.symptoms).filter(([, v]) => v > 0).map(([k, v]) => `${sym(k)} ${SEVERITY_LABELS[v].toLowerCase()}${k === 'flemas' && l.extra?.phlegm_color ? ` (${l.extra.phlegm_color})` : ''}`)
    if (s.length) L.push(`- Síntomas: ${s.join(' · ')}`)
    const meals = l.meals.filter((m) => m.fraction != null || m.carb || m.macros)
    const mode = weekMode(l, ctx)
    const nut = dayNutrition(l, mode, { cisplatin: isCisplatinDay(ctx) })
    const fh = fastingHours(l, byDate.get(addDays(l.date, -1)))
    if (meals.length) L.push(`- Comidas (${MODE_LABELS[mode].toLowerCase()}${fh != null ? `, ayuno ${fh} h` : ''}): ${meals.map((m) => { const t = mealTraffic(m, { cisplatin: isCisplatinDay(ctx) }); const mac = m.macros ? ` [verdura ${m.macros.veg ?? '—'}/2, proteína ${m.macros.prot ?? '—'}/2, almidón ${m.macros.starch ?? '—'}/3, grasa ${m.macros.fat ? 'sí' : 'no'}]` : ''; return `${m.slot}${m.time ? ` ${m.time}` : ''} ${m.fraction != null ? FRACTION_LABELS[String(m.fraction)] : ''}${mac}${t ? ` ${t.level}` : ''}${m.carb ? ` HC ${m.carb}` : ''}${m.texture ? ` ${m.texture}` : ''}${m.note ? ` (${m.note})` : ''}` }).join(' · ')} → ingesta media ${meanIntake(l.meals) != null ? Math.round(meanIntake(l.meals)! * 100) + ' %' : '—'}, perfil ${carbProfile(l.meals)}, semáforo del día ${nut.level}${nut.reasons.length ? ` (${nut.reasons.join('; ')})` : ''}`)
    const fl: string[] = []
    if (l.fluids_total_ml != null) fl.push(`total ${l.fluids_total_ml} ml`)
    if (l.water_ml != null) fl.push(`agua ${l.water_ml}`)
    if (l.seawater_ml != null) fl.push(`agua de mar ${l.seawater_ml}`)
    if (l.broth_cups) fl.push(`caldo ${l.broth_cups} medias tazas`)
    if (l.extra?.infusion_cups) fl.push(`infusiones ${l.extra.infusion_cups} medias tazas`)
    if (fl.length) L.push(`- Líquidos: ${fl.join(' · ')}`)
    const prevDone = Object.entries(l.preventive).filter(([, v]) => v).map(([k]) => PREVENTIVE.find((p) => p.key === k)?.label ?? k)
    if (prevDone.length) L.push(`- Preventivos hechos: ${prevDone.join('; ')}`)
    const taken = intakes.filter((i) => i.date === l.date)
    if (taken.length) L.push(`- Tomas: ${taken.map((i) => `${pname(i.product_id)} (${i.moment})`).join(', ')}`)
    const sl: string[] = []
    if (l.sleep_start && l.sleep_end) sl.push(`${l.sleep_start}–${l.sleep_end}`)
    if (l.wakeups != null) sl.push(`${l.wakeups} despertares${l.wakeup_cause ? ` (${l.wakeup_cause})` : ''}`)
    const sy = l.extra?.sync ?? {}
    const lt = (k: keyof typeof sy, label: string) => (l[k] ? `${label}${sy[k]?.time ? ` ${sy[k]!.time}` : ''}${sy[k]?.minutes ? ` ${sy[k]!.minutes} min` : ''}` : '')
    const light = [lt('ir_morning', 'IR mañana'), lt('ir_night', 'IR noche'), lt('glasses', 'gafas'), lt('daylight_morning', 'luz mañana'), lt('daylight_afternoon', 'luz tarde'), lt('sun_exposure', 'sol')].filter(Boolean)
    if (light.length) sl.push(light.join(', '))
    if (sl.length) L.push(`- Sueño y luz: ${sl.join(' · ')}`)
    const act = Object.entries(l.activity).filter(([, v]) => v).map(([k]) => k)
    const fu = l.extra?.functional
    const fuTxt = fu ? [fu.stairs && 'sube escaleras', fu.stands_alone && 'se levanta solo', fu.walk_min != null && `aguanta paseo ${fu.walk_min} min`, fu.falls && `caídas: ${fu.falls}`].filter(Boolean).join(', ') : ''
    if (act.length || l.activity_min || l.steps || fuTxt) L.push(`- Actividad: ${act.join(', ')}${l.activity_min ? ` · ${l.activity_min} min` : ''}${l.steps ? ` · ${l.steps} pasos` : ''}${fuTxt ? ` · capacidad funcional: ${fuTxt}` : ''}`)
    const ev = events.filter((e) => e.start_at.slice(0, 10) === l.date)
    if (ev.length) L.push(`- Agenda: ${ev.map((e) => `${e.title} (${e.type}, ${e.status})`).join('; ')}`)
    const td = todos.filter((t) => t.done_at!.slice(0, 10) === l.date)
    if (td.length) L.push(`- Pendientes resueltos: ${td.map((t) => t.title).join('; ')}`)
    if (l.notes) L.push(`- Notas: ${l.notes}`)
    L.push('')
  }
  const missing = []
  for (let d = from; d <= to; d = addDays(d, 1)) if (!byDate.has(d)) missing.push(d)
  if (missing.length) L.push(`Días sin registro: ${missing.join(', ')}`)
  L.push('')
  L.push('## 4. Analíticas (evolución por parámetro)')
  if (!panels.length) L.push('Sin analíticas en el período.')
  else {
    L.push('| Parámetro | ' + panels.map((p) => p.date).join(' | ') + ' | Rango |')
    L.push('|---|' + panels.map(() => '---').join('|') + '|---|')
    const keys = Array.from(new Set(results.filter((r) => panels.some((p) => p.id === r.panel_id)).map((r) => r.analyte)))
    for (const k of keys) {
      const cells = panels.map((p) => { const r = results.find((x) => x.panel_id === p.id && x.analyte === k); if (!r) return '—'; const flag = r.ref_low != null && r.value < r.ref_low ? ' ↓' : r.ref_high != null && r.value > r.ref_high ? ' ↑' : ''; return `${r.value}${flag}` })
      const any = results.find((x) => x.analyte === k && panels.some((p) => p.id === x.panel_id))
      L.push(`| ${ANALYTES.find((a) => a.key === k)?.label ?? k} (${any?.unit ?? ''}) | ${cells.join(' | ')} | ${any?.ref_low ?? '—'}–${any?.ref_high ?? '—'} |`)
    }
  }
  if (organ.length) { L.push(''); L.push('Pruebas de órgano: ' + organ.map((o) => `${o.type} ${o.date}: ${o.result ?? ''}`).join('; ')) }
  if (micro.length) { L.push(''); L.push('Tests de microbiota: ' + micro.map((m) => `${m.date} (${m.lab_name ?? ''}): ${m.results.map((r) => `${r.name} ${r.value}${r.flag ? ` [${r.flag}]` : ''}`).join(', ')}`).join('; ')) }
  L.push('')
  L.push('## 5. Ejercicio, emocional y cuidadora')
  for (const s of sessions) L.push(`- ${s.date} ${s.kind}: ${s.exercises.map((e) => `${e.name} ${e.sets ?? ''}×${e.reps ?? ''} ${e.load ?? ''}`).join(', ')}${s.minutes ? ` · ${s.minutes} min` : ''}`)
  for (const w of weeklyChild) L.push(`- Semana ${w.week_start} (niño): ánimo ${w.mood ?? '—'}/5 · emociones ${Object.entries(w.emotions).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ')} · imagen corporal ${w.body_image ?? '—'} · psicóloga ${w.psych_session ? 'sí' : 'no'} · amigos ${w.friends_contact ?? '—'}${w.decided ? ` · decidió: ${w.decided}` : ''}`)
  for (const w of weeklyCg) L.push(`- Semana ${w.week_start} (cuidador/a): Zarit ${w.zarit.reduce((a, b) => a + (b ?? 0), 0)}/28 · relevo ${w.relief ? 'sí' : 'no'} · tiempo propio ${w.self_time ? 'sí' : 'no'}${w.hardest ? ` · lo más difícil: ${w.hardest}` : ''}`)
  L.push('')
  L.push('## 6. Resumen numérico del período')
  const n = logs.length
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
  L.push(`- Días registrados: ${n} de ${Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1}`)
  L.push(`- Días con Tª ≥ 38 °C: ${logs.filter((l) => (l.temp_max ?? 0) >= 38).length} · semáforo rojo: ${logs.filter((l) => { const c = cycleContext(cycles, l.date); return dailyTraffic(l, [], c, symptomsForToday(c, diagnoses)).level === 'rojo' }).length} días`)
  const wts = backend.all('weights').filter((w) => inRange(w.at.slice(0, 10))).sort((a, b) => a.at.localeCompare(b.at))
  L.push(`- Peso: ${[...logs.filter((l) => l.weight != null).map((l) => `${l.date.slice(5)} ${l.weight}`), ...wts.map((w) => `${w.at.slice(5, 10)} ${w.kg} (${w.source})`)].join(', ') || '—'}`)
  L.push(`- Ingesta media: ${avg(logs.map((l) => meanIntake(l.meals)).filter((x): x is number => x != null).map((x) => x * 100)) ?? '—'} % · líquidos medios: ${avg(logs.map((l) => l.fluids_total_ml).filter((x): x is number => x != null)) ?? '—'} ml`)
  L.push(`- Dolor medio: ${avg(logs.map((l) => l.pain_max).filter((x): x is number => x != null)) ?? '—'} · despertares medios: ${avg(logs.map((l) => l.wakeups).filter((x): x is number => x != null)) ?? '—'} · actividad media: ${avg(logs.map((l) => l.activity_min).filter((x): x is number => x != null)) ?? '—'} min`)
  const symCount: Record<string, number> = {}
  for (const l of logs) for (const [k, v] of Object.entries(l.symptoms)) if (v > 0) symCount[k] = (symCount[k] ?? 0) + 1
  L.push(`- Síntomas más frecuentes (días): ${Object.entries(symCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${sym(k)} ${v}`).join(', ') || '—'}`)
  const pend = questions.filter((q) => q.status === 'pendiente')
  if (pend.length) { L.push(''); L.push('## 7. Preguntas pendientes para el equipo'); for (const q of pend) L.push(`- [${q.professional}] ${q.question}`) }
  return L.join('\n')
}
export function exportAiReport(from: string, to: string) {
  download(`informe_ia_${from}_${to}.md`, buildAiReport(from, to), 'text/markdown')
  markExported()
}
