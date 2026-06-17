-- Engagement-details fields on job_order, captured by the worker-requisition
-- "Engagement details" step. department_id, start_date and end_date already
-- exist (core schema + client_scope_org); this adds the picked job title
-- (which carries the risk tier), weekly-hours model, and a by-duration option.

create type public.hours_type    as enum ('fixed', 'variable');
create type public.duration_unit as enum ('days', 'weeks', 'months', 'years');

alter table public.job_order
    add column client_job_title_id uuid references public.client_job_title (id),
    add column weekly_hours        numeric,
    add column hours_type          public.hours_type,
    add column duration_value      int,
    add column duration_unit       public.duration_unit;
create index idx_job_order_client_job_title_id on public.job_order (client_job_title_id);
