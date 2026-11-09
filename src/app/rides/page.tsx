import type { Metadata } from 'next'
import PageHero from '@/components/PageHero'
import RideBooking from '@/components/commerce/RideBooking'
import { SITE_URL } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Book a cab or auto in Kerala with Verified Local Partners',
  description: 'Pick the pickup and drop, see the fare estimate, and we find you a driver. The driver starts the trip with a code we send you.',
  alternates: { canonical: `${SITE_URL}/rides/` },
}

export default function Page() {
  return (
    <>
      <PageHero label="Plan Your Journey" title="Book a cab or auto" subtitle="Pick the pickup and drop, see the fare estimate, and we find you a driver. The driver starts the trip with a code we send you." />
      <section className="py-10 bg-surface"><div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"><RideBooking /></div></section>
    </>
  )
}
