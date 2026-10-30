import type { Metadata } from 'next'
import { WA, SITE } from '@/lib/config'
import HouseIntro from '@/components/stay/HouseIntro'
import HouseSection from '@/components/stay/HouseSection'
import GardenSection from '@/components/stay/GardenSection'
import GallerySection from '@/components/stay/GallerySection'
import LocationSection from '@/components/stay/LocationSection'
import BookingSection from '@/components/stay/BookingSection'

export const metadata: Metadata = {
  title: 'Stay with us: Heritage Home near Amritapuri, Kollam',
  description: 'Two heritage rooms, an Ayurvedic garden, photos, directions and booking for the Veda Heritage family home in Vavvakkavu, Kollam, 5 km from Amritapuri.',
  alternates: { canonical: 'https://www.vedaheritage.co.in/stay/' },
}

const ANCHORS = [['house', 'The house'], ['garden', 'Garden & Ayurveda'], ['gallery', 'Photos'], ['location', 'Location'], ['book', 'Book']]

export default function StayPage() {
  return (
    <>
      <section className="pt-32 pb-14 text-center bg-hero-gradient">
        <p className="section-label text-accent-light">Stay with us</p>
        <h1 className="font-serif text-4xl md:text-5xl text-white mb-4">A Kerala family home near Amritapuri</h1>
        <div className="w-12 h-px bg-accent mx-auto mb-4" />
        <p className="text-white/75 max-w-xl mx-auto text-sm leading-relaxed px-4">
          Two heritage rooms, an Ayurvedic garden and a quiet compound in Vavvakkavu, Kollam, 5 km from Amritapuri.
          Everything about the stay is on this page.
        </p>
        <div className="flex gap-4 justify-center mt-6">
          <a href={SITE.airbnb} target="_blank" rel="noopener noreferrer" className="btn-accent text-xs">Book on Airbnb</a>
          <a href={WA.enquiry} target="_blank" rel="noopener noreferrer" className="btn-outline border-white text-white hover:bg-white hover:text-primary text-xs">WhatsApp</a>
        </div>
      </section>

      <nav aria-label="On this page" className="sticky top-16 xl:top-20 z-40 bg-white/95 backdrop-blur-sm border-b border-accent/20">
        <div className="max-w-6xl mx-auto px-4 flex gap-6 overflow-x-auto py-3 text-sm whitespace-nowrap justify-center">
          {ANCHORS.map(([id, label]) => <a key={id} href={`#${id}`} className="nav-link">{label}</a>)}
        </div>
      </nav>

      <HouseIntro />

      <div id="house" className="scroll-mt-32"><HouseSection /></div>
      <div id="garden" className="scroll-mt-32"><GardenSection /></div>
      <div id="gallery" className="scroll-mt-32"><GallerySection /></div>
      <div id="location" className="scroll-mt-32"><LocationSection /></div>
      <div id="book" className="scroll-mt-32"><BookingSection /></div>
    </>
  )
}
