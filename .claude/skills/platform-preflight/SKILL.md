---
name: platform-preflight
description: Pre-go-live check of the AiLocal platform - unit tests, lint, build, code review, and a local end-to-end run of the phone, SMS and voicemail webhooks against Postgres + PostgREST with a fake Claude API. Use before deploying risky changes or when asked to make sure "everything runs smooth".
---

# Preflight

1. `npm test` (node:test, `tests/*.test.mjs`), `npm run lint`, `npm run build`.
2. Code review: run the `code-review` skill on `main...HEAD` at `high`; fix confirmed findings with a test each.
3. Local end-to-end (harness in `/var/tmp/ailocal-pg`, rebuild it if the container was reset):
   - Postgres 16 on 5433: `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/ailocal-pg/data -o '-p 5433 -k /tmp' -l /var/tmp/ailocal-pg/log start"`;
     apply all `supabase/migrations/*.sql` (plus the auth stub `stub.sql`, roles, grants).
   - `./postgrest pgrst.conf` (port 3001) and `node fakes.mjs` (Supabase gateway 54321 + fake Anthropic 54400; prints JWT/cookie).
   - `next start -p 3100` with env: Supabase URL `http://127.0.0.1:54321`, keys = printed JWT, `ANTHROPIC_BASE_URL=http://127.0.0.1:54400`,
     `TWILIO_SKIP_VALIDATION=1`, `PUBLIC_BASE_URL=http://localhost:3100`. Override the container's own `ANTHROPIC_BASE_URL`.
   - curl `/api/voice/incoming` → `/api/voice/turn` (normal + AI-down = voicemail), `/api/sms/incoming` (new, duplicate, owner),
     `/api/voice/voicemail`; browser-check pages with Playwright from `/opt/node22/lib/node_modules/playwright` and cookie `sb-127-auth-token`.
4. Never `pkill -f` a pattern that appears in your own command line; kill by PID.
5. Report what passed, what was not testable (real Twilio audio), and remaining risks.
