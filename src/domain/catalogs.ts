// Catálogos de la app (v4). Todos los textos en lenguaje llano para cuidadores.

/** when: 'siempre' = en las dos listas · 'ciclo' = semana de quimio · 'fuera' = semana nadir / entre ciclos */
export interface SymptomDef {
  key: string
  label: string
  when: 'siempre' | 'ciclo' | 'fuera'
  redAt3?: boolean // intenso = criterio rojo
  help?: string
}

export const SYMPTOMS: SymptomDef[] = [
  { key: 'fiebre', label: 'Fiebre o escalofríos', when: 'siempre', redAt3: true },
  { key: 'mucositis', label: 'Boca: llagas o dolor al comer', when: 'siempre', redAt3: true, help: 'Leve: le molesta · Moderado: come menos por el dolor · Intenso: no puede comer ni beber' },
  { key: 'piel', label: 'Piel seca, enrojecida o con heridas', when: 'siempre' },
  { key: 'cabello', label: 'Caída del cabello / cuero cabelludo molesto', when: 'siempre' },
  { key: 'sangrado', label: 'Sangrado o hematomas', when: 'siempre', redAt3: true, help: 'Intenso: no cede o hematomas extensos' },
  { key: 'hormigueo', label: 'Hormigueos o calambres', when: 'siempre' },
  { key: 'oido', label: 'Oye peor o pitidos', when: 'siempre' },
  { key: 'disnea', label: 'Dificultad para respirar o dolor en el pecho', when: 'siempre', redAt3: true },
  { key: 'flemas', label: 'Flemas', when: 'siempre', help: 'Leve: alguna vez al día · Moderado: le cuesta echarlas · Intenso: constantes o le dificultan respirar' },
  { key: 'somnolencia', label: 'Somnolencia o confusión inusual', when: 'siempre', redAt3: true },
  { key: 'mareo', label: 'Mareo o inestabilidad', when: 'siempre', help: 'Leve: se marea al levantarse · Moderado: necesita sentarse o apoyarse · Intenso: no se sostiene o se ha desmayado', redAt3: true },
  { key: 'nauseas', label: 'Náuseas', when: 'siempre', help: 'Leve: lo dice pero come · Moderado: come menos por las náuseas · Intenso: no puede comer' },
  { key: 'vomitos', label: 'Vómitos', when: 'ciclo', redAt3: true, help: 'Intenso: no retiene líquidos' },
  { key: 'distension', label: 'Plenitud o tripa hinchada', when: 'ciclo' },
  { key: 'estrenimiento', label: 'Estreñimiento', when: 'ciclo' },
  { key: 'reaccion_infusion', label: 'Reacción en el brazo / picor durante la perfusión', when: 'ciclo' },
  { key: 'apetito', label: 'Menos apetito que la semana pasada', when: 'fuera' },
  { key: 'infeccion', label: 'Signos de infección (catéter rojo, tos, mocos, dolor al orinar, diarrea)', when: 'fuera', redAt3: true },
  { key: 'energia', label: 'Menos energía que la semana pasada', when: 'fuera' },
  { key: 'sueno_alterado', label: 'Sueño alterado', when: 'fuera' },
]

export const SEVERITY_LABELS = ['No', 'Leve', 'Moderado', 'Intenso'] as const

