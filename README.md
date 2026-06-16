# StaffingNation — dev mockup

Next.js (App Router) + TypeScript + Supabase. Throwaway dev mockup — RLS is off,
no real PII. The flagship flow is the **AI-driven "create new client" intake**.

## Run it

```bash
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev                         # http://localhost:3000/clients/new
```

`.env.local` (gitignored) needs:

| Var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dsvtqjnjdxvvjvrgvgep.supabase.co` (already in the example) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API (server-only) |
| `OPENAI_API_KEY` | OpenAI dashboard (server-only — never sent to the browser) |
| `OPENAI_MODEL` | e.g. `gpt-4o-mini` |

## The intake flow (`/clients/new`)

1. **Persona** — Client/CRA (terse) or Prospect (educate + probe).
2. **Brief** — free-text "what do you want from an HR solution engine?".
3. **Adaptive Q&A** — the `interviewer` server action picks the next best
   question each turn until it can map to services (~6-question soft cap so it
   always terminates).
4. **Recommendations** — the `synthesizer` returns services (constrained to the
   six seeded codes) each with a plain-language reason. Pre-checked; the human
   checks/unchecks and **always confirms** before anything is written.

On confirm, the `confirmIntake` server action (Zod-validated) calls the
`create_prospect_from_intake` Postgres function, which in **one transaction**:
creates the prospect entity (`kind 'client'`, billable, `status 'prospect'`),
writes the `intake_session`, the chosen `entity_service` rows (source `ai|manual`),
materializes `entity_module` (union of modules from chosen services), and — if
EoR was chosen — sets `entity.default_eor_id` to the seeded master EoR (TargetCW).
You land on a summary at `/clients/{id}`. Wizard state is held client-side and
**only** persisted on confirm — abandoned sessions leave no rows.

## AI is server-side only

`lib/llm.ts` (OpenAI) is marked `import "server-only"` and called only from
server actions; `OPENAI_API_KEY` never reaches the client. Model id comes from
`OPENAI_MODEL`. Uses OpenAI JSON mode (`response_format: json_object`). The
service catalog + two-level module map + signal definitions are embedded in the
system prompts so output is grounded; the synthesizer is constrained to the six
seeded service codes and parsed safely.

## Schema

Migrations in `supabase/migrations/`:
- `create_core_schema` — entity, app_user, jd, job_order, job, rate rules
- `client_intake_services` — module, service, service_module, entity_service,
  entity_module, intake_session; `entity.default_eor_id`; `prospect` status
- `intake_confirm_fn` — the atomic `create_prospect_from_intake` function

Regenerate types after schema changes: `npm run types:gen`.

## Stubbed (recorded now, built later)

Profile / subsidiaries / first-admin; per-service onboarding (international →
countries, VMS → agencies, 1099 → IC eval); onboarding & prescreening. The
summary page links to a "Continue setup" placeholder.
