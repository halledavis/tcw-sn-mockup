-- Pay-rate fields. client_job_title carries the JD-level pay range an order
-- references; job_order captures the chosen pay model (fixed rate / a range /
-- per-geography ranges). Reuses the existing public.pay_type enum.

-- ============================================================================
-- client_job_title: JD-level pay range + type, seeded for existing rows
-- ============================================================================
alter table public.client_job_title
    add column pay_type     public.pay_type,
    add column pay_rate_min numeric,
    add column pay_rate_max numeric;

-- Believable range + type per risk tier (office roles salary, the rest hourly).
update public.client_job_title cjt
set pay_type = v.pt::public.pay_type, pay_rate_min = v.lo, pay_rate_max = v.hi
from (
    select rt.id as tier_id, x.pt, x.lo, x.hi
    from public.risk_tier rt
    join (values
        ('tier_0', 'salary', 70000, 140000),
        ('tier_1', 'hourly', 22, 35),
        ('tier_2', 'hourly', 18, 28),
        ('tier_3', 'hourly', 25, 42),
        ('tier_4', 'hourly', 24, 40)
    ) as x(code, pt, lo, hi) on x.code = rt.code
) v
where cjt.risk_tier_id = v.tier_id and cjt.pay_rate_min is null;

-- Fallback for any title without a risk tier.
update public.client_job_title
set pay_type = 'hourly', pay_rate_min = 20, pay_rate_max = 35
where pay_rate_min is null;

-- ============================================================================
-- job_order: chosen pay model
-- ============================================================================
create type public.pay_mode as enum ('fixed', 'range', 'geo_ranges');

alter table public.job_order
    add column pay_mode     public.pay_mode,
    add column pay_type     public.pay_type,
    add column pay_rate     numeric,   -- fixed (candidate known)
    add column pay_rate_min numeric,   -- range
    add column pay_rate_max numeric;   -- range

-- ============================================================================
-- order_geo_pay_range: per-geography ranges for a geo_ranges order
-- ============================================================================
create table public.order_geo_pay_range (
    id           uuid primary key default gen_random_uuid(),
    job_order_id uuid not null references public.job_order (id) on delete cascade,
    geo_area     text not null,
    pay_rate_min numeric,
    pay_rate_max numeric,
    created_at   timestamptz not null default now()
);
create index idx_order_geo_pay_range_job_order_id on public.order_geo_pay_range (job_order_id);
