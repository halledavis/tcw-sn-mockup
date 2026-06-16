-- StaffingNation dev mockup — job types / risk tiering / bill cards.
-- Conventions: uuid PKs (gen_random_uuid()), created_at timestamptz default
-- now(), FK + index on every FK column, Postgres enums for categorical fields.
-- RLS left disabled (dev mockup). bill_rate_rule is intentionally untouched —
-- non-tier overrides stay there, layered on at order time later.

-- ============================================================================
-- Enums
-- ============================================================================
create type public.job_title_status as enum ('ai_suggested', 'confirmed', 'needs_review');
create type public.jd_risk_status   as enum ('ai_estimated', 'confirmed', 'needs_review');
create type public.bill_card_status as enum ('draft', 'active');

-- ============================================================================
-- risk_tier — system-owned catalog, single risk/liability axis
-- ============================================================================
create table public.risk_tier (
    id                 uuid primary key default gen_random_uuid(),
    code               text not null unique,
    name               text not null,
    description        text,
    default_markup_pct numeric,
    sort_order         int not null default 0,
    created_at         timestamptz not null default now()
);

insert into public.risk_tier (code, name, description, default_markup_pct, sort_order) values
  ('tier_0', 'General Office / Clerical / IT',                   'General Office / Clerical / IT',                       18, 0),
  ('tier_1', 'Skilled / Light Industrial',                       'Skilled / Light Industrial',                           28, 1),
  ('tier_2', 'Manual / Physical Labor',                          'Manual / Physical Labor',                              38, 2),
  ('tier_3', 'Hazardous / High-Risk',                            'Hazardous / High-Risk (driving, heights, equipment)',  50, 3),
  ('tier_4', 'Regulated / Sensitive',                            'Regulated / Sensitive (cash handling, minors, etc.)',  45, 4);

-- ============================================================================
-- client_job_title — per-client job titles with AI risk-tier suggestions
-- ============================================================================
create table public.client_job_title (
    id            uuid primary key default gen_random_uuid(),
    entity_id     uuid not null references public.entity (id) on delete cascade,
    title         text not null,
    blurb         text,
    risk_tier_id  uuid references public.risk_tier (id),
    ai_rationale  text,
    needs_review  boolean not null default false,
    status        public.job_title_status not null default 'ai_suggested',
    clarifications jsonb not null default '[]'::jsonb,
    created_at    timestamptz not null default now()
);
create index idx_client_job_title_entity_id    on public.client_job_title (entity_id);
create index idx_client_job_title_risk_tier_id on public.client_job_title (risk_tier_id);

-- ============================================================================
-- bill_card — per-client, per-tier markups scoped to states (or ALL).
-- Multiple cards per (entity, tier) allowed when state scopes differ.
-- ============================================================================
create table public.bill_card (
    id           uuid primary key default gen_random_uuid(),
    entity_id    uuid not null references public.entity (id) on delete cascade,
    risk_tier_id uuid not null references public.risk_tier (id),
    states       jsonb not null default '["ALL"]'::jsonb,   -- state codes or "ALL"
    markup_pct   numeric,
    status       public.bill_card_status not null default 'draft',
    created_at   timestamptz not null default now()
);
create index idx_bill_card_entity_id    on public.bill_card (entity_id);
create index idx_bill_card_risk_tier_id on public.bill_card (risk_tier_id);

-- ============================================================================
-- jd gains an (optional) risk tier + its status
-- ============================================================================
alter table public.jd
    add column risk_tier_id     uuid references public.risk_tier (id),
    add column risk_tier_status public.jd_risk_status;
create index idx_jd_risk_tier_id on public.jd (risk_tier_id);
