// Official government and public-transport links used across Discover Kerala.
// Verified weekly by .github/workflows/link-check.yml (scripts/check-links.mjs).
// We link out only; Veda Heritage is not affiliated with these bodies.

export interface OfficialLink {
  label: string
  url: string
  note: string
  group: 'Tourism' | 'Train' | 'Bus' | 'Water' | 'Temples'
}

export const OFFICIAL_LINKS: OfficialLink[] = [
  { group: 'Tourism', label: 'Kerala Tourism (Government of Kerala)', url: 'https://www.keralatourism.org/', note: 'Official destination guide, festivals, accredited Ayurveda centres and classified stays.' },
  { group: 'Tourism', label: 'KTDC — Kerala Tourism Development Corporation', url: 'https://www.ktdc.com/', note: 'Government-run hotels, resorts, tour packages and houseboat bookings.' },
  { group: 'Train', label: 'IRCTC — Book train tickets', url: 'https://www.irctc.co.in/', note: 'Indian Railways official ticket booking.' },
  { group: 'Train', label: 'NTES — Live train status', url: 'https://enquiry.indianrail.gov.in/ntes/', note: 'Running status, timetables and platform information from Indian Railways.' },
  { group: 'Bus', label: 'KSRTC Swift — Book Kerala state buses', url: 'https://onlineksrtcswift.com/', note: 'Kerala State Road Transport Corporation reservations for long-distance and Swift services.' },
  { group: 'Water', label: 'SWTD — State Water Transport Department', url: 'https://swtd.kerala.gov.in/', note: 'Public ferry and backwater boat services, including Alappuzha–Kottayam and Kollam–Alappuzha.' },
  { group: 'Temples', label: 'Travancore Devaswom Board', url: 'https://travancoredevaswomboard.org/', note: 'Administers Sabarimala and many temples in southern Kerala.' },
]

export const linksFor = (group: OfficialLink['group']) => OFFICIAL_LINKS.filter(l => l.group === group)
