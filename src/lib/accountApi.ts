// Client helpers for the traveller account API. The session token lives in this browser only.
import { ACCT_KEY } from './bookingApi'

export type Json = Record<string, any>
const st = { get: () => { try { return localStorage.getItem(ACCT_KEY) } catch { return null } }, set: (v: string) => { try { localStorage.setItem(ACCT_KEY, v) } catch { /* private mode */ } }, del: () => { try { localStorage.removeItem(ACCT_KEY) } catch { /* ignore */ } } }
export const acctStore = st

export async function acct(a: string, body?: unknown, session: string | null = st.get()) {
  try {
    const r = await fetch(`/api/account.php?a=${a}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { 'X-Account-Token': session } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Json }
  } catch { return { ok: false, status: 0, data: { error: 'Could not reach the server.' } as Json } }
}
export const fileToBase64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('read')); r.readAsDataURL(f) })
export function openBase64(mime: string, b64: string) { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); window.open(URL.createObjectURL(new Blob([u8], { type: mime })), '_blank') }
