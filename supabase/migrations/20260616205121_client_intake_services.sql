-- StaffingNation dev mockup — AI-driven "create new client" intake flow
-- Adds the module/service catalog (two-level capability map), per-client
-- resolved selections, and intake sessions. Follows existing conventions:
-- uuid PKs (gen_random_uuid()), created_at timestamptz default now(), FK +
-- index on every FK column, Postgres enums for categorical fields. RLS off.

-- ============================================================================
-- Enums
-- ============================================================================
create type public.entity_service_status as enum ('recommended', 'selected', 'active');
create type public.entity_service_source as enum ('ai', 'manual');
create type public.intake_persona        as enum ('cra', 'prospect');
create type public.intake_status         as enum ('in_progress', 'completed', 'confirmed');

-- Extend the existing entity lifecycle to allow the prospect -> active path.
-- (entity_status already has 'active','inactive'.) ADD VALUE is safe here
-- because no statement in this migration uses the new value.
alter type public.entity_status add value if not exists 'prospect';

-- ============================================================================
-- module — granular capability toggles (BRD Services list)
-- ============================================================================
create table public.module (
    id          uuid primary key default gen_random_uuid(),
    code        text not null unique,
    name        text not null,
    description text,
    created_at  timestamptz not null default now()
);

-- ============================================================================
-- service — the six commercial bundles the AI recommends
-- ============================================================================
create table public.service (
    id          uuid primary key default gen_random_uuid(),
    code        text not null unique,
    name        text not null,
    description text,
    sort_order  int not null default 0,
    created_at  timestamptz not null default now()
);

-- ============================================================================
-- service_module — M:N, which modules each service turns on (two-level map)
-- ============================================================================
create table public.service_module (
    id         uuid primary key default gen_random_uuid(),
    service_id uuid not null references public.service (id) on delete cascade,
    module_id  uuid not null references public.module (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (service_id, module_id)
);
create index idx_service_module_service_id on public.service_module (service_id);
create index idx_service_module_module_id  on public.service_module (module_id);

-- ============================================================================
-- entity_service — services chosen for a client (recommended/selected/active)
-- ============================================================================
create table public.entity_service (
    id         uuid primary key default gen_random_uuid(),
    entity_id  uuid not null references public.entity (id) on delete cascade,
    service_id uuid not null references public.service (id),
    status     public.entity_service_status not null default 'selected',
    source     public.entity_service_source not null default 'ai',
    created_at timestamptz not null default now(),
    unique (entity_id, service_id)
);
create index idx_entity_service_entity_id  on public.entity_service (entity_id);
create index idx_entity_service_service_id on public.entity_service (service_id);

-- ============================================================================
-- entity_module — resolved per-client toggles (materialized from services)
-- ============================================================================
create table public.entity_module (
    id         uuid primary key default gen_random_uuid(),
    entity_id  uuid not null references public.entity (id) on delete cascade,
    module_id  uuid not null references public.module (id),
    enabled    boolean not null default true,
    source     text,                              -- e.g. 'service:eor' provenance
    created_at timestamptz not null default now(),
    unique (entity_id, module_id)
);
create index idx_entity_module_entity_id on public.entity_module (entity_id);
create index idx_entity_module_module_id on public.entity_module (module_id);

-- ============================================================================
-- intake_session — one AI intake conversation per prospect
-- ============================================================================
create table public.intake_session (
    id               uuid primary key default gen_random_uuid(),
    entity_id        uuid references public.entity (id) on delete cascade,
    persona          public.intake_persona not null,
    brief            text,
    transcript       jsonb,            -- [{role, content}, ...]
    inferred_signals jsonb,            -- AI-extracted signals
    status           public.intake_status not null default 'completed',
    created_at       timestamptz not null default now()
);
create index idx_intake_session_entity_id on public.intake_session (entity_id);

-- ============================================================================
-- ALTER entity — master EoR pointer (prospect -> active lifecycle uses status)
-- ============================================================================
alter table public.entity
    add column default_eor_id uuid references public.entity (id);
create index idx_entity_default_eor_id on public.entity (default_eor_id);

-- ============================================================================
-- Catalog seed (reference data — ships with the migration so the app's
-- module/service catalog exists on every environment).
-- ============================================================================
insert into public.module (code, name, description) values
  ('marketplace',      'Marketplace',                 'Source candidates through the StaffingNation marketplace.'),
  ('direct_hire',      'Direct Hire',                 'Permanent placement / direct-hire conversions.'),
  ('timekeeping',      'Timekeeping',                 'Time capture and approval for engaged workers.'),
  ('self_sourced',     'Self-Sourced Sourcing',       'Client brings their own candidates to onboard/pay.'),
  ('vms',              'VMS',                         'Vendor management system for managing staffing suppliers.'),
  ('msp',              'MSP',                         'Managed service program oversight across suppliers.'),
  ('sow_mgmt',         'SOW Management',              'Statement-of-work / project-based engagement management.'),
  ('ic_1099_eval',     'IC / 1099 Evaluation',        'Independent-contractor classification and compliance evaluation.'),
  ('expense_mgmt',     'Expense Management',          'Worker expense capture and reimbursement.'),
  ('eor',              'Employer of Record',          'TCW/EoR legally employs the workers.'),
  ('intl_compliance',  'International Compliance',     'Cross-border employment and compliance coverage.');

insert into public.service (code, name, description, sort_order) values
  ('eor',                   'Employer of Record',       'We legally employ your workers and handle timekeeping/payroll.', 1),
  ('staffing',              'Staffing',                 'Onboard and pay workers you have already sourced yourself.',      2),
  ('vms',                   'VMS / MSP',                'Manage a network of staffing suppliers through a VMS + MSP.',     3),
  ('ic_1099_compliance',    'IC / 1099 Compliance',     'Evaluate and compliantly engage independent contractors.',        4),
  ('globalized_compliance', 'Globalized Compliance',    'Employ and stay compliant with workers outside your home country.', 5),
  ('nation_recruiting',     'Nation Recruiting',        'Source new candidates through the StaffingNation marketplace.',   6);

-- Thin starter service -> module map (editable; real-world mapping TBD).
insert into public.service_module (service_id, module_id)
select s.id, m.id from public.service s join public.module m on m.code in ('eor', 'timekeeping')
  where s.code = 'eor';
insert into public.service_module (service_id, module_id)
select s.id, m.id from public.service s join public.module m on m.code in ('self_sourced')
  where s.code = 'staffing';
insert into public.service_module (service_id, module_id)
select s.id, m.id from public.service s join public.module m on m.code in ('vms', 'msp')
  where s.code = 'vms';
insert into public.service_module (service_id, module_id)
select s.id, m.id from public.service s join public.module m on m.code in ('ic_1099_eval')
  where s.code = 'ic_1099_compliance';
insert into public.service_module (service_id, module_id)
select s.id, m.id from public.service s join public.module m on m.code in ('intl_compliance')
  where s.code = 'globalized_compliance';
insert into public.service_module (service_id, module_id)
select s.id, m.id from public.service s join public.module m on m.code in ('marketplace')
  where s.code = 'nation_recruiting';
