---
name: twilio-number
description: Connect, buy, or re-point a Twilio phone number for a subaccount so its calls and texts reach the AI receptionist and Messages inbox. Use when connecting a number, after a port completes, or when calls/texts aren't reaching the app.
---

# Twilio numbers

The cloud env has a Basic-auth credential for `api.twilio.com` (never write the Account SID into the repo). Test line: (877) 549-4401.

## In the app
Subaccount → Settings → AI phone number → **Connect** (existing number in the Twilio account) or **Buy & connect** (by area code).
This sets the number's Voice URL `/api/voice/incoming`, status callback `/api/voice/status`, and SMS URL `/api/sms/incoming`
(base = `PUBLIC_BASE_URL`).

## Check a number from the API
```bash
A=$(curl -s https://api.twilio.com/2010-04-01/Accounts.json | python3 -c "import sys,json;print(json.load(sys.stdin)['accounts'][0]['sid'])")
curl -s "https://api.twilio.com/2010-04-01/Accounts/$A/IncomingPhoneNumbers.json" \
 | python3 -c "import sys,json;[print(n['phone_number'],n['voice_url'],n['sms_url']) for n in json.load(sys.stdin)['incoming_phone_numbers']]"
```

## Gotchas
- Trial accounts: calls get a "press any key" preamble and texts only reach verified numbers. Upgrade before go-live.
- Texting from a local number needs A2P 10DLC; from toll-free needs toll-free verification (see `texting-compliance`).
- Webhooks verify Twilio's signature against `PUBLIC_BASE_URL`; if that env var is wrong every call gets 403.
