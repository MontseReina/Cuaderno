import type { Cycle, DailyLog, NauseaDia } from '../store/types'
import { addDays, diffDays, fmtDate } from './dates'
import { sesionesTratamiento, type Sesion } from './fases'

/** Registro de náuseas para saber si la pauta antiemética es suficiente (propuesta del 28/09/2026).
 *  - Intensidad: escala de caras 0-10 que señala el niño (tipo BARF, validada desde los 7 años), mañana, tarde y noche.
 *  - Fase: aguda (perfusión y primeras 24 h tras terminar), retardada (días 2 a 5 tras terminar), anticipatoria (casilla).
 *  - Impacto en comer y beber, arcadas sin vómito y rescates (dosis extra de antiemético) con su efecto a la hora.
 *  Los umbrales del control del día son una propuesta a validar con el equipo. */

export const NAUSEA_CARAS: { v: number; cara: string; txt: string }[] = [
  { v: 0, cara: '😀', txt: 'Nada' },
  { v: 2, cara: '🙂', txt: 'Un poco' },
  { v: 4, cara: '😐', txt: 'Algo más' },
  { v: 6, cara: '😟', txt: 'Bastante' },
  { v: 8, cara: '😣', txt: 'Mucho' },
  { v: 10, cara: '🤮', txt: 'Lo peor' },
]
export const NAUSEA_IMPIDE = ['Nada', 'Algo', 'Mucho'] as const
export const NAUSEA_DESENCADENANTES = ['Olores', 'Comida', 'Movimiento o coche', 'Tras una toma', 'Nervios o el hospital', 'Sin motivo claro']
export const NAUSEA_EFECTO: { value: 'si' | 'algo' | 'no'; label: string }[] = [
  { value: 'si', label: 'Sí' }, { value: 'algo', label: 'Algo' }, { value: 'no', label: 'No' },
]

/** Máximo del día en la escala 0-10 (null si no se ha apuntado ninguna cara). */
export function nauseaMax(n?: NauseaDia | null): number | null {
  const vs = Object.values(n?.score ?? {}).filter((v): v is number => v != null)
  return vs.length ? Math.max(...vs) : null
}
/** Equivalencia con la escala antigua No/Leve/Moderado/Intenso (para el semáforo y lo ya registrado). */
export const severidadDesdeEscala = (max: number | null) => (max == null || max === 0 ? 0 : max <= 3 ? 1 : max <= 6 ? 2 : 3)
const escalaDesdeSeveridad = (s: number) => [0, 2, 5, 8][s] ?? 0

export type FaseNausea = { fase: 'aguda' | 'retardada' | 'vispera'; kind: 'mtx' | 'cddp'; sesion: string; diaTras: number; texto: string }

const finPerfusion = (s: Sesion) => (s.kind === 'cddp' && !s.cycle?.end_at ? addDays(s.date, 2) : s.end)
const NOMBRE = { mtx: 'el metotrexato', cddp: 'el cisplatino + adriamicina' }
const DEL = { mtx: 'del metotrexato', cddp: 'del cisplatino + adriamicina' }

/** Fase de la náusea en un día, según las sesiones de Tratamiento (o del protocolo si aún no están). */
export function faseNausea(start: string | null | undefined, cycles: Cycle[], date: string, sesiones?: Sesion[]): FaseNausea | null {
  const ses = (sesiones ?? sesionesTratamiento(start, cycles)).filter((s) => s.kind !== 'cirugia')
  const manana = ses.find((s) => s.date === addDays(date, 1))
  const last = ses.filter((s) => s.date <= date).pop()
  if (last && last.kind !== 'cirugia') {
    const fin = finPerfusion(last)
    const d = diffDays(date, fin)
    const kind = last.kind as 'mtx' | 'cddp'
    if (date <= addDays(fin, 1)) return { fase: 'aguda', kind, sesion: last.date, diaTras: Math.max(0, d), texto: date <= fin ? `Fase aguda · día de perfusión ${DEL[kind]}` : `Fase aguda · primeras 24 h tras ${NOMBRE[kind]}` }
    if (d <= 5) return { fase: 'retardada', kind, sesion: last.date, diaTras: d, texto: `Fase retardada · día ${d} tras terminar ${NOMBRE[kind]}` }
  }
  if (manana && manana.kind !== 'cirugia') return { fase: 'vispera', kind: manana.kind as 'mtx' | 'cddp', sesion: manana.date, diaTras: -1, texto: `Víspera ${DEL[manana.kind as 'mtx' | 'cddp']}: si hay náusea, puede ser anticipatoria` }
  return null
}

export type ControlNivel = 'verde' | 'ambar' | 'rojo'
/** Control de náuseas y vómitos del día (propuesta, a validar con el equipo):
 *  verde = control completo: sin vómitos, sin arcadas, sin rescate y náusea ≤ 2 ·
 *  ámbar = náusea 3-6, 1-2 vómitos, arcadas, algo de impacto en comer o un rescate que funcionó ·
 *  rojo = náusea ≥ 7, 3 o más vómitos, no retiene líquidos, no puede comer, 2 o más rescates o uno que no funcionó. */
