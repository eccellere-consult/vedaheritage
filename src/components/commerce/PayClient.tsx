'use client'

import { useEffect, useState } from 'react'
import { TEST_BANNER, hashParams, inr, postJson } from '@/lib/bookingApi'

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, f: (r: unknown) => void) => void } } }

/** Pay for a booking with Razorpay Checkout. The amount shown and charged comes from the server record. */
export default function PayClient() {
  const [ref, setRef] = useState(''); const [tok, setTok] = useState('')
  const [info, setInfo] = useState<Record<string, any> | null>(null); const [err, setErr] = useState(''); const [paid, setPaid] = useState(false); const [busy, setBusy] = useState(false)

  useEffect(() => {
    const h = hashParams(); const r = h.get('ref') || '', t = h.get('t') || ''; setRef(r); setTok(t)
    if (!r || !t) { setErr('This payment link is incomplete. Open the link from your email again.'); return }
    postJson('pay-create.php', { ref: r, token: t }).then(x => { if (!x.ok) setErr(x.data.error || 'Could not start the payment.'); else if (x.data.paid) setPaid(true); else setInfo(x.data) })
  }, [])

  const pay = async () => {
    if (!info) return; setBusy(true); setErr('')
    try {
      if (!window.Razorpay) await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => res(); s.onerror = () => rej(new Error('load')); document.body.appendChild(s) })
      const rz = new window.Razorpay!({
        key: info.keyId, amount: info.amountPaise, currency: 'INR', order_id: info.orderId, name: 'Veda Heritage', description: `${info.partner}: ${info.summary}`, prefill: info.prefill, theme: { color: '#1D6A3A' },
        handler: async (res: Record<string, string>) => { const v = await postJson('pay-verify.php', { ref, token: tok, ...res }); if (v.ok && v.data.paid) setPaid(true); else setErr(v.data.error || 'We could not confirm the payment yet. If money was taken we will email you.'); setBusy(false) },
        modal: { ondismiss: () => setBusy(false) },
      })
      rz.on('payment.failed', () => { setErr('The payment did not go through. You can try again.'); setBusy(false) }); rz.open()
    } catch { setErr('Could not load the payment window. Check your connection and try again.'); setBusy(false) }
  }

  if (paid) return (
    <div className="card" role="status"><p className="font-serif text-2xl text-ink mb-1">Payment received</p><p className="text-sm text-ink-mid">Thank you. Booking <strong>{ref}</strong> is confirmed and we emailed you the details.</p>
      <a className="btn-outline text-xs mt-3 inline-block" href={`/rides/#ref=${encodeURIComponent(ref)}&t=${tok}`}>Track a ride booking</a></div>)
  return (
    <div className="card space-y-3">
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {String(info?.keyId || '').startsWith('rzp_test_') && <p role="status" className="rounded border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs">{TEST_BANNER} Use Razorpay's test card details.</p>}
      {info ? <>
        <p className="text-sm text-ink-mid">Booking <strong>{info.ref}</strong> · {info.partner}</p><p className="text-sm text-ink">{info.summary}</p>
        <p className="font-serif text-3xl text-primary">{inr(info.amountInr)}</p>
        <button className="btn-primary text-xs disabled:opacity-50" disabled={busy} onClick={pay}>{busy ? 'Opening payment…' : 'Pay now'}</button>
        <p className="text-xs text-ink-mid">Payments are processed securely by Razorpay. We never see your card details.</p>
      </> : !err && <p className="text-sm text-ink-mid">Preparing your payment…</p>}
    </div>)
}
