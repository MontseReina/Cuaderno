/** El relato de cada día: se monta con el capítulo de la saga, la forma de Huma de hoy,
 *  lo que pasó ayer y la «misión», que sale de mirar qué poder ha ido más flojo
 *  en los tres días anteriores. Nada de esto se guarda: se recalcula. */

import { addDays, weekStart } from './dates'
import { dayPoints, FORMS, formAt, type CatKey, type DayPoints, type RetoInputs } from './reto'
import { SAGA, SAGA_INICIO } from './saga'

/** Cada cosa que se apunta da un poder a Huma (como los tipos de un juego de criaturas). */
export const PODERES: Record<CatKey, { emoji: string; poder: string; tipo: string; largo: string; color: string; pedir: string; ruta: string }> = {
  comer: { largo: 'el Poder del Fuego', emoji: '🔥', poder: 'Fuego', tipo: 'Fuerza de fuego', color: '#EE4B2B', pedir: 'las comidas', ruta: '/nutricion' },
  beber: { largo: 'el Poder del Agua', emoji: '💧', poder: 'Agua', tipo: 'Poder del agua', color: '#2F8FD8', pedir: 'lo que has bebido', ruta: '/hidratacion' },
  moverse: { largo: 'el Poder del Rayo', emoji: '⚡', poder: 'Rayo', tipo: 'Velocidad del rayo', color: '#E8B400', pedir: 'el movimiento', ruta: '/ejercicio' },
  medicinas: { largo: 'el Poder del Escudo', emoji: '🛡️', poder: 'Escudo', tipo: 'Escudo mágico', color: '#3F6E78', pedir: 'las medicinas', ruta: '/medicacion' },
  dormir: { largo: 'el Poder de la Luna', emoji: '🌙', poder: 'Luna', tipo: 'Energía de luna', color: '#6A5ACD', pedir: 'cómo has dormido', ruta: '/biohacking' },
  estoy: { largo: 'el Corazón Valiente', emoji: '❤️', poder: 'Corazón', tipo: 'Corazón valiente', color: '#E2557A', pedir: 'cómo te encuentras', ruta: '/diario' },
}

export interface Evaluacion {
  /** Poder que más necesita Huma (el más flojo de los últimos días), o null si todos van bien. */
  necesita: CatKey | null
  /** Poder que mejor ha ido. */
  mejor: CatKey | null
  /** Porcentaje medio (0-100) de cada poder en los días mirados. */
  medias: Record<CatKey, number>
  dias: number
}

/** Prioridad cuando dos poderes empatan: primero lo que más importa para el cuerpo. */
const PRIORIDAD: CatKey[] = ['comer', 'beber', 'medicinas', 'moverse', 'dormir', 'estoy']

/** Mira los 3 días anteriores a `date` (sin contar hoy, que todavía se está rellenando). */
export function evaluar(date: string, inp: RetoInputs, shieldMin?: number): Evaluacion {
  const dias: DayPoints[] = [1, 2, 3].map((i) => dayPoints(addDays(date, -i), inp, shieldMin))
    .filter((d) => d.base > 0 || inp.logs.some((l) => l.date === d.date))
  const medias = Object.fromEntries(PRIORIDAD.map((k) => [k, 0])) as Record<CatKey, number>
  if (!dias.length) return { necesita: null, mejor: null, medias, dias: 0 }
  for (const k of PRIORIDAD) {
    medias[k] = Math.round(dias.reduce((a, d) => { const c = d.cats.find((x) => x.key === k)!; return a + (100 * c.pts) / c.max }, 0) / dias.length)
  }
  // «Cómo estoy» solo es misión si todo lo demás va bien.
  const candidatos = PRIORIDAD.filter((k) => k !== 'estoy')
  let necesita: CatKey | null = candidatos.reduce((min, k) => (medias[k] < medias[min] ? k : min), candidatos[0])
  if (medias[necesita] >= 80) necesita = medias.estoy < 80 ? 'estoy' : null
  // «Lo que más brilló»: sin contar las medicinas si esos días no tocaba ninguna (saldrían al 100 % sin hacer nada).
  const sinTomas = dias.every((d) => d.cats.find((x) => x.key === 'medicinas')!.detail === 'hoy no tocan')
  const opciones = PRIORIDAD.filter((k) => !(k === 'medicinas' && sinTomas))
  const mejor = opciones.reduce((max, k) => (medias[k] > medias[max] ? k : max), opciones[0])
  return { necesita, mejor: medias[mejor] > 0 ? mejor : null, medias, dias: dias.length }
}

