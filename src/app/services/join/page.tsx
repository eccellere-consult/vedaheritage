import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/content'
import JoinForm from '@/components/services/JoinForm'
import PageHero from '@/components/PageHero'

export const metadata: Metadata = {
  title: 'List Your Service in the Kerala Directory (Free, Verified)',
  description: 'Guides, stays, taxis, shops, restaurants, classes and tour operators: apply for a free verified listing. We check your email, phone and, where required, registration.',
  alternates: { canonical: `${SITE_URL}/services/join/` },
}

export default function JoinPage() {
  return (
    <>
      <PageHero label="Services" title="List your service" subtitle="A basic listing is free. We verify every business by email and phone, and check registration where the law requires one." />
      <section className="py-14 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <ol className="list-decimal pl-5 text-sm text-ink-mid space-y-1">
            <li>Apply below. Public details are limited to what visitors need; private details stay private.</li>
            <li>Confirm your business email using the link we send.</li>
            <li>We call your business phone and, for guides, stays, travel desks and wellness centres, check your registration against the official register.</li>
            <li>Your listing goes live. It is re-verified every 12 months; unverified listings are hidden.</li>
          </ol>
          <p className="text-sm text-ink-mid">Verified providers of most types can also ask about a <Link href="/services/standards/#advertising" className="underline">limited sponsored slot</Link>. Slots are few, labelled and time-boxed, and paying never changes the free listing order.</p>
          <JoinForm />
        </div>
      </section>
    </>
  )
}
