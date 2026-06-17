-- StaffingNation dev mockup — seed data
-- Reproduced locally by `supabase db reset`. Loaded into remote separately.
-- Deterministic UUIDs (prefix per table) so relationships are easy to follow:
--   a*=entity  b*=app_user  c*=jd  d*=job_order  e*=job
-- Exercises every FK, every enum value, the versioned-JD chain, and the
-- dual-role entity. No real PII.

-- ============================================================================
-- entity  (covers all entity_kind values; Umbrella has BOTH role flags)
-- ============================================================================
insert into public.entity (id, legal_name, dba_name, kind, parent_id, is_billing_entity, is_billable_entity, is_default_eor, address, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TargetCW Inc',            'TargetCW',      'tcw',    null,                                   true,  false, true,  '{"city":"San Diego","state":"CA","country":"US"}', 'active'),
  ('a0000000-0000-0000-0000-000000000002', 'Globex EoR Solutions LLC', 'Globex EoR',   'eor',    null,                                   true,  false, false, '{"city":"Austin","state":"TX","country":"US"}',    'active'),
  ('a0000000-0000-0000-0000-000000000003', 'Apex Staffing Partners',  'Apex Staffing', 'agency', null,                                   true,  false, false, '{"city":"Chicago","state":"IL","country":"US"}',   'active'),
  ('a0000000-0000-0000-0000-000000000004', 'Initech LLC',             'Initech',       'client', null,                                   false, true,  false, '{"city":"Austin","state":"TX","country":"US"}',    'active'),
  ('a0000000-0000-0000-0000-000000000005', 'Initech West LLC',        'Initech West',  'client', 'a0000000-0000-0000-0000-000000000004', false, true,  false, '{"city":"Phoenix","state":"AZ","country":"US"}',   'active'),
  ('a0000000-0000-0000-0000-000000000006', 'Hooli Corp',              'Hooli',         'client', null,                                   false, true,  false, '{"city":"Palo Alto","state":"CA","country":"US"}', 'active'),
  ('a0000000-0000-0000-0000-000000000007', 'Umbrella Group Inc',      'Umbrella',      'vendor', null,                                   true,  true,  false, '{"city":"Raccoon City","state":"MI","country":"US"}', 'active'),
  ('a0000000-0000-0000-0000-000000000008', 'Pied Piper MSP LLC',      'Pied Piper',    'msp',    null,                                   false, false, false, '{"city":"Seattle","state":"WA","country":"US"}',   'active');

-- ============================================================================
-- app_user  (covers all app_user_role values)
-- ============================================================================
insert into public.app_user (id, entity_id, role, first_name, last_name, email, status, location_access, department_access) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'admin',          'Alice',  'Admin',    'alice.admin@initech.example',     'active', '["austin","phoenix"]', '["engineering","operations"]'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'hiring_manager', 'Hank',   'Manager',  'hank.manager@initech.example',    'active', '["austin"]',            '["operations"]'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'recruiter',      'Rita',   'Recruit',  'rita.recruit@apexstaffing.example','active', null,                   null),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'eor_admin',      'Edgar',  'EorAdmin', 'edgar.eor@targetcw.example',      'active', null,                   null),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'supplier_admin', 'Sam',    'Supply',   'sam.supply@globexeor.example',    'active', null,                   null),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'worker',         'Wendy',  'Welder',   'wendy.welder@worker.example',     'active', null,                   null),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'worker',         'Walt',   'Worker',   'walt.worker@worker.example',      'active', null,                   null),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'worker',         'Will',   'Wright',   'will.wright@worker.example',      'active', null,                   null);

