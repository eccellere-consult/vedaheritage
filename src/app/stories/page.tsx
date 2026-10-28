import type { Metadata } from 'next'
import { SITE_URL, getEntries, getStories } from '@/lib/content'
import StoryList from '@/components/StoryList'
import StoryForm from '@/components/StoryForm'

import PageHero from '@/components/PageHero'

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
      <PageHero label="Community" title="Traveller Stories & Notes" subtitle="A tip that saved your day, a folk tale a local told you, a moment you will not forget — share it for the next traveller." />
      <section className="py-14 bg-surface">
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
