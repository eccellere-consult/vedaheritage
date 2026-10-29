import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/content'
import PageHero from '@/components/PageHero'

export const metadata: Metadata = {
  title: 'Marketplace Rules: What Is Not Allowed and How to Buy Safely',
  description: 'What you can list on the Veda Heritage marketplace, which items are not allowed, how enquiries and privacy work, and tips for buying and selling safely.',
  alternates: { canonical: `${SITE_URL}/marketplace/rules/` },
}

const NOT_ALLOWED = [
  ['Antiquities', 'Items 100 years old or more, and manuscripts 75 years or more. Selling and exporting these is regulated in India.'],
  ['Wildlife and animal products', 'Ivory, tusk, horn, bone, shell, coral, feathers, fur, skins and anything from protected species.'],
  ['Regulated timber and plants', 'Sandalwood, rosewood and similar timber in raw or restricted form. Live plants and seeds are not accepted for now.'],
  ['Religious idols and temple property', 'Idols, ritual items or fittings taken from temples or places of worship, or of unclear origin.'],
  ['Medicines and health products', 'Ayurvedic or other medicines, oils sold with health claims, tablets, powders and supplements.'],
  ['Weapons and hazardous goods', 'Weapons, ammunition, fireworks, chemicals.'],
  ['Counterfeits and false claims', 'Imitations sold as protected crafts, or goods described as "genuine", "certified" or "GI" without proof.'],
  ['Stolen or disputed goods', 'Anything you do not have the right to sell.'],
  ['Precious metals and stones', 'Gold, silver, gemstones and jewellery: hallmarking and valuation rules apply.'],
]

export default function RulesPage() {
  return (
    <>
      <PageHero label="Marketplace" title="Rules and safe buying" subtitle="Plain-language guide. It is not legal advice; you are responsible for following the law." />
      <section className="py-14 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-ink-mid leading-relaxed">
          <div>
            <h2 className="section-title mb-3">How it works</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Sellers submit an item with photos. We review it before it appears. A listing runs for 90 days.</li>
              <li>Buyers send an enquiry. We introduce buyer and seller; contact details are shared only with that one person.</li>
              <li>The sale happens between buyer and seller. Veda Heritage does not hold stock, take payments, ship goods, or guarantee authenticity, quality or price.</li>
              <li>Listings are free for now. We may decline or remove any listing at our discretion.</li>
            </ul>
          </div>
          <div>
            <h2 className="section-title mb-3">What is not allowed</h2>
            <dl className="space-y-3 text-sm">
              {NOT_ALLOWED.map(([t, d]) => <div key={t}><dt className="font-medium text-ink">{t}</dt><dd>{d}</dd></div>)}
            </dl>
            <p className="text-sm mt-4">If you are unsure whether an item is allowed, ask us before listing. Laws that may apply include the Antiquities and Art Treasures Act, the Wildlife (Protection) Act and the Drugs and Cosmetics Act.</p>
          </div>
          <div>
            <h2 className="section-title mb-3">Buying safely</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Inspect in person where you can, and ask for extra photos.</li>
              <li>Pay only when you receive the item. Never pay in advance, by gift card, or by crypto.</li>
              <li>Treat claims of age, origin or authenticity as the seller's opinion unless you have independent proof.</li>
              <li>Be careful with shipping long distances or abroad: ask a courier about export rules first.</li>
            </ul>
          </div>
          <div>
            <h2 className="section-title mb-3">Your data</h2>
            <p className="text-sm">We collect only what the form asks for. Seller contact details and photos are stored privately and are deleted if a listing is not approved or is removed. Buyer details are deleted once we have made the introduction. Published listings show the seller's first name only. To ask for your data to be removed, use <Link href="/stay/#book" className="underline">the contact form</Link>.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/marketplace/sell/" className="btn-primary text-xs">List an item</Link>
            <Link href="/marketplace/" className="btn-outline text-xs">Browse items</Link>
          </div>
        </div>
      </section>
    </>
  )
}