export function controlDelDia(l?: DailyLog | null): { nivel: ControlNivel; motivos: string[]; max: number | null } | null {
  if (!l) return null
  const n = l.extra?.nausea
  const legacy = l.symptoms?.nauseas ?? 0
  const max = nauseaMax(n) ?? (legacy ? escalaDesdeSeveridad(legacy) : 0)
  const vom = l.extra?.vomits?.length ?? 0
  const arc = n?.arcadas ?? 0
  const res = n?.rescates ?? []
  const fallidos = res.filter((r) => r.efecto === 'no').length
  const rojo: string[] = []
  const ambar: string[] = []
  if (max >= 7) rojo.push(`náusea ${max}/10`); else if (max >= 3) ambar.push(`náusea ${max}/10`)
  if (vom >= 3) rojo.push(`${vom} vómitos`); else if (vom > 0) ambar.push(`${vom} vómito${vom > 1 ? 's' : ''}`)
  if (l.extra?.vomit_no_liquids && vom > 0) rojo.push('no retiene líquidos')
  if (n?.impide === 2) rojo.push('no puede comer ni beber'); else if (n?.impide === 1) ambar.push('come o bebe menos')
  if (arc > 0) ambar.push(`${arc} arcada${arc > 1 ? 's' : ''}`)
  if (res.length >= 2) rojo.push(`${res.length} rescates`)
  if (fallidos) rojo.push(fallidos === 1 ? 'un rescate no funcionó' : `${fallidos} rescates no funcionaron`)
  if (res.length === 1 && !fallidos) ambar.push('1 rescate')
  if (rojo.length) return { nivel: 'rojo', motivos: [...rojo, ...ambar], max }
  if (ambar.length) return { nivel: 'ambar', motivos: ambar, max }
  return { nivel: 'verde', motivos: [], max }
}

export interface ResumenFase { dias: number; completos: number }
export interface ResumenSesion { sesion: string; kind: 'mtx' | 'cddp'; titulo: string; aguda: ResumenFase; retardada: ResumenFase; rescates: number; eficaces: number; anticipatoria: boolean; texto: string }

/** Resumen por sesión de quimio: días con control completo en fase aguda y retardada, y rescates.
 *  Solo cuenta días apuntados hasta `hasta` (normalmente hoy). */
export function resumenSesion(s: Sesion, logs: DailyLog[], hasta: string): ResumenSesion | null {
  if (s.kind === 'cirugia' || s.date > hasta) return null
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const fin = finPerfusion(s)
  const agudaDias: string[] = []
  for (let d = s.date; d <= addDays(fin, 1); d = addDays(d, 1)) agudaDias.push(d)
  const retDias = [2, 3, 4, 5].map((k) => addDays(fin, k))
  const cuenta = (ds: string[]): ResumenFase => {
    const hechos = ds.filter((d) => d <= hasta && byDate.has(d))
    return { dias: hechos.length, completos: hechos.filter((d) => controlDelDia(byDate.get(d))?.nivel === 'verde').length }
  }
  const todos = [...agudaDias, ...retDias].filter((d) => d <= hasta)
  const rescates = todos.flatMap((d) => byDate.get(d)?.extra?.nausea?.rescates ?? [])
  const vispera = byDate.get(addDays(s.date, -1))
  const anticipatoria = [vispera, byDate.get(s.date)].some((l) => !!l?.extra?.nausea?.anticipatoria)
  const aguda = cuenta(agudaDias)
  const retardada = cuenta(retDias)
  const kind = s.kind as 'mtx' | 'cddp'
  const titulo = `${kind === 'mtx' ? 'Metotrexato' : 'Cisplatino + adriamicina'} del ${fmtDate(s.date).replace(/^\S+,\s*/, '')}`
  const f = (x: ResumenFase) => (x.dias ? `${x.completos} de ${x.dias} día${x.dias > 1 ? 's' : ''} con control completo` : 'sin días apuntados')
  const efi = rescates.filter((r) => r.efecto === 'si').length
  const texto = `Aguda: ${f(aguda)} · retardada: ${f(retardada)} · ${rescates.length ? `${rescates.length} rescate${rescates.length > 1 ? 's' : ''} (${efi} ${efi === 1 ? 'eficaz' : 'eficaces'})` : 'sin rescates'}${anticipatoria ? ' · hubo náusea anticipatoria' : ''}`
  return { sesion: s.date, kind, titulo, aguda, retardada, rescates: rescates.length, eficaces: efi, anticipatoria, texto }
}

/** Resúmenes de las últimas sesiones de quimio hasta `hasta` (la más reciente primero). */
export function resumenesRecientes(start: string | null | undefined, cycles: Cycle[], logs: DailyLog[], hasta: string, n = 3): ResumenSesion[] {
  return sesionesTratamiento(start, cycles)
    .filter((s) => s.kind !== 'cirugia' && s.date <= hasta)
    .slice(-n).reverse()
    .map((s) => resumenSesion(s, logs, hasta))
    .filter((r): r is ResumenSesion => !!r)
}

/** Resumen de náuseas de un ciclo de Tratamiento (su propia sesión), para la ficha del ciclo. */
export function resumenDeCiclo(c: Cycle, logs: DailyLog[], hasta: string): ResumenSesion | null {
  const s = sesionesTratamiento(null, [c])[0]
  if (!s) return null
  const r = resumenSesion(s, logs, hasta)
  return r && r.aguda.dias + r.retardada.dias > 0 ? r : null
}
