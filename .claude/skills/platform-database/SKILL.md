---
name: platform-database
description: Set up or change the AiLocal platform's Supabase database - apply migrations in supabase/migrations, add tables with RLS, read or fix live data. Use when adding a table/column, when a feature says "needs migration 000X", or when inspecting calls, contacts, subaccounts or messages.
---

# Database (Supabase + RLS)

Project: `uanvjjibesevskafqhrc.supabase.co`. The cloud environment has an API credential for that host
(headers `apikey` + `Authorization: Bearer`, service_role), so plain `curl` to `/rest/v1/...` works with no key in the command.

## Schema rules
- One file per change: `supabase/migrations/000N_<what>.sql`, never edit an applied one.
- Every tenant table has `subaccount_id uuid not null references subaccounts on delete cascade`,
  `enable row level security`, and a policy `using (public.has_subaccount(subaccount_id)) with check (...)`.
- Admin-only data uses `public.is_agency_admin()`. Service-role code (webhooks) bypasses RLS via `createAdminClient()`.

## Applying a migration
Claude cannot run DDL (PostgREST only). The owner runs it: Supabase → SQL Editor → paste the file → Run.
Code that depends on a new table must degrade until then: check `isMissingTable(error)` (lib/sms.js;
codes `42P01` / `PGRST205`) and show a notice instead of crashing.

## Reading / writing live data
```bash
S=https://uanvjjibesevskafqhrc.supabase.co/rest/v1
curl -s "$S/subaccounts?select=id,name,twilio_number"
curl -s "$S/calls?select=started_at,transcript&order=started_at.desc&limit=1"
curl -s -X PATCH "$S/subaccounts?id=eq.<id>" -H "Content-Type: application/json" -d '{"booking_days":"1,2,3,4,5,6"}'
```
Only write live data the owner asked for. Never delete without asking.

## Local copy for testing
See the `platform-preflight` skill (Postgres 16 + PostgREST harness).
