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

  async init(): Promise<string | null> {
    const { data } = await this.client.auth.getSession()
    const session = data.session
    if (!session) return null // sin sesión: se muestra la pantalla de entrar
    this.userId = session.user.id
    this.userName =
      (session.user.user_metadata?.name as string | undefined) ?? session.user.email ?? 'usuario'

    // Cargar los datos. Si falla (sin cobertura, sesión caducada…) se reintenta;
    // NUNCA se sigue con la caché vacía, porque parecería que los datos se han borrado.
    let fallo: string | null = null
    for (let intento = 0; intento < 3; intento++) {
      const errores = (await Promise.all(TABLE_NAMES.map((t) => this.load(t)))).filter(Boolean) as string[]
      if (!errores.length) { fallo = null; break }
      fallo = errores[0]
      if (intento === 0) await this.client.auth.refreshSession().catch(() => {})
      await new Promise((r) => setTimeout(r, 1200 * (intento + 1)))
    }
    if (fallo) return fallo

    this.client
      .channel('cuaderno-cambios')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const table = payload.table as TableName
        if (!TABLE_NAMES.includes(table)) return
        const row = (payload.new ?? payload.old) as Row<typeof table>
        if (row && 'id' in row) this.cache.put(table, row)
      })
      .subscribe()
    return null
  }

  private async load<T extends TableName>(table: T): Promise<string | null> {
    try {
      const q = this.client.from(table).select('*')
      const { data, error } = table === 'profiles' ? await q : await q.is('deleted_at', null)
      if (error) {
        console.error('Error cargando', table, error.message)
        return error.message
      }
      this.cache.set(table, (data ?? []) as Row<T>[])
      return null
    } catch (e) {
      console.error('Error cargando', table, e)
      return e instanceof Error ? e.message : 'sin conexión'
    }
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

  /** Entrar con el código de 6 cifras del correo. */
  async signInWithCode(email: string, token: string) {
    return this.client.auth.verifyOtp({ email, token, type: 'email' })
  }

  /** Entrar pegando el enlace del correo: sirve dentro de la app instalada, donde el enlace abre el navegador y no la app. */
  async signInWithLink(link: string) {
    let token_hash = ''
    try {
      const u = new URL(link.trim())
      token_hash = u.searchParams.get('token_hash') ?? u.searchParams.get('token') ?? ''
      if (!token_hash && u.hash) token_hash = new URLSearchParams(u.hash.slice(1)).get('token_hash') ?? ''
    } catch { /* no es una URL válida */ }
    if (!token_hash) return { error: { message: 'Ese enlace no vale. Copia el enlace entero del correo.' } as { message: string } }
    return this.client.auth.verifyOtp({ token_hash, type: 'magiclink' })
  }
  async signOut() {
    await this.client.auth.signOut()
    location.reload()
  }
}
