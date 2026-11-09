import type { Metadata } from 'next'
import PageHero from '@/components/PageHero'
import PayClient from '@/components/commerce/PayClient'

export const metadata: Metadata = { title: 'Pay for your booking', description: 'Secure payment for a Veda Heritage booking.', robots: { index: false, follow: false } }

export default function Page() {
  return (<><PageHero label="Booking" title="Pay for your booking" subtitle="Secure payment through Razorpay." /><section className="py-10 bg-surface"><div className="max-w-xl mx-auto px-4 sm:px-6"><PayClient /></div></section></>)
}
