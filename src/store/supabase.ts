import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Cache, type Backend, type Row } from './store'
import { TABLE_NAMES, type TableName } from './types'

/** Backend real: PostgreSQL en Supabase con tiempo real y acceso por invitación. */
export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const
  cache = new Cache()
  client: SupabaseClient
  private userId = ''
  private userName = ''

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey)
  }

  async init() {
    const { data } = await this.client.auth.getSession()
    const session = data.session
    if (!session) return
    this.userId = session.user.id
    this.userName =
      (session.user.user_metadata?.name as string | undefined) ?? session.user.email ?? 'usuario'
    await Promise.all(TABLE_NAMES.map((t) => this.load(t)))
    this.client
      .channel('cuaderno-cambios')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const table = payload.table as TableName
        if (!TABLE_NAMES.includes(table)) return
        const row = (payload.new ?? payload.old) as Row<typeof table>
        if (row && 'id' in row) this.cache.put(table, row)
      })
      .subscribe()
  }

  private async load<T extends TableName>(table: T) {
    const q = this.client.from(table).select('*')
    const { data, error } = table === 'profiles' ? await q : await q.is('deleted_at', null)
    if (error) {
      console.error('Error cargando', table, error.message)
      return
    }
    this.cache.set(table, (data ?? []) as Row<T>[])
  }

  all<T extends TableName>(table: T): Row<T>[] {
    return this.cache.data[table] as Row<T>[]
  }
  async upsert<T extends TableName>(table: T, row: Row<T>) {
    this.cache.put(table, row) // optimista
    const { error } = await this.client.from(table).upsert(row as never)
    if (error) {
      console.error('Error guardando en', table, error.message)
      await this.load(table)
    }
  }
  async softDelete<T extends TableName>(table: T, id: string) {
    const row = (this.cache.data[table] as Row<T>[]).find((r) => r.id === id)
    if (!row) return
    const stamped = { ...row, deleted_at: new Date().toISOString() }
    this.cache.put(table, stamped)
    const { error } = await this.client
      .from(table)
      .update({ deleted_at: stamped.deleted_at, updated_by: this.userId })
      .eq('id', id)
    if (error) console.error('Error borrando en', table, error.message)
  }
  subscribe(fn: () => void) {
    return this.cache.subscribe(fn)
  }
  currentUserId() {
    return this.userId
  }
  currentUserName() {
    return this.userName
  }
  async signInWithEmail(email: string) {
    return this.client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })
  }
  async signOut() {
    await this.client.auth.signOut()
    location.reload()
  }
}
