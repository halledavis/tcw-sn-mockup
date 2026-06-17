-- StaffingNation dev mockup — bill_card gains a service_type and risk_tier
-- becomes optional, plus a per-client config-page progress tracker.
-- Conventions: uuid PKs (gen_random_uuid()), created_at/updated_at timestamptz
-- default now(), FK + index on every FK column, Postgres enums for categorical
-- fields. RLS left disabled (dev mockup).
--
-- Bill cards are ALWAYS markup-based: no billing_model / bill_rate columns here
-- (billing model is a VMS setting). service_type partitions cards by the
-- service they price (EoR vs Staffing vs VMS).

-- ============================================================================
-- bill_card: + service_type (eor|staffing|vms), risk_tier_id now nullable
-- ============================================================================
create type public.bill_card_service_type as enum ('eor', 'staffing', 'vms');

alter table public.bill_card
    add column service_type public.bill_card_service_type;

-- Backfill existing rows before enforcing not null (all prior cards were EoR).
update public.bill_card set service_type = 'eor' where service_type is null;

alter table public.bill_card
    alter column service_type set not null,
    alter column risk_tier_id drop not null;

-- ============================================================================
-- entity_config_status — per-client config-page progress (resume + summary).
-- One row per (entity, config_key); the wizard upserts as each gated config
-- page is completed or skipped.
-- ============================================================================
create type public.config_status as enum ('not_started', 'completed', 'skipped');

create table public.entity_config_status (
    id         uuid primary key default gen_random_uuid(),
    entity_id  uuid not null references public.entity (id) on delete cascade,
    config_key text not null,
    status     public.config_status not null default 'not_started',
    updated_at timestamptz not null default now(),
    unique (entity_id, config_key)
);
create index idx_entity_config_status_entity_id on public.entity_config_status (entity_id);