/** Número de capítulo (1, 2, 3…) para una fecha. */
export function capituloDe(date: string) {
  const ms = new Date(date + 'T12:00').getTime() - new Date(SAGA_INICIO + 'T12:00').getTime()
  return Math.max(1, Math.round(ms / 86400000) + 1)
}

export interface Parrafo { texto: string; tipo: 'titulo' | 'ayer' | 'cuento' | 'forma' | 'torre' | 'mision' | 'cierre' }
export interface Relato { numero: number; titulo: string; parrafos: Parrafo[]; mision: CatKey | null; minutos: number }

// ——— Piezas que se combinan cada día ———
const pick = <T,>(arr: T[], n: number) => arr[((n % arr.length) + arr.length) % arr.length]

export const FORMA_TXT: string[][] = [
  ['Hoy {H} está en su fase de Núcleo: un huevo de roca negra de volcán, cruzado por grietas que brillan como lava. A su alrededor gira un anillo de oro y bailan llamas verdes y doradas. Por fuera parece quieto, pero dentro arde un fuego que no se apaga. A los {SIG} puntos, el Núcleo estallará.',
    'Hoy {H} es un Núcleo de fuego. Las grietas de la roca laten con luz naranja, tac, tac, como un corazón, y el anillo dorado da vueltas sin parar. Está cargando poder, tu poder. Cuando lleguéis a {SIG} puntos, la roca saltará en mil pedazos.'],
  ['Hoy {H} está en su fase de Ascua: ha roto el Núcleo y se ha plantado encima de los trozos de roca negra. Es pequeño, rojo y naranja, con una cresta de plumas verdes y azules, unos ojos enormes de color turquesa y un sol dorado en el pecho. No le tiene miedo a nada. A los {SIG} puntos subirá a la fase Brasa.',
    'Hoy {H} es un Ascua recién nacido, y ya tiene genio. Levanta la cabeza, saca pecho para que se vea bien su sol dorado y suelta chispas verdes cuando se acerca la Niebla Gris. A los {SIG} puntos, evolucionará.'],
  ['Hoy {H} está en su fase de Brasa: se ha puesto de pie, con las garras doradas bien clavadas en el suelo y las alas abiertas, rojas, doradas y verde turquesa. En el pecho le brilla el sol dorado y a su alrededor se enciende fuego verde. Es un guerrero en entrenamiento, y entrena contigo. A los {SIG} puntos, echará a volar.',
    'Hoy {H} es una Brasa en guardia. Cuando tú ganas un poder, él lo nota justo en el sol de su pecho, que se enciende un poquito más. A los {SIG} puntos llegará la fase Llamarada.'],
  ['Hoy {H} está en su fase de Llamarada: ya vuela. Sus alas abiertas son enormes, de rojo, oro y verde, y detrás deja una cola larguísima de llamas que se enroscan en el aire. Cuando pasa, el cielo se ilumina. A los {SIG} puntos entrará en modo Inferno.',
    'Hoy {H} es una Llamarada que corta el cielo, dejando una estela de fuego verde y naranja. Las criaturas del valle levantan la cabeza para verlo pasar. A los {SIG} puntos subirá otro nivel.'],
  ['Hoy {H} está en modo Inferno: todo su cuerpo arde en fuego verde, sus garras brillan y a su alrededor flotan cristales negros de roca de volcán, como un escudo que gira. El sol de su pecho brilla verde. Es el penúltimo nivel. Solo faltan {FALTA} puntos para la fase final.',
    'Hoy {H} ha despertado el Inferno. Cuando grita, los cristales negros giran a su alrededor y la Niebla Gris retrocede asustada. Faltan {FALTA} puntos para el Fénix Supremo.'],
  ['Hoy {H} está en su fase final: ¡Fénix Supremo! Detrás de su cabeza brilla un sol de oro, sus alas ocupan todo el cielo y su cola es larguísima, con plumas que tienen dibujados ojos de colores, como un pavo real de fuego. Lo habéis conseguido juntos, y el premio de la semana ya es tuyo.',
    'Hoy {H} es el Fénix Supremo, con su sol dorado y su cola de plumas con ojos. Nadie en el Valle del Alba había visto nunca tanto poder. Eso es lo que consigue un entrenador valiente.'],
]