export interface PreventiveDef {
  key: string
  label: string
  group: string
  when?: 'siempre' | 'nadir' | 'cateter' | 'mtx'
  /** Aclaración corta debajo de la casilla. */
  help?: string
}
export const PREVENTIVE: PreventiveDef[] = [
  { key: 'cepillado', label: 'Cepillado suave (mañana y noche)', group: 'Boca' },
  { key: 'enj_coco', label: 'Enjuague de la mañana con aceite de coco', group: 'Boca' },
  { key: 'enj_lactoferrina', label: 'Enjuague de la noche con agua + lactoferrina', group: 'Boca' },
  { key: 'enj_marromero', label: 'Enjuagues de agua de mar y romero durante el día', group: 'Boca' },
  { key: 'boca_revisada', label: 'Boca revisada (llagas, sangrado)', group: 'Boca' },
  { key: 'emoliente', label: 'Emoliente en la piel (mañana / noche)', group: 'Piel y pelo' },
  { key: 'cuero_cabelludo', label: 'Cuero cabelludo lavado suave / hidratado', group: 'Piel y pelo' },
  { key: 'gorro_sol', label: 'Gorro o protección del sol y del frío', group: 'Piel y pelo' },
  { key: 'aposito', label: 'Apósito íntegro y seco', group: 'Catéter', when: 'cateter' },
  { key: 'zona_cateter', label: 'Zona del catéter sin rojez ni dolor', group: 'Catéter', when: 'cateter' },
  { key: 'no_inmersion', label: 'Sin inmersión (baño completo, piscina)', group: 'Catéter', when: 'cateter' },
  { key: 'cocinado', label: 'Todo cocinado, nada crudo ni sin pasteurizar', group: 'Neutropenia (D7-14)', when: 'nadir' },
  { key: 'sin_aglomeraciones', label: 'Sin aglomeraciones, obras ni tierra removida', group: 'Neutropenia (D7-14)', when: 'nadir' },
  { key: 'temperatura', label: 'Temperatura tomada', group: 'Neutropenia (D7-14)', when: 'nadir' },
  { key: 'manos', label: 'Higiene de manos de todos en casa', group: 'Neutropenia (D7-14)', when: 'nadir' },
  { key: 'liquidos_mtx', label: 'Líquidos abundantes y pH urinario controlado', group: 'Día de metotrexato', when: 'mtx' },
  { key: 'epsom_mtx', label: 'Baño de sales de Epsom', group: 'Día de metotrexato', when: 'mtx', help: 'Agua templada, 15-20 min. Con catéter central: sin sumergir el apósito (de cintura para abajo, o la zona bien tapada y seca). Aclarar al salir.' },
]

