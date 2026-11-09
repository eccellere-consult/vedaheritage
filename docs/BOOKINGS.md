# Itinerary, stay and transport: what is built and what needs a decision

## Built now (phase 1, no payments, no licences needed)
- **Itinerary planner** at `/itinerary/`: pick places (all published guides) and upcoming festivals, arrange by day, set a trip date (festivals snap to the matching day and warn about clashes), add notes, copy a share link (the plan travels in the link, nothing is stored on our server), print or save as PDF. The plan is also kept in the visitor's browser.
- **Stay and local transport help**: "Send my plan on WhatsApp" sends the day-by-day plan to the Veda Heritage number. Stay options and a local driver or auto are arranged by people, paid directly on arrival.
- **Tickets on the official sites**: IRCTC, KSRTC Swift, redBus, State Water Transport, KTDC. Links only; no resale, no scraping.

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
| 2 | Partner directory for registered stays and licensed drivers with an enquiry form; booking reference; monthly settlement sheet in the admin | Written partner agreement, registration check, privacy notice |
| 3 | On-site payments with split commission | Payment aggregator, CA sign-off on GST/TCS/TDS, refund and grievance policy, terms of service, legal review |
| 4 | Booking-site partnerships (KTDC, KSRTC, redBus) | Their written approval and API or affiliate access |

Rule: no public claim of "book", "pay" or "partner" on the site until the matching agreement and licence exist. This is guidance, not legal advice; take legal and tax advice before phases 2 and 3.