-- ============================================================================
-- jd  (3 JDs across Clients A/B; jd #1 versioned twice via parent_jd_id;
--      mix of hourly/salary; jd #3 uses a pay_rate range)
-- ============================================================================
insert into public.jd (id, entity_id, title, overview, job_category, pay_type, pay_rate, pay_rate_min, pay_rate_max, soc_code, version, parent_jd_id, status) values
  -- JD #1 v1 (Initech / Client A) — approved, then superseded by v2
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Senior Welder',     'Structural welding for fabrication line.', 'Welder',   'hourly', 42.50, null,  null,  '51-4121', 1, null,                                   'approved'),
  -- JD #1 v2 — NEW row pointing at v1 (snapshot chain), bumped rate
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'Senior Welder',     'Structural welding; added pipe certification.', 'Welder', 'hourly', 45.00, null, null, '51-4121', 2, 'c0000000-0000-0000-0000-000000000001', 'approved'),
  -- JD #2 (Hooli / Client B) — salary
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000006', 'Software Engineer', 'Backend services in Go.',                  'Engineering', 'salary', 135000, null, null, '15-1252', 1, null,                                'approved'),
  -- JD #3 (Initech / Client A) — hourly with a pay_rate RANGE
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Forklift Operator', 'Warehouse material handling.',             'Logistics','hourly', null,  22.00, 28.00, '53-7051', 1, null,                                   'approved');

-- ============================================================================
-- job_order  (4: worker vs supplier flow; self/external/outside sourcing;
--             markup vs bill_rate; varying num_workers; open + partially_filled)
-- ============================================================================
insert into public.job_order (id, entity_id, sub_entity_id, jd_id, sow_ref, flow_type, num_workers, source_type, location, billing_entity_id, billing_model, markup_pct, bill_rate, start_date, end_date, status, submitted_by) values
  -- JO #1: Initech, worker flow, self-sourced, 2 workers, TargetCW as EoR (markup), partially filled
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', null,                                   'c0000000-0000-0000-0000-000000000002', null,        'worker',   2, 'self_sourced',       'Austin, TX',  'a0000000-0000-0000-0000-000000000001', 'markup',    50.00, null,  '2026-01-15', '2026-12-31', 'partially_filled', 'b0000000-0000-0000-0000-000000000002'),
  -- JO #2: Hooli, worker flow, externally sourced, 3 workers, Globex EoR (bill_rate), filled
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006', null,                                   'c0000000-0000-0000-0000-000000000003', null,        'worker',   3, 'externally_sourced', 'Palo Alto, CA','a0000000-0000-0000-0000-000000000002', 'bill_rate', null,  95.00, '2026-02-01', null,         'filled',           'b0000000-0000-0000-0000-000000000003'),
  -- JO #3: Initech, worker flow, self-sourced, 1 worker, Umbrella supplier (markup), still open
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', null,                                   'c0000000-0000-0000-0000-000000000004', null,        'worker',   1, 'self_sourced',       'Phoenix, AZ', 'a0000000-0000-0000-0000-000000000007', 'markup',    40.00, null,  '2026-03-01', null,         'open',             'b0000000-0000-0000-0000-000000000002'),
  -- JO #4: Initech (sub: Initech West), SUPPLIER flow (no JD), outside SN, 2 workers, Globex (bill_rate), open
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005', null,                                  'SOW-2026-0042', 'supplier', 2, 'outside_sn',         'Remote',      'a0000000-0000-0000-0000-000000000002', 'bill_rate', null,  88.00, '2026-04-01', null,         'open',             'b0000000-0000-0000-0000-000000000001');

-- ============================================================================
-- job  (6 engagements; each pins jd_version_id + frozen rates where a JD applies;
--       JO #2 holds MULTIPLE jobs; one job's billing_entity differs from its
--       order's; supplier-flow job has no JD; covers offered/active/ended)
-- ============================================================================
insert into public.job (id, job_order_id, worker_user_id, billing_entity_id, jd_version_id, pay_rate, bill_rate, start_date, end_date, status) values
  -- JO #1 (needs 2, 1 filled => partially_filled). Pins JD v2; TargetCW EoR.
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 45.00, 67.50, '2026-01-20', null,         'active'),
  -- JO #2 (3 jobs => MULTIPLE). Pins JD #2 (salary). Globex EoR for two...
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 135000, 95.00, '2026-02-05', null,         'active'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 135000, 95.00, '2026-02-05', '2026-05-30', 'ended'),
  -- ...and one whose billing_entity DIFFERS from the order's (TargetCW, not Globex)
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 140000, 98.00, '2026-03-01', null,         'active'),
  -- JO #3 (open, offer extended). Pins JD #3.
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000004', 26.00, 36.40, '2026-03-10', null,         'offered'),
  -- JO #4 (SUPPLIER flow => no JD; jd_version_id null). Globex EoR.
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', null,                                   55.00, 88.00, '2026-04-05', null,         'active');

