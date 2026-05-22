'use client'

import { useState } from 'react'
import { WA, SITE } from '@/lib/config'

type FormState = 'idle' | 'sending' | 'success' | 'error'

export default function ContactPage() {
  const [state, setState] = useState<FormState>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setError('')

    const form = e.currentTarget
    const data = new FormData(form)

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: data,
      })
      const json = await res.json()

      if (json.success) {
        setState('success')
        form.reset()
      } else {
        setError(json.message || 'Something went wrong. Please try WhatsApp instead.')
        setState('error')
      }
    } catch {
      setError('Could not send your message. Please try WhatsApp instead.')
      setState('error')
    }
  }

  return (
    <>
      {/* Header */}
      <section
        className="pt-32 pb-20 text-center"
        style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}
      >
        <p className="font-sans text-gold/80 text-xs tracking-[0.25em] uppercase mb-3">Reservations</p>
        <h1 className="font-serif text-5xl text-white mb-4">Book & Contact</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-lg mx-auto text-sm leading-relaxed px-4">
          Book instantly on Airbnb, or send us a message — we respond within the hour.
          For extended stays or group bookings, WhatsApp is fastest.
        </p>
      </section>

      <section className="py-24 bg-cream">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

            {/* Left: contact options */}
            <div>
              <p className="section-label">Quickest Options</p>
              <h2 className="font-serif text-3xl text-ink mb-2">Get in Touch</h2>
              <div className="gold-rule mb-8" />

              {/* WhatsApp — primary */}
              <a
                href={WA.enquiry}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 bg-[#25D366] text-white px-6 py-4 mb-4 hover:bg-[#1ebe5d] transition-colors"
              >
                <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L.057 23.882a.5.5 0 0 0 .613.613l6.035-1.465A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.844 0-3.575-.49-5.068-1.348l-.363-.214-3.757.912.928-3.757-.228-.374A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                <div>
                  <p className="font-medium text-sm">WhatsApp (Fastest)</p>
                  <p className="text-white/80 text-xs">{SITE.phoneDisplay} · Usually replies within 1 hour</p>
                </div>
              </a>

              {/* Airbnb */}
              <a
                href="https://www.airbnb.co.in/h/stay-near-amritapuri"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 bg-[#FF5A5F] text-white px-6 py-4 mb-4 hover:bg-[#e54e53] transition-colors"
              >
                <span className="text-2xl flex-shrink-0">🏠</span>
                <div>
                  <p className="font-medium text-sm">Book on Airbnb</p>
                  <p className="text-white/80 text-xs">Instant booking · Secure payment · Free cancellation</p>
                </div>
              </a>

              {/* Email */}
              <a
                href="mailto:stay@vedaheritage.co.in"
                className="flex items-center gap-4 bg-white border border-gold/30 px-6 py-4 mb-8 hover:border-gold transition-colors"
              >
                <span className="text-2xl flex-shrink-0">✉️</span>
                <div>
                  <p className="font-medium text-sm text-ink">Email Us</p>
                  <p className="text-ink-mid text-xs">stay@vedaheritage.co.in · Response within 4 hours</p>
                </div>
              </a>

              {/* Address */}
              <div className="bg-gold-pale p-6 border-l-4 border-gold">
                <p className="section-label mb-3">Our Address</p>
                <p className="text-sm text-ink-mid leading-relaxed">
                  Veda Heritage<br />
                  Vavvakkavu, Karunagapally<br />
                  Kollam District, Kerala 690536<br />
                  India
                </p>
                <p className="text-xs text-gold mt-3 italic">
                  GPS pin shared on WhatsApp after booking confirmation.
                </p>
              </div>
            </div>

            {/* Right: form */}
            <div>
              <p className="section-label">Enquiry Form</p>
              <h2 className="font-serif text-3xl text-ink mb-2">Send a Message</h2>
              <div className="gold-rule mb-8" />

              {state === 'success' ? (
                <div className="bg-forest text-white p-8 text-center">
                  <div className="text-4xl mb-3">✓</div>
                  <h3 className="font-serif text-xl mb-2">Message Sent!</h3>
                  <p className="text-white/80 text-sm">
                    Thank you. Yesodharan will reply within a few hours. For urgent queries, please WhatsApp directly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Web3Forms access key — replace with your key from web3forms.com (free) */}
                  <input type="hidden" name="access_key" value="YOUR_WEB3FORMS_ACCESS_KEY" />
                  <input type="hidden" name="subject" value="New enquiry from vedaheritage.co.in" />
                  <input type="hidden" name="from_name" value="Veda Heritage Website" />
                  <input type="checkbox" name="botcheck" className="hidden" style={{ display: 'none' }} />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-sans uppercase tracking-wider text-ink-mid mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        className="w-full border border-gold/30 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-sans uppercase tracking-wider text-ink-mid mb-1">
                        Country *
                      </label>
                      <input
                        type="text"
                        name="country"
                        required
                        className="w-full border border-gold/30 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                        placeholder="e.g. Germany"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-sans uppercase tracking-wider text-ink-mid mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full border border-gold/30 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-sans uppercase tracking-wider text-ink-mid mb-1">
                        Arrival Date
                      </label>
                      <input
                        type="date"
                        name="arrival_date"
                        className="w-full border border-gold/30 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-sans uppercase tracking-wider text-ink-mid mb-1">
                        Departure Date
                      </label>
                      <input
                        type="date"
                        name="departure_date"
                        className="w-full border border-gold/30 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-sans uppercase tracking-wider text-ink-mid mb-1">
                      Number of Guests
                    </label>
                    <select
                      name="guests"
                      className="w-full border border-gold/30 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                    >
                      <option value="1">1 guest</option>
                      <option value="2">2 guests</option>
                      <option value="3">3 guests</option>
                      <option value="4">4 guests</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-sans uppercase tracking-wider text-ink-mid mb-1">
                      Your Message
                    </label>
                    <textarea
                      name="message"
                      rows={4}
                      className="w-full border border-gold/30 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-forest resize-none"
                      placeholder="Tell us about your visit — Amritapuri program, Ayurveda interest, special requirements..."
                    />
                  </div>

                  {state === 'error' && (
                    <p className="text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-2">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={state === 'sending'}
                    className="btn-primary text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {state === 'sending' ? 'Sending…' : 'Send Enquiry →'}
                  </button>

                  <p className="text-xs text-ink-mid/50 text-center">
                    Or book instantly on{' '}
                    <a
                      href="https://www.airbnb.co.in/h/stay-near-amritapuri"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold hover:underline"
                    >
                      Airbnb
                    </a>
                    {' '}·{' '}
                    <a
                      href={WA.base}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold hover:underline"
                    >
                      WhatsApp
                    </a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
