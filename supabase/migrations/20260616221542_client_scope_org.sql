-- StaffingNation dev mockup — operating-scope + org-structure tables.
-- Conventions: uuid PKs (gen_random_uuid()), created_at timestamptz default
-- now(), FK + index on every FK column, Postgres enums for categorical fields.
-- RLS left disabled (dev mockup).

-- ============================================================================
-- Enums
-- ============================================================================
create type public.addendum_status  as enum ('not_applicable', 'pending', 'draft', 'sent', 'signed');
create type public.subdivision_type as enum ('state', 'province');

-- ============================================================================
-- client_country_scope — countries a client operates in (+ addendum tracking)
-- ============================================================================
create table public.client_country_scope (
    id              uuid primary key default gen_random_uuid(),
    entity_id       uuid not null references public.entity (id) on delete cascade,
    country_code    text not null,
    addendum_status public.addendum_status not null default 'not_applicable',
    addendum_ref    text,
    created_at      timestamptz not null default now(),
    unique (entity_id, country_code)
);
create index idx_client_country_scope_entity_id on public.client_country_scope (entity_id);

-- ============================================================================
-- client_subdivision_scope — states/provinces within a scoped country
-- ============================================================================
create table public.client_subdivision_scope (
    id               uuid primary key default gen_random_uuid(),
    entity_id        uuid not null references public.entity (id) on delete cascade,
    country_code     text not null,
    subdivision_code text not null,
    subdivision_type public.subdivision_type not null,
    created_at       timestamptz not null default now(),
    unique (entity_id, country_code, subdivision_code)
);
create index idx_client_subdivision_scope_entity_id on public.client_subdivision_scope (entity_id);

-- ============================================================================
-- location — physical work locations for a client
-- ============================================================================
create table public.location (
    id          uuid primary key default gen_random_uuid(),
    entity_id   uuid not null references public.entity (id) on delete cascade,
    name        text,
    street      text,
    city        text,
    state       text,
    country     text,
    postal      text,
    internal_id text,
    is_primary  boolean not null default false,
    created_at  timestamptz not null default now()
);
create index idx_location_entity_id on public.location (entity_id);

-- ============================================================================
-- department — org units for a client
-- ============================================================================
create table public.department (
    id          uuid primary key default gen_random_uuid(),
    entity_id   uuid not null references public.entity (id) on delete cascade,
    name        text not null,
    internal_id text,
    created_at  timestamptz not null default now(),
    unique (entity_id, name)
);
create index idx_department_entity_id on public.department (entity_id);

-- ============================================================================
-- job_order gains an optional department
-- ============================================================================
alter table public.job_order
    add column department_id uuid references public.department (id);
create index idx_job_order_department_id on public.job_order (department_id);