export const CARB_HELP: Record<string, { label: string; help: string }> = {
  sin: { label: 'Sin hidratos', help: 'Solo proteína, grasa y verdura de hoja. Ej.: huevos con aguacate; pescado con espinacas; caldo con carne.' },
  baja: { label: 'Baja', help: 'Una ración pequeña de hidrato (≈ ½ puño del niño): algo de fruta, un poco de legumbre, tubérculo pequeño, un yogur.' },
  media: { label: 'Media', help: 'Una ración normal de hidrato (≈ 1 puño): arroz, pasta, patata, pan, fruta entera, legumbre.' },
  alta: { label: 'Alta', help: 'Dos o más raciones, o dulces / zumo / bollería / batidos hipercalóricos azucarados.' },
}
export const FRACTION_LABELS: Record<string, string> = {
  '0': 'Nada', '0.25': '¼', '0.5': '½', '0.75': '¾', '1': 'Todo',
}
export const MEAL_SLOTS: { key: string; label: string; fat?: boolean }[] = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'media_manana', label: 'Media mañana' },
  { key: 'comida', label: 'Comida' },
  { key: 'merienda', label: 'Merienda' },
  { key: 'cena', label: 'Cena' },
  { key: 'snack_grasa_1', label: '5ª · Snack de grasas', fat: true },
  { key: 'snack_grasa_2', label: '6ª · Snack de grasas', fat: true },
  { key: 'otra', label: 'Otra' },
]
/** Comidas que se muestran según el modo de la semana (pauta de la nutricionista, 10-sept-2026). */
export const MEAL_SLOTS_BY_MODE: Record<'quimio' | 'nadir', string[]> = {
  quimio: ['desayuno', 'comida', 'merienda', 'cena'], // 3-4 comidas, lo que tolere
  nadir: ['desayuno', 'media_manana', 'comida', 'merienda', 'cena', 'snack_grasa_1', 'snack_grasa_2'], // 6 comidas; 5ª y 6ª = snacks de grasa
}
export const MEALS_TARGET: Record<'quimio' | 'nadir', { min: number; fatSnacks: number }> = {
  quimio: { min: 3, fatSnacks: 0 },
  nadir: { min: 6, fatSnacks: 2 },
}
export const MODE_LABELS: Record<'quimio' | 'nadir', string> = { quimio: 'Semana de quimio', nadir: 'Semana nadir' }
export const MACRO_OPTS = {
  veg: [{ value: 0, label: 'Nada' }, { value: 1, label: 'Poca' }, { value: 2, label: '≈ ½ plato' }],
  prot: [{ value: 0, label: 'Nada' }, { value: 1, label: 'Poca' }, { value: 2, label: '≈ ⅓ plato' }],
  starch: [{ value: 0, label: 'Nada' }, { value: 1, label: 'Poco' }, { value: 2, label: '≈ ¼ plato' }, { value: 3, label: 'Más de ¼' }],
} as const
export const FAT_EXAMPLES = 'AOVE o sésamo crudo por encima, ghee, tahine, semillas, aceite de coco, huevo, caldo de huesos, proteína de guisante'
/** Objetivos de líquidos orientativos por modo (ml/día). Pendiente de validar con la nutricionista. */
export const FLUID_TARGET: Record<'quimio' | 'nadir', number> = { quimio: 1500, nadir: 1200 }
export const SEAWATER_TARGET_ML = 50 // "chupitos" de agua de mar
export const HYDRATION_TIPS: Record<'quimio' | 'nadir', string[]> = {
  quimio: ['Agua a sorbos frecuentes; en metotrexato, líquidos abundantes y pH de orina controlado', 'Chupitos de agua de mar', 'Manzanilla y jengibre (sin limón): regeneran mucosas', 'Caldo de verduras + huesos como base de los platos'],
  nadir: ['Mantener agua + agua de mar aunque no tenga sed', 'Infusiones de manzanilla / jengibre templadas', 'Caldo de Santa Paciencia (medias tazas) cuenta como líquido', 'Si vomita o hay diarrea: reponer con caldo salado y avisar si no retiene'],
}
export const CUP_ML = 200 // media taza = 200 ml (decisión de la familia)

/** Color de las flemas. Se pregunta solo si se ha marcado el síntoma. */
export const PHLEGM_COLORS: { value: 'transparente' | 'amarillo' | 'verde' | 'rojo'; label: string; swatch: string; alerta?: boolean }[] = [
  { value: 'transparente', label: 'Transparente', swatch: '#eef3f3' },
  { value: 'amarillo', label: 'Amarillo', swatch: '#efd96b' },
  { value: 'verde', label: 'Verde', swatch: '#8ba85f', alerta: true },
  { value: 'rojo', label: 'Rojo (con sangre)', swatch: '#b1412f', alerta: true },
]

export const URINE_COLORS = ['#f7f6ee', '#f6efb8', '#f1df6e', '#e6c53a', '#c9962a', '#9c4a24']
export const URINE_LABELS = ['Transparente', 'Muy claro', 'Amarillo', 'Amarillo oscuro', 'Ámbar', 'Marrón / rojizo']

export const STOOL_COLORS = [
  { key: 'normal', label: 'Normal' },
  { key: 'oscuro', label: 'Muy oscuro / negro' },
  { key: 'sangre', label: 'Con sangre' },
  { key: 'palido', label: 'Pálido' },
  { key: 'verdoso', label: 'Verdoso' },
]
export const BRISTOL_HELP = ['', 'Bolas duras separadas (estreñimiento)', 'Salchicha grumosa', 'Salchicha con grietas', 'Salchicha lisa y blanda (ideal)', 'Trozos blandos con bordes definidos', 'Pastosa, bordes irregulares', 'Líquida, sin trozos (diarrea)']

