import { BLOG_POSTS, BlogSection } from '@/data/blog'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

export async function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = BLOG_POSTS.find(p => p.slug === slug)
  if (!post) return { title: 'Not Found' }
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.coverImage }],
    },
  }
}

function renderSection(section: BlogSection, i: number) {
  switch (section.type) {
    case 'heading':
      return (
        <h2 key={i} className="font-serif text-2xl text-ink mt-10 mb-3">
          {section.text}
        </h2>
      )
    case 'paragraph':
      return (
        <p key={i} className="text-ink-mid leading-relaxed mb-5">
          {section.text}
        </p>
      )
    case 'list':
      return (
        <ul key={i} className="mb-6 space-y-2">
          {section.items?.map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-sm text-ink-mid">
              <span className="text-gold mt-1 flex-shrink-0 text-lg leading-none">›</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'tip':
      return (
        <div key={i} className="my-8 border-l-4 border-gold bg-gold-pale p-6">
          <p className="text-xs font-sans font-bold text-gold tracking-widest uppercase mb-2">Host Tip</p>
          <p className="text-ink-mid text-sm leading-relaxed italic font-serif text-base">{section.text}</p>
        </div>
      )
    case 'quote':
      return (
        <blockquote key={i} className="my-8 pl-6 border-l-4 border-forest">
          <p className="font-serif text-xl text-ink italic leading-relaxed">{section.text}</p>
        </blockquote>
      )
    default:
      return null
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = BLOG_POSTS.find(p => p.slug === slug)
  if (!post) notFound()

  const otherPosts = BLOG_POSTS.filter(p => p.slug !== post.slug).slice(0, 2)

  return (
    <>
      {/* Hero */}
      <div className="relative h-72 md:h-96 pt-16 overflow-hidden">
        <img
          src={post.coverImage}
          alt={post.coverAlt}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-ink/60" />
        <div className="relative h-full flex flex-col justify-end pb-10 px-4 max-w-4xl mx-auto">
          <span className="text-gold text-xs font-sans tracking-widest uppercase mb-3">{post.category}</span>
          <h1 className="font-serif text-3xl md:text-5xl text-white leading-tight mb-3">{post.title}</h1>
          <div className="flex items-center gap-4 text-white/60 text-xs font-sans">
            <span>{post.author}</span>
            <span>·</span>
            <span>{post.date}</span>
            <span>·</span>
            <span>{post.readTime}</span>
          </div>
        </div>
      </div>

      {/* Article */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Subtitle */}
          <p className="font-serif text-xl text-ink-mid italic mb-8 pb-8 border-b border-gold/20">
            {post.subtitle}
          </p>

          {/* Content */}
          <article>{post.content.map((s, i) => renderSection(s, i))}</article>

          {/* Tags */}
          <div className="mt-12 pt-6 border-t border-gold/20 flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs bg-gold-pale text-ink-mid border border-gold/30 px-3 py-1">
                {tag}
              </span>
            ))}
          </div>

          {/* Book CTA */}
          <div className="mt-12 bg-forest text-white p-8 text-center">
            <p className="font-serif text-xl text-gold mb-2">Experience It Yourself</p>
            <p className="text-white/80 text-sm mb-4">
              Stay at Veda Heritage — 5 km from Amritapuri, traditional Kerala home, Ayurvedic garden.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://www.airbnb.co.in/h/stay-near-amritapuri"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold text-xs"
              >
                Book on Airbnb
              </a>
              <a
                href="https://wa.me/919964694566?text=Hello%2C%20I%20read%20your%20blog%20and%20would%20like%20to%20book%20a%20stay."
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline border-white text-white hover:bg-white hover:text-forest text-xs"
              >
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* More posts */}
      {otherPosts.length > 0 && (
        <section className="py-16 bg-cream">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <p className="section-label text-center mb-8">More from the Blog</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {otherPosts.map(p => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group bg-white shadow-sm hover:shadow-md transition-shadow">
                  <img src={p.coverImage} alt={p.coverAlt} className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity" />
                  <div className="p-5">
                    <p className="text-gold text-xs font-sans uppercase tracking-wider mb-2">{p.category}</p>
                    <h3 className="font-serif text-lg text-ink group-hover:text-forest transition-colors">{p.title}</h3>
                    <p className="text-xs text-ink-mid mt-2">{p.readTime}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/blog" className="btn-outline border-forest text-forest text-xs">
                ← All Posts
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
