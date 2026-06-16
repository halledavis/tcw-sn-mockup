-- StaffingNation dev mockup — core schema
-- Conventions: public schema, uuid PKs (gen_random_uuid()), created_at timestamptz
-- default now(), FK + index on every FK column, Postgres enums for categorical fields.
-- RLS intentionally left DISABLED (dev mockup). No production hardening.

-- ============================================================================
-- Enums (categorical fields, used consistently across tables)
-- ============================================================================
create type public.entity_kind       as enum ('client', 'tcw', 'eor', 'agency', 'vendor', 'msp');
create type public.entity_status      as enum ('active', 'inactive');
create type public.app_user_role      as enum ('admin', 'hiring_manager', 'recruiter', 'supplier_admin', 'eor_admin', 'worker');
create type public.app_user_status    as enum ('active', 'inactive', 'invited');
create type public.pay_type           as enum ('hourly', 'salary');
create type public.jd_status          as enum ('draft', 'pending', 'approved');
create type public.flow_type          as enum ('worker', 'supplier');
create type public.source_type        as enum ('self_sourced', 'externally_sourced', 'outside_sn');
create type public.billing_model      as enum ('markup', 'bill_rate');
create type public.job_order_status   as enum ('open', 'partially_filled', 'filled', 'closed', 'cancelled');
create type public.job_status         as enum ('offered', 'active', 'ended');
create type public.scope_level        as enum ('system', 'operator', 'client', 'location_dept', 'jd', 'order');

-- ============================================================================
-- 1. entity — companies/orgs of every kind, one table
-- ============================================================================
create table public.entity (
    id                 uuid primary key default gen_random_uuid(),
    legal_name         text not null,
    dba_name           text,
    kind               public.entity_kind not null,
    parent_id          uuid references public.entity (id),          -- self-FK: subsidiaries
    is_billing_entity  boolean not null default false,              -- bill-FROM: issues invoices / legal employer
    is_billable_entity boolean not null default false,              -- bill-TO: gets invoiced / pays
    is_default_eor     boolean not null default false,
    address            jsonb,
    status             public.entity_status not null default 'active',
    created_at         timestamptz not null default now()
);
create index idx_entity_parent_id on public.entity (parent_id);
create index idx_entity_kind      on public.entity (kind);

-- ============================================================================
-- 2. app_user — unified across all entity types (workers are role 'worker')
-- ============================================================================
create table public.app_user (
    id                uuid primary key default gen_random_uuid(),
    entity_id         uuid not null references public.entity (id),
    role              public.app_user_role not null,
    first_name        text not null,
    last_name         text not null,
    email             text not null unique,
    status            public.app_user_status not null default 'active',
    location_access   jsonb,
    department_access jsonb,
    created_at        timestamptz not null default now()
);
create index idx_app_user_entity_id on public.app_user (entity_id);

-- ============================================================================
-- 3. jd — job descriptions, client-scoped, versioned (each version is a NEW row)
-- ============================================================================
create table public.jd (
    id               uuid primary key default gen_random_uuid(),
    entity_id        uuid not null references public.entity (id),   -- owning client
    title            text not null,
    overview         text,
    responsibilities text,
    requirements     text,
    job_category     text,
    pay_type         public.pay_type not null,
    pay_rate         numeric,
    pay_rate_min     numeric,
    pay_rate_max     numeric,
    soc_code         text,
    version          int not null default 1,
    parent_jd_id     uuid references public.jd (id),                -- prior version
    status           public.jd_status not null default 'draft',
    created_at       timestamptz not null default now()
);
create index idx_jd_entity_id    on public.jd (entity_id);
create index idx_jd_parent_jd_id on public.jd (parent_jd_id);

-- ============================================================================
-- 4. job_order — the requisition / order
-- ============================================================================
create table public.job_order (
    id                uuid primary key default gen_random_uuid(),
    entity_id         uuid not null references public.entity (id),  -- client
    sub_entity_id     uuid references public.entity (id),
    jd_id             uuid references public.jd (id),               -- null for supplier flow
    sow_ref           text,                                         -- SOW table stubbed
    flow_type         public.flow_type not null,
    num_workers       int not null default 1,
    source_type       public.source_type not null,
    location          text,                                         -- location table stubbed
    billing_entity_id uuid references public.entity (id),           -- fulfilling EoR/supplier
    billing_model     public.billing_model,
    markup_pct        numeric,
    bill_rate         numeric,
    start_date        date,
    end_date          date,
    status            public.job_order_status not null default 'open',
    submitted_by      uuid references public.app_user (id),
    created_at        timestamptz not null default now()
);
create index idx_job_order_entity_id         on public.job_order (entity_id);
create index idx_job_order_sub_entity_id     on public.job_order (sub_entity_id);
create index idx_job_order_jd_id             on public.job_order (jd_id);
create index idx_job_order_billing_entity_id on public.job_order (billing_entity_id);
create index idx_job_order_submitted_by      on public.job_order (submitted_by);

-- ============================================================================
-- 5. job — one filled engagement/assignment from a job_order
-- ============================================================================
create table public.job (
    id                uuid primary key default gen_random_uuid(),
    job_order_id      uuid not null references public.job_order (id),
    worker_user_id    uuid not null references public.app_user (id),
    billing_entity_id uuid references public.entity (id),           -- legal employer for THIS engagement
    jd_version_id     uuid references public.jd (id),               -- exact JD row snapshotted at offer
    pay_rate          numeric,                                      -- frozen resolved pay rate at offer
    bill_rate         numeric,                                      -- frozen resolved bill rate at offer
    start_date        date,
    end_date          date,
    status            public.job_status not null default 'offered',
    created_at        timestamptz not null default now()
);
create index idx_job_job_order_id      on public.job (job_order_id);
create index idx_job_worker_user_id    on public.job (worker_user_id);
create index idx_job_billing_entity_id on public.job (billing_entity_id);
create index idx_job_jd_version_id     on public.job (jd_version_id);

-- ============================================================================
-- 6. pay_rate_rule — resolution: order > jd > location_dept > client > operator > system
--    scope_ref is intentionally polymorphic (points at entity/jd/job_order by
--    scope_level) so it is NOT a FK; it is indexed for resolution lookups.
-- ============================================================================
create table public.pay_rate_rule (
    id              uuid primary key default gen_random_uuid(),
    scope_level     public.scope_level not null,
    scope_ref       uuid,
    entity_id       uuid references public.entity (id),             -- owning client
    when_conditions jsonb,
    pay_type        public.pay_type not null,
    pay_rate        numeric not null,
    priority        int not null default 0,
    created_at      timestamptz not null default now()
);
create index idx_pay_rate_rule_entity_id on public.pay_rate_rule (entity_id);
create index idx_pay_rate_rule_scope     on public.pay_rate_rule (scope_level, scope_ref);

-- ============================================================================
-- 7. bill_rate_rule — same shape + resolution as pay_rate_rule; payload is billing_model
-- ============================================================================
create table public.bill_rate_rule (
    id              uuid primary key default gen_random_uuid(),
    scope_level     public.scope_level not null,
    scope_ref       uuid,
    entity_id       uuid references public.entity (id),             -- owning client
    when_conditions jsonb,
    billing_model   public.billing_model not null,
    markup_pct      numeric,
    bill_rate       numeric,
    priority        int not null default 0,
    created_at      timestamptz not null default now()
);
create index idx_bill_rate_rule_entity_id on public.bill_rate_rule (entity_id);
create index idx_bill_rate_rule_scope     on public.bill_rate_rule (scope_level, scope_ref);