export const FATIGUE_LABELS = ['Juega normal', 'Algo cansado', 'Descansa más de lo normal', 'Casi todo el día tumbado', 'No se levanta']
export const MOOD_FACES = ['😢', '😟', '😐', '🙂', '😄']

export const ACTIVITIES = [
  { key: 'paseo', label: 'Paseo' },
  { key: 'juego', label: 'Juego activo' },
  { key: 'fisio', label: 'Fisioterapia' },
  { key: 'fuerza', label: 'Fuerza' },
  { key: 'aerobico', label: 'Aeróbico' },
  { key: 'cama', label: 'Movilización en cama' },
]
export const WAKEUP_CAUSES = ['Dolor', 'Náusea', 'Pipí', 'Ruido o controles', 'Miedo o nervios', 'Otra']
export const SYNC_ITEMS: { key: 'ir_morning' | 'ir_night' | 'glasses' | 'daylight_morning' | 'daylight_afternoon' | 'sun_exposure'; label: string; minutes?: boolean }[] = [
  { key: 'daylight_morning', label: 'Luz natural por la mañana', minutes: true },
  { key: 'ir_morning', label: 'Luz infrarroja / roja por la mañana', minutes: true },
  { key: 'daylight_afternoon', label: 'Luz natural por la tarde', minutes: true },
  { key: 'sun_exposure', label: 'Exposición solar con cuidado', minutes: true },
  { key: 'ir_night', label: 'Luz infrarroja / roja por la noche', minutes: true },
  { key: 'glasses', label: 'Gafas de bloqueo de luz azul (desde)' },
]

/** Signos y síntomas a vigilar según el diagnóstico (se rellenan solos al escribir el nombre; se pueden editar).
 *  Fuentes: fichas de oncología pediátrica (SIOP/ SEHOP), guías de neutropenia febril y de catéter central. */
