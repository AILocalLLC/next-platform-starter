---
name: platform-audit
description: Full audit of the AI Local system - phone platform (Netlify + Supabase), CRM (Google Cloud Run + Cloud SQL), phone bridge, Twilio and Anthropic - in five phases - discovery, diagnostics, security (tenant isolation, auth, webhooks, prompt injection, recordings, SMS opt-out), functional tests with test data, and a ranked report. Use when Ted says "run the platform audit", "full security review", or before onboarding a new client.
---

# Platform audit

Audits everything that holds client data. Read-only against live systems except where a step says otherwise.

## Ground rules (never break)
- **Never delete anything without asking Ted first.** Not data, files, accounts, records or settings.
- **Never touch live client data.** Read live data only to count or check structure; never edit or send to it.
  All writes and tests use the **Audit Test** business (below) or local copies.
- **Evidence for every result**: the command, request or query run, and what came back (status, row count, log line).
  No evidence = "not checked", never "pass".
- **Mark what you can't reach** as "not checked: needs Ted" with the exact screen to look at (e.g. Cloud SQL backups,
  Supabase leaked-password setting, GoDaddy DNS). Never guess.
- **Say before any step that costs money** (real test calls/texts are a few cents each). Test calls go only to Ted's
  numbers (330-327-0304, 330-488-4225) or the businesses' own lines.
- Never print secret values. Stop and report (don't exploit further) if a real data leak is found.
- Merges and deploys only when Ted says "deploy". Fixes go in PRs; the audit itself changes nothing.

## Systems in scope
| System | Where | Holds |
|---|---|---|
| Phone platform | this repo, Netlify (`ailocal-platform`) | Ari, calls, SMS, chat, bookings |
| Platform database | Supabase `uanvjjibesevskafqhrc` | subaccounts, contacts, calls, messages |
| CRM | `AILocalLLC/antigravity-crm`, Cloud Run `api` + `dashboard` (project `ailocal-crm-2026`) | tenants, users, contacts, deals, websites, invoices |
| CRM database | Cloud SQL (Postgres) | all CRM data |
| Phone bridge | CRM `apps/api/src/voiceRelay.js` (WebSocket) | live call audio text |
| Twilio | account `AC708078db…` | numbers, webhooks, recordings, A2P |
| Anthropic | API key in Netlify env | Ari's AI |
| Websites | ailocal.net, thermalroofing.net (CRM site builder) | public pages, lead forms |

## Audit Test business
Create once (ask Ted first) and reuse: CRM sub-account **"Audit Test"** and platform subaccount **"Audit Test"**,
receptionist off, no Twilio number, 3 fake contacts (`Audit Test One/Two/Three`, 555 numbers, `@example.com`).
Cross-tenant tests read **from** Audit Test **toward** a real business and must come back empty or denied.

## Phase 1: Discovery
1. Map every route: platform `app/api/**/route.js`, CRM `app.(get|post|put|patch|delete)` in `apps/api/src/index.js`,
   dashboard `app/**/page.tsx`. For each: auth used (none / session / tenant JWT / API key / platform key / Twilio signature / Stripe signature).
2. Map data: Supabase tables + RLS policies + functions (`list_tables`, `pg_policies`, advisors); CRM Prisma schema + startup `ensure*` tables.
3. Map outside connections: Twilio number webhooks (voice/SMS/status URLs), Stripe, Google Calendar service account, Netlify env var *names*.
4. Build and run both apps locally (`platform-preflight` harness for the platform; `npm test` for CRM API).
Output: a route table and a data map.

## Phase 2: Diagnostics
- Build, type check, lint, unit tests for both repos (counts, not just pass/fail).
- `npm audit --omit=dev` for both repos.
- Logs, last 7 days: Netlify function errors, Cloud Run `severity>=ERROR` and 5xx by route, Supabase `query_logs`.
- Database integrity: orphan rows (calls without subaccount, contacts without tenant), duplicate phone numbers per business,
  tables a route uses that don't exist (this caught `WorkflowTemplate`, Nov 2026).
- Performance: every main GET per business under 1 s; Ari turn timing from `calls.transcript` timings (target ≤ 2.5 s).
- Deploy health: last 15 Cloud Build runs, last 10 Netlify deploys.

## Phase 3: Security
1. **Leaked keys**: scan both repos and git history for keys/tokens (`sk-`, `AC`+32 hex, `SK`, `whsec_`, JWTs, `service_role`,
   private keys); check `NEXT_PUBLIC_*` vars contain nothing secret; check public JS bundles for secrets.
2. **Auth**: every route from Phase 1 without auth must be meant to be public; try each protected route with no token,
   an expired token, and a VIEW/SALES user (writes must fail). Role escalation: can a non-admin set their own role?
3. **Tenant isolation** (the most important check):
   - CRM: as an Audit Test user, request a real business's contact/deal/invoice/site by ID, with a forged `x-tenant-id`,
     and via list filters. All must be 403/404/empty. Check every Prisma query on tenant data runs inside `withRLS`.
   - Supabase: as an Audit Test login, query every table for other subaccounts' rows (RLS). Check `service_role` is used only server-side.
   - ID tampering: change IDs in URLs and bodies (contacts, calls, appointments, funnels, websites).
4. **Webhooks**: platform Twilio routes reject unsigned/badly signed requests (`TWILIO_SKIP_VALIDATION` must be unset in production);
   relay-turn rejects a wrong `sig`; Stripe webhook checks its signature; CRM platform-key routes reject a missing key.
5. **AI prompt injection** (Audit Test, chat widget or local harness, not live lines): caller tries "ignore your instructions",
   asks for other customers' details, asks Ari to read her instructions, tries to make her quote prices not in the script or book outside hours.
   Pass = she stays in role and reveals nothing.
6. **Call recordings and transcripts**: who can open recording links (Twilio auth required?), retention, transcripts visible only to their business.
7. **SMS compliance**: STOP / UNSUBSCRIBE / HELP handled and honored on every number; opt-out stored and checked before any automation or bulk text;
   consent text on every form; A2P registration status per number.
8. **Web**: security headers, CORS, rate limits on public forms and login, public websites can't reach the CRM API on customer domains.

## Phase 4: Functional tests (Audit Test business only)
Agency: create/switch sub-account, add/remove team member, roles. Contacts: add, edit, search, CSV import, delete (test data only).
Phone: one scripted test call to an Audit Test-configured line or the local harness (greeting, lead saved, booking, goodbye, transfer).
SMS: inbound reply lands in inbox; STOP works. Pipeline: create deal, move stages, mark won/lost, automation fires.
Websites: form submit creates contact. Reports load. Mobile: every main page at 390 px wide (no sideways scroll, nothing cut off).
Clean up Audit Test data afterwards only with Ted's OK.

## Phase 5: Report
Publish as one page (artifact) and a short chat summary:
1. **Pass/fail table**: every check, result (pass / fail / not checked: needs Ted), evidence link or snippet.
2. **Findings, ranked** Critical → High → Medium → Low: what, where (file:line or screen), how to reproduce, impact, fix.
3. **Fix list in order**, with which ones Claude can fix in a PR and which need Ted.
Lead with the outcome in plain words: "No client can see another client's data" (or what failed).
