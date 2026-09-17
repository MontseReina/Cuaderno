import type { TableName, Tables } from './types'
import { TABLE_NAMES } from './types'

export type Row<T extends TableName> = Tables[T]
export type Listener = () => void

/** Contrato común para el almacenamiento local (demo) y Supabase. */
export interface Backend {
  readonly mode: 'demo' | 'supabase'
  init(): Promise<void>
  all<T extends TableName>(table: T): Row<T>[]
  upsert<T extends TableName>(table: T, row: Row<T>): Promise<void>
  softDelete<T extends TableName>(table: T, id: string): Promise<void>
  subscribe(fn: Listener): () => void
  currentUserId(): string
  currentUserName(): string
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
export const nowIso = () => new Date().toISOString()

/** Caché en memoria + notificación de cambios; la usan ambos backends. */
export class Cache {
  data: { [K in TableName]: Row<K>[] } = Object.fromEntries(
    TABLE_NAMES.map((t) => [t, []]),
  ) as unknown as { [K in TableName]: Row<K>[] }
  private listeners = new Set<Listener>()
  version = 0

  set<T extends TableName>(table: T, rows: Row<T>[]) {
    this.data[table] = rows.filter((r) => !(r as { deleted_at?: string | null }).deleted_at) as never
    this.bump()
  }
  put<T extends TableName>(table: T, row: Row<T>) {
    const rows = this.data[table] as Row<T>[]
    const i = rows.findIndex((r) => r.id === row.id)
    const deleted = (row as { deleted_at?: string | null }).deleted_at
    if (deleted) {
      if (i >= 0) rows.splice(i, 1)
    } else if (i >= 0) rows[i] = row
    else rows.push(row)
    this.data[table] = [...rows] as never
    this.bump()
  }
  bump() {
    this.version++
    this.listeners.forEach((l) => l())
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}
