// Client helpers for the booking endpoints (PHP on the live site). Nothing here is secret; prices are always recomputed on the server.
export interface BookingStatus {
  ok: boolean; open: boolean; testMode?: boolean
  caps: { enquiries: boolean; stays: boolean; rides: boolean; payments: boolean; accounts?: boolean; kyc?: boolean }
  partners: { id: string; name: string; type: string; typeLabel: string; districts: string[]; summary: string }[]
  stays: { id: string; name: string; districts: string[]; summary: string; rooms: { id: string; name: string; capacity: number; rateInr: number }[] }[]
  rides: { vehicles: { id: string; label: string }[]; points: { id: string; label: string; district: string }[] } | null
}

export async function getStatus(): Promise<BookingStatus | null> {
  try { const r = await fetch('/api/booking-status.php', { cache: 'no-store' }); const j = await r.json(); return j?.ok ? j : null } catch { return null }
}
export const ACCT_KEY = 'vh-account-session'
export const acctToken = () => { try { return localStorage.getItem(ACCT_KEY) } catch { return null } }
export async function postForm(ep: string, fields: Record<string, string | boolean>) {
  const fd = new FormData(); const at = acctToken(); if (at && ['stay-book.php', 'ride-book.php', 'submit-booking.php'].includes(ep)) fd.set('account', at); for (const [k, v] of Object.entries(fields)) if (v !== '' && v !== false) fd.set(k, v === true ? '1' : v)
  try { const r = await fetch(`/api/${ep}`, { method: 'POST', body: fd }); return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) } }
  catch { return { ok: false, status: 0, data: { error: 'Could not reach the server. Please try again.' } } }
}
export async function postJson(ep: string, body: unknown) {
  try { const r = await fetch(`/api/${ep}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) } }
  catch { return { ok: false, status: 0, data: { error: 'Could not reach the server. Please try again.' } } }
}
export const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
export const hashParams = () => { try { return new URLSearchParams(window.location.hash.replace(/^#/, '')) } catch { return new URLSearchParams() } }
export const fieldClass = 'w-full border border-ink/20 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40'

export const TEST_BANNER = 'TEST MODE: this is a test. Nothing here is a real booking, no email goes to partners or travellers, and payments use test cards only.'
