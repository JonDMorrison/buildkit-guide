# ProjectPath (buildkit-guide)

## Deploy
- Vercel auto-deploys on push to main
- Supabase project: bvzgxtvihbchqkvdbmqm

## Key People
- Chantel (GRM Inc, Kelowna) — primary beta user, do not break her workflows

## Critical Rules
- Invite flow spans two edge functions — read both before touching either
- Sidebar flash fix uses useRef — do not revert to useState
- Logout race condition fix is intentional — do not simplify the logout sequence
- Daily log autofill correction is deliberate — check before changing form defaults
- AI Assist uses OpenAI function calling — do not switch to simple completion

## Stack
- Lovable + Supabase + Vercel + OpenAI (function calling for AI Assist)

## Common Mistakes to Avoid
- Don't restructure the invite flow without reading both edge functions first
- Don't assume Supabase tables are empty — this project has live data
- Read only first, report findings, confirm with Jon, then make changes

## Testing

End-to-end tests live in `tests/e2e/` and run with Playwright (chromium-only). Config is `playwright.config.ts`; baseURL honors `TEST_BASE_URL` / `PLAYWRIGHT_BASE_URL` (default `http://localhost:8080`). The webServer block auto-starts `npm run dev` if nothing is on 8080.

Scripts:
- `npm run test:e2e` — full suite
- `npm run test:e2e:ui` — interactive Playwright UI
- `npm run test:e2e:headed` — visible browser

Skeleton specs (TODO selectors):
- `auth.spec.ts` — contractor signup + login
- `projects.spec.ts` — project creation, task assignment + completion
- `ai-assist.spec.ts` — AI Assist drawer open + canned-response render (stub OpenAI before enabling)
- `client-invite.spec.ts` — invite flow + scoped client dashboard

Before enabling these:
1. Use a non-Chantel test contractor account — Chantel is the live primary beta user.
2. Stub the OpenAI function-calling endpoint via Playwright `page.route` or an env-var-gated edge function override. Never burn live OpenAI tokens in CI.
3. Capture an invite from a test SMTP catcher (mailhog, mailpit) — never use her real email.
4. The invite flow spans two edge functions; both must be deployed against the test branch before invite tests pass.

The Expect MCP (AI-driven exploratory browser testing) is registered globally in Claude Code; invoke `/expect` for ad-hoc test runs on top of the persistent suite.
