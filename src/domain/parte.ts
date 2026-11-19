/** 0.50.0 · Parte de la mañana (pedido de Montserrate, 19/11/2026).
 *
 *  La familia rellena el registro por la noche, antes del cierre de las 00:00. A las 8:00 del día siguiente llega a
 *  Montserrate, Estefanía y Roberto un parte del día anterior, ya cerrado:
 *   - constantes (temperatura, tensión, pulso, saturación) y dolor, siempre con su valor (0.50.1);
 *   - boca y mucosas: llagas, estomatitis o cualquier lesión de mucositis, también leve, y si se revisó la boca (0.50.1);
 *   - otros signos y síntomas: solo lo que sale en naranja o rojo (mismos rangos que el informe semanal, aceptados el 27/09);
 *   - orina (micciones frente a lo habitual y color) y cuidados preventivos hechos / no hechos / sin marcar (0.50.1);
 *   - medicación de rescate (Nausealiv, Ipeca + Nux vómica + Arsenicum, paracetamol, ondansetrón): si se dio o no;
 *     la medicación habitual no sale;
 *   - nutrición: ayuno de la noche, proteína del día (360-400 g) y de desayuno, comida y cena (120 g), ingestas y
 *     hora de fin de la cena;
 *   - hidratación: ml del día frente a 1.500;
 *   - energía y descanso: cansancio, ánimo, sueño, horas entre la cena y dormir, luz del día;
 *   - otros: peso, ejercicio de la mano y paseos tras comer, notas del día, y lo que se cerró sin rellenar.
 *  «La noche» es siempre la que termina la mañana del día del parte (cena de la víspera → desayuno de ese día), que es
 *  la que está completa cuando se rellena el registro por la noche.
 *
 *  Es puro (sin base de datos): lo usan la app (pantalla «Partes del día») y la función del servidor que lo manda. */
import type { Cycle, DailyLog, Intake, MenuData, Patient, Product, VitalEntry, WeightEntry } from '../store/types'
import { addDays } from './dates'
import { AYUNO_MAX_H, LOCATIONS, PREVENTIVE, STOOL_COLORS, TOMAS, URINE_LABELS } from './catalogs'
import { buildSignos, RANGOS_SIGNOS, type Alerta } from './informeSignosEjercicio'
import { cycleContext, isMtxPerfusionDay, otrosSintomas } from './cycle'
import { trafficWindow } from './medication'
import {
  AGUA_DIA_ML, CENA_LIMITE, HORAS_CENA_CAMA, MANO_HORAS, PRINCIPALES, batidoMl, enCasa, liquidosDelDia, ml, modoDelDia,
  pendientesDelDia, tomasHechas, tomasMetaDelDia,
} from './avisos'
import { finDe, fastingHours, totalFluids } from './nutrition'
import { proteinaDia, DIA_MIN, DIA_MAX, META_PRINCIPAL, PROTEINA_DESDE } from './proteina'
import { menuDelDia } from './menu'
import { tomada } from './kcal'
import { tiposBristol } from './deposiciones'
import { nauseaMax } from './nausea'

export type Color = 'verde' | 'naranja' | 'rojo' | 'gris'
export const PUNTO: Record<Color, string> = { verde: '🟢', naranja: '🟠', rojo: '🔴', gris: '⚪' }

/** Medicación de rescate (a demanda). Se reconoce por el nombre del producto en Medicación. */
export const RESCATE: { key: string; nombre: string; re: RegExp }[] = [
  { key: 'nausealiv', nombre: 'Nausealiv', re: /nausea\s*liv/i },
  { key: 'homeopatia', nombre: 'Ipeca + Nux vómica + Arsenicum', re: /nux|arsenicum|ipeca/i },
  { key: 'paracetamol', nombre: 'Paracetamol', re: /paracetamol|apiretal|dalsy|termalgin/i },
  { key: 'ondansetron', nombre: 'Ondansetrón', re: /ondansetr|zofran|yatrox/i },
]
/** Horas de sueño recomendadas a su edad (6-12 años: 9-12 h; AASM, Paruthi et al., J Clin Sleep Med 2016). */
export const SUENO_H = [9, 12] as const

export interface DatosParte {
  logs: DailyLog[]
  cycles: Cycle[]
  products: Product[]
  intakes: Intake[]
  weights: WeightEntry[]
  menu: MenuData | null
  patient?: Patient
}

