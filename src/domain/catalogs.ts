// Catálogos de la app (v4). Todos los textos en lenguaje llano para cuidadores.

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
  { key: 'somnolencia', label: 'Somnolencia o confusión inusual', when: 'siempre', redAt3: true },
  { key: 'nauseas', label: 'Náuseas', when: 'ciclo' },
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
  { key: 'nada_rectal', label: 'Nada por vía rectal (termómetro, supositorios)', group: 'Siempre' },
  { key: 'sin_farmacos_nuevos', label: 'Ningún fármaco nuevo sin consultar (AINE, IBP…)', group: 'Siempre' },
  { key: 'miembro', label: 'Miembro afectado protegido / sin caídas', group: 'Siempre' },
  { key: 'ojos_nariz', label: 'Higiene ocular y nasal si hay sequedad', group: 'Siempre' },
  { key: 'antitrombotico', label: 'Medidas antitrombóticas indicadas por el equipo (movilizar, medias, medicación)', group: 'Si lo indica el equipo' },
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
export const MEAL_SLOTS: { key: string; label: string }[] = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'media_manana', label: 'Media mañana' },
  { key: 'comida', label: 'Comida' },
  { key: 'merienda', label: 'Merienda' },
  { key: 'cena', label: 'Cena' },
  { key: 'otra', label: 'Otra' },
]
export const CUP_ML = 200 // media taza = 200 ml (decisión de la familia)

export const URINE_COLORS = ['#f7f6ee', '#f6efb8', '#f1df6e', '#e6c53a', '#c9962a', '#9c4a24']
export const URINE_LABELS = ['Transparente', 'Muy claro', 'Amarillo', 'Amarillo oscuro', 'Ámbar', 'Marrón / rojizo']

export const STOOL_COLORS = [
  { key: 'normal', label: 'Normal' },
  { key: 'oscuro', label: 'Muy oscuro / negro' },
  { key: 'sangre', label: 'Con sangre' },
  { key: 'palido', label: 'Pálido' },
  { key: 'verdoso', label: 'Verdoso' },
]
export const BRISTOL_HELP = ['', 'Bolas duras', 'Salchicha grumosa', 'Salchicha con grietas', 'Salchicha lisa', 'Trozos blandos', 'Pastosa', 'Líquida']

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
  alopatico: 'Medicamentos pautados (medicina tradicional)',
  sup_ciclo: 'Suplementación en ciclo',
  sup_fuera: 'Suplementación fuera de ciclo',
}
export const MOMENTS: { key: string; label: string }[] = [
  { key: 'ayunas', label: 'Ayunas' },
  { key: 'manana', label: 'Mañana' },
  { key: 'comida', label: 'Comida' },
  { key: 'cena', label: 'Cena' },
  { key: 'dormir', label: 'Antes de dormir' },
]
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
