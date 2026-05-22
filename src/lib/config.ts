// ═══════════════════════════════════════════════════════════════════
// VEDA HERITAGE — SITE CONFIGURATION
// Update this file to change phone numbers, emails, and photo URLs
// across the entire website in one place.
// ═══════════════════════════════════════════════════════════════════

export const SITE = {
  name: 'Veda Heritage',
  tagline: "Where Kerala's Soul Lives",
  phone: '919964694566',
  phoneDisplay: '+91 99646 94566',
  email: 'stay@vedaheritage.co.in',
  airbnb: 'https://www.airbnb.co.in/h/stay-near-amritapuri',
  address: {
    line1: 'Vavvakkavu, Karunagapally',
    line2: 'Kollam District, Kerala 690536',
    country: 'India',
  },
}

export const WA = {
  base: `https://wa.me/${SITE.phone}`,
  enquiry: `https://wa.me/${SITE.phone}?text=Hello%2C%20I%20am%20interested%20in%20staying%20at%20Veda%20Heritage%20near%20Amritapuri.`,
  directions: `https://wa.me/${SITE.phone}?text=Hello%2C%20I%20need%20directions%20to%20Veda%20Heritage.`,
  book: `https://wa.me/${SITE.phone}?text=Hello%2C%20I%20would%20like%20to%20book%20Veda%20Heritage.`,
  products: `https://wa.me/${SITE.phone}?text=Hello%2C%20I%20would%20like%20to%20know%20more%20about%20your%20Ayurveda%20products.`,
}

// ═══════════════════════════════════════════════════════════════════
// PHOTOS
// To swap any photo: replace the URL below with your own image path
// or any Unsplash URL. Unsplash photos are free (unsplash.com/license)
//
// To use your own photos:
//   1. Place files in veda-heritage/public/images/
//   2. Replace URL with: '/images/your-photo.jpg'
// ═══════════════════════════════════════════════════════════════════
export const PHOTOS = {

  // Home page — full-screen hero banner
  hero: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1600&q=85',
  heroAlt: 'Lush Kerala backwaters at dawn — Veda Heritage',

  // Home page — About section
  about: '/images/vedaheritage_1.png',
  aboutAlt: 'Veda Heritage — Traditional Kerala family home in Vavvakkavu, Kollam',

  // Ayurveda — Medicinal garden
  garden: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80',
  gardenAlt: 'Medicinal herbs and Ayurvedic plants in the traditional garden',

  // Ayurveda — Treatment room
  treatment: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80',
  treatmentAlt: 'Traditional Ayurvedic oil treatment and massage room',

  // Ayurveda — Oils and products
  oils: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80',
  oilsAlt: 'Classical Ayurvedic oils, herbs and natural wellness products',

  // Stay — The Heritage Room (bedroom 1)
  room1: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
  room1Alt: 'The Heritage Room — traditional bedroom with teakwood fittings',

  // Stay — The Terrace Room (bedroom 2)
  room2: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80',
  room2Alt: 'The Terrace Room with private balcony and coconut grove view',

  // Gallery — 12 photos (add/remove/replace freely)
  gallery: [
    { src: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80', alt: 'Kerala backwaters at dawn', caption: 'The Backwaters of Kollam' },
    { src: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80', alt: 'Ayurvedic medicinal garden', caption: 'Our Medicinal Garden' },
    { src: '/images/vedaheritage_2.png', alt: 'Veda Heritage — three views at golden hour, sunset and dawn', caption: 'Veda Heritage — Authentic Kerala Living' },
    { src: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80', alt: 'Heritage bedroom', caption: 'The Heritage Room' },
    { src: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80', alt: 'Terrace room with balcony', caption: 'The Terrace Room' },
    { src: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80', alt: 'Ayurvedic treatment room', caption: 'Ayurvedic Treatments' },
    { src: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80', alt: 'Ayurvedic oils and herbs', caption: 'Classical Ayurveda Products' },
    { src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', alt: 'Kerala coastal sunrise', caption: 'Morning on the Coast' },
    { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80', alt: 'Lush green Kerala landscape', caption: 'Kerala in Monsoon' },
    { src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80', alt: 'Kerala sunset over water', caption: 'Sunset from the Retreat' },
    { src: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80', alt: 'Tropical coconut palms at sunrise', caption: 'Coconut Grove Morning' },
    { src: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80', alt: 'Traditional Kerala cuisine on banana leaf', caption: 'Traditional Kerala Sadya' },
  ],
}
