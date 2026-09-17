const KEY = 'cuaderno-pin'
const SESSION = 'cuaderno-pin-ok'

export function getPin(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}
export function setPin(pin: string) {
  try { pin ? localStorage.setItem(KEY, pin) : localStorage.removeItem(KEY) } catch { /* ignore */ }
}
export function pinUnlocked(): boolean {
  try { return !getPin() || sessionStorage.getItem(SESSION) === '1' } catch { return true }
}
export function unlock(pin: string): boolean {
  if (pin !== getPin()) return false
  try { sessionStorage.setItem(SESSION, '1') } catch { /* ignore */ }
  return true
}
