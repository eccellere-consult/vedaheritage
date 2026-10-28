import type { Metadata } from 'next'
import { SITE_URL, getEntries, getStories } from '@/lib/content'
import StoryList from '@/components/StoryList'
import StoryForm from '@/components/StoryForm'

export const metadata: Metadata = {
  title: 'Traveller Stories & Notes from Kerala',
  description: 'Real notes, tips and folk tales from travellers and locals across Kerala. Read them, and share your own.',
  alternates: { canonical: `${SITE_URL}/stories/` },
}

export default function StoriesPage() {
  const stories = getStories()
  const places = getEntries().map(x => ({ category: x.category, slug: x.slug, name: x.name }))
  return (
    <>
      <section className="pt-32 pb-16 text-center" style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}>
        <p className="section-label text-gold/80">Community</p>
        <h1 className="font-serif text-4xl md:text-5xl text-white mb-4 px-4">Traveller Stories &amp; Notes</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed px-4">
          A tip that saved your day, a folk tale a local told you, a moment you will not forget — share it for the next traveller.
        </p>
      </section>
      <section className="py-14 bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <StoryList stories={stories} />
          <h2 className="section-title mt-14 mb-4">Share your story</h2>
          <p className="text-sm text-ink-mid mb-4">Stories are reviewed twice a week. Only your first name and home town are shown.</p>
          <StoryForm places={places} />
        </div>
      </section>
    </>
  )
}
