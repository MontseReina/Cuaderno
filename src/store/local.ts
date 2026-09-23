import { Cache, type Backend, type Row } from './store'
import { TABLE_NAMES, type TableName } from './types'

const KEY = 'cuaderno-demo-db-v1'
const USER_KEY = 'cuaderno-demo-user'

/** Backend de demostración: guarda todo en el propio dispositivo (localStorage). */
export class LocalBackend implements Backend {
  readonly mode = 'demo' as const
  cache = new Cache()

  async init() {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<TableName, unknown[]>>
        for (const t of TABLE_NAMES) this.cache.set(t, (parsed[t] ?? []) as never)
      }
    } catch {
      /* sin datos previos */
    }
    return null
  }
  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.cache.data))
    } catch {
      /* almacenamiento no disponible */
    }
  }
  all<T extends TableName>(table: T): Row<T>[] {
    return this.cache.data[table] as Row<T>[]
  }
  async upsert<T extends TableName>(table: T, row: Row<T>) {
    this.cache.put(table, row)
    this.persist()
  }
  async softDelete<T extends TableName>(table: T, id: string) {
    const row = (this.cache.data[table] as Row<T>[]).find((r) => r.id === id)
    if (row) {
      this.cache.put(table, { ...row, deleted_at: new Date().toISOString() })
      this.persist()
    }
  }
  subscribe(fn: () => void) {
    return this.cache.subscribe(fn)
  }
  currentUserId() {
    return this.user().id
  }
  currentUserName() {
    return this.user().name
  }
  user(): { id: string; name: string } {
    try {
      const raw = localStorage.getItem(USER_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return { id: '', name: '' }
  }
  setUser(u: { id: string; name: string }) {
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    this.cache.bump()
  }
  reset() {
    localStorage.removeItem(KEY)
    for (const t of TABLE_NAMES) this.cache.set(t, [])
  }
}
