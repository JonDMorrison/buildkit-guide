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
