import type { Metadata } from 'next'
import PageHero from '@/components/PageHero'
import DriverClient from '@/components/commerce/DriverClient'

export const metadata: Metadata = { title: 'Driver page', description: 'Private page for a driver to accept and run a ride.', robots: { index: false, follow: false } }

export default function Page() {
  return (<><PageHero label="Partners" title="Ride request" subtitle="Accept the ride, start with the traveller's code, complete the trip." /><section className="py-10 bg-surface"><div className="max-w-xl mx-auto px-4 sm:px-6"><DriverClient /></div></section></>)
}
