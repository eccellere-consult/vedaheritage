'use client'

import { useState } from 'react'

const field = 'w-full border border-accent/40 bg-white px-3 py-2 text-sm focus:outline-none focus:border-primary'

export default function EnquiryForm({ listingId }: { listingId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setState('sending')
    try {
      const res = await fetch('/api/submit-enquiry.php', { method: 'POST', body: new FormData(e.currentTarget) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Something went wrong.')
      setState('done')
    } catch (err) { setState('error'); setMsg(err instanceof Error ? err.message : 'Something went wrong.') }
  }
  if (state === 'done') return <div className="bg-accent-pale p-5 text-sm text-ink-mid"><p className="font-medium text-primary mb-1">Thank you. Your enquiry is with us.</p><p>We introduce you to the seller by email or phone, usually within two working days. Your details are shared only with this seller.</p></div>
  return (
    <form onSubmit={onSubmit} className="bg-white border-t-2 border-accent p-5 space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <h3 className="font-serif text-xl text-ink">Ask about this item</h3>
      <label className="block text-xs tracking-wider uppercase text-ink-mid">Your first name<input name="name" required maxLength={60} className={field + ' mt-1'} /></label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs tracking-wider uppercase text-ink-mid">Email<input type="email" name="contactEmail" maxLength={120} className={field + ' mt-1'} /></label>
        <label className="block text-xs tracking-wider uppercase text-ink-mid">Phone<input type="tel" name="contactPhone" maxLength={20} className={field + ' mt-1'} /></label>
      </div>
      <p className="text-xs text-ink-mid -mt-1">Give at least one of email or phone.</p>
      <label className="block text-xs tracking-wider uppercase text-ink-mid">Message<textarea name="message" required minLength={10} maxLength={800} rows={4} className={field + ' mt-1'} /></label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex gap-2 text-xs text-ink-mid"><input type="checkbox" name="consent" required className="mt-0.5" /><span>I agree that Veda Heritage may share my name and contact details with this seller to arrange an introduction, and keeps them only for that purpose.</span></label>
      {state === 'error' && <p role="alert" className="text-xs text-red-700">{msg}</p>}
      <button className="btn-primary text-xs" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send enquiry'}</button>
    </form>
  )
}
