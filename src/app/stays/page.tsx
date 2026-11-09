import type { Metadata } from 'next'
import PageHero from '@/components/PageHero'
import StayFinder from '@/components/commerce/StayFinder'
import { SITE_URL } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Book a stay in Kerala with Verified Local Partners',
  description: 'Choose your dates, pick a room and book. Prices are set by the stay and checked by our system when you book.',
  alternates: { canonical: `${SITE_URL}/stays/` },
}

export default function Page() {
  return (
    <>
      <PageHero label="Plan Your Journey" title="Book a stay" subtitle="Choose your dates, pick a room and book. Prices are set by the stay and checked by our system when you book." />
      <section className="py-10 bg-surface"><div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"><StayFinder /></div></section>
    </>
  )
}
