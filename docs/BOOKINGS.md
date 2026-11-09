# Itinerary, stay and transport: what is built and what needs a decision

## Built now (phase 1, no payments, no licences needed)
- **Itinerary planner** at `/itinerary/`: pick places (all published guides) and upcoming festivals, arrange by day, set a trip date (festivals snap to the matching day and warn about clashes), add notes, copy a share link (the plan travels in the link, nothing is stored on our server), print or save as PDF. The plan is also kept in the visitor's browser.
- **Stay and local transport help**: "Send my plan on WhatsApp" sends the day-by-day plan to the Veda Heritage number. Stay options and a local driver or auto are arranged by people, paid directly on arrival.
- **Tickets on the official sites**: IRCTC, KSRTC Swift, redBus, State Water Transport, KTDC. Links only; no resale, no scraping.

## Built (phase 2): the bookings module, LOCKED by default
Everything below exists in the software but does nothing until you open it. Admin, **Bookings** tab. Travellers see no booking form while it is locked.
- **Capability gates.** Five capabilities (enquiries, commission, stays, rides, payments), each with a checklist and evidence field (for example grievance officer, GSTIN). A capability can be switched on only when every item is ticked and the evidence is recorded; the server enforces this, not just the screen. Changing the evidence switches it off again until it is complete.
  - *Partner enquiries and booking references*: travellers send a request to a verified partner and get a reference such as `VH-2611-K7QD`. A person checks it and sends it to the partner. Payment is on site.
  - *Commission ledger and monthly settlement*: records the fee on completed bookings and builds a monthly sheet per partner with GST on the fee, as CSV, and lets you mark a month settled with an invoice reference.
  - *Online payments with split commission* and *Cab and auto dispatch*: shown as **not built**. They stay locked even with every box ticked, because the software for them does not exist yet.
- **Your fee, configurable.** Either a percentage of the booking value (0 to 20) or a flat rupee amount per completed booking (0 to 5000). Set a default and, if you like, a different fee per partner. A flat fee never exceeds the booking value. The fee is computed in code and kept on each booking, so changing it later does not alter past bookings.
- **Partners.** Only verified stays and transport providers from the Directory. Each needs a signed agreement date and a registration or permit check before it can take requests.
- **Privacy.** Traveller details sit in the private data folder, never in GitHub. When a booking is completed, cancelled or declined, the phone, email and message are deleted; the reference, dates and fee stay.
- **Traveller side.** On the itinerary page, "Ask a verified partner for a stay or a ride" appears only when Partner enquiries is open. The plan is prefilled; consent to share details with the partner is required.

### To start using it
1. Sign agreements with partners; add them in the Directory tab; check their registrations.
2. In Bookings, record the approvals and evidence for "Partner enquiries", save, switch on. Add partners (agreement date, registration checked, switch on).
3. When your accountant is ready, record GSTIN and approvals for "Commission", switch on, choose the fee.

### Phase 3 (built, locked): stays, rides and Razorpay payments
Decision update: online payment at booking is now built. Pay-on-site with a monthly invoice still works and is used automatically whenever online payments are switched off.
- **Stays** (`/stays/`): partners list rooms (nightly rate, sleeps, units, blocked nights) in Bookings. Travellers pick dates, see the price (computed on the server), and book. A room is held for 30 minutes while the traveller pays; two travellers cannot take the last room.
- **Rides** (`/rides/`): one platform rate card (base, per km, minimum, night surcharge) set in Bookings. Fare = distance between two fixed points (straight line x 1.35) on the card: an ESTIMATE, labelled as such. The request goes to every partner that runs that vehicle in the pickup district; the first to accept on a private link gets it. The traveller receives the driver's details and a 4-digit trip code; the driver starts the trip with the code and completes it. No live GPS tracking.
- **Payments**: Razorpay Checkout. Our server creates the order from its own price, verifies the payment signature, and also listens to the webhook (so a closed tab never loses a payment; replays are ignored). The partner's share (amount minus your fee, GST on the fee, and any TCS/TDS you set) becomes a HELD transfer to the partner's Razorpay linked account and is released when the stay or trip is completed (or by you). Refunds (full or part) reverse the partner transfer. Admin buttons: Release payout, Retry payout transfer, Refund.
- **Everything stays locked until switched on** in the Bookings tab. Payments additionally need: the keys in `vh-config.php`, Partner enquiries and Commission switched on, and the approvals recorded.

