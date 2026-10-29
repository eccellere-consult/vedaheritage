import type { Metadata } from 'next'
import ReportForm from '@/components/services/ReportForm'
import PageHero from '@/components/PageHero'

export const metadata: Metadata = {
  title: 'Report a Problem with a Directory Listing',
  description: 'Tell us about a wrong contact, a closed business, a misleading advert or a safety concern with a listing in the Veda Heritage services directory.',
  robots: { index: false, follow: true },
}

export default function ReportPage() {
  return (
    <>
      <PageHero label="Services" title="Report a problem" subtitle="Wrong number, closed business, misleading advert or a safety concern? Tell us and we will review the listing." />
      <section className="py-14 bg-surface"><div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8"><ReportForm /></div></section>
    </>
  )
}
