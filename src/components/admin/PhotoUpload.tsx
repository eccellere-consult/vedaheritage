'use client'
import { useState } from 'react'

/** Pick a photo you took, type the credit, attach it to a guide. The browser shrinks and re-encodes it (no GPS or camera data survives). */
type Res = { ok: boolean; data: { [k: string]: any } } // eslint-disable-line @typescript-eslint/no-explicit-any

export default function PhotoUpload({ category, slug, number, say, onDone, post }: { category: string; slug: string; number?: number; say: (t: string, bad?: boolean) => void; onDone: () => void; post: (a: string, body: { [k: string]: unknown }) => Promise<Res> }) {
  const [open, setOpen] = useState(false); const [file, setFile] = useState<File | null>(null); const [credit, setCredit] = useState(''); const [alt, setAlt] = useState(''); const [busy, setBusy] = useState(false)
  async function shrink(f: File): Promise<string> {
    const bmp = await createImageBitmap(f); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k)
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
    return cv.toDataURL('image/jpeg', 0.85)
  }
  async function send() {
    if (!file) return say('Choose a picture first.', true)
    setBusy(true)
    try {
      const image = await shrink(file)
      const r = await post('photo_upload', { category, slug, number, image, credit, alt })
      say(r.ok ? r.data.message : r.data.error, !r.ok)
      if (r.ok) { setOpen(false); setFile(null); setCredit(''); setAlt(''); onDone() }
    } catch { say('That file could not be read as a picture. Try a JPEG or PNG.', true) }
    setBusy(false)
  }
  if (!open) return <button className="btn-outline text-xs" onClick={() => setOpen(true)}>Upload your own photo</button>
  const inp = 'border border-accent/30 px-2 py-1 text-sm w-full'
  return (
    <div className="mt-2 p-3 border border-accent/30 space-y-2 w-full text-sm">
      <label className="block">Picture you took<input type="file" accept="image/jpeg,image/png" className="block mt-1" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <label className="block">Credit (shown under the photo, e.g. &quot;Photo: Your Name&quot;)<input className={inp} value={credit} maxLength={120} onChange={e => setCredit(e.target.value)} /></label>
      <label className="block">What it shows (for screen readers)<input className={inp} value={alt} maxLength={200} onChange={e => setAlt(e.target.value)} /></label>
      <div className="flex gap-2"><button className="btn-primary text-xs disabled:opacity-40" disabled={busy || !file || credit.trim().length < 2 || alt.trim().length < 5} onClick={send}>{busy ? 'Uploading…' : 'Attach photo'}</button><button className="btn-outline text-xs" onClick={() => setOpen(false)}>Cancel</button></div>
    </div>
  )
}
