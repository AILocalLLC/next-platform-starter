---
name: onboard-subaccount
description: Add a new client business (subaccount) to the AiLocal platform end to end - create it, write the AI receptionist script, import GHL contacts, set notifications, calendar, number and chat. Use when the owner says "set up <business>" or moves a GHL sub-account over.
---

# Onboard a subaccount

Order matters; each step is in the app (logged in as agency admin) unless noted.

1. **Create**: sidebar → + New → business name. Set timezone in Settings.
2. **AI receptionist** tab:
   - Greeting: the exact opening line from the GHL voice agent.
   - Business information: services, area served, hours, pricing rules (only what the AI may say).
   - Instructions: the GHL agent's roles/rules script, pasted as-is.
   - Lead SMS number (`notify_phone`): owner's cell. Transfer number: optional live handoff (also used if the AI fails).
3. **Contacts** → Import from CSV: GHL → Contacts → select all → Export. Duplicates skipped.
4. **Calendar booking**: see `calendar-booking` skill.
5. **Number**: see `twilio-number` skill (test number first; the real number only on port day, see `port-number`).
6. **Website chat** (optional): AI receptionist → Website chat → enable → paste snippet on the client site.
7. **Team**: Team → invite staff; tick only this subaccount for members.
8. Verify with a test call (`voice-test-calls`) before telling the client it is live.

Reference: NGNM subaccount id `27889db1-78a8-4009-b4d9-9501f556e89b` (Mon–Sat 8–6, 60-min estimates, 24h notice, calendar sales@newguttersnearme.com).