export const DX_SIGNS: { match: RegExp; signs: string[] }[] = [
  { match: /osteosarcoma|tumor óseo|sarcoma/i, signs: ['Dolor en la zona del tumor que aumenta o despierta por la noche', 'Hinchazón o calor local', 'Dificultad para apoyar o mover el miembro', 'Fiebre sin foco'] },
  { match: /met[aá]stasis pulmonar|pulm[oó]n|n[oó]dulo pulmonar/i, signs: ['Tos nueva o persistente', 'Dificultad para respirar o respiración rápida', 'Dolor en el pecho o al respirar', 'Sangre al toser'] },
  { match: /neutropenia|neutrop[eé]nico/i, signs: ['Temperatura ≥ 38 °C (o 37,5 °C repetida)', 'Escalofríos o tiritona', 'Decaimiento brusco', 'Rojez o dolor en catéter, boca, ano o piel'] },
  { match: /mucositis|llagas|estomatitis/i, signs: ['Dolor al tragar', 'Bebe menos de lo habitual', 'Babea o no quiere abrir la boca', 'Sangrado de encías'] },
  { match: /infecci[oó]n.*cat[eé]ter|cat[eé]ter.*infecci|bacteriemia|sepsis/i, signs: ['Fiebre o escalofríos al lavar el catéter', 'Rojez, calor o pus en el punto de salida', 'Dolor en el trayecto del catéter', 'Tensión baja, mareo, palidez'] },
  { match: /trombosis|tromb[oó]tico|coágulo/i, signs: ['Hinchazón de un brazo, cuello o cara', 'Dolor o venas marcadas en el brazo del catéter', 'Dificultad para respirar súbita'] },
  { match: /anemia/i, signs: ['Palidez de piel o labios', 'Cansancio mayor de lo habitual', 'Latido rápido, mareo al levantarse', 'Dolor de cabeza'] },
  { match: /trombopenia|trombocitopenia|plaquetas bajas/i, signs: ['Hematomas o petequias (puntitos rojos)', 'Sangrado de nariz o encías que no cede', 'Sangre en orina o heces'] },
  { match: /cardio|fevi|miocardio|antraciclina/i, signs: ['Cansancio al esfuerzo que antes toleraba', 'Respiración rápida o tos al tumbarse', 'Hinchazón de pies o párpados'] },
  { match: /ototox|audici[oó]n|hipoacusia/i, signs: ['Pide que le repitan o sube el volumen', 'Pitidos en los oídos', 'Mareo o inestabilidad'] },
  { match: /renal|ri[ñn][oó]n|nefro|tubulopat/i, signs: ['Orina menos de lo habitual', 'Hinchazón de párpados o piernas', 'Calambres o temblor (magnesio, potasio)', 'Orina espumosa o rojiza'] },
  { match: /hep[aá]t|h[ií]gado|transaminasas/i, signs: ['Piel u ojos amarillentos', 'Orina muy oscura o heces pálidas', 'Dolor en el lado derecho de la tripa', 'Picor generalizado'] },
  { match: /neuropat|hormigueo|vincristina|cisplatino/i, signs: ['Hormigueos o acorchamiento en manos y pies', 'Se tropieza o le cuesta abrochar botones', 'Estreñimiento marcado', 'Dolor mandibular'] },
  { match: /gastro|diarrea|colitis|enteritis/i, signs: ['Más de 3 deposiciones líquidas al día', 'Sangre o moco en las heces', 'Dolor de tripa con fiebre', 'Bebe poco y orina poco (deshidratación)'] },
  { match: /desnutric|caquexia|p[eé]rdida de peso/i, signs: ['Pérdida de peso en dos pesadas seguidas', 'Come menos de la mitad dos días seguidos', 'Menos fuerza o actividad', 'Edemas en piernas'] },
  { match: /fractura|fractura patol/i, signs: ['Dolor brusco en el hueso afectado', 'No puede apoyar', 'Deformidad o hinchazón nueva'] },
  { match: /varicela|herpes|z[oó]ster/i, signs: ['Vesículas (ampollitas) nuevas en piel', 'Fiebre', 'Dolor o quemazón en una zona de piel antes de la erupción'] },
  { match: /covid|gripe|virus respiratorio|vrs|bronquiolitis/i, signs: ['Fiebre', 'Tos, mocos, dolor de garganta', 'Respiración rápida o con esfuerzo', 'Rechazo de líquidos'] },
]
export function suggestSigns(name: string): string[] {
  const out: string[] = []
  for (const d of DX_SIGNS) if (d.match.test(name)) for (const s of d.signs) if (!out.includes(s)) out.push(s)
  return out
}
export const DX_SIGNS_GENERIC = ['Fiebre ≥ 38 °C', 'Decaimiento o somnolencia inusual', 'Dolor nuevo o que aumenta']
export const ROUTE_LABELS: Record<string, string> = { oral: 'Oral', sc: 'Subcutánea', im: 'Intramuscular', iv: 'Endovenoso' }
export const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const NAUSEA_LABELS = ['Sin náusea', 'Leve', 'Moderada', 'Intensa']
export const WEIGHT_SOURCES: { value: 'inbody' | 'hospital' | 'casa'; label: string }[] = [
  { value: 'inbody', label: 'Báscula InBody' }, { value: 'hospital', label: 'Hospital Gregorio Marañón' }, { value: 'casa', label: 'Báscula de casa' },
]

export const EMOTIONS = [
  { key: 'alegria', label: 'Alegría', emoji: '😄' },
  { key: 'calma', label: 'Calma', emoji: '😌' },
  { key: 'miedo', label: 'Miedo', emoji: '😨' },
  { key: 'nervios', label: 'Nervios / ansiedad', emoji: '😰' },
  { key: 'tristeza', label: 'Tristeza', emoji: '😢' },
  { key: 'enfado', label: 'Enfado', emoji: '😠' },
  { key: 'aburrimiento', label: 'Aburrimiento', emoji: '😑' },
  { key: 'verguenza', label: 'Vergüenza', emoji: '😳' },
]

