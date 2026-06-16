# Supabase ↔ GitHub Migration Workflow — Manual Setup Checklist

This repo is wired for a version-controlled Supabase migration workflow:

- `supabase/` — CLI scaffold (`config.toml`, migrations) committed to git
- `.github/workflows/deploy-migrations.yml` — on push to `main`, installs the
  Supabase CLI and runs `supabase db push` using **repo secrets only**
- Baseline migration captured from the current remote schema (see
  `supabase/migrations/`)

Project ref: **`dsvtqjnjdxvvjvrgvgep`** · Production branch: **`main`**

Everything below is what **you** must do by hand. Nothing here puts a secret
into git.

---

## 1. Add the GitHub repo secrets (required for the Actions workflow)

The workflow reads `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` from repo
secrets. Add them once.

### Option A — `gh` CLI (install it first)

```bash
# Install gh (macOS):  brew install gh
# Then authenticate:    gh auth login

gh secret set SUPABASE_ACCESS_TOKEN  --repo halledavis/tcw-sn-mockup
gh secret set SUPABASE_DB_PASSWORD   --repo halledavis/tcw-sn-mockup
```

Each command prompts for the value (paste it; it is not echoed). Do **not** pass
`--body "<value>"` — that would leave the secret in your shell history.

### Option B — Dashboard

GitHub repo → **Settings → Secrets and variables → Actions →
New repository secret**. Add:

| Name                    | Value                                            |
| ----------------------- | ------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN` | A Supabase access token (Dashboard → Account → Access Tokens) |
| `SUPABASE_DB_PASSWORD`  | Your project's database password                 |

The project ref is **not** a secret — it's inlined in the workflow.

---

## 2. (Optional) Native Supabase GitHub integration / preview branches

The Actions workflow above is fully sufficient for auto-deploy on push to
`main`. If you *also* (or instead) want Supabase's **native** GitHub integration
— automatic deploys and per-PR preview branches managed by Supabase itself —
enable it in the dashboard:

1. Open the project: <https://supabase.com/dashboard/project/dsvtqjnjdxvvjvrgvgep>
2. Go to **Project Settings → Integrations → GitHub**
   (recent dashboards may label this **Settings → Integrations**, or surface a
   **"Connect to GitHub"** button under **Branches** / **Database → Branching** —
   follow whichever is actually present).
3. **Authorize the Supabase GitHub App** when prompted, granting access to the
   `halledavis/tcw-sn-mockup` repository.
4. In the integration config, point it at:
   - **Repository:** `halledavis/tcw-sn-mockup`
   - **Supabase directory:** `supabase`
   - **Production branch:** `main`
5. (Optional) Enable **preview branches** so each PR gets an ephemeral DB
   branch with migrations applied.

> Note: if you enable native auto-deploy, both it *and* the Actions workflow
> will try to push migrations on merge to `main`. That's harmless (pushes are
> idempotent — already-applied migrations are skipped) but redundant. Pick one
> as your primary, and optionally disable the other.

---

## 3. Verify

- Push a no-op migration change or use **Actions → Deploy Supabase Migrations →
  Run workflow** (manual `workflow_dispatch`) and confirm the run is green.
- Future schema changes: create a migration locally
  (`supabase migration new <name>` or `supabase db diff -f <name>`), commit, and
  push to `main`. The workflow applies it.

---

## Done for you (no action needed)

- [x] Git repo + `origin` remote confirmed
- [x] `supabase init` scaffold created
- [x] Linked to project `dsvtqjnjdxvvjvrgvgep`
- [x] Baseline migration pulled from remote and committed
- [x] `deploy-migrations.yml` workflow committed
- [x] `.gitignore` excludes env files / secrets / Supabase temp state
