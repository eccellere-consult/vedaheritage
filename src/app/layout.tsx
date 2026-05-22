import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import WhatsAppButton from '@/components/WhatsAppButton'

export const metadata: Metadata = {
  title: {
    default: 'Veda Heritage | Traditional Kerala Retreat near Amritapuri',
    template: '%s | Veda Heritage',
  },
  description:
    'Veda Heritage — a traditional Kerala heritage villa in Vavvakkavu, Kollam. 5 km from Amritapuri Ashram. Ayurvedic garden, heritage stay, authentic Kerala experience.',
  keywords: [
    'Kerala heritage retreat', 'stay near Amritapuri', 'Vavvakkavu villa',
    'Kollam heritage stay', 'Kerala Ayurveda retreat', 'Amritapuri accommodation',
    'traditional Kerala house', 'vedaheritage',
  ],
  openGraph: {
    title: 'Veda Heritage | Traditional Kerala Retreat near Amritapuri',
    description: 'A traditional heritage villa in Vavvakkavu, Kollam — 5 km from Amritapuri. Ayurvedic garden, heritage rooms, authentic Kerala.',
    url: 'https://www.vedaheritage.co.in',
    siteName: 'Veda Heritage',
    locale: 'en_IN',
    type: 'website',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.vedaheritage.co.in' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  )
}
