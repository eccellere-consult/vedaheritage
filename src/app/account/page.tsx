import type { Metadata } from 'next'
import PageHero from '@/components/PageHero'
import AccountPortal from '@/components/commerce/AccountPortal'

export const metadata: Metadata = { title: 'My account', description: 'Your Veda Heritage trips, bookings, payments and details.', robots: { index: false, follow: false } }

export default function Page() {
  return (<><PageHero label="Traveller" title="My account" subtitle="Trips, bookings, payments and key contacts in one place." /><section className="py-10 bg-surface"><div className="max-w-3xl mx-auto px-4 sm:px-6"><AccountPortal /></div></section></>)
}
