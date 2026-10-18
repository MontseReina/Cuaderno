/** Web Push con WebCrypto (sin librerías): firma VAPID (RFC 8292) y cifrado aes128gcm (RFC 8291).
 *  Funciona igual en Deno (Supabase Edge Functions) y en Node 20+, donde se prueba. */

const enc = new TextEncoder()

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
export function b64urlEncode(b: Uint8Array | ArrayBuffer): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource))
}

export interface VapidKeys {
  /** Clave pública sin comprimir (65 bytes) en base64url: la misma que usa la app al suscribirse. */
  publicKey: string
  /** Parte privada `d` de la clave (32 bytes) en base64url. */
  privateKey: string
  /** mailto: o https: de contacto (lo piden Apple y Google). */
  subject: string
}

/** Cabecera Authorization de VAPID para un endpoint. */
export async function vapidAuth(endpoint: string, keys: VapidKeys, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const pub = b64urlDecode(keys.publicKey)
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: keys.privateKey,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const aud = new URL(endpoint).origin
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64urlEncode(enc.encode(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: keys.subject })))
  const unsigned = `${header}.${payload}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned))
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${keys.publicKey}`
}

/** Cifra el contenido para una suscripción (aes128gcm, un solo registro). */
export async function encryptPayload(p256dh: string, auth: string, plaintext: Uint8Array, salt?: Uint8Array, serverKeys?: CryptoKeyPair): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(p256dh)
  const authSecret = b64urlDecode(auth)
  const as = serverKeys ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as EcdhKeyDeriveParams, as.privateKey, 256))
  const prkKey = await hmac(authSecret, ecdh)
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]))
  const ikm = (await hmac(prkKey, keyInfo)).slice(0, 32)
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(s, ikm)
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt'])
  const padded = concat(plaintext, new Uint8Array([2])) // delimitador del último registro
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, key, padded as BufferSource))
  const rs = new Uint8Array([0, 0, 16, 0]) // 4096
  return concat(s, rs, new Uint8Array([asPublic.length]), asPublic, ct)
}

export interface PushSub { endpoint: string; p256dh: string; auth: string }
export interface PushResult { ok: boolean; status: number; gone: boolean; text?: string }

/** Manda un aviso a una suscripción. `gone` = la suscripción ya no existe (se borra). */
export async function sendPush(sub: PushSub, data: unknown, keys: VapidKeys, fetchFn: typeof fetch = fetch): Promise<PushResult> {
  const body = await encryptPayload(sub.p256dh, sub.auth, enc.encode(JSON.stringify(data)))
  const res = await fetchFn(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(6 * 3600),
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: await vapidAuth(sub.endpoint, keys),
    },
    body: body as BodyInit,
  })
  const text = res.ok ? undefined : (await res.text().catch(() => '')).slice(0, 300)
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, text }
}