export const ZARIT7 = [
  '¿Sientes que no tienes tiempo suficiente para ti?',
  '¿Te sientes agobiada por compaginar el cuidado con el resto de responsabilidades?',
  '¿Sientes que el cuidado ha afectado a tu salud?',
  '¿Sientes que ha afectado a tu relación con otras personas?',
  '¿Te sientes incómoda por haberte distanciado de amistades?',
  '¿Sientes que has perdido el control de tu vida?',
  'En conjunto, ¿cómo de sobrecargada te sientes?',
]
export const ZARIT_SCALE = ['Nunca', 'Rara vez', 'A veces', 'Bastante', 'Casi siempre']
export const ZARIT_CUTOFF = 17

export const LOCATIONS: { value: 'casa' | 'ingreso' | 'hospital_dia' | 'urgencias'; label: string; short: string; emoji: string }[] = [
  { value: 'casa', label: 'Casa', short: 'En casa', emoji: '🏠' },
  { value: 'ingreso', label: 'Ingreso', short: 'Ingresado', emoji: '🏥' },
  { value: 'hospital_dia', label: 'Hospital de día', short: 'Hospital de día', emoji: '💉' },
  { value: 'urgencias', label: 'Urgencias', short: 'En urgencias', emoji: '🚑' },
]

/** Anexo 2 del protocolo ISG-GEIS-OS-2, pacientes ABCB1/P-glicoproteína negativos: 34 semanas. */
export const PROTOCOL_34: { week: number; label: string }[] = [
  { week: 0, label: 'MTX' }, { week: 1, label: 'CDP + ADM' }, { week: 4, label: 'MTX' }, { week: 5, label: 'CDP + ADM' },
  { week: 8, label: 'Cirugía' }, { week: 9, label: 'ADM*' }, { week: 12, label: 'MTX' }, { week: 13, label: 'MTX' },
  { week: 14, label: 'CDP' }, { week: 17, label: 'ADM*' }, { week: 20, label: 'MTX' }, { week: 21, label: 'MTX' },
  { week: 22, label: 'CDP' }, { week: 25, label: 'ADM*' }, { week: 28, label: 'MTX' }, { week: 29, label: 'MTX' },
  { week: 30, label: 'CDP' }, { week: 33, label: 'MTX' }, { week: 34, label: 'MTX' },
]
export const PROTOCOL_WEEKS = 34

export const VITAL_SLOTS: { key: 'manana' | 'tarde' | 'noche'; label: string }[] = [
  { key: 'manana', label: 'Mañana' }, { key: 'tarde', label: 'Tarde' }, { key: 'noche', label: 'Noche' },
]

