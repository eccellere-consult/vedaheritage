import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/content'
import SellForm from '@/components/market/SellForm'
import Notice from '@/components/market/Notice'
import PageHero from '@/components/PageHero'

export const metadata: Metadata = {
  title: 'List a Traditional Kerala Item for Sale (Free, Moderated)',
  description: 'List a traditional Kerala item: add photos and a description. We review it; if approved it appears for 90 days and your contact details stay private.',
  alternates: { canonical: `${SITE_URL}/marketplace/sell/` },
}

export default function SellPage() {
  return (
    <>
      <PageHero label="Marketplace" title="List an item" subtitle="Free. We review every listing twice a week. Your phone and email never appear on the site." />
      <section className="py-14 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <Notice />
          <ol className="list-decimal pl-5 text-sm text-ink-mid space-y-1">
            <li>Read the <Link href="/marketplace/rules/" className="underline">rules</Link>: some items are not allowed.</li>
            <li>Submit the form with 1 to 3 photos.</li>
            <li>We review it. If approved it goes live for 90 days.</li>
            <li>A buyer asks about it; we introduce you privately and you agree the sale between you.</li>
          </ol>
          <SellForm />
        </div>
      </section>
    </>
  )
}
