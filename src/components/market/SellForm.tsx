'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LISTING_CATEGORIES, LISTING_CONDITIONS } from '@/lib/listing-options'

const field = 'w-full border border-accent/40 bg-white px-3 py-2 text-sm focus:outline-none focus:border-primary'
const MAX = 6 * 1024 * 1024

export default function SellForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const files = fd.getAll('photos[]').filter((f): f is File => f instanceof File && f.size > 0)
    if (!files.length || files.length > 3 || files.some(f => f.size > MAX || !/^image\/(jpeg|png|webp)$/.test(f.type))) { setState('error'); setMsg('Please add 1 to 3 photos (JPG, PNG or WebP, under 6 MB each).'); return }
    setState('sending')
    try {
      const res = await fetch('/api/submit-listing.php', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Something went wrong.')
      setState('done')
    } catch (err) { setState('error'); setMsg(err instanceof Error ? err.message : 'Something went wrong.') }
  }
  if (state === 'done') return <div className="bg-accent-pale p-6 text-sm text-ink-mid"><p className="font-medium text-primary mb-1">Thank you. Your item is with our editors.</p><p>We review listings twice a week. If approved it appears on the marketplace for 90 days, and buyers are introduced to you privately. If it is not approved, your photos and contact details are deleted.</p></div>
  return (
    <form onSubmit={onSubmit} className="bg-white border-t-2 border-accent p-6 space-y-4">
      <label className="block text-xs tracking-wider uppercase text-ink-mid">Item title<input name="title" required minLength={5} maxLength={90} className={field + ' mt-1'} /></label>
      <div className="grid md:grid-cols-3 gap-4">
        <label className="block text-xs tracking-wider uppercase text-ink-mid">Category<select name="category" required className={field + ' mt-1'}>{Object.entries(LISTING_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="block text-xs tracking-wider uppercase text-ink-mid">Condition<select name="condition" required className={field + ' mt-1'}>{Object.entries(LISTING_CONDITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="block text-xs tracking-wider uppercase text-ink-mid">Price (₹, whole rupees)<input name="price" required inputMode="numeric" pattern="[0-9]{1,7}" className={field + ' mt-1'} /></label>
      </div>
      <label className="block text-xs tracking-wider uppercase text-ink-mid">Description (size, material, age, condition, how it is used)<textarea name="description" required minLength={40} maxLength={1500} rows={5} className={field + ' mt-1'} /></label>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="block text-xs tracking-wider uppercase text-ink-mid">District where the item is<input name="district" required maxLength={40} className={field + ' mt-1'} /></label>
        <label className="block text-xs tracking-wider uppercase text-ink-mid">Your first name<input name="sellerName" required maxLength={40} className={field + ' mt-1'} /></label>
      </div>
      <fieldset className="border border-accent/30 p-4 space-y-3">
        <legend className="px-1 text-xs tracking-wider uppercase text-ink-mid">Private contact (never shown on the site)</legend>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block text-xs tracking-wider uppercase text-ink-mid">Email<input type="email" name="contactEmail" maxLength={120} className={field + ' mt-1'} /></label>
          <label className="block text-xs tracking-wider uppercase text-ink-mid">Phone or WhatsApp<input type="tel" name="contactPhone" maxLength={20} className={field + ' mt-1'} /></label>
        </div>
        <p className="text-xs text-ink-mid">Give at least one. We use it only to introduce a buyer.</p>
      </fieldset>
      <fieldset className="border border-accent/30 p-4 space-y-2">
        <legend className="px-1 text-xs tracking-wider uppercase text-ink-mid">Photos (1 to 3)</legend>
        <input type="file" name="photos[]" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
        <p className="text-xs text-ink-mid">Photos you took yourself, in good light. Location data is removed.</p>
      </fieldset>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex gap-2 text-xs text-ink-mid"><input type="checkbox" name="declare" required className="mt-0.5" /><span>I own this item and may sell it. It is not an antiquity (under 100 years old; manuscripts under 75), and it is not on the <Link href="/marketplace/rules/" className="underline">list of items that are not allowed</Link>. The details above are true.</span></label>
      <label className="flex gap-2 text-xs text-ink-mid"><input type="checkbox" name="consent" required className="mt-0.5" /><span>Veda Heritage may publish this listing, my photos and my first name. My contact details stay private and are shared only with a buyer I am introduced to.</span></label>
      {state === 'error' && <p role="alert" className="text-xs text-red-700">{msg}</p>}
      <button className="btn-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Submit for review'}</button>
    </form>
  )
}
