import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import WhatsAppButton from '@/components/WhatsAppButton'

export const metadata: Metadata = {
  title: {
    default: "Veda Heritage | Discover Kerala's Vedic & Traditional Heritage",
    template: '%s | Veda Heritage',
  },
  description:
    "Discover Kerala's temples, Vedic heritage and mantras, Ayurveda and healing plants, music, dance, astrology and wedding traditions. Hosted from a heritage home near Amritapuri.",
  keywords: [
    'Kerala heritage', 'Vedic heritage Kerala', 'Kerala mantras', 'Ayurvedic plants Kerala', 'Kathakali', 'Kerala temples', 'Kerala wedding traditions', 'Kerala astrology', 'stay near Amritapuri', 'Vavvakkavu villa',
    'Kollam heritage stay', 'Kerala Ayurveda retreat', 'Amritapuri accommodation',
    'traditional Kerala house', 'vedaheritage',
  ],
  openGraph: {
    title: "Veda Heritage | Discover Kerala's Vedic & Traditional Heritage",
    description: "A living guide to Kerala's temples, Vedic heritage, Ayurveda, healing plants, music, dance and traditions.",
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
