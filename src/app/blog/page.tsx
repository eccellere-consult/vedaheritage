import type { Metadata } from 'next'
import Link from 'next/link'
import { BLOG_POSTS } from '@/data/blog'

export const metadata: Metadata = {
  title: 'Blog — Travel, Ayurveda & Kerala Culture',
  description: 'Travel guides, Ayurveda insights, and Kerala culture from Veda Heritage — a traditional retreat near Amritapuri, Kollam.',
}

const CATEGORY_COLOURS: Record<string, string> = {
  'Travel': 'bg-blue-100 text-blue-800',
  'Ayurveda': 'bg-green-100 text-green-800',
  'Kerala Culture': 'bg-amber-100 text-amber-800',
  'Wellness': 'bg-purple-100 text-purple-800',
}

export default function BlogPage() {
  return (
    <>
      {/* Header */}
      <section
        className="pt-32 pb-20 text-center"
        style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}
      >
        <p className="section-label text-gold/80">Stories & Guides</p>
        <h1 className="font-serif text-5xl text-white mb-4">Blog</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed px-4">
          Travel guides, Ayurveda wisdom, Kerala culture, and insider knowledge from life at Vavvakkavu — near Amritapuri.
        </p>
      </section>

      {/* Posts grid */}
      <section className="py-24 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {BLOG_POSTS.map(post => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col"
              >
                {/* Cover image */}
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={post.coverImage}
                    alt={post.coverAlt}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-xs font-sans font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLOURS[post.category]}`}>
                      {post.category}
                    </span>
                    <span className="text-ink-mid/40 text-xs">{post.readTime}</span>
                  </div>

                  <h2 className="font-serif text-xl text-ink mb-2 group-hover:text-forest transition-colors duration-150">
                    {post.title}
                  </h2>
                  <p className="text-sm text-ink-mid leading-relaxed mb-4 flex-1">{post.excerpt}</p>

                  <div className="flex items-center justify-between pt-4 border-t border-gold/20">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-forest flex items-center justify-center">
                        <span className="text-white text-xs font-medium">{post.author[0]}</span>
                      </div>
                      <span className="text-xs text-ink-mid">{post.author}</span>
                    </div>
                    <span className="text-xs text-ink-mid/50">{post.date}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter / WhatsApp subscribe */}
      <section className="py-16 bg-forest text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-serif text-3xl text-white mb-3">Never Miss a Story</h2>
          <p className="text-white/70 text-sm mb-6">
            New guides, seasonal tips, and retreat stories — follow us on WhatsApp or email.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/919964694566?text=Please%20keep%20me%20updated%20on%20Veda%20Heritage%20blog%20posts%20and%20events."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold text-xs"
            >
              Follow on WhatsApp
            </a>
            <a href="mailto:stay@vedaheritage.co.in?subject=Subscribe to Veda Heritage updates" className="btn-outline border-white text-white hover:bg-white hover:text-forest text-xs">
              Email Subscribe
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