-- ============================================================================
-- pay_rate_rule  (ladder: system > operator > client > jd > location_dept;
--                 'order' scope is exercised in bill_rate_rule below)
-- ============================================================================
insert into public.pay_rate_rule (id, scope_level, scope_ref, entity_id, when_conditions, pay_type, pay_rate, priority) values
  (gen_random_uuid(), 'system',        null,                                   null,                                   null,                                                              'hourly', 25.00, 0),
  (gen_random_uuid(), 'operator',      'a0000000-0000-0000-0000-000000000001', null,                                   null,                                                              'hourly', 30.00, 5),
  (gen_random_uuid(), 'client',        'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', null,                                                              'hourly', 40.00, 10),
  (gen_random_uuid(), 'jd',            'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', null,                                                              'hourly', 48.00, 20),
  (gen_random_uuid(), 'location_dept', null,                                   'a0000000-0000-0000-0000-000000000004', '{"job_category":"Welder","country":"US","state_not":"CA"}'::jsonb, 'hourly', 55.00, 30);

-- ============================================================================
-- bill_rate_rule  (same ladder shape; payload is billing_model; covers markup
--                  + bill_rate, and the 'order' scope + when_conditions)
-- ============================================================================
insert into public.bill_rate_rule (id, scope_level, scope_ref, entity_id, when_conditions, billing_model, markup_pct, bill_rate, priority) values
  (gen_random_uuid(), 'system', null,                                   null,                                   null,                                                  'markup',    45.00, null,  0),
  (gen_random_uuid(), 'client', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', null,                                                  'markup',    50.00, null,  10),
  (gen_random_uuid(), 'jd',     'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000006', null,                                                  'bill_rate', null,  95.00, 20),
  (gen_random_uuid(), 'order',  'd0000000-0000-0000-0000-000000000001', null,                                   '{"job_category":"Welder","state":"TX"}'::jsonb,       'bill_rate', null,  80.00, 30);

-- ============================================================================
-- DEMO DATA for the order-intake flow (departments / locations / scope / job
-- titles) on the three billable-entity clients. IDEMPOTENT — safe to re-run:
-- natural-key ON CONFLICT where a unique exists, WHERE NOT EXISTS otherwise.
-- Clients: A=Initech LLC (...004, US multi-state), B=Hooli Corp (...006, incl.
-- London UK), C=Initech West LLC (...005, incl. Toronto ON).
-- ============================================================================

-- Departments — unique(entity_id, name)
insert into public.department (entity_id, name) values
  ('a0000000-0000-0000-0000-000000000004', 'Engineering'),
  ('a0000000-0000-0000-0000-000000000004', 'Operations'),
  ('a0000000-0000-0000-0000-000000000004', 'Sales'),
  ('a0000000-0000-0000-0000-000000000004', 'Marketing'),
  ('a0000000-0000-0000-0000-000000000006', 'Engineering'),
  ('a0000000-0000-0000-0000-000000000006', 'Product'),
  ('a0000000-0000-0000-0000-000000000006', 'Data Science'),
  ('a0000000-0000-0000-0000-000000000005', 'Field Services'),
  ('a0000000-0000-0000-0000-000000000005', 'Operations'),
  ('a0000000-0000-0000-0000-000000000005', 'Logistics')
on conflict (entity_id, name) do nothing;

-- Locations — no unique constraint, guard on (entity_id, name)
insert into public.location (entity_id, name, city, state, country, is_primary)
select v.entity_id, v.name, v.city, v.state, v.country, v.is_primary
from (values
  -- A: Initech LLC — US multi-state
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Austin HQ',     'Austin',    'TX', 'US', true),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Denver Office', 'Denver',    'CO', 'US', false),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Chicago Office','Chicago',   'IL', 'US', false),
  -- B: Hooli Corp — US + non-US (London, UK)
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'Palo Alto HQ',  'Palo Alto', 'CA', 'US', true),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'NYC Office',    'New York',  'NY', 'US', false),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'London Office', 'London',    null, 'GB', false),
  -- C: Initech West LLC — US + Canadian province (Toronto, ON)
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Phoenix HQ',    'Phoenix',   'AZ', 'US', true),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Seattle Office','Seattle',   'WA', 'US', false),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Toronto Office','Toronto',   'ON', 'CA', false)
) as v(entity_id, name, city, state, country, is_primary)
where not exists (
  select 1 from public.location l where l.entity_id = v.entity_id and l.name = v.name
);