export const DRUG_LABELS: Record<string, string> = {
  MTX: 'Metotrexato', CDDP: 'Cisplatino', ADM: 'Doxorrubicina (adriamicina)', HDIFO: 'Ifosfamida', MTP: 'Mifamurtida', OTRO: 'Otro',
}
export const DRUG_WATCH: Record<string, string[]> = {
  MTX: ['pH urinario por micción (objetivo > 7)', 'Volumen de orina / balance', 'Líquidos tomados', 'Folinato: inicio, dosis y fin', 'Niveles de MTX 24/48/72 h'],
  CDDP: ['Diuresis', 'Náusea y vómitos', 'Oye peor o pitidos', 'Calambres o temblor (magnesio)'],
  ADM: ['Orina rojiza (esperable, avisar a la familia)', 'Boca D5-10', 'Control de FEVI pendiente'],
  HDIFO: ['Sangre en la orina', 'Confusión o somnolencia inusual', 'Mesna administrada'],
  MTP: ['Fiebre / escalofríos tras la infusión', 'Cefalea, dolores musculares'],
  OTRO: [],
}
export const TRAFFIC_LABELS: Record<string, string> = { verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo' }
export const BLOCK_LABELS: Record<string, string> = {
  hospital: 'Medicación del hospital',
  sup_ciclo: 'Suplementación en ciclo',
  sup_fuera: 'Suplementación fuera de ciclo',
  alopatico: 'Medicamentos (registro anterior)', // ya no se ofrece: la medicación entre ciclos va en Ciclos
}
export const BLOCK_HELP: Record<string, string> = {
  hospital: 'Pautada por oncología del hospital (informe de alta o consulta). Solo la cambia o la suspende el equipo del hospital.',
  sup_ciclo: 'Se mantiene también los días de quimio e ingreso.',
  sup_fuera: 'Se pausa los días de quimio e ingreso y se retoma al alta (o cuando se indique).',
}
/** Semáforo por defecto al elegir el bloque de un producto nuevo (se puede cambiar). */
export const BLOCK_DEFAULT_TRAFFIC: Record<string, Record<string, 'verde' | 'ambar' | 'rojo'>> = {
  hospital: { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'verde' },
  sup_ciclo: { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'verde' },
  sup_fuera: { mtx: 'rojo', cddp_adm: 'rojo', nadir: 'ambar', infusion: 'rojo' },
}
export const MOMENTS: { key: string; label: string }[] = [
  { key: 'ayunas', label: 'Ayunas' },
  { key: 'manana', label: 'Mañana' },
  { key: 'media_manana', label: 'Media mañana' },
  { key: 'comida', label: 'Comida' },
  { key: 'media_tarde', label: 'Media tarde' },
  { key: 'cena', label: 'Cena' },
  { key: 'dormir', label: 'Antes de dormir' },
]
/** Quién pauta (desplegable). "Otro" permite escribirlo a mano. */
export const PRESCRIBERS = ['Oncología del hospital', 'Oncóloga integrativa', 'Oncólogo', 'Digestivo', 'Nutricionista'] as const
export const OUTCOME_LABELS: Record<string, { label: string; tag: string }> = {
  funciono: { label: 'Funcionó', tag: 'verde' },
  parcial: { label: 'Funcionó en parte', tag: 'ambar' },
  no_funciono: { label: 'No funcionó / no lo toleró', tag: 'rojo' },
  no_se: { label: 'No se sabe', tag: 'gray' },
}
/** Productos que exigen consulta antes de añadirse. */
export const CONSULT_FIRST = ['ibuprofeno', 'aine', 'naproxeno', 'aspirina', 'omeprazol', 'ibp', 'pantoprazol', 'fólico', 'folico', 'hierro', 'floradix', 'ginseng', 'curcumina', 'cúrcuma', 'vitamina e', 'hipérico', 'hierba de san juan']
export const ANTICOAG_KEYWORDS = ['heparina', 'enoxaparina', 'clexane', 'hibor', 'bemiparina', 'acenocumarol', 'sintrom', 'rivaroxaban', 'apixaban', 'dabigatran', 'anticoagulante']
export const ANTIPLATELET_SUPP = ['omega', 'dha', 'epa', 'curcumina', 'cúrcuma', 'reishi', 'cordyceps', 'vitamina e', 'ginkgo', 'ajo', 'jengibre', 'ginseng', 'nattokinasa']

export interface AnalyteDef {
  key: string
  label: string
  unit: string
  group: string
}
export const ANALYTES: AnalyteDef[] = [
  { key: 'leucocitos', label: 'Leucocitos', unit: '×10³/µL', group: 'Recuperación medular' },
  { key: 'neutrofilos', label: 'Neutrófilos absolutos', unit: '×10³/µL', group: 'Recuperación medular' },
  { key: 'linfocitos', label: 'Linfocitos absolutos', unit: '×10³/µL', group: 'Recuperación medular' },
  { key: 'plaquetas', label: 'Plaquetas', unit: '×10³/µL', group: 'Recuperación medular' },
  { key: 'hemoglobina', label: 'Hemoglobina', unit: 'g/dL', group: 'Recuperación medular' },
  { key: 'creatinina', label: 'Creatinina', unit: 'mg/dL', group: 'Renal' },
  { key: 'urea', label: 'Urea', unit: 'mg/dL', group: 'Renal' },
  { key: 'sodio', label: 'Sodio', unit: 'mmol/L', group: 'Renal' },
  { key: 'potasio', label: 'Potasio', unit: 'mmol/L', group: 'Renal' },
  { key: 'magnesio', label: 'Magnesio', unit: 'mg/dL', group: 'Renal' },
  { key: 'calcio', label: 'Calcio', unit: 'mg/dL', group: 'Renal' },
  { key: 'fosforo', label: 'Fósforo', unit: 'mg/dL', group: 'Renal' },
  { key: 'ast', label: 'AST (GOT)', unit: 'U/L', group: 'Hepático' },
  { key: 'alt', label: 'ALT (GPT)', unit: 'U/L', group: 'Hepático' },
  { key: 'bilirrubina', label: 'Bilirrubina total', unit: 'mg/dL', group: 'Hepático' },
  { key: 'pcr', label: 'PCR', unit: 'mg/L', group: 'Inflamación / redox' },
  { key: 'ferritina', label: 'Ferritina', unit: 'ng/mL', group: 'Inflamación / redox' },
  { key: 'albumina', label: 'Albúmina', unit: 'g/dL', group: 'Inflamación / redox' },
  { key: 'prealbumina', label: 'Prealbúmina', unit: 'mg/dL', group: 'Inflamación / redox' },
  { key: 'glucosa', label: 'Glucosa', unit: 'mg/dL', group: 'Metabólico' },
  { key: 'insulina', label: 'Insulina', unit: 'µU/mL', group: 'Metabólico' },
  { key: 'hba1c', label: 'HbA1c', unit: '%', group: 'Metabólico' },
  { key: 'vitd', label: 'Vitamina D (25-OH)', unit: 'ng/mL', group: 'Micronutrientes' },
  { key: 'zinc', label: 'Zinc', unit: 'µg/dL', group: 'Micronutrientes' },
  { key: 'b12', label: 'Vitamina B12', unit: 'pg/mL', group: 'Micronutrientes' },
  { key: 'folato', label: 'Folato', unit: 'ng/mL', group: 'Micronutrientes' },
  { key: 'hierro', label: 'Hierro', unit: 'µg/dL', group: 'Micronutrientes' },
  { key: 'saturacion', label: 'Índice de saturación de transferrina', unit: '%', group: 'Micronutrientes' },
  { key: 'fa', label: 'Fosfatasa alcalina', unit: 'U/L', group: 'Marcadores tumorales indirectos' },
  { key: 'ldh', label: 'LDH', unit: 'U/L', group: 'Marcadores tumorales indirectos' },
  { key: 'mtx', label: 'Metotrexato sérico', unit: 'µmol/L', group: 'Tratamiento' },
  { key: 'ph_orina', label: 'pH urinario', unit: '', group: 'Tratamiento' },
]

export { PROFESSIONALS } from '../store/types'
export const PILLARS = [
  'Diagnósticos', 'Tratamiento', 'Registro diario', 'Preventivos', 'Medicación', 'Nutrición',
  'Ejercicio', 'Microbiota', 'Biohacking', 'Analíticas', 'Emocional', 'Otro',
]
export const EVENT_TYPES: { key: string; label: string }[] = [
  { key: 'ingreso', label: 'Ingreso' },
  { key: 'hospital_dia', label: 'Hospital de día' },
  { key: 'consulta', label: 'Consulta' },
  { key: 'prueba', label: 'Prueba' },
  { key: 'extraccion', label: 'Extracción / analítica' },
  { key: 'resultado', label: 'Resultado esperado' },
  { key: 'mifamurtida', label: 'Mifamurtida' },
  { key: 'cura_cateter', label: 'Cura del catéter' },
  { key: 'cita_equipo', label: 'Cita con el equipo' },
  { key: 'fisio', label: 'Fisioterapia' },
  { key: 'otro', label: 'Otro' },
]