export const MISION_TXT: Record<CatKey | 'ninguna', string[]> = {
  comer: [
    'Y ahora, entrenador, escucha bien, porque hoy hay una misión. {H} tiene la llama del Fuego un poco pequeñita estos días. El Fuego se gana comiendo, y no hace falta comer montañas: cada bocado cuenta, incluso medio plato, incluso un caldito si la tripa está revuelta. Cada cucharada es una chispa que va directa al corazón de {H}.',
    'Doña Chispa ha mirado la llama de {H} con sus gafas redondas y ha dicho: hmmm. El Poder del Fuego necesita leña. Y la leña de un fénix es la comida. Hoy la misión es sencilla: en cada comida, unos bocaditos más que ayer, poquito a poco, sin prisa. Tu fénix notará cada uno.',
  ],
  beber: [
    'Y ahora, entrenador, una misión importante. Las tortugas del Río de Cristal han mandado un mensaje: {H} anda un poco seco estos días. El Poder del Agua se gana bebiendo: agua, caldo, infusiones… sorbito a sorbito, a lo largo de todo el día. Un truco de entrenador: tener siempre un vaso cerca y darle un trago cada vez que mires a {H}.',
    'Lumo ha notado algo: las plumas de {H} brillan menos cuando le falta agua. La misión de hoy es el Poder del Agua. No hace falta beberse un río de golpe: basta con muchos sorbitos pequeños, como hacen las tortugas, que beben despacio pero todo el día.',
  ],
  medicinas: [
    'Y ahora, entrenador, la misión de hoy viene de la Torre de los Sanadores. El Escudo de {H} necesita refuerzo. El Poder del Escudo se gana tomando las pociones y medicinas, todas, aunque alguna sepa rara. Un secreto de guardián: tomarla de un trago, pensar en {H} y luego un premio de agua fresquita.',
    'La guardiana de pelo rizado ha mandado una carta: el Escudo mágico de {H} tiene algún agujerito. Se arregla con las pociones de cada día. Hoy la misión es no dejarse ninguna. Cada toma es una pieza nueva del escudo.',
  ],
  moverse: [
    'Y ahora, entrenador, una misión de las Montañas del Trueno. El Poder del Rayo de {H} está un poco dormido. Se despierta moviéndose, como tú puedas: un paseo corto, estirar los brazos, mover los dedos de los pies, jugar a algo con las manos. Recuerda al búho campeón, que solo movía la cabeza.',
    'El conejo de las gafas de sol ha venido a buscarte: dice que {H} necesita chispas de Rayo. Hoy la misión es moverse un poquito, lo que el cuerpo deje. Aunque sean cinco minutos. Cada movimiento es un zigzag dorado en las alas de tu fénix.',
  ],
  dormir: [
    'Y ahora, entrenador, una misión del Lago de la Luna. {H} necesita Poder de Luna: el poder del descanso. Esta noche, a dormir a buena hora, con la luz apagadita, y por la mañana, un ratito de luz del sol en la cara. Y que alguien apunte cómo ha ido la noche, porque así la luna sabe que has descansado.',
    'Doña Chispa dice que los fénix que duermen bien renacen más fuertes. La misión de hoy es la Energía de Luna: dormir bien esta noche y que quede apuntado a qué hora te dormiste y te despertaste.',
  ],
  estoy: [
    'Y ahora, entrenador, la misión de hoy es del Corazón Valiente. {H} quiere saber cómo estás de verdad: si te duele algo, si estás cansado, si estás contento o enfadado. Contarlo también es de valientes. Y que quede apuntado en el diario, para que el Corazón de {H} lo sienta.',
    'Lumo te ha preguntado una cosa muy importante: ¿cómo estás hoy? El Poder del Corazón Valiente se gana contando lo que sientes, sea lo que sea. No hay respuestas malas. Díselo a mamá o a la tía para que lo apunten.',
  ],
  ninguna: [
    'Y ahora, entrenador, una noticia buenísima: estos días todos los poderes de {H} han ido fenomenal. Fuego, Agua, Rayo, Escudo, Luna y Corazón brillan a la vez. La misión de hoy es mantener el fuego encendido, igual que hasta ahora. Doña Chispa dice que pocos entrenadores lo consiguen.',
    'Doña Chispa se ha quitado las gafas, las ha limpiado y se las ha vuelto a poner, porque no se lo creía: todos los poderes de {H} están fuertes. Hoy la misión es seguir así. Eres un entrenador de los buenos.',
  ],
}

