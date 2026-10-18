import { todayStr } from './dates'

/** 0.34.0 · Cierre del día a las 00:00 (Montserrate, 18/10/2026): lo que no se ha rellenado antes de medianoche cuenta
 *  como «no dado / no realizado» y el día ya no se puede cambiar. El aviso de las 21 h lo recuerda. */
export const diaCerrado = (date: string) => date < todayStr()
export const MSG_DIA_CERRADO = 'Día cerrado: lo que no se rellenó antes de las 00:00 cuenta como no hecho y ya no se puede cambiar.'
/** Tablas del registro diario que se cierran a medianoche (las que llevan `date`). */
export const TABLAS_DEL_DIA = ['daily_logs', 'intakes'] as const
