# Marketplace: moderated classifieds

**Model:** sellers submit items, the owner approves them, buyers send enquiries, the owner introduces buyer and seller, and the sale happens between them. The site holds no stock, takes **no payments**, ships nothing and guarantees nothing.

## Flow
1. Seller opens `/marketplace/sell/`, fills the form with 1 to 3 photos and ticks two confirmations (ownership and not-an-antiquity, and consent to publish).
2. `submit-listing.php` validates, re-encodes photos (EXIF and GPS stripped), and stores the submission **privately** on Hostinger.
3. Admin → **Marketplace** tab: review photos, text, risk flags and the seller's private contact. **Approve & publish** commits the public listing JSON and photos to `main` in one commit (one deploy). **Reject** deletes photos and contact details immediately.
4. The listing shows for 90 days at `/marketplace/<id>/` (expired listings disappear at the next rebuild).
5. A buyer sends an enquiry (`submit-enquiry.php`). It appears under **Enquiries to introduce**, next to the seller's contact. You introduce them by email or WhatsApp, then click **Mark introduced** (the buyer's details are deleted).
6. **Mark sold** or **Remove** when done. Remove deletes the seller's contact details.

## Where data lives
| Data | Where | Public? |
|---|---|---|
| Seller name, email, phone; buyer name, email, phone, message | `vh-data/market/` on Hostinger, **outside** `public_html` | No |
| Listing text, price, district, seller first name, photos | `src/content/listings/*.json` and `public/images/marketplace/` in the **public** GitHub repo | Yes, after approval |

Contact details are never written to GitHub (the repository is public). `npm run validate` fails if a listing file contains an email, phone number or contact field.

## Rules enforced in code
- Price is a whole number from 1 to 500,000 rupees; category and condition are from fixed lists; no web links in text; honeypot; rate limits (3 listings per hour and 8 per day, 5 enquiries per hour, per address).
- Approval is blocked without a photo, valid price, description length, and the seller declaration.
- Risk flags need an explicit override: animal materials, regulated timber, "antique/century/manuscript", idols and temple items, medicine or health claims, live plants and seeds, precious metals, authenticity claims, advance-payment wording.

## Optional email alerts
Add `'notify_email' => 'you@example.com'` to `vh-config.php` to get a one-line email when a listing or enquiry arrives (it contains the item title only, no personal data).

## Before you open this to the public (please read)
This is a build, not legal advice. Before promoting the marketplace, have a lawyer confirm at least:
1. **Your role.** Facilitating sales between others may bring obligations under India's Consumer Protection (E-Commerce) Rules 2020 and the IT (Intermediary Guidelines) Rules 2021 (for example a grievance contact and takedown process). Terms of use and a disclaimer need legal wording.
2. **Personal data.** The Digital Personal Data Protection Act 2023 applies to the contact details you collect: notice, consent, purpose limitation, retention and deletion. The forms and rules page contain a plain-language version; counsel should check it.
3. **Restricted items.** The "not allowed" list on `/marketplace/rules/` is general (antiquities, wildlife products, regulated timber, medicines, idols from places of worship, and others). Confirm it matches current law and your risk appetite.
4. **Tax.** Whether you earn anything (fees, commission) and any GST or income-tax treatment.
Until then, keep the marketplace unpromoted (it is linked from the menu and footer; remove those links if you want it fully private) and approve only items you are comfortable with.

## Operating tips
- Review twice a week with the other moderation. Look at the photos: stock images, watermarks and obviously old items are warning signs.
- Do not approve items you cannot judge. Reject politely; there is no appeal process to build.
- Keep an eye on enquiries: introducing is manual, so answer within two working days as the site promises.
- Token: the admin GitHub token needs **Contents: Read and write** (already in `docs/ADMIN.md`); no new permission is required.
