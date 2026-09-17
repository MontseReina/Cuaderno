import type { Product } from '../store/types'

/** Lista actual de la familia (hoja "TRATAMIENTO AGOSTO 26" + semáforo v2 de suplementación por ventanas).
 *  Los semáforos son la propuesta razonada llevada a la oncóloga, no indicación médica. */
type Seed = Omit<Product, 'id' | 'patient_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'>
const s = (name: string, block: Product['block'], moments: Product['moments'], dose: string, traffic: Product['traffic'], traffic_reason: string, prescribed_by = ''): Seed => ({
  name, block, moments, dose, traffic, traffic_reason, prescribed_by, start_date: '2026-08-26',
})

export const SEED_PRODUCTS: Seed[] = [
  s('L-Carnitina', 'sup_fuera', ['manana', 'comida'], '1 + 1', { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'verde' }, 'Sin interacción relevante; datos preliminares de cardioprotección'),
  s('Micelinone Plus (hongos + adaptógenos)', 'sup_fuera', ['manana'], '1', { mtx: 'ambar', cddp_adm: 'ambar', nadir: 'ambar', infusion: 'ambar' }, 'Betaglucanos vs. mifamurtida; reishi/cordyceps antiagregantes; astrágalo/rodiola modulan P-gp y CYP3A4. Falta etiqueta con especies y dosis'),
  s('Lactoferrina', 'sup_fuera', ['manana'], '1', { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'verde' }, 'Sin folato ni antioxidantes a dosis alta'),
  s('Floradix', 'sup_fuera', ['cena'], '2', { mtx: 'rojo', cddp_adm: 'rojo', nadir: 'rojo', infusion: 'rojo' }, 'Hierro + vitaminas B (posible fólico → antagoniza MTX); hierro libre + antraciclina = cardiotoxicidad. No reanudar sin ferritina e índice de saturación'),
  s('DHA', 'sup_fuera', ['manana', 'cena'], '1 + 1', { mtx: 'verde', cddp_adm: 'verde', nadir: 'ambar', infusion: 'verde' }, 'Autorizado por oncología. Vigilar sangrado en el nadir plaquetario', 'Oncología'),
  s('Pure Omega Curcumine', 'sup_fuera', ['manana', 'cena'], '1 + 1', { mtx: 'rojo', cddp_adm: 'rojo', nadir: 'rojo', infusion: 'rojo' }, 'Curcumina (P-gp/CYP3A4) + omega-3 antiagregante'),
  s('CN Base', 'sup_fuera', ['cena'], '1', { mtx: 'rojo', cddp_adm: 'ambar', nadir: 'verde', infusion: 'rojo' }, 'Álcali y minerales no contabilizados; el pH urinario > 7 es objetivo pautado en MTX'),
  s('Symbiolact', 'sup_fuera', ['ayunas'], '1', { mtx: 'ambar', cddp_adm: 'ambar', nadir: 'rojo', infusion: 'ambar' }, 'Bacterias vivas con catéter central; riesgo real en el nadir (D7-14). Decisión del equipo'),
  s('Buti D', 'sup_fuera', ['comida'], '2', { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'verde' }, 'Butirato + vit. D. Verificar que no lleve folato ni antioxidantes'),
  s('Magnesio', 'sup_fuera', ['dormir'], '2', { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'ambar' }, 'Autorizado por oncología. El día de cisplatino va también IV: avisar para el balance', 'Oncología'),
  s('Cronobiane (melatonina LP)', 'sup_fuera', ['cena'], '2 antes de cenar', { mtx: 'ambar', cddp_adm: 'ambar', nadir: 'verde', infusion: 'ambar' }, 'Duda abierta: captación de radicales libres frente a ADM/CDDP; 1,9 mg es dosis de adulto'),
  s('Carcinosinum', 'sup_fuera', ['ayunas'], '2', { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'verde' }, 'Dilución homeopática, sin interacción farmacológica'),
  s('Nux vomica + Arsenicum', 'sup_fuera', ['ayunas'], '2 + 2', { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'verde' }, 'Dilución homeopática'),
  s('Ginseng (Bilnag)', 'sup_fuera', ['manana', 'comida'], '1 + 1', { mtx: 'rojo', cddp_adm: 'rojo', nadir: 'rojo', infusion: 'rojo' }, 'P-gp/CYP3A4, antiagregante, 20 mg vit. E, no recomendado en < 18 años (EMA). Propuesta: suspender durante todo el tratamiento activo'),
  s('Oil pulling (aceite de coco)', 'sup_fuera', ['ayunas'], '1 enjuague', { mtx: 'verde', cddp_adm: 'verde', nadir: 'verde', infusion: 'verde' }, 'Enjuague; suspender con mucositis o sangrado gingival'),
  s('Enjuague lactoferrina + melatonina + probiótico', 'sup_fuera', ['dormir'], '1 (enjuagar y tragar)', { mtx: 'ambar', cddp_adm: 'ambar', nadir: 'ambar', infusion: 'ambar' }, 'Se traga: hereda las dudas de Cronobiane y Symbiolact'),
]
