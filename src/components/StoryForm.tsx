'use client'

import { useState } from 'react'
import { WA } from '@/lib/config'

export interface PlaceOption { category: string; slug: string; name: string }

const ENDPOINT = '/api/submit-story.php'
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['Experience', 'Folklore I heard', 'Travel tip', 'Family recipe', 'Muthassi story']

export default function StoryForm({ places, defaultPlace }: { places: PlaceOption[]; defaultPlace?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const [entryCategory, entrySlug] = String(fd.get('place') || '').split('/')
    fd.set('entryCategory', entryCategory || '')
    fd.set('entrySlug', entrySlug || '')
    const files = fd.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length > 2 || files.some(f => f.size > MAX_BYTES || !/^image\/(jpeg|png|webp)$/.test(f.type))) {
      setState('error')
      setMsg('Please attach up to 2 photos (JPG, PNG or WebP, 5 MB each).')
      return
    }
    setState('sending')
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Something went wrong.')
      setState('done')
      form.reset()
    } catch (err) {
      setState('error')
      setMsg(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const field = 'w-full border border-accent/40 bg-white px-3 py-2 text-sm focus:outline-none focus:border-primary'

  if (state === 'done') {
    return (
      <div className="bg-accent-pale p-6 text-sm text-ink-mid">
        <p className="font-medium text-primary mb-1">Thank you — your story is with our editors.</p>
        <p>Stories are reviewed twice a week and published once approved. We may edit for length and clarity.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border-t-2 border-accent p-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-xs tracking-wider uppercase text-ink-mid">Your first name
          <input name="author" required maxLength={60} className={field + ' mt-1'} />
        </label>
        <label className="text-xs tracking-wider uppercase text-ink-mid">Where you are from (optional)
          <input name="origin" maxLength={60} className={field + ' mt-1'} />
        </label>
        <label className="text-xs tracking-wider uppercase text-ink-mid">About which place
          <select name="place" defaultValue={defaultPlace || ''} className={field + ' mt-1'}>
            <option value="">General / Kerala</option>
            {places.map(p => <option key={p.category + p.slug} value={`${p.category}/${p.slug}`}>{p.name}</option>)}
          </select>
        </label>
        <label className="text-xs tracking-wider uppercase text-ink-mid">Type
          <select name="type" className={field + ' mt-1'}>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs tracking-wider uppercase text-ink-mid">Title
        <input name="title" required maxLength={120} className={field + ' mt-1'} />
      </label>
      <label className="block text-xs tracking-wider uppercase text-ink-mid">Your story or note
        <textarea name="body" required minLength={40} maxLength={4000} rows={6} className={field + ' mt-1'} />
      </label>
      <fieldset className="border border-accent/30 p-4 space-y-3">
        <legend className="px-1 text-xs tracking-wider uppercase text-ink-mid">Add photos (optional, up to 2)</legend>
        <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
        <input name="photoCaption" maxLength={160} placeholder="Short caption / what the photo shows" className={field} />
        <label className="flex gap-2 text-xs text-ink-mid">
          <input type="checkbox" name="photoConsent" className="mt-0.5" />
          <span>I took these photos and grant Veda Heritage a non-exclusive licence to publish them on this website with credit to my first name. Location data is removed.</span>
        </label>
      </fieldset>
      {/* honeypot — hidden from people, filled by bots */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex gap-2 text-xs text-ink-mid">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>I wrote this myself and agree that Veda Heritage may edit and publish it with my first name. No contact details are published.</span>
      </label>
      {state === 'error' && (
        <p className="text-xs text-red-700">
          {msg} You can also send it on <a className="underline" href={WA.base}>WhatsApp</a>.
        </p>
      )}
      <button type="submit" disabled={state === 'sending'} className="btn-primary disabled:opacity-60">
        {state === 'sending' ? 'Sending…' : 'Share your story'}
      </button>
    </form>
  )
}
