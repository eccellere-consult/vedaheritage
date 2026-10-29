'use client'

import { useEffect, useState } from 'react'
import { REPORT_REASONS } from '@/lib/provider-options'

const field = 'w-full border border-accent/40 bg-white px-3 py-2 text-sm focus:outline-none focus:border-primary'

export default function ReportForm() {
  const [id, setId] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  useEffect(() => { setId(new URLSearchParams(window.location.search).get('id') || '') }, [])
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setState('sending')
    try {
      const res = await fetch('/api/submit-report.php', { method: 'POST', body: new FormData(e.currentTarget) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Something went wrong.')
      setState('done')
    } catch (err) { setState('error'); setMsg(err instanceof Error ? err.message : 'Something went wrong.') }
  }
  if (state === 'done') return <div className="bg-accent-pale p-6 text-sm text-ink-mid"><p className="font-medium text-primary mb-1">Thank you. We will review this listing.</p><p>If we need more detail we will use the email you gave, then delete it.</p></div>
  if (!id) return <p className="text-sm text-ink-mid">Open this page from the “Report a problem” link on a listing so we know which one you mean.</p>
  return (
    <form onSubmit={onSubmit} className="bg-white border-t-2 border-accent p-6 space-y-4">
      <input type="hidden" name="providerId" value={id} />
      <label className="block text-xs tracking-wider uppercase text-ink-mid">What is the problem?<select name="reason" required className={field + ' mt-1'}>{Object.entries(REPORT_REASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="block text-xs tracking-wider uppercase text-ink-mid">Details<textarea name="details" required minLength={10} maxLength={500} rows={4} className={field + ' mt-1'} /></label>
      <label className="block text-xs tracking-wider uppercase text-ink-mid">Your email (optional, only if you want a reply)<input type="email" name="contactEmail" maxLength={120} className={field + ' mt-1'} /></label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state === 'error' && <p role="alert" className="text-xs text-red-700">{msg}</p>}
      <button className="btn-primary text-xs" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send report'}</button>
    </form>
  )
}
