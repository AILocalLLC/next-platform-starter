# Next session: start here

Paused 2026-10-04. No changes pending. Latest deployed commit: c4dea9d (live on ailocal-platform.netlify.app).

## 1. Upgrade Twilio (owner)
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
