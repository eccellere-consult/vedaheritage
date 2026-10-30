import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/content'
import PageHero from '@/components/PageHero'

export const metadata: Metadata = {
  title: 'Directory Standards: How Listings Are Verified and Adverts Are Controlled',
  description: 'How the Veda Heritage services directory verifies businesses, what adverts are allowed, how many sponsored slots exist, and how to report a problem.',
  alternates: { canonical: `${SITE_URL}/services/standards/` },
}

const Row = ({ t, d }: { t: string; d: string }) => <div><dt className="font-medium text-ink">{t}</dt><dd>{d}</dd></div>

export default function StandardsPage() {
  return (
    <>
      <PageHero label="Services" title="How we verify and advertise" subtitle="The rules that keep the directory useful and fair. Plain language, not legal advice." />
      <section className="py-14 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-ink-mid leading-relaxed text-sm">
          <div>
            <h2 className="section-title mb-3">Three kinds of contact</h2>
            <dl className="space-y-3">
              <Row t="Official contacts" d="Taken only from official pages (temple administrations, tourism departments, transport bodies), each linked to its source and dated. Always free, always shown first." />
              <Row t="Verified local services" d="Independent businesses, listed free and shown alphabetically. Payment never changes this order." />
              <Row t="Sponsored" d="A small number of labelled paid placements by verified providers, described below." />
            </dl>
          </div>
          <div>
            <h2 className="section-title mb-3">How a business is verified</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>The business email is confirmed by a one-time link.</li>
              <li>We call or message the business phone number.</li>
              <li>The website, if given, must be a working https address with no link shorteners.</li>
              <li>Guides, stays, tour operators and wellness centres give a registration or licence, which we check against the official register. The type is shown; the number is not.</li>
              <li>Duplicates are rejected. Summaries with web links, price guarantees, rankings, health claims or occult claims are rejected or edited.</li>
              <li>Verification lasts 12 months. After that the listing is hidden until it is re-verified.</li>
            </ul>
          </div>
          <div id="advertising">
            <h2 className="section-title mb-3">Advertising rules</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Few slots.</strong> At most 2 sponsored placements on any page, and at most 3 sponsored providers of one type in one district at a time.</li>
              <li><strong>Verified only.</strong> Only a live, in-date verified provider can be sponsored, for up to 90 days, and never beyond its verification date.</li>
              <li><strong>Always labelled.</strong> Sponsored items say “Sponsored” and their links are marked as paid for search engines.</li>
              <li><strong>Plain text.</strong> A headline (60 characters) and one line (140 characters). No images, banners, pop-ups or web links in the text.</li>
              <li><strong>Honest wording.</strong> No “best”, “number one”, “cheapest”, guarantees, health or medical claims, miracle or occult claims, or pressure wording.</li>
              <li><strong>Not for health services.</strong> Ayurveda and wellness centres can be listed but not advertised, because health advertising is regulated.</li>
              <li><strong>Rotation.</strong> When slots are full, eligible sponsors rotate weekly.</li>
              <li>We may refuse, pause or remove any listing or advert, for example after a verified complaint.</li>
            </ul>
          </div>
          <div>
            <h2 className="section-title mb-3">Your data</h2>
            <p>Public: business name, summary, phone, email, website, address and registration type. Private: the contact person, their phone and the registration number, used only for verification and deleted if a listing is rejected or removed. Reports are deleted when closed.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/services/join/" className="btn-primary text-xs">List your service</Link>
            <Link href="/services/" className="btn-outline text-xs">Browse services</Link>
          </div>
        </div>
      </section>
    </>
  )
}