export const PEDIR = 'Y un encargo de entrenador: cuando termine el día, pregunta a mamá o a la tía si han apuntado {PEDIR} en la app. Si no está apuntado, el poder no le llega a {H}.'

export const TORRE_TXT = [
  'Hoy es día de Torre. Los Guardianes de Bata Blanca están contigo, y tus pociones de escudo están trabajando. Hoy no hace falta hacer grandes cosas: por ser día de Torre ya tienes {ESCUDO} puntos asegurados, solo por ser valiente. Todo lo que hagas de más es un regalo extra para {H}.',
  'Hoy te toca estar en la Torre de los Sanadores, y eso ya es una hazaña. Los días de Torre cuentan doble en valentía: ya tienes {ESCUDO} puntos guardados en el bolsillo. {H} se queda a tu lado, calentito, cuidándote igual que tú lo cuidas a él.',
]

export const CIERRE_TXT = [
  'Y recuerda lo que dice Doña Chispa: ser valiente no es no tener miedo. Es tener miedo y dar el paso igualmente. Tú lo haces todos los días.',
  'Los fénix no son fuertes porque nunca se caigan. Son fuertes porque siempre, siempre, vuelven a levantarse. Igual que tú.',
  'Hoy no hace falta ser gigante. Basta con encender luces pequeñas, una detrás de otra. Cada una cuenta.',
  'Lumo dice que contigo cerca el miedo se hace de bolsillo. Y tiene razón: juntos, todo es más pequeñito.',
  'Hay días de niebla y días de sol. En los dos, tu fénix está orgulloso de ti.',
  'Tu valentía no se ve por fuera, pero {H} la siente por dentro. Y por eso crece.',
  'Un entrenador valiente no lo hace todo perfecto. Lo intenta. Y tú lo intentas cada día.',
]

export interface RelatoDatos {
  date: string
  inp: RetoInputs
  entrenador: string
  criatura: string
  goal: number
  shieldMin: number
  /** Puntos de la semana y nivel de hoy. */
  semana: number
  nivel: number
  hoyEscudo: boolean
}

