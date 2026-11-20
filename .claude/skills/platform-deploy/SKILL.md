---
name: platform-deploy
description: Ship a change to the AiLocal platform safely - test, push to the deploy branch, watch the Netlify build, and confirm which commit is live. Use after any code change, or when asked "is it live?".
---

# Deploy

- Netlify site `ailocal-platform` (id `cf0ffbeb-962e-41c3-8297-15bbb287d46c`) builds **production from branch
  `claude/adoring-mayer-5yw59a`** and serves the AI phone line. A push there changes live call handling.
- The old site `ailocaldigitalbusinesscard` also builds previews; ignore it. GHL sites and DNS are never touched.
- The cloud environment has a Netlify API credential for `api.netlify.com`; `*.netlify.app` itself is not reachable.

## Steps
1. `npm test && npm run lint && npm run build` - all must pass. For webhook/route changes also run `platform-preflight`.
2. Commit (no model names in messages), `git push -u origin claude/adoring-mayer-5yw59a`.
   Docs-only commits: add `[skip netlify]` (previews may still build; harmless).
3. Watch the build:
```bash
H=$(git rev-parse --short=7 HEAD)
curl -s "https://api.netlify.com/api/v1/sites/cf0ffbeb-962e-41c3-8297-15bbb287d46c/deploys?per_page=5" \
 | python3 -c "import sys,json;[print(d['context'],d['state'],d.get('error_message')) for d in json.load(sys.stdin) if d['commit_ref'].startswith('$H')]"
curl -s https://api.netlify.com/api/v1/sites/cf0ffbeb-962e-41c3-8297-15bbb287d46c | python3 -c "import sys,json;print(json.load(sys.stdin)['published_deploy']['commit_ref'][:7])"
```
4. Report "live" only when `production ready` and the published commit matches.

## Env vars (Netlify → Site configuration → Environment variables)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `PUBLIC_BASE_URL`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
`NEXT_PUBLIC_BRAND_*`, `NODE_VERSION=22`. Never read secret values back from the API.
