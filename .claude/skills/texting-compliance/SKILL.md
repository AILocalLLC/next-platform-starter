---
name: texting-compliance
description: Get Twilio texting approved - A2P 10DLC brand/campaign for local numbers and toll-free verification for 8xx numbers - so confirmations, owner alerts and Messages replies are delivered. Use after upgrading Twilio or when texts fail with filtering/30034/30032 errors.
---

# Texting compliance

GHL's "A2P Verified" does not carry over to Twilio. Approval takes ~1–3 weeks; start immediately after the upgrade.

## A2P 10DLC (local numbers, e.g. 330-919-6167)
Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC.
- Brand: legal name, EIN, address, website, contact name/email/phone (owner provides).
- Campaign: Customer care / Mixed. Sample messages (real app texts):
  - "Thanks Sam! Your New Gutters Near Me appointment is booked for Wednesday, October 14 at 9:00 AM. Reply STOP to opt out."
  - "Thanks! New Gutters Near Me got your request. A team member will reach out within a few hours to confirm. Reply STOP to opt out."
- Opt-in: "Customers call or text our business number and give their number to book an estimate."
- Add the number to the campaign's Messaging Service once approved.

## Toll-free verification (877 549 4401)
Messaging → Regulatory Compliance → Toll-free verification; same business details and samples.

Claude can draft every field; the owner submits (business identity and EIN).