#### Razorpay setup (one time)
1. In `vh-config.php` (never in the repository) add:
   `'razorpay_key_id' => 'rzp_live_...', 'razorpay_key_secret' => '...', 'razorpay_webhook_secret' => '...'`. Start with TEST keys.
2. In the Razorpay dashboard, set the webhook URL to `https://www.vedaheritage.co.in/api/razorpay-webhook.php`, with the same secret, and subscribe to `payment.captured`, `order.paid` and `refund.processed`.
3. Create a Route linked account for each partner and paste its `acc_...` ID in Bookings, partner, "payout account".
4. Make a test booking with test keys end to end (stay and ride), including a refund, before using live keys.

#### Not verified here
The code was tested against a mock of the Razorpay API (amounts, held transfers, signatures, webhooks, refunds), not against Razorpay itself. Razorpay's Route, transfer and hold behaviour and field names must be checked in test mode before going live. The statutory deductions (TCS under GST, TDS) default to 0; set them only with your accountant.

## Not built, and why (needs your decision)
1. **Commission of 0.5 to 1 percent on pay-on-site bookings.** The site cannot see money that changes hands on site, so the fee depends on trust: a written agreement with each provider, a booking reference per enquiry, a monthly self-reported settlement and the right to audit. Expect leakage (guest and provider simply agree a direct deal). Also, 0.5 to 1 percent is far below what booking platforms charge (typically 10 to 20 percent for stays), so it will not fund development. Better options: a flat fee per confirmed booking, or 5 to 10 percent only on stays Veda Heritage arranges itself.
2. **Taking payments on the site.** Needs a licensed payment aggregator (for example Razorpay or Cashfree with split settlement), a refund and grievance process, and tax handling: GST on the commission, and e-commerce operator rules (TCS under GST, TDS on payouts). Confirm each with a chartered accountant before launch.
3. **"Uber-type" cabs and autos.** Running a ride or cab booking service makes the site a motor vehicle aggregator, which needs a state licence, driver verification, insurance and fare compliance under the Motor Vehicle Aggregator Guidelines and Kerala rules. Do not build it as a captive service. Safer: a directory of licensed local operators with enquiry only, or a partnership with an existing licensed platform (ask about Kerala Savari, the state-backed service; verify its partnership terms).
4. **"Airbnb-type" stays.** Only list properties with a valid Kerala Tourism homestay or hotel registration (store the registration number and show it). A marketplace must show total price, a cancellation and refund policy and a grievance officer (Consumer Protection E-Commerce Rules 2020), and handle guest data under the DPDP Act 2023. Airbnb itself does not share commission with outside sites; keep the outbound link and check whether its affiliate programme is open.
5. **Trains and buses.** IRCTC tickets can only be sold through IRCTC or its authorised agents; deep links only. KSRTC and redBus: ask each about an official partner or affiliate programme before building anything. Do not claim a partnership until a written agreement exists.

## Suggested phases
| Phase | What | Needs |
|---|---|---|
| 1 (done) | Itinerary planner, WhatsApp enquiry, official ticket links | Nothing |
| 2 (built, locked) | Partner enquiries, booking reference, fee (percentage or flat), monthly settlement sheet, all gated in the admin | Written partner agreement, registration check, privacy notice, then switch on |
| 3 | On-site payments with split commission | Payment aggregator, CA sign-off on GST/TCS/TDS, refund and grievance policy, terms of service, legal review |
| 4 | Booking-site partnerships (KTDC, KSRTC, redBus) | Their written approval and API or affiliate access |

Rule: no public claim of "book", "pay" or "partner" on the site until the matching agreement and licence exist. This is guidance, not legal advice; take legal and tax advice before phases 2 and 3.
