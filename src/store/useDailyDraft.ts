import { useCallback, useEffect, useRef, useState } from 'react'
import { currentPatientId, save, useRows } from './index'
import type { DailyLog } from './types'
import { useToast } from '../components/ui'

export const emptyLog = (date: string): DailyLog =>
  ({ date, symptoms: {}, preventive: {}, meals: [], activity: {}, extra: {} }) as unknown as DailyLog

/** Borrador del registro diario de una fecha con autoguardado (800 ms tras el último cambio).
 *  Lo comparten Diario, Nutrición, Hidratación y Biohacking: todos escriben en la misma fila. */
export function useDailyDraft(date: string) {
  const logs = useRows('daily_logs')
  const existing = logs.find((l) => l.date === date)
  const [draft, setDraft] = useState<DailyLog>(() => ({ ...emptyLog(date), ...(existing ?? {}) }))
  const { toast, node } = useToast()
  const dirty = useRef(false)

  useEffect(() => {
    if (dirty.current) return // no pisar lo que se está escribiendo
    setDraft({ ...emptyLog(date), ...(existing ?? {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id, existing?.updated_at])

  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(async () => {
      const saved = await save('daily_logs', { ...draft, patient_id: currentPatientId(), date })
      if (!draft.id) setDraft((d) => ({ ...d, id: saved.id }))
      dirty.current = false
      toast('Guardado')
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const set = useCallback(<K extends keyof DailyLog>(k: K, v: DailyLog[K]) => {
    dirty.current = true
    setDraft((d) => ({ ...d, [k]: v }))
  }, [])
  const setExtra = useCallback((patch: Partial<NonNullable<DailyLog['extra']>>) => {
    dirty.current = true
    setDraft((d) => ({ ...d, extra: { ...(d.extra ?? {}), ...patch } }))
  }, [])

  return { draft, set, setExtra, logs, toastNode: node }
}
