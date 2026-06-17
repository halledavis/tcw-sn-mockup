-- Location-details fields on job_order, captured by the worker-requisition
-- "Location details" step. work_arrangement is the onsite/remote/hybrid/open
-- model; reporting_location_id points at one of the client's definite offices
-- (location rows), not a scoped jurisdiction. No map-data schema — the step's
-- world map is cosmetic and projected from an inline centroid lookup.

create type public.work_arrangement as enum ('onsite', 'remote', 'hybrid', 'open');

alter table public.job_order
    add column work_arrangement      public.work_arrangement,
    add column reporting_location_id uuid references public.location (id);
create index idx_job_order_reporting_location_id on public.job_order (reporting_location_id);
