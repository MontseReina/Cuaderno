import { useEffect, useMemo, useState } from 'react'
import { LocalBackend } from './local'
import { SupabaseBackend } from './supabase'
import { nowIso, uid, type Backend, type Row } from './store'
import type { BaseRow, TableName } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const backend: Backend = url && key ? new SupabaseBackend(url, key) : new LocalBackend()
export const isDemo = backend.mode === 'demo'

/** Re-renderiza el componente cuando cambia cualquier dato. */
export function useStoreVersion() {
  const [, setV] = useState(0)
  useEffect(() => backend.subscribe(() => setV((v) => v + 1)), [])
}

/** Filas de una tabla (ya filtradas por paciente actual cuando aplica). */
export function useRows<T extends TableName>(table: T, filter?: (r: Row<T>) => boolean): Row<T>[] {
  useStoreVersion()
  const rows = backend.all(table)
  return useMemo(() => (filter ? rows.filter(filter) : rows), [rows, filter])
}

/** Guarda una fila nueva o modificada, rellenando los metadatos comunes. */
export async function save<T extends TableName>(
  table: T,
  row: Partial<Row<T>> & { id?: string },
): Promise<Row<T>> {
  const now = nowIso()
  const me = backend.currentUserId()
  const existing = row.id ? backend.all(table).find((r) => r.id === row.id) : undefined
  const full = {
    ...(existing ?? {}),
    ...row,
    id: row.id ?? uid(),
    created_at: (existing as BaseRow | undefined)?.created_at ?? now,
    created_by: (existing as BaseRow | undefined)?.created_by ?? me,
    updated_at: now,
    updated_by: me,
  } as Row<T>
  await backend.upsert(table, full)
  return full
}

export async function remove<T extends TableName>(table: T, id: string) {
  await backend.softDelete(table, id)
}

export function currentPatientId(): string {
  const p = backend.all('patients')[0]
  return p?.id ?? ''
}
