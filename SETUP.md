# AiLocal platform — setup

White-label agency platform: unlimited subaccounts, team logins, dashboards, and a Claude-powered AI phone receptionist.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL editor → run each file in `supabase/migrations/` in order (`0001_…`, `0002_…`).
3. Auth → URL configuration: set Site URL to your `PUBLIC_BASE_URL`, add `${PUBLIC_BASE_URL}/auth/confirm` to redirect URLs.
4. Auth → Email templates (Invite, Reset password): change the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (use `type=recovery` for reset).
5. Auth → Users → "Add user" for yourself. **The first user becomes the agency admin.**

## 2. Twilio
Create an account, copy the Account SID and Auth Token. Numbers are wired automatically from each subaccount's **Settings → AI phone number** (connect an existing number or buy one by area code).

## 3. Environment variables (Netlify → Site settings → Environment)
See `.env.example`. Required: Supabase URL/keys, `ANTHROPIC_API_KEY`, Twilio SID/token, `PUBLIC_BASE_URL`. Branding (`NEXT_PUBLIC_BRAND_*`) makes it white label.

## 4. Use it
- **Dashboard**: agency-wide calls, leads, AI minutes, per-subaccount table.
- **New subaccount** → fill in **AI receptionist** (greeting, business info, instructions, transfer number, lead SMS number) → **Settings** → connect a number.
- Point the client's business line (call forwarding / no-answer forwarding) to the AI number.
- **Team**: invite users; members only see the subaccounts you tick.
- **Contacts → Import from CSV**: bring over Go High Level contacts (Contacts → Export in GHL). Duplicates are skipped.
- **AI receptionist → Website chat**: turn it on and paste the snippet into the client's website. Same AI, same business info; leads land in Contacts and the owner gets a text.

## Switching from Go High Level (no downtime)
1. Build and test everything with one test Twilio number. GHL stays live.
2. Import each client's contacts via CSV.
3. Move phone numbers: numbers on your own Twilio account need nothing; LC Phone numbers get a port-out request scheduled for the cutover date; numbers owned by the client's carrier just get their forwarding changed.
4. Cutover day: point every number at the new system (Settings → Connect number), swap website chat snippets, then change DNS.

## How calls work
Twilio → `/api/voice/incoming` (greeting) → caller speaks → `/api/voice/turn` (Claude replies, can save the lead, transfer, or hang up) → loop. When the call ends Twilio hits `/api/voice/status`, which writes a summary and texts the owner if a lead was captured. All webhooks verify Twilio's signature.

## Develop
```
npm install
cp .env.example .env.local   # fill in
npm run dev
npm test
```
