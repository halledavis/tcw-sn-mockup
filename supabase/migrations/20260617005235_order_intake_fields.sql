-- Order-intake flow fields on job_order. The wizard captures a richer
-- fulfillment/fill-source model than the original flow_type/source_type pair;
-- we store both the new finer-grained values AND keep flow_type/source_type
-- populated (via the app's mapping) for consistency with existing logic.
-- A 'draft' status lets the flow persist an in-progress order (CRUD).

-- Finer-grained capture from the order wizard.
create type public.fulfillment_type as enum ('agent', 'worker', 'project');
create type public.fill_source      as enum ('self_pending', 'self_known', 'staffing_outside', 'staffing_kickoff');

-- job_order can now be a draft (in-progress order intake).
alter type public.job_order_status add value if not exists 'draft';

alter table public.job_order
    add column fulfillment_type public.fulfillment_type,
    add column fill_source      public.fill_source,
    add column candidate_known  boolean;
