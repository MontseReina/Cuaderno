import { useCallback, useEffect, useRef, useState } from 'react'
import { currentPatientId, save, useRows } from './index'
import type { DailyLog } from './types'
import { useToast } from '../components/ui'

export const emptyLog = (date: string): DailyLog =>
  ({ date, symptoms: {}, preventive: {}, meals: [], activity: {}, extra: {} }) as unknown as DailyLog

type Extra = NonNullable<DailyLog['extra']>
const META = new Set(['id', 'patient_id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at'])
/** Contenido del registro sin los metadatos, para saber si dos versiones son iguales. */
function contenido(l: DailyLog) {
  const o: Record<string, unknown> = {}
  for (const k of Object.keys(l).sort()) if (!META.has(k)) o[k] = (l as unknown as Record<string, unknown>)[k]
  return JSON.stringify(o)
}

/** Borrador del registro diario de una fecha con autoguardado (800 ms tras el último cambio).
 *  Lo comparten Diario, Nutrición, Hidratación y Biohacking: todos escriben en la misma fila.
 *
 *  Dos protecciones contra pérdida de datos:
 *  1. El «sucio» solo se limpia si no ha habido cambios nuevos mientras se guardaba (si no, el eco
 *     del servidor podía pisar un cambio hecho durante el guardado: así se perdía un segundo vómito).
 *  2. Al guardar se parte de la última versión del servidor y se aplican solo los campos tocados en
 *     este dispositivo, para que dos móviles editando el mismo día no se borren datos entre sí. */
export function useDailyDraft(date: string) {
  const logs = useRows('daily_logs')
  const existing = logs.find((l) => l.date === date)
  const [draft, setDraft] = useState<DailyLog>(() => ({ ...emptyLog(date), ...(existing ?? {}) }))
  const { toast, node } = useToast()
  const dirty = useRef(false)
  const ver = useRef(0) // sube con cada cambio local
  const touched = useRef<Set<string>>(new Set()) // campos cambiados aquí desde el último guardado
  const touchedExtra = useRef<Set<string>>(new Set())
  const latest = useRef(existing)
  latest.current = existing

  // Sincronizar con lo que llega del servidor (otro dispositivo) solo si aquí no hay nada a medio escribir
  // y si de verdad ha cambiado el contenido (el eco de nuestro propio guardado no cuenta).
  useEffect(() => {
    if (dirty.current) return
    setDraft((d) => {
      const next = { ...emptyLog(date), ...(existing ?? {}) }
      return d.date === date && existing && contenido(d) === contenido(next) ? { ...d, ...existing } : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id, existing?.updated_at])

  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(async () => {
      const v = ver.current
      // Partir de la última versión conocida y aplicar solo lo tocado aquí.
      const base = latest.current && latest.current.id === draft.id ? latest.current : draft
      const row: DailyLog = { ...base, id: draft.id ?? base.id, patient_id: currentPatientId(), date } as DailyLog
      const dr = draft as unknown as Record<string, unknown>
      const rw = row as unknown as Record<string, unknown>
      for (const k of touched.current) rw[k] = dr[k]
      if (touchedExtra.current.size) {
        const ex: Record<string, unknown> = { ...((base.extra ?? {}) as Record<string, unknown>) }
        const dx = (draft.extra ?? {}) as Record<string, unknown>
        for (const k of touchedExtra.current) ex[k] = dx[k]
        row.extra = ex as Extra
      }
      const saved = await save('daily_logs', row)
      if (ver.current === v) {
        // Nada nuevo mientras se guardaba: el borrador pasa a ser exactamente lo guardado.
        dirty.current = false
        touched.current.clear()
        touchedExtra.current.clear()
        setDraft(saved)
      } else if (!draft.id) {
        setDraft((d) => ({ ...d, id: saved.id }))
      }
      toast('Guardado')
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const set = useCallback(<K extends keyof DailyLog>(k: K, v: DailyLog[K]) => {
    dirty.current = true
    ver.current++
    touched.current.add(k as string)
    setDraft((d) => ({ ...d, [k]: v }))
  }, [])
  const setExtra = useCallback((patch: Partial<Extra>) => {
    dirty.current = true
    ver.current++
    for (const k of Object.keys(patch)) touchedExtra.current.add(k)
    setDraft((d) => ({ ...d, extra: { ...(d.extra ?? {}), ...patch } }))
  }, [])

  return { draft, set, setExtra, logs, toastNode: node }
}
