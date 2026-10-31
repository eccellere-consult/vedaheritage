'use client'
import { useEffect, useState } from 'react'

const API = '/api/admin/index.php'
type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** Same-origin call to the admin API. The session cookie is HttpOnly, so this only works for a logged-in owner. */
async function call(a: string, csrf: string, body?: Json, query = ''): Promise<{ ok: boolean; data: Json }> {
  try {
    const r = await fetch(`${API}?a=${a}${query}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(body && csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, data }
  } catch { return { ok: false, data: { error: 'Could not reach the admin service.' } } }
}

/** Returns the CSRF token when the visitor is the logged-in owner, otherwise null (and nothing is shown). */
function useOwner(): string | null {
  const [csrf, setCsrf] = useState<string | null>(null)
  useEffect(() => { call('status', '').then(r => { if (r.ok && r.data.authed && r.data.csrf) setCsrf(r.data.csrf) }) }, [])
  return csrf
}

const btn = 'px-3 py-1.5 text-xs border border-white/40 hover:bg-white/10 disabled:opacity-40'

/** Owner tools on a live guide page: edit, mark reviewed, unpublish, delete. */
export default function OwnerBar({ category, slug, autoPublished, reviewed }: { category: string; slug: string; autoPublished?: string; reviewed?: boolean }) {
  const csrf = useOwner(); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<Json | null>(null); const [raw, setRaw] = useState(false); const [json, setJson] = useState('')
  if (!csrf) return null
  const needsReview = !!autoPublished && reviewed !== true
  async function run(a: string, extra: Json = {}, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true); const r = await call(a, csrf as string, { category, slug, ...extra }); setBusy(false)
    setMsg(r.ok ? r.data.message || 'Done.' : [r.data.error, ...(r.data.blockers || [])].filter(Boolean).join(' · '))
    return r
  }
  async function openEdit() {
    const r = await call('entry', csrf as string, undefined, `&category=${category}&slug=${slug}`)
    if (!r.ok) return setMsg(r.data.error || 'Could not load the entry.')
    setEdit(r.data.entry); setJson(JSON.stringify(r.data.entry, null, 2)); setRaw(false)
  }
  async function save() {
    let entry = edit
    if (raw) { try { entry = JSON.parse(json) } catch { return setMsg('The advanced text is not valid JSON.') } }
    const r = await run('entry_save', { entry }); if (r?.ok) setEdit(null)
  }
  const set = (k: string, v: unknown) => { const next = { ...(edit as Json), [k]: v }; setEdit(next); setJson(JSON.stringify(next, null, 2)) }
  const field = 'border border-accent/30 px-3 py-2 w-full text-sm text-ink bg-white'
  return (
    <>
      <div role="region" aria-label="Owner tools" className="fixed bottom-0 inset-x-0 z-50 bg-ink text-white px-4 py-2 flex flex-wrap items-center gap-2 text-xs shadow-lg">
        <strong className="mr-2">Owner tools</strong>
        {needsReview ? <span className="bg-amber-500/20 border border-amber-300/50 px-2 py-1">Published by the agents, not yet reviewed</span> : <span className="opacity-70">Reviewed</span>}
        <button className={btn} disabled={busy} onClick={openEdit}>Edit</button>
        {needsReview && <button className={btn} disabled={busy} onClick={() => run('entry_reviewed')}>Mark reviewed</button>}
        <button className={btn} disabled={busy} onClick={() => run('set_status', { status: 'draft' }, 'Unpublish this page? It goes back to drafts and disappears from the site.')}>Unpublish</button>
        <button className={btn} disabled={busy} onClick={() => run('entry_delete', {}, 'Delete this page and its photos for good?')}>Delete</button>
        <a className={btn} href="/admin/">Admin</a>
        {msg && <span className="ml-2" role="status">{msg}</span>}
      </div>
      {edit && (
        <div className="fixed inset-0 z-[60] bg-black/60 overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Edit page">
          <div className="bg-white max-w-3xl mx-auto p-6 space-y-4">
            <h2 className="font-serif text-2xl text-ink">Edit {String(edit.name)}</h2>
            {!raw ? <>
              <label className="block text-sm">Summary (50 to 200 characters)<textarea className={field} rows={3} value={String(edit.summary || '')} onChange={e => set('summary', e.target.value)} /></label>
              <label className="block text-sm">Tagline<input className={field} value={String(edit.tagline || '')} onChange={e => set('tagline', e.target.value)} /></label>
              <label className="block text-sm">Description (blank line between paragraphs)<textarea className={field} rows={10} value={(edit.description as string[] | undefined)?.join('\n\n') || ''} onChange={e => set('description', e.target.value.split(/\n{2,}/).map(x => x.trim()).filter(Boolean))} /></label>
            </> : <label className="block text-sm">Everything (advanced JSON)<textarea className={field + ' font-mono'} rows={22} value={json} onChange={e => setJson(e.target.value)} /></label>}
            <div className="flex flex-wrap gap-2 items-center">
              <button className="btn-primary text-xs" disabled={busy} onClick={save}>Save and mark reviewed</button>
              <button className="btn-outline text-xs" onClick={() => setEdit(null)}>Cancel</button>
              <button className="text-xs underline text-primary ml-auto" onClick={() => setRaw(!raw)}>{raw ? 'Simple form' : 'Advanced: edit everything'}</button>
            </div>
            {msg && <p className="text-sm text-red-700" role="status">{msg}</p>}
          </div>
        </div>
      )}
    </>
  )
}

/** Owner-only "Remove" for one event card on the Events page. */
export function EventOwnerTools({ id }: { id: string }) {
  const csrf = useOwner(); const [msg, setMsg] = useState('')
  if (!csrf) return null
  return (
    <span className="block mt-2">
      <button className="text-xs underline text-red-700" onClick={async () => {
        if (!window.confirm('Remove this event from the calendar?')) return
        const r = await call('event_delete', csrf, { id }); setMsg(r.ok ? r.data.message : r.data.error)
      }}>Remove event</button>
      {msg && <span className="text-xs ml-2" role="status">{msg}</span>}
    </span>
  )
}
