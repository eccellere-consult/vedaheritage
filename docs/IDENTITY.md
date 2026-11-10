# Accounts, identity documents and verification

Built, and LOCKED by default (admin, Bookings: capabilities "Traveller accounts and dashboard" and "Identity documents and verification"; or Test mode for trying them).

## What exists
**Traveller account (`/account/`)** – register or sign in with an emailed one-time link (no password; link valid 20 minutes, session 30 days). Dashboard: bookings with a status line (Requested, Sent, Confirmed, Paid, Completed; for rides Driver assigned, Trip started), payment state with receipt and refunds, the stay or driver to contact (with the trip code), emergency numbers (112, 108; your own number if `contact_phone` is set in `vh-config.php`), saved itineraries (save from the planner), profile with an emergency contact. Bookings made while signed in link to the account; bookings made with the same verified email also show while the contact is still on file.

**Identity details and documents (traveller)** – foreign nationals: the data a stay needs for Form C (name, date of birth, nationality, passport number, place and dates, visa number, type and dates, arrival details, purpose, next destination, home address). Indian residents: a government ID (passport, driving licence, voter ID, PAN, other) with number and address. **Aadhaar numbers and images are refused.** Documents: JPEG, PNG or PDF up to 5 MB, up to 8 per traveller. Explicit consent is required and recorded (versioned).

**Partner and provider verification (`/partner/`, Verification tab)** – stays: registration certificate (Kerala Tourism or local body) and owner photo ID, plus a property photo (optional). Transport: owner/driver ID, driving licence, vehicle RC, permit, insurance. Plus a location (device GPS or typed, must be inside Kerala). Admin (Verification tab) opens each document with a logged reason, approves with an **expiry date** (required for licences, permits, insurance, registration) or rejects with a note, and approves the location against a map. With identity verification on, a partner can take bookings only while every required document is approved and in date and the location is approved; an expired document takes it off bookings automatically. Partners can still sign in to upload.

**Form C assist (`/partner/`, "Guest registration (Form C)" tab, stays)** – for confirmed or paid bookings by foreign guests with an account, the host can open the guest's details from 3 days before check-in until 7 days after check-out, open the passport scan, and record the FRRO acknowledgement number. **The host files Form C on the FRRO website; this site only shows the data.** Every view is logged.

## Privacy design
- Identity details and documents are encrypted at rest (libsodium secretbox). The key is `doc_key` in `vh-config.php` (generate one in admin, Verification, "Generate an encryption key"). If the key is lost, documents cannot be opened: keep a private backup.
- Stored in the private data folder, never in GitHub or the web root.
- Access: the owner; the host (Form C, own bookings only, time-limited); admins. Every non-owner view is written to the audit log with a reason (admin) or the booking reference (host); IPs are stored hashed.
- Retention: documents are deleted `kycRetentionDays` after upload (default 180, editable 7 to 730); identity details follow the same period. Deleted automatically and on demand. Partner documents are kept while the partner is active.
- Erasure: a traveller can delete their account, details, documents and itineraries at any time; the admin can erase on request. Completed bookings keep the reference, dates and fee, not the contact details.
- Test mode uses a throwaway key: those records are deleted when test mode is switched off.
- Sign-in answers identically for known and unknown emails.

## Decisions and checks that are yours (not legal advice)
1. A **privacy notice and consent wording** for identity data (India's Digital Personal Data Protection Act, 2023): purposes, retention, rights, a grievance contact. The capability's checklist asks you to confirm a lawyer reviewed it. The consent text shown to travellers is a starting point, not reviewed wording.
2. **Form C** duties sit with the accommodation provider. Confirm the current FRRO rules and deadlines (usually within 24 hours of arrival) and which fields the portal asks for; the field list here follows common practice and may need adjusting.
3. **Aadhaar**: do not collect it. Hosts verifying Indian guests should follow current guidance.
4. **Retention periods** for hosts' own legal record-keeping are theirs; this site deletes its copy on the schedule above.
5. **Server security**: shared hosting. Use a strong admin password, keep `vh-config.php` outside the web folder, back up `doc_key`, and consider whether you are comfortable holding passport scans there. A breach of identity documents has serious consequences; limiting what you collect (for example collecting only for stays that need it, and shortening retention) is the safest choice.
6. **Verification is a review aid, not proof**: a document that looks valid may still be forged. Phone checks and the official registers remain your job.

## Not built
Automatic verification against government registers, selfie or liveness checks, automatic filing of Form C, document OCR, multi-person admin roles with separate permissions.