export function relatoDelDia(d: RelatoDatos): Relato {
  const numero = capituloDe(d.date)
  const cap = pick(SAGA, numero - 1)
  const ev = evaluar(d.date, d.inp, d.shieldMin)
  const sig = d.nivel < FORMS.length - 1 ? formAt(d.nivel + 1, d.goal) : d.goal
  const nom = d.entrenador.trim()
  const sub = (t: string) => t
    .replaceAll('entrenador {E}', nom ? `entrenador ${nom}` : 'entrenador').replaceAll('{E}', nom || 'entrenador').replaceAll('{H}', d.criatura)
    .replaceAll('{SIG}', String(sig)).replaceAll('{FALTA}', String(Math.max(0, sig - d.semana)))
    .replaceAll('{ESCUDO}', String(d.shieldMin))
    .replaceAll('{HUMA}', d.nivel === 0 ? `el huevo de ${d.criatura}` : d.criatura)
    .replaceAll('{A_HUMA}', d.nivel === 0 ? `el huevo de ${d.criatura}` : `a ${d.criatura}`)
    .replaceAll('{PIEL}', d.nivel === 0 ? 'su cáscara' : 'sus plumas')
    .replaceAll('{SONIDO}', d.nivel === 0 ? 'Y desde dentro del huevo se oyó otra vez: tac, tac.' : `Y ${d.criatura} contestó con un grito de fénix: ¡kiiiah!`)
  const p: Parrafo[] = []

  p.push({ tipo: 'titulo', texto: sub(`Capítulo ${numero}. ${cap.titulo}.`) })

  // Ayer (si es lunes, se habla de la semana pasada).
  const ayer = dayPoints(addDays(d.date, -1), d.inp, d.shieldMin)
  const esLunes = weekStart(d.date) === d.date
  if (esLunes) {
    p.push({ tipo: 'ayer', texto: sub('Hola, entrenador {E}. Hoy es lunes, y los lunes pasa algo especial: {H} ha vuelto a su huevo para renacer, como hacen todos los fénix. Pero no empieza de cero: dentro lleva una chispa de todo lo que vivisteis la semana pasada. Empieza una semana nueva, y un premio nuevo.') })
  } else if (ayer.base > 0 || ayer.shield) {
    const mejor = ev.mejor ? PODERES[ev.mejor] : null
    p.push({ tipo: 'ayer', texto: sub(`Hola, entrenador {E}. Ayer conseguisteis ${ayer.total} puntos de poder${ayer.shield ? ', en un día de Torre, que vale el doble en valentía' : ''}.${mejor ? ` Lo que más brilló estos días fue ${mejor.largo}, y {H} todavía lo nota en las plumas.` : ''} Vamos con el capítulo de hoy.`) })
  } else {
    p.push({ tipo: 'ayer', texto: sub('Hola, entrenador {E}. Ayer el cuaderno se quedó un poco vacío, y no pasa nada: hasta los mejores entrenadores tienen días así. Hoy es un día nuevo, y {H} está deseando ganar poderes contigo. Vamos con el capítulo de hoy.') })
  }

  for (const t of cap.texto) p.push({ tipo: 'cuento', texto: sub(t) })

  p.push({ tipo: 'forma', texto: sub(pick(FORMA_TXT[d.nivel], numero)) })
  if (d.hoyEscudo) p.push({ tipo: 'torre', texto: sub(pick(TORRE_TXT, numero)) })

  const mk = ev.necesita ?? 'ninguna'
  p.push({ tipo: 'mision', texto: sub(pick(MISION_TXT[mk], numero)) })
  if (ev.necesita) p.push({ tipo: 'mision', texto: sub(PEDIR.replace('{PEDIR}', PODERES[ev.necesita].pedir)) })

  p.push({ tipo: 'cierre', texto: sub(pick(CIERRE_TXT, numero)) })
  p.push({ tipo: 'cierre', texto: sub(cap.manana) + ' Hasta mañana, entrenador.' })

  const palabras = p.reduce((a, x) => a + x.texto.split(/\s+/).length, 0)
  return { numero, titulo: sub(cap.titulo), parrafos: p, mision: ev.necesita, minutos: Math.max(1, Math.round(palabras / 140)) }
}

