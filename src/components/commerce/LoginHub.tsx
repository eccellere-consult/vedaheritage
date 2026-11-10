'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { type BookingStatus, getStatus } from '@/lib/bookingApi'

/** One place to register or sign in, whoever you are. Shows what is open yet, so nobody lands on a dead end. */
export default function LoginHub() {
  const [st, setSt] = useState<BookingStatus | null | undefined>(undefined)
  useEffect(() => { getStatus().then(setSt) }, [])
  const known = st !== undefined
  const accounts = !!st?.caps.accounts, partners = !!(st?.caps.enquiries || st?.caps.stays || st?.caps.rides || st?.caps.kyc)
  const soon = <span className="text-xs rounded-full border border-amber-300 bg-amber-50 text-amber-800 px-2 py-0.5">Opening soon</span>
  const card = (title: string, who: string, open: boolean, actions: React.ReactNode) => (
    <div className="card flex flex-col gap-3"><div className="flex items-center justify-between gap-2"><h2 className="font-serif text-xl text-ink">{title}</h2>{known && !open && soon}</div><p className="text-sm text-ink-mid">{who}</p><div className="flex flex-wrap gap-2 mt-auto">{actions}</div></div>)
  return (
    <div className="space-y-4">
      {st?.testMode && <p role="status" className="rounded border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs">TEST MODE: this is a test. Nothing here is real.</p>}
      <div className="grid md:grid-cols-3 gap-4">
        {card('Traveller', 'Plan trips, see your bookings, payments and key contacts in one place, and keep the identity details a stay needs.', accounts,
          <><Link href="/account/" className="btn-primary text-xs">Register</Link><Link href="/account/" className="btn-outline text-xs">Sign in</Link></>)}
        {card('Partner', 'Stays and drivers: manage rides, bookings, rooms and payouts, upload your documents and, for stays, handle guest registration.', partners,
          <><Link href="/partner/" className="btn-primary text-xs">Partner sign-in</Link></>)}
        {card('Become a partner or service provider', 'Autos, taxis, stays, guides and local businesses: apply to be listed. We verify your registration, documents and location.', true,
          <><Link href="/services/join/" className="btn-primary text-xs">Apply to join</Link><Link href="/services/standards/" className="btn-outline text-xs">Our standards</Link></>)}
      </div>
      <p className="text-xs text-ink-mid">No passwords: we email you a one-time sign-in link. Not receiving it? Check your spam folder, or ask us on WhatsApp from the <Link className="underline" href="/stay/#book">contact section</Link>.</p>
    </div>
  )
}