-- In-scope countries — unique(entity_id, country_code)
insert into public.client_country_scope (entity_id, country_code, addendum_status) values
  ('a0000000-0000-0000-0000-000000000004', 'US', 'not_applicable'),
  ('a0000000-0000-0000-0000-000000000006', 'US', 'not_applicable'),
  ('a0000000-0000-0000-0000-000000000006', 'GB', 'pending'),
  ('a0000000-0000-0000-0000-000000000005', 'US', 'not_applicable'),
  ('a0000000-0000-0000-0000-000000000005', 'CA', 'pending')
on conflict (entity_id, country_code) do nothing;

-- In-scope subdivisions — unique(entity_id, country_code, subdivision_code)
insert into public.client_subdivision_scope (entity_id, country_code, subdivision_code, subdivision_type) values
  ('a0000000-0000-0000-0000-000000000004', 'US', 'TX', 'state'),
  ('a0000000-0000-0000-0000-000000000004', 'US', 'CO', 'state'),
  ('a0000000-0000-0000-0000-000000000004', 'US', 'IL', 'state'),
  ('a0000000-0000-0000-0000-000000000006', 'US', 'CA', 'state'),
  ('a0000000-0000-0000-0000-000000000006', 'US', 'NY', 'state'),
  ('a0000000-0000-0000-0000-000000000005', 'US', 'AZ', 'state'),
  ('a0000000-0000-0000-0000-000000000005', 'US', 'WA', 'state'),
  ('a0000000-0000-0000-0000-000000000005', 'CA', 'ON', 'province')
on conflict (entity_id, country_code, subdivision_code) do nothing;

-- Job titles — no unique constraint, guard on (entity_id, title). risk_tier_id
-- assigned across a mix of seeded tiers via code lookup.
insert into public.client_job_title (entity_id, title, risk_tier_id, status, needs_review)
select v.entity_id, v.title, (select id from public.risk_tier where code = v.tier), 'confirmed', false
from (values
  -- A: Initech LLC — software / tech
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Software Engineer', 'tier_0'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Account Manager',   'tier_0'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Field Technician',  'tier_1'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Lab Technician',    'tier_2'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Delivery Driver',   'tier_3'),
  -- B: Hooli Corp — search / data
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'Software Engineer', 'tier_0'),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'Data Scientist',    'tier_0'),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'Product Manager',   'tier_0'),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'Field Technician',  'tier_1'),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'Warehouse Associate','tier_2'),
  -- C: Initech West LLC — field services / industrial
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Operations Coordinator', 'tier_0'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Field Technician',       'tier_1'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Warehouse Associate',    'tier_2'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Lab Technician',         'tier_2'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Forklift Operator',      'tier_3'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Delivery Driver',        'tier_3')
) as v(entity_id, title, tier)
where not exists (
  select 1 from public.client_job_title c where c.entity_id = v.entity_id and c.title = v.title
);

-- JD-level pay range + type per title (by risk tier), for any title missing it.
-- Mirrors the order_pay_rate migration so a fresh db reset stays consistent.
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
