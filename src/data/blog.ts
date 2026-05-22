export interface BlogSection {
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'tip'
  text?: string
  items?: string[]
}

export interface BlogPost {
  slug: string
  title: string
  subtitle: string
  date: string
  author: string
  readTime: string
  category: 'Travel' | 'Ayurveda' | 'Kerala Culture' | 'Wellness'
  excerpt: string
  coverImage: string
  coverAlt: string
  content: BlogSection[]
  tags: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'first-timers-guide-amritapuri',
    title: "A First-Timer's Guide to Amritapuri Ashram",
    subtitle: "Everything you need to know before your first visit to Amma's ashram in Kerala",
    date: '15 April 2026',
    author: 'Yesodharan',
    readTime: '6 min read',
    category: 'Travel',
    excerpt: "Amritapuri — the ashram of Mata Amritanandamayi (Amma) — receives 30,000–40,000 visitors from 100+ countries every year. Here is everything a first-time visitor needs to know.",
    coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80',
    coverAlt: 'Serene morning light at a spiritual retreat in Kerala',
    tags: ['Amritapuri', 'Amma', 'Spiritual Travel', 'Kerala Ashram', 'Kollam'],
    content: [
      { type: 'paragraph', text: "Amritapuri — the ashram of Mata Amritanandamayi, known worldwide as Amma (Mother) — receives 30,000 to 40,000 visitors from more than 100 countries every year. It is one of India's most visited spiritual destinations and one of the most genuinely welcoming. Tucked on a narrow strip of land between the Arabian Sea and the Kayamkulam backwaters in Kollam district, it is a world unto itself." },
      { type: 'heading', text: 'How to Get There' },
      { type: 'paragraph', text: "The ashram is located in Amritapuri (Parayakadavu), about 10 km from Karunagapally town. The nearest railway station is Karunagapally (8 km), accessible from Trivandrum in 90 minutes or Kochi in 2.5 hours. From Karunagapally, an auto-rickshaw to the ashram takes 20 minutes. If you are staying at Veda Heritage in Vavvakkavu, the ashram is just 5 km away — a 12-minute auto ride." },
      { type: 'heading', text: 'What to Expect Inside' },
      { type: 'paragraph', text: "The ashram is a small city. It has resident devotees (bramhacharis and brahmacharinis), long-term and short-term guests from every country, a hospital, schools, and a tower of high-rise accommodation blocks. At its heart is the large darshan hall where Amma gives her famous hugs (darshan) — sometimes for 8–12 hours continuously." },
      { type: 'list', items: [
        'Darshan programs: Amma gives darshan on most days she is in residence. Check amritapuri.org for the schedule.',
        'Bhajans: Daily devotional singing sessions in the main hall — profoundly beautiful, open to all visitors.',
        'Seva: Short-term visitors can participate in selfless service activities. Ask at the guest office.',
        'Meditation: Various meditation and yoga programs are available throughout the day.',
        'Satsang: Evening spiritual discourses and Q&A sessions in multiple languages.',
      ]},
      { type: 'heading', text: 'Dress Code & Etiquette' },
      { type: 'paragraph', text: "Conservative clothing is required. Women: long skirts or salwar kameez, covered shoulders. Men: long trousers and covered shoulders. White or pastel colours are encouraged. Remove shoes at all hall entrances. Photography is restricted inside the darshan hall — please respect this." },
      { type: 'heading', text: 'Best Times to Visit' },
      { type: 'list', items: [
        "October – February: Peak season with ideal climate. Amma is often in residence for extended periods.",
        "Amma's Birthday (September): The biggest event of the year — up to 50,000 devotees, 3-day celebration.",
        "Onam (August–September): Kerala's harvest festival is celebrated beautifully at the ashram.",
        "Christmas–New Year: Special multicultural programs; one of the most magical times at the ashram.",
        "April–May: Hotter but quieter; more intimate time with the ashram community.",
      ]},
      { type: 'tip', text: "Stay at Veda Heritage in Vavvakkavu — just 5 km from Amritapuri. You get a traditional Kerala heritage home, an Ayurvedic garden, home-cooked Kerala food, and a peaceful base for your ashram visit — at a fraction of the ashram guesthouse rates, with far more space and privacy." },
      { type: 'heading', text: 'Practical Details' },
      { type: 'list', items: [
        'Entry is free. No ticket or reservation is needed for darshan.',
        'The ashram canteen serves three affordable vegetarian meals daily.',
        'Most ashram staff speak good English. Malayalam and Hindi also widely understood.',
        'ATM available inside the ashram compound. Visa/Mastercard accepted.',
        'Website: amritapuri.org for program schedules and announcements.',
      ]},
    ],
  },
  {
    slug: 'healing-garden-medicinal-plants',
    title: 'The Healing Garden: 8 Medicinal Plants at Veda Heritage',
    subtitle: 'A guided tour of the Ayurvedic medicinal plant garden — ancient wisdom growing in your backyard',
    date: '22 March 2026',
    author: 'Yesodharan',
    readTime: '5 min read',
    category: 'Ayurveda',
    excerpt: "Our Ayurvedic garden holds 40+ species of classical healing plants. Every morning, we walk guests through the plants and their traditional Ayurvedic uses. Here are 8 to know before you arrive.",
    coverImage: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80',
    coverAlt: 'Ayurvedic medicinal herb garden with lush green plants',
    tags: ['Ayurveda', 'Medicinal Plants', 'Brahmi', 'Kerala Garden', 'Herbal Medicine'],
    content: [
      { type: 'paragraph', text: "One of the first things guests notice at Veda Heritage is the garden. Not the coconut palms (though they are magnificent) or the traditional Kerala architecture — but the dense, fragrant, wildly alive medicinal garden that runs along the southern wall of the compound. This is our Ayurvedic garden: 40+ medicinal species, each identified with its Sanskrit name, Malayalam name, and classical use." },
      { type: 'paragraph', text: "Every morning, we walk guests through this garden. It is a 20-minute living classroom that many guests describe as the highlight of their stay. Here are 8 plants you will meet — and why the ancient texts revere them." },
      { type: 'heading', text: '1. Brahmi (Bacopa monnieri)' },
      { type: 'paragraph', text: "Perhaps the most famous Ayurvedic brain herb. Brahmi has been used in classical Ayurveda for over 3,000 years for enhancing memory, reducing anxiety, and improving concentration. In traditional Kerala households, Brahmi oil was massaged into children's scalps every morning before school. Modern neuroscience has now validated many of its documented cognitive benefits." },
      { type: 'heading', text: '2. Ashwagandha (Withania somnifera)' },
      { type: 'paragraph', text: "Known as Indian Ginseng in the West, Ashwagandha is the world's most studied Ayurvedic herb — a rasayana (rejuvenating tonic) used for stress, fatigue, immunity, and vitality. At Veda Heritage, it grows along the outer wall, its small bell-shaped flowers and distinctive red berries unmistakable in winter." },
      { type: 'heading', text: '3. Tulsi (Ocimum tenuiflorum) — Holy Basil' },
      { type: 'paragraph', text: "Tulsi is not merely a plant in a Kerala household — it is sacred. Found in the courtyard of every traditional home, Tulsi is worshipped daily and used medicinally for respiratory conditions, skin health, and stress resilience. Our garden includes three varieties: Rama Tulsi, Krishna Tulsi, and the intensely aromatic Vana Tulsi." },
      { type: 'heading', text: '4. Vetiver (Chrysopogon zizanioides) — Khus' },
      { type: 'paragraph', text: "Vetiver root has the most extraordinary cooling quality of any Ayurvedic plant. In Kerala's summer months, vetiver khus water is consumed daily to prevent heat stroke. The roots are also woven into traditional khas-khas mats used to cool rooms. Our vetiver grove provides roots for guest cooling teas and our treatment room." },
      { type: 'heading', text: '5. Neem (Azadirachta indica)' },
      { type: 'paragraph', text: "Called 'the village pharmacy' in Kerala, every part of the neem tree — leaf, bark, root, seed, oil — serves a medicinal purpose. Antibacterial, antifungal, anti-inflammatory, and deeply detoxifying. Traditional households use neem twigs as toothbrushes and neem leaf baths for skin conditions. Our 40-year-old neem tree anchors the garden." },
      { type: 'heading', text: '6. Turmeric (Curcuma longa) — Manjal' },
      { type: 'paragraph', text: "Turmeric is consumed in Kerala cuisine three times a day, every day. Medicinally it is an anti-inflammatory, wound healer, digestive aid, and immune booster. Our Kerala-variety manjal is deeply golden and intensely aromatic — far more potent than commercially available turmeric powder." },
      { type: 'heading', text: '7. Curry Leaf (Murraya koenigii)' },
      { type: 'paragraph', text: "Impossible to understand Kerala cooking without curry leaves — and equally impossible to understand Kerala medicine without them. Used for diabetes management, cholesterol reduction, hair growth, and digestion. Rich in iron, calcium, and vitamins A, B, and C. Fresh from our garden every morning." },
      { type: 'heading', text: '8. Aloe Vera (Kumari)' },
      { type: 'paragraph', text: "Kumari — the 'young maiden' — is one of the most widely used classical Ayurvedic herbs for skin healing, digestion, and feminine health. Our garden has the large, thick-leafed variety that produces the most medicinally active gel. Guests often request a fresh leaf after a beach day at Vavvakkavu." },
      { type: 'tip', text: "Every morning at 7 AM, your host walks guests through the garden. This is completely free and takes about 20 minutes. It is one of the most-mentioned experiences in our guest reviews. Simply let us know the evening before." },
    ],
  },
  {
    slug: 'kerala-december-best-season',
    title: 'Kerala in December: Why Winter is the Perfect Season',
    subtitle: 'Climate, festivals, the Ayurveda season, and why Christmas at Amritapuri is unforgettable',
    date: '5 November 2025',
    author: 'Yesodharan',
    readTime: '4 min read',
    category: 'Travel',
    excerpt: "December is Kerala's most beautiful month. The monsoon has passed, the air is crystalline, and Amritapuri hosts one of the most moving Christmas celebrations in India. Here is why winter is the best time to visit.",
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    coverAlt: 'Beautiful Kerala coastline bathed in golden winter light',
    tags: ['Kerala Winter', 'December Travel', 'Christmas Amritapuri', 'Kerala Season', 'Ayurveda Season'],
    content: [
      { type: 'paragraph', text: "If you visit Kerala only once, visit in December. The monsoon rains have completely withdrawn. The air carries an extraordinary clarity — sharp, cool, fragrant with the post-rain earth. The paddy fields around Vavvakkavu are golden with the harvest. The backwaters are still and reflective. Temperature sits at a glorious 24–28°C, cool enough for deep Ayurveda treatments, warm enough for swimming." },
      { type: 'heading', text: 'The Climate' },
      { type: 'paragraph', text: "December–February is Kerala's peak season for good reason. Days are sunny and warm (24–30°C). Evenings are pleasantly cool. Humidity drops significantly. The Arabian Sea is calm and beautiful for swimming. The beaches near Vavvakkavu are at their best — clean, quiet, and uncrowded." },
      { type: 'heading', text: 'The Ayurveda Season' },
      { type: 'paragraph', text: "Traditional Ayurvedic practitioners consider Hemanta (early winter, November–January) one of the three ideal seasons for intensive Ayurvedic treatments. The cool, dry climate is perfect for oil-based therapies: Abhyanga, Shirodhara, and Njavara Kizhi. The body absorbs oils deeply in the cool season, making treatments significantly more effective than in summer. If you plan to do serious Ayurveda, come in winter." },
      { type: 'heading', text: 'Christmas at Amritapuri' },
      { type: 'paragraph', text: "The ashram's Christmas celebrations have become legendary among devotees worldwide. Amma sees Christ as a divine avatar and celebrates Christmas with remarkable depth and sincerity. The ashram is decorated with thousands of lights. Carols are sung in 30+ languages. Amma gives special extended darshan. International devotees from every faith gather in a display of spiritual unity that is deeply moving to witness." },
      { type: 'heading', text: 'What to Do in December at Vavvakkavu' },
      { type: 'list', items: [
        "Attend Amma's darshan programs at Amritapuri (5 km) — the ashram is at its most vibrant",
        'Walk the Vavvakkavu beach at sunrise — the winter light is extraordinary',
        'Take a full Abhyanga treatment at Veda Heritage — the optimal season for oil therapies',
        'Backwater boat ride from Karunagapally or Kollam town',
        'Day trip to Alappuzha (Alleppey) — houseboat on the famous backwaters',
        'Visit Krishnapuram Palace Museum (25 km) — Kerala murals of exceptional quality',
        'Christmas Eve at the ashram — the midnight program is unmissable',
      ]},
      { type: 'tip', text: "Book 6–8 weeks in advance for December. Veda Heritage fills up quickly during the peak winter season, especially around Christmas and New Year. Contact us directly on WhatsApp for priority booking and extended-stay rates." },
    ],
  },
  {
    slug: 'abhyanga-kerala-oil-massage',
    title: "Abhyanga: Kerala's Ancient Oil Massage Ritual",
    subtitle: 'The 5,000-year-old full-body oil massage — what it is, what it does, and how we practise it',
    date: '18 January 2026',
    author: 'Veda Heritage Team',
    readTime: '5 min read',
    category: 'Ayurveda',
    excerpt: "Abhyanga is the cornerstone of classical Ayurvedic daily practice — a full-body warm oil massage that nourishes every tissue, calms the nervous system, and reverses the effects of stress. Here is everything you need to know.",
    coverImage: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80',
    coverAlt: 'Traditional Ayurvedic warm oil massage treatment',
    tags: ['Abhyanga', 'Ayurvedic Massage', 'Kerala Wellness', 'Oil Massage', 'Ayurveda Treatment'],
    content: [
      { type: 'paragraph', text: "Of all the practices in Ayurveda's daily routine (dinacharya), abhyanga — full-body warm oil massage — is considered the most nourishing and transformative. The Ashtanga Hridayam states: 'Abhyangam aacharet nityam' — 'One should practise abhyanga daily.' Not as an occasional luxury. Daily." },
      { type: 'heading', text: 'What Is Abhyanga?' },
      { type: 'paragraph', text: "Abhyanga is a full-body warm oil massage performed by a trained therapist, typically lasting 60–90 minutes. The oil is chosen according to the recipient's prakriti (constitution) and vikruti (current imbalance). Applied in long strokes along the muscles, circular strokes at the joints, and deep pressure at marma points (vital energy centres). After the massage, the recipient rests for 15–20 minutes, then takes a warm herbal bath." },
      { type: 'heading', text: 'The Classical Oils We Use' },
      { type: 'paragraph', text: "At Veda Heritage, we use authentic Vaidyaratnam classical oils — the same formulations prepared according to thousand-year-old classical texts:" },
      { type: 'list', items: [
        "Dhanwantaram Thailam: Named for Dhanwantari, the divine physician of Ayurveda. The most classical Kerala massage oil — for general rejuvenation, joint health, and nervous system support.",
        "Ksheerabala Thailam: Milk + bala root + sesame oil. Particularly effective for vata conditions — anxiety, insomnia, dry skin, stiffness.",
        "Murivenna: 'Wound oil' — the fastest-healing topical oil in classical Ayurveda. Used for injuries, inflammation, and chronic joint conditions.",
        "Kunkumadi Thailam: The renowned saffron-based face oil — for skin brightness, even tone, and calm.",
      ]},
      { type: 'heading', text: 'What Does It Do?' },
      { type: 'list', items: [
        "Calms the nervous system: Within 20 minutes, cortisol levels drop measurably",
        "Improves lymphatic circulation: Long strokes actively promote lymph drainage",
        "Deeply nourishes skin: Warm oil penetrates multiple skin layers and the deeper tissues beneath",
        "Relieves joint stiffness: Particularly effective for vata-related conditions",
        "Improves sleep quality: Regular abhyanga is as effective as some sleep medications in clinical studies",
        "Reduces anxiety and mental restlessness: The combination of warm oil and sustained therapeutic touch has profound psychological effects",
      ]},
      { type: 'heading', text: 'Abhyanga at Veda Heritage' },
      { type: 'paragraph', text: "Our treatments are performed in a dedicated traditional treatment room with a wooden droni (carved massage table), proper drainage, and full privacy. Our therapist has practised in the traditional guru-shishya (teacher-student) lineage for over 15 years. Sessions are 60 or 90 minutes." },
      { type: 'tip', text: "Book your treatment 24 hours in advance. Avoid eating for 90 minutes before the treatment. Wear loose clothing you do not mind getting a little oil on — the oil is entirely natural and washes out easily. After treatment, rest for at least 30 minutes before any activity." },
    ],
  },
]
