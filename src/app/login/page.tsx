import type { Metadata } from 'next'
import PageHero from '@/components/PageHero'
import LoginHub from '@/components/commerce/LoginHub'

export const metadata: Metadata = { title: 'Register or sign in', description: 'Register or sign in as a traveller, partner or service provider with Veda Heritage.', robots: { index: false, follow: true } }

export default function Page() {
  return (<><PageHero label="Welcome" title="Register or sign in" subtitle="Travellers, partners and service providers, in one place." /><section className="py-10 bg-surface"><div className="max-w-5xl mx-auto px-4 sm:px-6"><LoginHub /></div></section></>)
}
