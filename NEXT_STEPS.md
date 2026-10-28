# Next session: start here

Updated 2026-10-05. Full porting runbook: PORTING.md.

## 0. One-time database update (owner, 1 minute)
- Supabase → SQL Editor → paste `supabase/migrations/0004_messages.sql` → Run. Turns on the Messages inbox.
  Until then incoming texts are still forwarded to the owner's phone, just not saved in the app.

## Status 2026-10-07
- Twilio upgraded (Full, $50). Scripted test call from the verified 330-488-4225 to the 877 line booked Oct 14 8am end to end;
  replies 0.9–2s, calendar fillers worked, numbers read digit by digit. Keep-warm schedule added (first-ring delay was ~5s).
- Texts from the 877 line fail with 30032 until toll-free verification is approved -> owner alerts and confirmations blocked.
- Delete the test estimates (Sam Tester Oct 14 8am; Richard Cranium Oct 6) from sales@ calendar.

- 330-919-6167: GHL ticket #6491290 (2026-10-07). GHL is doing a direct transfer from LC Phone into our Twilio account
  (gaining SID given). Senior specialist replies by email. When the number appears in Twilio it has NO webhooks:
  connect it in the app immediately (Settings -> Connect) or calls go nowhere.

- Texting registrations submitted by Claude via API (2026-10-07), all under New Gutters Near Me LLC (EIN profile BUfb32…):
  - A2P brand BNca0f66… APPROVED (low-volume standard).
  - A2P campaign QE2c6890… (MIXED) on Messaging Service MG0220a1… - pending carrier review. Add 330-919-6167 to this
    service when it arrives (the hourly port watch does it).
  - Toll-free verification HHa9d940… for (877) 549-4401 - PENDING_REVIEW.
  - Public consent page: https://ailocal-platform.netlify.app/sms-consent
  - AI Local's own number (330-476-7348) will need a separate AI Local LLC profile/brand later.

## 1. Upgrade Twilio (owner) - DONE
- Console → Upgrade account → pay-as-you-go. Add ~$20 and turn on auto-recharge (e.g. +$20 when under $10).
- Why: the trial account blocks texts to unverified numbers and plays a "press any key" trial message on calls,
  which is why Claude's scripted test calls hung up after 13s.

## 2. Test calls and pause tuning (Claude)
- After the upgrade, Claude places scripted test calls itself (Twilio, Supabase and Netlify credentials are already
  in the cloud environment) and reads per-turn timings from the calls table.
- Not yet heard on a real call: the "One moment while I check the calendar / book that" filler, and zip codes and
  phone numbers read digit by digit.
- Last measured: normal replies ~1s; calendar check ~2.8s and booking ~4.4s (now covered by the filler line).

## 3. Port (330) 919-6167 from GHL to Twilio
GHL's Phone System screen shows it is on LC Phone (confirm under GHL Settings → Phone Integration: LeadConnector,
no Twilio account linked).
1. Ask GHL support for port-out details for 330-919-6167: account number, transfer PIN, and the exact business
   name and address on the account.
2. In Twilio: Phone Numbers → Port & Host → enter those details, sign the authorization form Twilio generates,
   and pick the transfer date.
3. Redo the A2P 10DLC texting registration in Twilio right after upgrading. GHL's "A2P Verified" does not carry
   over. Approval takes 1–3 weeks, so start it alongside the port.
4. GHL keeps working until the transfer date. On that day calls go to Ari, so the app must be fully tested first.
- 330-476-7348 (GHL default number) belongs to the AI Local company sub-account. It moves later, after that
  sub-account is built out in the new app. Same steps.
- Owner moves numbers one at a time, so expect a short period where GHL and the new app run side by side.

## 4. Toll-free verification
- (877) 549-4401 needs Twilio toll-free verification before it can text customers.

## 5. Later
- Samantha voice (ElevenLabs "Samantha - Happy Support Leader", same as GHL): paused by owner.
  Recommended route: Twilio ConversationRelay with ElevenLabs. Needs an ElevenLabs account and a small always-on
  server (~$5–7/mo).
