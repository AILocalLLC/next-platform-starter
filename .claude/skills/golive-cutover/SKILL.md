---
name: golive-cutover
description: Plan and run the switch from Go High Level to the AiLocal platform with no downtime - checklist, order of operations, and what must never be touched early. Use when the owner asks what's left before going live or says it's cutover day.
---

# Go-live cutover

Owner rules: no site or number may go down; GHL stays live until everything can switch; never change DNS early; never delete without asking.

## Ready-to-switch checklist (per subaccount)
- [ ] Migrations applied (incl. `0004_messages.sql`).
- [ ] Twilio upgraded, auto-recharge on; texting approved (`texting-compliance`).
- [ ] Receptionist script, greeting, notify phone, calendar configured (`onboard-subaccount`, `calendar-booking`).
- [ ] Real test call books correctly; timings acceptable (`voice-test-calls`); preflight green (`platform-preflight`).
- [ ] Contacts imported from GHL.

## Order
1. Port numbers one at a time (`port-number`); brief overlap with GHL is expected.
2. On each port day connect the number in the app and verify calls + texts.
3. Swap website chat snippets.
4. Only when every number is moved: DNS / domain changes (app.ailocal.net), then turn off GHL.

Progress lives in `NEXT_STEPS.md`; update it at the end of each session.
