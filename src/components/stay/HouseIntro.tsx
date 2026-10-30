import { PHOTOS } from '@/lib/config'

/** The house exterior and its story, first thing under the Stay with us header. */
export default function HouseIntro() {
  return (
    <section className="py-14 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-5 gap-10 items-center">
        <figure className="lg:col-span-3">
          <img src={PHOTOS.house} alt={PHOTOS.houseAlt} width={1024} height={475} className="w-full h-auto rounded-sm shadow-lg" />
          <figcaption className="text-xs text-ink-mid/80 mt-2">The house in Vavvakkavu, Kollam.</figcaption>
        </figure>
        <div className="lg:col-span-2">
          <p className="section-label">Our home</p>
          <h2 className="section-title mb-4">A Kerala family home, open to the world</h2>
          <div className="accent-rule" />
          <p className="text-ink-mid leading-relaxed mb-4">
            Veda Heritage is a traditional Kerala family residence in Vavvakkavu, a quiet fishing and farming village on the backwaters of Kollam, where the land and the sea meet in ancient harmony.
          </p>
          <p className="text-ink-mid leading-relaxed mb-4">
            The home has been in the family for generations. Today, your host Yesodharan opens it to guests who come seeking the authentic Kerala, the one beyond the tourist brochures.
          </p>
          <p className="text-ink-mid leading-relaxed">
            For spiritual travellers visiting Amritapuri, it is a traditional home experience 5 km from Amma&apos;s ashram, 12 minutes by auto-rickshaw.
          </p>
        </div>
      </div>
    </section>
  )
}
