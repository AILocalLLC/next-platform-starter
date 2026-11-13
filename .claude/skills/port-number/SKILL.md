---
name: port-number
description: Move a business phone number from GHL (LC Phone) or another carrier into Twilio and switch it to the AI receptionist with no missed calls. Use when the owner wants to port 330-919-6167, 330-476-7348 or any client number.
---

# Port a number into Twilio

Full runbook: `PORTING.md`. Numbers move one at a time; GHL keeps working until each port completes.

**Remind the owner first: GHL LC Phone numbers use the EASY way, not a carrier port.** LC Phone runs on Twilio, so
GHL Support can move the number straight into our Twilio account ("Moving Phone Numbers across accounts (LC Phone -> Twilio)").
No account number, PIN, CSR, LOA or Twilio port form. Waiting on a CSR/PIN from GHL took days twice; avoid it.
- Reply on / open a GHL support ticket asking them to MOVE (not port) the LC Phone number(s) into our Twilio account.
- Give them: our Twilio Account SID (AC..., Twilio Console home -> Account Info), the number(s), the sub-account name(s).
- Do not release/disable the number in GHL until GHL confirms the move and it has been tested in Twilio.
- Then do step 5 below (connect + test) and start A2P 10DLC (texting registration does not transfer).
- Only if GHL refuses: fall back to the carrier port in steps 3-4.
Pending: +1 330-476-7348 (AI Local, ticket #6596989), +1 330-422-3322 (Thermal Roofing and Siding).

1. Confirm the source: GHL → Settings → Phone Integration. LeadConnector/LC Phone → port. Own Twilio linked to GHL → no port, just re-point.
2. Prereqs: Twilio upgraded; `texting-compliance` started; the subaccount fully tested (`voice-test-calls`).
3. From GHL support: account number, port-out PIN, exact business name + service address, invoice if available.
4. Twilio Console → Phone Numbers → Port & Host → enter number + details → sign the generated LOA → pick a weekday-morning date.
5. Port day: number shows in Twilio → app Settings → **Connect** it (calls + texts) → real call from a cell (book a test) →
   text the number (appears in Messages, forwarded to owner) → turn off the GHL agent/workflows for that number.
6. Rollback: Twilio number → "A call comes in" → forward to the office cell.

Done: 330-919-6167 (NGNM). Next: 330-476-7348 (AI Local, platform sub-account b069837b-d094-44c6-bbd3-3412abd0bd20), 330-422-3322 (Thermal Roofing and Siding).
