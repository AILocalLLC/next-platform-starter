# AiLocal platform — setup

White-label agency platform: unlimited subaccounts, team logins, dashboards, and a Claude-powered AI phone receptionist.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL editor → run `supabase/migrations/0001_init.sql`.
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

## How calls work
Twilio → `/api/voice/incoming` (greeting) → caller speaks → `/api/voice/turn` (Claude replies, can save the lead, transfer, or hang up) → loop. When the call ends Twilio hits `/api/voice/status`, which writes a summary and texts the owner if a lead was captured. All webhooks verify Twilio's signature.

## Develop
```
npm install
cp .env.example .env.local   # fill in
npm run dev
npm test
```
