'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DISTRICT_NAMES, NEEDS_CREDENTIAL, PROVIDER_TYPES, type ProviderType } from '@/lib/provider-options'

const field = 'w-full border border-accent/40 bg-white px-3 py-2 text-sm focus:outline-none focus:border-primary'
const lab = 'block text-xs tracking-wider uppercase text-ink-mid'

export default function JoinForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [type, setType] = useState<ProviderType>('guide')
  const [picked, setPicked] = useState<string[]>([])
  const needs = NEEDS_CREDENTIAL.includes(type)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!picked.length) { setState('error'); setMsg('Please choose 1 to 3 districts.'); return }
    setState('sending')
    try {
      const res = await fetch('/api/submit-provider.php', { method: 'POST', body: new FormData(e.currentTarget) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Something went wrong.')
      setState('done')
    } catch (err) { setState('error'); setMsg(err instanceof Error ? err.message : 'Something went wrong.') }
  }
  const toggle = (d: string) => setPicked(p => p.includes(d) ? p.filter(x => x !== d) : p.length < 3 ? [...p, d] : p)

  if (state === 'done') return <div className="bg-accent-pale p-6 text-sm text-ink-mid space-y-2"><p className="font-medium text-primary">Thank you. Next steps:</p><ol className="list-decimal pl-5"><li>Open the confirmation link we emailed to your business address (valid for 7 days).</li><li>We phone your business number to complete the check{needs ? ' and verify your registration' : ''}.</li><li>Once verified, your listing goes live. Verification is renewed every 12 months.</li></ol></div>
  return (
    <form onSubmit={onSubmit} className="bg-white border-t-2 border-accent p-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <label className={lab}>Business name<input name="businessName" required minLength={3} maxLength={80} className={field + ' mt-1'} /></label>
        <label className={lab}>Type of service<select name="type" className={field + ' mt-1'} value={type} onChange={e => setType(e.target.value as ProviderType)}>{Object.entries(PROVIDER_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <fieldset className="border border-accent/30 p-4">
        <legend className="px-1 text-xs tracking-wider uppercase text-ink-mid">Districts you serve (choose 1 to 3)</legend>
        <div className="flex flex-wrap gap-2">{DISTRICT_NAMES.map(d => (
          <label key={d} className={`text-xs px-3 py-1 border cursor-pointer ${picked.includes(d) ? 'bg-primary text-white border-primary' : 'border-accent/40 text-ink-mid'}`}>
            <input type="checkbox" name="districts[]" value={d} checked={picked.includes(d)} onChange={() => toggle(d)} className="sr-only" />{d}
          </label>))}</div>
      </fieldset>
      <label className={lab}>What you offer (40 to 200 characters, plain facts, no web links)<textarea name="summary" required minLength={40} maxLength={200} rows={3} className={field + ' mt-1'} /></label>
      <fieldset className="border border-accent/30 p-4 space-y-3">
        <legend className="px-1 text-xs tracking-wider uppercase text-ink-mid">Public contact details (shown to visitors)</legend>
        <div className="grid md:grid-cols-2 gap-4">
          <label className={lab}>Business phone<input type="tel" name="phone" required maxLength={20} className={field + ' mt-1'} /></label>
          <label className={lab}>Business email<input type="email" name="email" required maxLength={120} className={field + ' mt-1'} /></label>
          <label className={lab}>Website (https, optional)<input type="url" name="siteUrl" maxLength={200} placeholder="https://" className={field + ' mt-1'} /></label>
          <label className={lab}>Address or area (optional)<input name="address" maxLength={120} className={field + ' mt-1'} /></label>
        </div>
      </fieldset>
      <fieldset className="border border-accent/30 p-4 space-y-3">
        <legend className="px-1 text-xs tracking-wider uppercase text-ink-mid">Private verification details (never published)</legend>
        <div className="grid md:grid-cols-2 gap-4">
          <label className={lab}>Person we should speak to<input name="contactPerson" required maxLength={60} className={field + ' mt-1'} /></label>
          <label className={lab}>Their phone (if different)<input type="tel" name="contactPersonPhone" maxLength={20} className={field + ' mt-1'} /></label>
          {needs && <>
            <label className={lab}>Registration or licence type<input name="credentialKind" required maxLength={80} placeholder="e.g. Kerala Tourism registered homestay" className={field + ' mt-1'} /></label>
            <label className={lab}>Registration or licence number<input name="credentialNumber" required maxLength={40} className={field + ' mt-1'} /></label>
          </>}
        </div>
        <p className="text-xs text-ink-mid">{needs ? 'This type of service needs a registration or licence. We check it against the official register; the type is shown publicly, the number is not.' : 'A registration number is optional for this type.'}</p>
      </fieldset>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex gap-2 text-xs text-ink-mid"><input type="checkbox" name="declare" required className="mt-0.5" /><span>The details are true, I am authorised to list this business, and I am not making health, price or ranking claims I cannot prove.</span></label>
      <label className="flex gap-2 text-xs text-ink-mid"><input type="checkbox" name="consent" required className="mt-0.5" /><span>Veda Heritage may publish the business name, summary, phone, email, website and address. My private details are used only for verification and are deleted if the listing is rejected or removed.</span></label>
      <label className="flex gap-2 text-xs text-ink-mid"><input type="checkbox" name="terms" required className="mt-0.5" /><span>I have read <Link href="/services/standards/" className="underline">the verification and advertising standards</Link>.</span></label>
      {state === 'error' && <p role="alert" className="text-xs text-red-700">{msg}</p>}
      <button className="btn-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Apply to be listed (free)'}</button>
    </form>
  )
}
