import type { Metadata } from 'next'
import PageHero from '@/components/PageHero'
import PartnerPortal from '@/components/commerce/PartnerPortal'

export const metadata: Metadata = { title: 'Partner sign-in', description: 'Sign-in page for Veda Heritage stay and transport partners.', robots: { index: false, follow: false } }

export default function Page() {
  return (<><PageHero label="Partners" title="Partner page" subtitle="Rides, bookings, rooms and payouts in one place." /><section className="py-10 bg-surface"><div className="max-w-3xl mx-auto px-4 sm:px-6"><PartnerPortal /></div></section></>)
}