export interface Linea { color: Color; texto: string; detalle?: string }
export interface RescateFila { nombre: string; estado: 'dada' | 'np' | 'no_dada' | 'sin_marcar'; veces: number; momentos: string[]; motivo?: string }
export interface ProtFila { label: string; g: number; color: Color; registrada: boolean }

export interface Parte {
  date: string
  fase: string
  lugar: string
  sinDatos: boolean
  sinRellenar: string[]
  signos: Linea[]
  /** 0.50.1 · Boca y mucosas: siempre (también leve), para supervisar el cuidado. */
  boca: Linea[]
  /** 0.50.1 · Constantes del día con su valor (temperatura, tensión, pulso, saturación) y dolor. */
  constantes: Linea[]
  /** 0.50.1 · Orina: micciones frente a lo habitual y color. */
  orina: Linea | null
  /** 0.50.1 · Cuidados preventivos (boca, piel, catéter, neutropenia…): hechos, no hechos y sin marcar. */
  preventivos: { linea: Linea; noHechos: string[]; sinMarcar: string[] } | null
  deposiciones: Linea | null
  rescate: RescateFila[]
  rescatesNausea: string[]
  nutricion: Linea[]
  proteina: { total: number; color: Color; tomas: ProtFila[] } | null
  hidratacion: Linea | null
  descanso: Linea[]
  otros: Linea[]
  notas: string | null
  /** Recuento para la cabecera y el aviso. */
  rojos: number
  naranjas: number
}

