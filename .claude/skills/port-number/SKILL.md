---
name: port-number
description: Move a business phone number from GHL (LC Phone) or another carrier into Twilio and switch it to the AI receptionist with no missed calls. Use when the owner wants to port 330-919-6167, 330-476-7348 or any client number.
---

# Port a number into Twilio

Full runbook: `PORTING.md`. Numbers move one at a time; GHL keeps working until each port completes.

1. Confirm the source: GHL → Settings → Phone Integration. LeadConnector/LC Phone → port. Own Twilio linked to GHL → no port, just re-point.
2. Prereqs: Twilio upgraded; `texting-compliance` started; the subaccount fully tested (`voice-test-calls`).
3. From GHL support: account number, port-out PIN, exact business name + service address, invoice if available.
4. Twilio Console → Phone Numbers → Port & Host → enter number + details → sign the generated LOA → pick a weekday-morning date.
5. Port day: number shows in Twilio → app Settings → **Connect** it (calls + texts) → real call from a cell (book a test) →
   text the number (appears in Messages, forwarded to owner) → turn off the GHL agent/workflows for that number.
6. Rollback: Twilio number → "A call comes in" → forward to the office cell.

Queue: 330-919-6167 (NGNM) first; 330-476-7348 (AI Local) after that sub-account is built in the app.