const es = (n: number, dec = 1) => String(Math.round(n * 10 ** dec) / 10 ** dec).replace('.', ',')
const hora = (hhmm: string) => hhmm.slice(0, 5).replace(/^0(\d)/, '$1')
const minDe = (hhmm?: string | null) => { const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
const MOMENTO: Record<string, string> = { ayunas: 'ayunas', manana: 'mañana', media_manana: 'media mañana', comida: 'comida', media_tarde: 'media tarde', cena: 'cena', dormir: 'al dormir' }
const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const fechaLarga = (d: string) => { const x = new Date(d + 'T12:00'); return `${DOW[x.getDay()]} ${x.getDate()} de ${MES[x.getMonth()]}` }
export const fechaCorta = (d: string) => { const x = new Date(d + 'T12:00'); return `${DOW[x.getDay()]} ${x.getDate()}` }

const vigente = (p: Product, d: string) => !p.deleted_at && (!p.start_date || p.start_date <= d) && (!p.end_date || p.end_date > d)

export function buildParte(date: string, data: DatosParte): Parte {
  const byDate = new Map(data.logs.map((l) => [l.date, l]))
  const log = byDate.get(date)
  const vispera = byDate.get(addDays(date, -1))
  const modo = modoDelDia(log, data.cycles, date)
  const loc = LOCATIONS.find((x) => x.value === (log?.location ?? 'casa'))
  const out: Parte = {
    date, fase: modo === 'quimio' ? 'Semana de quimio' : 'Semana nadir', lugar: loc ? `${loc.emoji} ${loc.short}` : '',
    sinDatos: !log, sinRellenar: [], signos: [], boca: [], constantes: [], orina: null, preventivos: null, deposiciones: null, rescate: [], rescatesNausea: [], nutricion: [],
    proteina: null, hidratacion: null, descanso: [], otros: [], notas: null, rojos: 0, naranjas: 0,
  }

  // ---------- Registro: lo que se cerró sin rellenar ----------
  const cerrado = log?.extra && (log.extra as { cierre?: { sin_rellenar?: string[] } }).cierre?.sin_rellenar
  out.sinRellenar = cerrado ?? pendientesDelDia({ date, log, ayer: vispera, logs: data.logs, weights: data.weights, cycles: data.cycles, products: data.products, intakes: data.intakes.filter((i) => i.date === date) })
  if (!log) return out

  // ---------- Signos y síntomas (solo naranja y rojo) ----------
  const sg = buildSignos([date], data.logs, data.patient)
  const conHora = (a: Alerta) => a.hora ? `${a.titulo} (${a.hora})` : a.titulo
  // Constantes, dolor y boca van en sus propios bloques (con su valor siempre a la vista).
  const APARTE = /^(Fiebre|37,5|Febrícula|Tensión|Pulso|Saturación|Dolor|Boca:)/
  out.signos = sg.alertas.filter((a) => !APARTE.test(a.titulo)).map((a) => ({ color: a.nivel === 'rojo' ? 'rojo' : 'naranja', texto: conHora(a), detalle: a.detalle }))
  // Vómitos (todos los episodios: los de alarma ya salen en rojo arriba)
  const vom = log.extra?.vomits ?? []
  if (vom.length && !out.signos.some((s) => /^Vómito/.test(s.texto))) {
    out.signos.push({ color: vom.length >= 3 ? 'rojo' : 'naranja', texto: `${vom.length} ${vom.length === 1 ? 'vómito' : 'vómitos'}`, detalle: vom.map((v) => v.time).filter(Boolean).join(', ') || undefined })
  }
  const nm = nauseaMax(log.extra?.nausea)
  if (nm != null && nm >= 5) out.signos.push({ color: nm >= 8 ? 'rojo' : 'naranja', texto: `Náuseas ${nm}/10` })

  // ---------- Constantes (siempre con su valor) ----------
  const R = RANGOS_SIGNOS
  const vit = Object.entries(log.extra?.vitals ?? {}).filter((x): x is [string, VitalEntry] => !!x[1])
  const SLOT: Record<string, string> = { manana: 'mañana', tarde: 'tarde', noche: 'noche' }
  const temps = vit.filter(([, v]) => v.temp != null).map(([k, v]) => ({ k, t: v.temp! }))
  if (log.temp_max != null && !temps.some((x) => x.t === log.temp_max)) temps.push({ k: '', t: log.temp_max })
  if (temps.length) {
    const max = temps.reduce((a, b) => (b.t > a.t ? b : a))
    const feb = temps.filter((x) => x.t >= R.febricula && x.t < R.fiebre).length
    const c: Color = max.t >= R.fiebre || feb >= 2 ? 'rojo' : max.t >= R.febricula ? 'naranja' : 'verde'
    out.constantes.push({ color: c, texto: `Temperatura máx. ${es(max.t)} °C${max.k ? ` (${SLOT[max.k]})` : ''}${max.t >= R.fiebre ? ' · FIEBRE' : max.t >= R.febricula ? ' · febrícula' : ''}`, detalle: `${temps.length} ${temps.length === 1 ? 'toma' : 'tomas'} · fiebre ≥ ${es(R.fiebre)} °C${log.extra?.fever_cause ? ` · foco marcado: ${log.extra.fever_cause.replace('_', ' ')}` : ''}` })
  } else out.constantes.push({ color: log.extra?.not_measured?.temp ? 'gris' : 'naranja', texto: log.extra?.not_measured?.temp ? 'Temperatura: no se pudo medir' : 'Temperatura sin tomar' })
  const tas = vit.filter(([, v]) => v.sys != null).map(([k, v]) => ({ k, sys: v.sys!, dia: v.dia ?? null }))
  if (tas.length) {
    const baja = tas.reduce((a, b) => (b.sys < a.sys ? b : a))
    const alta = tas.reduce((a, b) => (b.sys > a.sys ? b : a))
    const mal = (x: { sys: number; dia: number | null }) => x.sys < R.sys[0] || x.sys > R.sys[1] || (x.dia != null && x.dia > R.diaMax)
    const peor = mal(baja) ? baja : alta
    out.constantes.push({ color: tas.some(mal) ? 'naranja' : 'verde', texto: `Tensión ${tas.map((x) => `${x.sys}/${x.dia ?? '—'}`).join(' · ')}${baja.sys < R.sys[0] ? ' · BAJA' : peor.sys > R.sys[1] ? ' · alta' : ''}`, detalle: `rango: sistólica ${R.sys[0]}–${R.sys[1]}, diastólica hasta ${R.diaMax}` })
  }
  const pulsos = vit.filter(([, v]) => v.pulse != null).map(([, v]) => v.pulse!)
  if (pulsos.length) {
    const mal = pulsos.filter((x) => x < R.pulso[0] || x > R.pulso[1])
    out.constantes.push({ color: mal.length ? 'naranja' : 'verde', texto: `Pulso ${pulsos.join(' · ')} lpm`, detalle: `rango ${R.pulso[0]}–${R.pulso[1]} en reposo` })
  }
  const sats = vit.filter(([, v]) => v.spo2 != null).map(([, v]) => v.spo2!)
  if (sats.length) {
    const min = Math.min(...sats)
    out.constantes.push({ color: min < R.satRojo ? 'rojo' : min < R.satOk ? 'naranja' : 'verde', texto: `Saturación mín. ${min} %`, detalle: `normal ≥ ${R.satOk} %` })
  }
  if (log.pain_max != null) out.constantes.push({ color: log.pain_max >= R.dolorRojo ? 'rojo' : log.pain_max >= R.dolorAmbar ? 'naranja' : 'verde', texto: `Dolor ${log.pain_max}/10${log.pain_location ? ` · ${log.pain_location}` : ''}` })
  else out.constantes.push({ color: 'gris', texto: 'Dolor sin registrar' })

  // ---------- Boca y mucosas (siempre, también leve) ----------
  const muc = log.symptoms?.mucositis ?? 0
  const GRADO = ['', 'leve (le molesta)', 'moderada (come menos por el dolor)', 'intensa (no puede comer ni beber)']
  const revisada = log.preventive?.boca_revisada
  if (muc > 0) out.boca.push({ color: muc >= 3 ? 'rojo' : 'naranja', texto: `Llagas o dolor en la boca: ${GRADO[muc] ?? muc}` })
  const BOCA_RE = /llaga|afta|estomatitis|mucositis|boca|labio|enc[ií]a|lengua|garganta|anal|culete|escoc/i
  for (const o of otrosSintomas(log).filter((x) => BOCA_RE.test(x.text))) out.boca.push({ color: o.sev >= 3 ? 'rojo' : 'naranja', texto: `Otro: ${o.text.trim()}`, detalle: ['', 'leve', 'moderado', 'intenso'][o.sev] })
  const sintomasMarcados = Object.keys(log.symptoms ?? {}).length > 0 || !!log.extra?.symptoms_ok
  if (!out.boca.length) out.boca.push(sintomasMarcados ? { color: 'verde', texto: 'Sin llagas ni dolor en la boca' } : { color: 'gris', texto: 'Boca: síntomas sin revisar' })
  out.boca.push(revisada === true ? { color: 'verde', texto: 'Boca revisada ✓' } : revisada === 'x' ? { color: 'naranja', texto: 'Boca no revisada' } : revisada === 'np' ? { color: 'gris', texto: 'Revisión de boca: no precisa' } : { color: 'naranja', texto: 'Revisión de boca sin marcar' })

  // ---------- Orina ----------
  const usual = data.patient?.usual_voids ?? null
  if (log.urine_count != null || log.urine_color != null || log.urine_amount) {
    const menos = log.urine_amount === 'menos' || (usual != null && log.urine_count != null && log.urine_count < usual)
    const col = log.urine_color != null ? URINE_LABELS[log.urine_color - 1] : null
    const cOrina: Color = (log.urine_color ?? 0) >= 6 ? 'rojo' : menos || (log.urine_color ?? 0) >= 5 ? 'naranja' : 'verde'
    out.orina = { color: cOrina, texto: `Orina: ${log.urine_count != null ? `${log.urine_count} micciones` : 'micciones sin contar'}${col ? ` · ${col.toLowerCase()}` : ''}${log.urine_amount === 'menos' ? ' · menos cantidad' : ''}`, detalle: usual != null ? `lo habitual: ${usual}` : undefined }
  } else out.orina = { color: 'gris', texto: log.extra?.not_measured?.urine ? 'Orina: no se pudo ver' : 'Orina sin registrar' }

  // ---------- Cuidados preventivos ----------
  const ctx = cycleContext(data.cycles, date)
  const hasCatheter = !!data.patient?.catheter_type?.trim()
  const aplica = PREVENTIVE.filter((x) => !x.when || x.when === 'siempre' || (x.when === 'nadir' && ctx.nadir) || (x.when === 'cateter' && hasCatheter) || (x.when === 'mtx' && isMtxPerfusionDay(data.cycles, date)) || (x.when === 'infusion' && trafficWindow(ctx, date) === 'infusion'))
    .filter((x) => x.key !== 'boca_revisada')
  if (aplica.length) {
    const marca = (k: string) => log.preventive?.[k]
    const previstos = aplica.filter((x) => marca(x.key) !== 'np')
    const hechos = previstos.filter((x) => marca(x.key) === true)
    const noHechos = previstos.filter((x) => marca(x.key) === 'x').map((x) => x.label)
    const sinMarcar = previstos.filter((x) => marca(x.key) == null).map((x) => x.label)
    const pct = previstos.length ? Math.round((hechos.length / previstos.length) * 100) : 100
    out.preventivos = {
      linea: { color: pct === 100 ? 'verde' : pct >= 80 ? 'naranja' : 'rojo', texto: `Cuidados preventivos: ${hechos.length} de ${previstos.length} hechos` },
      noHechos, sinMarcar,
    }
  }

  // Deposiciones: siempre una línea (verde si es normal), porque se sigue a diario.
  const tipos = tiposBristol(log)
  const color = STOOL_COLORS.find((x) => x.key === log.stool_color)?.label.toLowerCase()
  if (log.stools_n == null) out.deposiciones = { color: 'gris', texto: 'Deposiciones sin registrar' }
  else if (log.stools_n === 0) out.deposiciones = { color: 'verde', texto: 'Sin deposición' }
  else {
    const fuera = tipos.some((b) => b <= 2 || b >= 5)
    out.deposiciones = {
      color: fuera ? 'naranja' : 'verde',
      texto: `${log.stools_n} ${log.stools_n === 1 ? 'deposición' : 'deposiciones'}${tipos.length ? ` · Bristol ${tipos.join(', ')}` : ''}${color && log.stool_color !== 'normal' ? ` · ${color}` : ''}`,
    }
  }

  // ---------- Medicación de rescate ----------
  const intakesDia = data.intakes.filter((i) => i.date === date && !i.deleted_at)
  for (const r of RESCATE) {
    const prods = data.products.filter((p) => r.re.test(p.name) && vigente(p, date))
    if (!prods.length) continue
    const ids = new Set(prods.map((p) => p.id))
    const tomas = intakesDia.filter((i) => ids.has(i.product_id))
    const dadas = tomas.filter((i) => i.status === 'dada' || (i.status == null && i.taken))
    const noDadas = tomas.filter((i) => i.status === 'no_dada')
    const np = tomas.filter((i) => i.status === 'no_precisa')
    out.rescate.push({
      nombre: r.nombre,
      estado: dadas.length ? 'dada' : noDadas.length ? 'no_dada' : np.length ? 'np' : 'sin_marcar',
      veces: dadas.length,
      momentos: dadas.map((i) => MOMENTO[i.moment] ?? i.moment),
      motivo: noDadas.map((i) => i.reason).filter(Boolean).join('; ') || undefined,
    })
  }
  out.rescatesNausea = (log.extra?.nausea?.rescates ?? []).map((x) => `${x.med}${x.time ? ` a las ${hora(x.time)}` : ''}${x.efecto ? ` (${x.efecto === 'si' ? 'funcionó' : x.efecto === 'algo' ? 'funcionó algo' : 'no funcionó'})` : ''}`)

  // ---------- Nutrición ----------
  const ay = fastingHours(log, vispera)
  if (ay == null) out.nutricion.push({ color: 'gris', texto: 'Ayuno de la noche: faltan horas para calcularlo' })
  else out.nutricion.push({ color: ay <= AYUNO_MAX_H ? 'verde' : 'naranja', texto: `Ayuno de la noche: ${es(ay)} h`, detalle: `máximo ${AYUNO_MAX_H} h` })

  const meta = tomasMetaDelDia(log, data.cycles, date)
  const hechas = tomasHechas(log)
  out.nutricion.push({ color: hechas >= meta ? 'verde' : hechas >= meta - 1 ? 'naranja' : 'rojo', texto: `Ingestas: ${hechas} de ${meta}` })

  const cena = log.meals.find((m) => m.slot === 'cena')
  const cenaFin = cena && tomada(cena) ? finDe(cena) : null
  if (cena && cena.fraction === 0) out.nutricion.push({ color: 'naranja', texto: 'No cenó' })
  else if (cenaFin) out.nutricion.push({ color: cenaFin.slice(0, 5) <= CENA_LIMITE ? 'verde' : 'naranja', texto: `Cena terminada a las ${hora(cenaFin)}`, detalle: `como tarde ${hora(CENA_LIMITE)}` })
  else out.nutricion.push({ color: 'gris', texto: 'Hora de la cena sin registrar' })

  if (date >= PROTEINA_DESDE) {
    const p = proteinaDia(log.meals, menuDelDia(data.menu, date), data.menu)
    out.proteina = {
      total: Math.round(p.total),
      color: p.total >= DIA_MIN ? 'verde' : p.total >= (DIA_MIN * 2) / 3 ? 'naranja' : 'rojo',
      tomas: p.tomas.filter((t) => t.principal).map((t) => ({
        label: TOMAS.find((x) => x.key === t.slot)?.label ?? t.slot,
        g: Math.round(t.tomado),
        color: !t.registrada ? 'gris' : t.nivel === 'verde' ? 'verde' : t.nivel === 'amarillo' ? 'naranja' : 'rojo',
        registrada: t.registrada,
      })),
    }
  }

  // ---------- Hidratación ----------
  const tieneLiq = totalFluids(log) != null || batidoMl(log) > 0
  if (!tieneLiq) out.hidratacion = { color: 'gris', texto: 'Líquidos sin registrar' }
  else {
    const v = liquidosDelDia(log)
    out.hidratacion = { color: v >= AGUA_DIA_ML ? 'verde' : v >= AGUA_DIA_ML * 0.6 ? 'naranja' : 'rojo', texto: `${ml(v)} ml de ${ml(AGUA_DIA_ML)}` }
  }

  // ---------- Energía y descanso ----------
  if (log.fatigue != null) out.descanso.push({ color: log.fatigue >= 3 ? 'naranja' : 'verde', texto: `Cansancio ${log.fatigue}/4`, detalle: ['juega normal', 'algo cansado', 'descansa más de lo normal', 'casi todo el día tumbado', 'no se levanta'][log.fatigue] })
  else out.descanso.push({ color: 'gris', texto: 'Cansancio sin registrar' })
  if (log.mood_child != null) out.descanso.push({ color: log.mood_child <= 2 ? 'naranja' : 'verde', texto: `Ánimo ${log.mood_child}/5` })
  const ini = minDe(log.sleep_start), fin = minDe(log.sleep_end)
  if (ini != null && fin != null) {
    const h = ((fin - ini + 1440) % 1440) / 60
    out.descanso.push({ color: h >= SUENO_H[0] && h <= SUENO_H[1] ? 'verde' : 'naranja', texto: `Sueño de la noche: ${es(h)} h (${hora(log.sleep_start!)}–${hora(log.sleep_end!)})`, detalle: `recomendado ${SUENO_H[0]}–${SUENO_H[1]} h${log.wakeups ? ` · ${log.wakeups} despertares` : ''}` })
    const cenaV = vispera?.meals.find((m) => m.slot === 'cena')
    const cv = cenaV && tomada(cenaV) ? minDe(finDe(cenaV)) : null
    if (cv != null) {
      const g = ((ini - cv + 1440) % 1440) / 60
      out.descanso.push({ color: g >= HORAS_CENA_CAMA ? 'verde' : 'naranja', texto: `Entre la cena y dormir: ${es(g)} h`, detalle: `mínimo ${HORAS_CENA_CAMA} h, ideal 3 h` })
    }
  } else out.descanso.push({ color: 'gris', texto: 'Sueño sin registrar' })
  const luz = [log.daylight_morning && 'mañana', log.daylight_afternoon && 'tarde', log.sun_exposure && 'sol directo'].filter(Boolean) as string[]
  out.descanso.push(luz.length ? { color: 'verde', texto: `Luz del día: ${luz.join(', ')}` } : { color: 'naranja', texto: 'Sin luz del día apuntada' })

  // ---------- Otros ----------
  const pesos = [
    ...data.weights.filter((w) => !w.deleted_at).map((w) => ({ d: w.at.slice(0, 10), kg: w.kg })),
    ...data.logs.filter((l) => l.weight != null).map((l) => ({ d: l.date, kg: l.weight! })),
  ].sort((a, b) => a.d.localeCompare(b.d))
  const hoyP = pesos.filter((p) => p.d === date).pop()
  if (hoyP) {
    const ant = pesos.filter((p) => p.d < date).pop()
    const dif = ant ? hoyP.kg - ant.kg : null
    const pctDif = ant && dif != null ? (dif / ant.kg) * 100 : null
    out.otros.push({ color: pctDif != null && pctDif <= -2 ? 'naranja' : 'verde', texto: `Peso ${es(hoyP.kg, 2)} kg${dif != null ? ` (${dif >= 0 ? '+' : ''}${es(dif, 2)} kg desde el ${fechaCorta(ant!.d)})` : ''}` })
  }
  const mano = MANO_HORAS.filter((h) => log.extra?.mano?.[h]).length
  out.otros.push({ color: mano >= MANO_HORAS.length / 2 ? 'verde' : mano > 0 ? 'naranja' : 'gris', texto: `Ejercicios de la mano: ${mano} de ${MANO_HORAS.length} rondas` })
  if (enCasa(log)) {
    const princ = PRINCIPALES.filter((s) => tomada(log.meals.find((m) => m.slot === s)))
    if (princ.length) {
      const n = princ.filter((s) => log.extra?.move_after?.[s]).length
      out.otros.push({ color: n >= princ.length ? 'verde' : 'naranja', texto: `Caminar tras comer: ${n} de ${princ.length}` })
    }
  }
  out.notas = log.notes?.trim() || null

  const todas = [...out.signos, ...out.constantes, ...out.boca, ...(out.orina ? [out.orina] : []), ...(out.preventivos ? [out.preventivos.linea] : []), ...(out.deposiciones ? [out.deposiciones] : []), ...out.nutricion, ...(out.hidratacion ? [out.hidratacion] : []), ...out.descanso, ...out.otros]
  if (out.proteina) todas.push({ color: out.proteina.color, texto: '' }, ...out.proteina.tomas.map((t) => ({ color: t.color, texto: '' })))
  out.rojos = todas.filter((l) => l.color === 'rojo').length
  out.naranjas = todas.filter((l) => l.color === 'naranja').length
  return out
}

/** Título y texto del aviso de las 8:00 (corto: el detalle está en la app). */
export function avisoParte(p: Parte): { title: string; body: string } {
  const title = `Huma · Parte del ${fechaCorta(p.date)} 🌅`
  if (p.sinDatos) return { title, body: 'Ayer no se registró nada en Huma.' }
  const lineas: string[] = []
  const clinicas = [...p.constantes, ...p.boca.filter((b) => !/^Boca revisada|^Revisión de boca|^Boca no revisada/.test(b.texto)), ...p.signos, ...(p.orina ? [p.orina] : [])]
  const alertas = clinicas.filter((s) => s.color === 'rojo').concat(clinicas.filter((s) => s.color === 'naranja'))
  lineas.push(alertas.length ? alertas.slice(0, 3).map((s) => `${PUNTO[s.color]} ${s.texto}`).join(' · ') + (alertas.length > 3 ? ` (+${alertas.length - 3})` : '') : '🟢 Sin signos fuera de lo normal')
  const dadas = p.rescate.filter((r) => r.estado === 'dada')
  lineas.push(dadas.length ? `💊 Rescate: ${dadas.map((r) => `${r.nombre}${r.veces > 1 ? ` ×${r.veces}` : ''}`).join(', ')}` : '💊 Sin medicación de rescate')
  const nut: string[] = []
  if (p.proteina) nut.push(`${PUNTO[p.proteina.color]} Proteína ${p.proteina.total} g`)
  if (p.hidratacion && p.hidratacion.color !== 'gris') nut.push(`${PUNTO[p.hidratacion.color]} Líquidos ${p.hidratacion.texto.replace(/ de .*/, '')}`)
  const ay = p.nutricion.find((l) => l.texto.startsWith('Ayuno') && l.color !== 'gris')
  if (ay) nut.push(`${PUNTO[ay.color]} ${ay.texto.replace('Ayuno de la noche: ', 'Ayuno ')}`)
  if (nut.length) lineas.push(nut.join(' · '))
  if (p.deposiciones && p.deposiciones.color === 'naranja') lineas.push(`${PUNTO.naranja} ${p.deposiciones.texto}`)
  if (p.preventivos && p.preventivos.linea.color !== 'verde') lineas.push(`${PUNTO[p.preventivos.linea.color]} ${p.preventivos.linea.texto}`)
  if (p.sinRellenar.length) lineas.push(`⚪ Sin rellenar: ${p.sinRellenar.join(', ')}`)
  return { title, body: lineas.join('\n') }
}

export { DIA_MAX, META_PRINCIPAL }
