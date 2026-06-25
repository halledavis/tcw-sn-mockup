-- ============================================================================
-- halle — BRE / Prime rules engine (consolidated capture)
-- ============================================================================
-- Source-control + reproducibility snapshot of the `halle` schema, which until
-- now existed ONLY in the remote database (it was built out-of-band, not via a
-- migration). This file recreates the whole engine — 27 tables, 7 enums, the
-- resolver + integrity functions, triggers, indexes, RLS, and demo seed — on a
-- fresh database.
--
-- CLEAN vs LIVE: in the live remote the six engine enums (authority_type,
-- effect_type, instrument_type, ledger_event_type, origin_type, violation_action)
-- were accidentally created in BOTH `public` and `halle`, and the live tables
-- bind to the `public` copies. Nothing outside `halle` uses those copies. This
-- migration is the *intended clean form*: every type lives in `halle` and tables
-- bind to `halle.<enum>`. It does NOT mutate the live schema's existing column
-- bindings.
--
-- IDEMPOTENT: every statement is guarded (create … if not exists / or replace,
-- drop-trigger-if-exists, insert … on conflict do nothing). So it create-cleans
-- on a fresh DB and no-ops against the existing remote — safe for both the
-- PR validate stack (`supabase start`) and `supabase db push`.
-- ============================================================================

create schema if not exists halle;
set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- Enums (all in halle)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='halle' and t.typname='authority_type') then
    create type halle.authority_type as enum ('system','employer','client','location');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='halle' and t.typname='effect_type') then
    create type halle.effect_type as enum ('setter','floor','ceiling','gate');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='halle' and t.typname='violation_action') then
    create type halle.violation_action as enum ('block','resolve_quiet','resolve_loud','flag_soft','flag_hard','re_sign');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='halle' and t.typname='origin_type') then
    create type halle.origin_type as enum ('clause','instrument','statute','operator_default','manual');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='halle' and t.typname='ledger_event_type') then
    create type halle.ledger_event_type as enum ('accrual','usage','adjustment','forfeiture','grant');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='halle' and t.typname='instrument_type') then
    create type halle.instrument_type as enum ('bill_card','pay_card','onboarding_packet','addendum');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='halle' and t.typname='condition_kind') then
    create type halle.condition_kind as enum ('eq','range');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Tables (dependency-ordered; FKs inline)
-- ----------------------------------------------------------------------------

-- Parties: clients (billable) and EoR/TCW (billing) in one table.
create table if not exists halle.entity (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  is_billing_entity  boolean not null default false,
  is_billable_entity boolean not null default false
);

-- Geography hierarchy (country > state > county > city), drives jurisdiction.
create table if not exists halle.geo_level (
  level text primary key,
  rank  integer not null
);

create table if not exists halle.geo (
  id        uuid primary key default gen_random_uuid(),
  level     text not null references halle.geo_level(level),
  parent_id uuid references halle.geo(id),
  code      text,
  name      text not null
);

create table if not exists halle.worker (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  home_city    text,
  home_state   text,
  home_country text,
  phone        text,
  email        text
);

create table if not exists halle.jd (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  risk_tier integer
);

-- Registry of allowed predicate keys + their value types (enforced by validate_rule).
create table if not exists halle.predicate_key (
  key        text primary key,
  value_type text not null check (value_type = any (array['uuid','text','number','bool'])),
  description text
);

-- Registry of record types rules attach to (the trigger/gather index).
create table if not exists halle.object_type (
  id             text primary key,
  physical_table text not null,
  trigger_events text[] not null
);

-- Authoring layer: reusable clause language + rule template.
create table if not exists halle.clause (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  body          text,
  rule_template jsonb,
  version       integer not null default 1
);

create table if not exists halle.paycode (
  id      uuid primary key default gen_random_uuid(),
  paycode text not null unique
);

-- MSA = signed contract (billing entity ↔ billable entity).
create table if not exists halle.msa (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  billable_entity_id uuid not null,
  billing_entity_id  uuid not null,
  version            integer not null default 1,
  signed_at          timestamptz,
  effective_from     date not null,
  effective_to       date,
  supersedes_id      uuid references halle.msa(id)
);

-- A clause bound into one MSA, parameters filled in — drives concrete rules.
create table if not exists halle.msa_clause (
  id          uuid primary key default gen_random_uuid(),
  msa_id      uuid not null references halle.msa(id),
  clause_id   uuid not null references halle.clause(id),
  sort_order  integer,
  parameters  jsonb,
  change_tier text
);

-- Signed, versioned grouping (bill/pay cards, packets). Never resolves.
create table if not exists halle.instrument (
  id                   uuid primary key default gen_random_uuid(),
  instrument_type      halle.instrument_type not null,
  name                 text not null,
  authority_type       halle.authority_type not null,
  authority_entity_id  uuid,
  version              integer not null default 1,
  signed_at            timestamptz,
  effective_from       date not null,
  effective_to         date,
  supersedes_id        uuid references halle.instrument(id),
  origin_msa_clause_id uuid references halle.msa_clause(id)
);

-- RULE — the homogeneous policy primitive. predicate → effect, with a combinator.
create table if not exists halle.rule (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  predicate               jsonb not null,
  effect                  jsonb not null,
  effect_type             halle.effect_type not null,
  authority_type          halle.authority_type not null,
  authority_entity_id     uuid,
  origin_type             halle.origin_type not null default 'manual'::halle.origin_type,
  origin_id               uuid,
  sort_order              integer,
  create_violation_action halle.violation_action,
  update_violation_action halle.violation_action,
  effective_from          date not null,
  effective_to            date,
  supersedes_id           uuid references halle.rule(id)
);

-- Derived predicate index (maintained by the shred_predicate trigger).
create table if not exists halle.rule_condition (
  rule_id  uuid not null references halle.rule(id) on delete cascade,
  key      text not null references halle.predicate_key(key),
  kind     halle.condition_kind not null,
  val_text text,
  val_num  numeric,
  val_lo   numeric,
  val_hi   numeric
);

create table if not exists halle.rule_match_meta (
  rule_id         uuid primary key references halle.rule(id) on delete cascade,
  condition_count integer not null default 0,
  exact_only      boolean not null default false
);

create table if not exists halle.rule_object_type (
  rule_id        uuid not null references halle.rule(id) on delete cascade,
  object_type_id text not null references halle.object_type(id),
  primary key (rule_id, object_type_id)
);

-- LEDGER — append-only accrual events; balance = sum, clamped to a cap ceiling rule.
create table if not exists halle.ledger_event (
  id             uuid primary key default gen_random_uuid(),
  worker_id      uuid not null,
  accrual_type   text not null,
  event_type     halle.ledger_event_type not null,
  amount         numeric not null,
  effective_date date not null,
  source_rule_id uuid references halle.rule(id),
  created_at     timestamptz default now()
);

-- Operational / context records the resolver joins against.
create table if not exists halle.job_order (
  id                 uuid primary key default gen_random_uuid(),
  billable_entity_id uuid references halle.entity(id),
  billing_entity_id  uuid references halle.entity(id),
  jd_id              uuid references halle.jd(id),
  worksite_geo_id    uuid references halle.geo(id),
  po_number          text
);

create table if not exists halle.job (
  id           uuid primary key default gen_random_uuid(),
  job_order_id uuid references halle.job_order(id),
  worker_id    uuid references halle.worker(id),
  start_date   date,
  end_date     date
);

create table if not exists halle.timecard (
  id          uuid primary key default gen_random_uuid(),
  reg_hours   numeric(8,2) default 0,
  ot_hours    numeric(8,2) default 0,
  worker_id   uuid references halle.worker(id),
  dt_hours    numeric(8,2) default 0,
  total_hours numeric(8,2) default 0,
  gross       numeric(12,2)
);

create table if not exists halle.punch (
  id         uuid primary key default gen_random_uuid(),
  worker_id  uuid references halle.worker(id),
  job_id     uuid references halle.job(id),
  work_date  date,
  clock_in   timestamptz,
  clock_out  timestamptz,
  hours      numeric(8,2),
  bill_code_id uuid,
  approver_id  uuid,
  pay_rate   numeric(12,4),
  gross      numeric(12,2),
  paycode_id uuid references halle.paycode(id)
);

create table if not exists halle.timecard_punch (
  timecard_id uuid not null references halle.timecard(id) on delete cascade,
  punch_id    uuid not null references halle.punch(id) on delete cascade,
  primary key (timecard_id, punch_id)
);

create table if not exists halle.paycheck (
  id           uuid primary key default gen_random_uuid(),
  worker_id    uuid references halle.worker(id),
  gross        numeric(12,2),
  weekend_date date
);

create table if not exists halle.txn (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid references halle.worker(id),
  timecard_id uuid references halle.timecard(id),
  check_id    uuid references halle.paycheck(id),
  reg_hours   numeric(8,2),
  ot_hours    numeric(8,2),
  dt_hours    numeric(8,2),
  total_hours numeric(8,2),
  gross       numeric(12,2),
  pay_rate    numeric(12,4),
  bill_rate   numeric(12,4),
  adjustments numeric(12,2),
  total_bill  numeric(12,2)
);

create table if not exists halle.invoice (
  id                 uuid primary key default gen_random_uuid(),
  invoice_amount     numeric(12,2),
  pay_amount         numeric(12,2),
  balance_amount     numeric(12,2),
  billable_entity_id uuid references halle.entity(id),
  billing_entity_id  uuid references halle.entity(id)
);

-- Audit: every resolution writes a decision + the rules that fired.
create table if not exists halle.decision (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  object_type text references halle.object_type(id),
  object_id   uuid,
  action      text,
  context     jsonb not null,
  result      jsonb not null,
  as_of       date not null
);

create table if not exists halle.decision_rule (
  decision_id uuid not null references halle.decision(id) on delete cascade,
  rule_id     uuid not null references halle.rule(id),
  primary key (decision_id, rule_id)
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists rule_effect_type on halle.rule using btree (effect_type, effective_from);
create index if not exists rule_origin on halle.rule using btree (origin_type, origin_id);
create index if not exists rule_supersedes on halle.rule using btree (supersedes_id);
create index if not exists rule_condition_eq_n on halle.rule_condition using btree (key, val_num) where ((kind = 'eq'::halle.condition_kind) and (val_num is not null));
create index if not exists rule_condition_eq_t on halle.rule_condition using btree (key, val_text) where ((kind = 'eq'::halle.condition_kind) and (val_text is not null));
create index if not exists rule_condition_range on halle.rule_condition using btree (key) where (kind = 'range'::halle.condition_kind);
create index if not exists rule_condition_rule on halle.rule_condition using btree (rule_id);
create index if not exists rule_object_type_lookup on halle.rule_object_type using btree (object_type_id, rule_id);
create index if not exists ledger_lookup on halle.ledger_event using btree (worker_id, accrual_type, effective_date);
create index if not exists instrument_origin_clause on halle.instrument using btree (origin_msa_clause_id);
create index if not exists punch_job on halle.punch using btree (job_id, work_date);
create index if not exists punch_worker on halle.punch using btree (worker_id, work_date);
create index if not exists txn_check on halle.txn using btree (check_id);
create index if not exists txn_timecard on halle.txn using btree (timecard_id);
create index if not exists txn_worker on halle.txn using btree (worker_id);
create index if not exists decision_object on halle.decision using btree (object_type, object_id, occurred_at);
create index if not exists decision_rule_by_rule on halle.decision_rule using btree (rule_id);

-- ----------------------------------------------------------------------------
-- Functions (resolver + integrity). Captured verbatim from the live engine.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION halle.geo_ancestry(p_geo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
declare result jsonb := '{}'::jsonb; cur uuid := p_geo; lvl text; pid uuid; gid uuid; guard int := 0;
begin
  while cur is not null and guard < 20 loop
    select g.id, g.level, g.parent_id into gid, lvl, pid from halle.geo g where g.id = cur;
    exit when gid is null;
    result := result || jsonb_build_object('geo_'||lvl, gid::text);
    cur := pid; guard := guard + 1;
  end loop;
  return result;
end; $function$;

CREATE OR REPLACE FUNCTION halle.predicate_specificity(p jsonb)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'halle', 'public'
AS $function$ select count(*)::int from jsonb_object_keys(p); $function$;

CREATE OR REPLACE FUNCTION halle.predicate_matches(predicate jsonb, ctx jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'halle', 'public'
AS $function$
declare k text; v jsonb; cv jsonb; ct text; n numeric;
begin
  for k, v in select * from jsonb_each(predicate) loop
    cv := ctx -> k;                       -- context value as jsonb (null if absent)
    ct := ctx ->> k;                      -- ... and as text
    if jsonb_typeof(v) = 'object' then
      if v ? 'in' then
        if cv is null then return false; end if;
        if not exists (
          select 1 from jsonb_array_elements(v->'in') e
          where (jsonb_typeof(e) = 'number' and ct ~ '^-?[0-9]+(\.[0-9]+)?$' and (e #>> '{}')::numeric = ct::numeric)
             or (jsonb_typeof(e) <> 'number' and btrim(e #>> '{}') = btrim(ct))
        ) then return false; end if;
      elsif (v ? 'min') or (v ? 'max') then
        if ct is null or ct !~ '^-?[0-9]+(\.[0-9]+)?$' then return false; end if;
        n := ct::numeric;
        if (v ? 'min') and n < (v->>'min')::numeric then return false; end if;
        if (v ? 'max') and n > (v->>'max')::numeric then return false; end if;
      else
        if cv is null or not (cv @> v) then return false; end if;   -- nested-match
      end if;
    else
      if cv is null then return false; end if;
      case jsonb_typeof(v)
        when 'number' then
          if ct !~ '^-?[0-9]+(\.[0-9]+)?$' or (v #>> '{}')::numeric <> ct::numeric then return false; end if;
        else  -- string or boolean (boolean serializes to canonical 'true'/'false')
          if btrim(v #>> '{}') is distinct from btrim(ct) then return false; end if;
      end case;
    end if;
  end loop;
  return true;
end; $function$;

CREATE OR REPLACE FUNCTION halle.shred_predicate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'halle', 'public'
AS $function$
begin
  delete from halle.rule_condition where rule_id = new.id;
  insert into halle.rule_condition (rule_id, key, kind, val_text, val_num, val_lo, val_hi)
    select * from halle.expected_conditions(new.id, new.predicate, new.authority_type, new.authority_entity_id);
  insert into halle.rule_match_meta (rule_id, condition_count, exact_only)
    select new.id, m.condition_count, m.exact_only
    from halle.expected_meta(new.predicate, new.authority_type, new.authority_entity_id) m
    on conflict (rule_id) do update
      set condition_count = excluded.condition_count, exact_only = excluded.exact_only;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION halle.rebuild_shred()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'halle', 'public'
AS $function$
begin
  truncate halle.rule_condition;
  delete from halle.rule_match_meta;
  insert into halle.rule_condition (rule_id, key, kind, val_text, val_num, val_lo, val_hi)
    select e.* from halle.rule r, lateral halle.expected_conditions(r.id, r.predicate, r.authority_type, r.authority_entity_id) e;
  insert into halle.rule_match_meta (rule_id, condition_count, exact_only)
    select r.id, m.condition_count, m.exact_only
    from halle.rule r, lateral halle.expected_meta(r.predicate, r.authority_type, r.authority_entity_id) m;
end; $function$;

CREATE OR REPLACE FUNCTION halle.authority_in_scope(at halle.authority_type, aid uuid, ctx jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select case at
    when 'system'   then true
    when 'employer' then ctx->>'employer_id' = aid::text
    when 'client'   then ctx->>'client_id'   = aid::text
    when 'location' then ctx->>'location_id'  = aid::text
  end;
$function$;

CREATE OR REPLACE FUNCTION halle.expected_conditions(p_rule_id uuid, p_predicate jsonb, p_authority_type halle.authority_type, p_authority_entity_id uuid)
 RETURNS TABLE(rule_id uuid, key text, kind halle.condition_kind, val_text text, val_num numeric, val_lo numeric, val_hi numeric)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'halle', 'public'
AS $function$
declare k text; val jsonb; akey text;
begin
  if p_authority_type <> 'system' and p_authority_entity_id is not null then
    akey := case p_authority_type when 'employer' then 'employer_id'
                                  when 'client'   then 'client_id'
                                  when 'location' then 'location_id' end;
    return query select p_rule_id, akey, 'eq'::condition_kind, p_authority_entity_id::text, null::numeric, null::numeric, null::numeric;
  end if;
  for k, val in select * from jsonb_each(p_predicate) loop
    if jsonb_typeof(val) = 'object' then
      if val ? 'in' then
        return query
          select p_rule_id, k, 'eq'::condition_kind,
                 case when jsonb_typeof(e) = 'number' then null else btrim(e #>> '{}') end,
                 case when jsonb_typeof(e) = 'number' then (e #>> '{}')::numeric else null end,
                 null::numeric, null::numeric
          from jsonb_array_elements(val->'in') e;
      elsif (val ? 'min') or (val ? 'max') then
        return query select p_rule_id, k, 'range'::condition_kind, null::text, null::numeric,
                            (val->>'min')::numeric, (val->>'max')::numeric;
      end if;  -- nested-match: no shreddable rows (drives exact_only in expected_meta)
    elsif jsonb_typeof(val) = 'number' then
      return query select p_rule_id, k, 'eq'::condition_kind, null::text, (val #>> '{}')::numeric, null::numeric, null::numeric;
    else  -- string or boolean (boolean serializes to canonical 'true'/'false')
      return query select p_rule_id, k, 'eq'::condition_kind, btrim(val #>> '{}'), null::numeric, null::numeric, null::numeric;
    end if;
  end loop;
end; $function$;

CREATE OR REPLACE FUNCTION halle.expected_meta(p_predicate jsonb, p_authority_type halle.authority_type, p_authority_entity_id uuid)
 RETURNS TABLE(condition_count integer, exact_only boolean)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select
    (case when p_authority_type <> 'system' and p_authority_entity_id is not null then 1 else 0 end
       + (select count(*) from jsonb_each(p_predicate)))::int,
    coalesce((select bool_or(jsonb_typeof(value) = 'object'
                             and not (value ? 'in') and not (value ? 'min') and not (value ? 'max'))
              from jsonb_each(p_predicate)), false);
$function$;

CREATE OR REPLACE FUNCTION halle.verify_shred()
 RETURNS TABLE(rule_id uuid, problem text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
  with expected as (
    select e.* from halle.rule r, lateral halle.expected_conditions(r.id, r.predicate, r.authority_type, r.authority_entity_id) e
  ),
  cond_diff as (
    select coalesce(e.rule_id, a.rule_id) as rule_id from (
      select rule_id, key, kind, val_text, val_num, val_lo, val_hi from expected
      except
      select rule_id, key, kind, val_text, val_num, val_lo, val_hi from halle.rule_condition
    ) e full outer join (
      select rule_id, key, kind, val_text, val_num, val_lo, val_hi from halle.rule_condition
      except
      select rule_id, key, kind, val_text, val_num, val_lo, val_hi from expected
    ) a on false
  ),
  meta_diff as (
    select r.id as rule_id
    from halle.rule r
    cross join lateral halle.expected_meta(r.predicate, r.authority_type, r.authority_entity_id) m
    left join halle.rule_match_meta mm on mm.rule_id = r.id
    where mm.rule_id is null
       or mm.condition_count is distinct from m.condition_count
       or mm.exact_only is distinct from m.exact_only
  )
  select rule_id, 'condition rows differ from expected' from cond_diff
  union
  select rule_id, 'match_meta differs from expected'    from meta_diff;
$function$;

CREATE OR REPLACE FUNCTION halle.type_ok(p_type text, v jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select case p_type
    when 'number' then jsonb_typeof(v) = 'number'
    when 'bool'   then jsonb_typeof(v) = 'boolean'
    when 'uuid'   then jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^[0-9a-fA-F-]{36}$'
    when 'text'   then jsonb_typeof(v) = 'string'
    else true
  end;
$function$;

CREATE OR REPLACE FUNCTION halle.validate_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'halle', 'public'
AS $function$
declare k text; v jsonb; vtype text;
begin
  -- 1. effect shape must match effect_type
  case new.effect_type
    when 'setter' then
      if not (new.effect ? 'field') or jsonb_typeof(new.effect->'value') is distinct from 'number'
         or new.effect ?| array['min','max','requires'] then
        raise exception 'BRE: setter effect must be {field, numeric value}: %', new.effect;
      end if;
    when 'floor' then
      if not (new.effect ? 'field') or jsonb_typeof(new.effect->'min') is distinct from 'number'
         or new.effect ?| array['value','max','requires'] then
        raise exception 'BRE: floor effect must be {field, numeric min}: %', new.effect;
      end if;
    when 'ceiling' then
      if not (new.effect ? 'field') or jsonb_typeof(new.effect->'max') is distinct from 'number'
         or new.effect ?| array['value','min','requires'] then
        raise exception 'BRE: ceiling effect must be {field, numeric max}: %', new.effect;
      end if;
    when 'gate' then
      if not (new.effect ? 'requires') or new.effect ?| array['field','value','min','max'] then
        raise exception 'BRE: gate effect must carry {requires} and no field/value/min/max: %', new.effect;
      end if;
  end case;

  -- 2. combine: only on floor/ceiling, only 'protective' | 'override'
  if new.effect ? 'combine' then
    if new.effect_type not in ('floor','ceiling') then
      raise exception 'BRE: combine is only valid on floor/ceiling, not %', new.effect_type;
    elsif (new.effect->>'combine') not in ('protective','override') then
      raise exception 'BRE: combine must be protective|override, got "%"', new.effect->>'combine';
    end if;
  end if;

  -- 3. setters cannot be violated → their violation actions must be null
  if new.effect_type = 'setter'
     and (new.create_violation_action is not null or new.update_violation_action is not null) then
    raise exception 'BRE: setter rules must have null violation actions (setters cannot be violated)';
  end if;

  -- 4. every predicate key must be registered, and its value must match the registered type
  for k, v in select * from jsonb_each(new.predicate) loop
    select value_type into vtype from halle.predicate_key where key = k;
    if vtype is null then
      raise exception 'BRE: unknown predicate key "%". Register it in predicate_key first.', k;
    end if;
    if jsonb_typeof(v) = 'object' then
      if v ? 'in' then
        if exists (select 1 from jsonb_array_elements(v->'in') e where not halle.type_ok(vtype, e)) then
          raise exception 'BRE: predicate key "%" has an in-set member of the wrong type (expected %)', k, vtype;
        end if;
      elsif (v ? 'min') or (v ? 'max') then
        if vtype <> 'number' then
          raise exception 'BRE: predicate key "%" is % but uses a numeric range', k, vtype;
        end if;
      end if;  -- nested-match object: type-check skipped (recheck handles it)
    elsif not halle.type_ok(vtype, v) then
      raise exception 'BRE: predicate key "%" expects % but got %', k, vtype, v;
    end if;
  end loop;

  return new;
end; $function$;

CREATE OR REPLACE FUNCTION halle.wakes_engine(p_object_type text, p_action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select p_action = any(trigger_events) from halle.object_type where id = p_object_type;
$function$;

CREATE OR REPLACE FUNCTION halle.match_rules(p_object_type text, ctx jsonb, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS SETOF halle.rule
 LANGUAGE sql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
  with ctx_pairs as (
    select key, value #>> '{}' as val from jsonb_each(ctx)
  ),
  satisfied as (
    -- text eq (codes, ids, booleans — stored canonical: trimmed, booleans lower-cased)
    select rc.rule_id, rc.key
    from halle.rule_condition rc join ctx_pairs c on c.key = rc.key
    where rc.kind = 'eq' and rc.val_text is not null and rc.val_text = btrim(c.val)
    union
    -- numeric eq (so 16 and 16.00 match; never under-match the recheck)
    select rc.rule_id, rc.key
    from halle.rule_condition rc join ctx_pairs c on c.key = rc.key
    where rc.kind = 'eq' and rc.val_num is not null
      and c.val ~ '^-?[0-9]+(\.[0-9]+)?$' and rc.val_num = c.val::numeric
    union
    -- numeric range
    select rc.rule_id, rc.key
    from halle.rule_condition rc join ctx_pairs c on c.key = rc.key
    where rc.kind = 'range' and c.val ~ '^-?[0-9]+(\.[0-9]+)?$'
      and (rc.val_lo is null or c.val::numeric >= rc.val_lo)
      and (rc.val_hi is null or c.val::numeric <= rc.val_hi)
  ),
  counted as (
    select s.rule_id
    from satisfied s join halle.rule_match_meta m on m.rule_id = s.rule_id
    group by s.rule_id, m.condition_count
    having count(distinct s.key) = m.condition_count
  ),
  candidate_ids as (
    select rule_id from halle.rule_match_meta where condition_count = 0
    union select rule_id from halle.rule_match_meta where exact_only
    union select rule_id from counted
  )
  select r.*
  from halle.rule r
  join candidate_ids ci on ci.rule_id = r.id
  join halle.rule_object_type rot on rot.rule_id = r.id and rot.object_type_id = p_object_type
  where r.effective_from <= p_as_of and (r.effective_to is null or r.effective_to > p_as_of)
    and halle.predicate_matches(r.predicate, ctx)
    and halle.authority_in_scope(r.authority_type, r.authority_entity_id, ctx);
$function$;

CREATE OR REPLACE FUNCTION halle.clamp_value(v numeric, flo numeric, cei numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select case
    when v is null then null                                          -- no setter → no engine value
    when flo is not null and cei is not null and cei < flo then null   -- unsatisfiable window
    else least(greatest(v, coalesce(flo, v)), coalesce(cei, v))
  end;
$function$;

CREATE OR REPLACE FUNCTION halle.resolve_object(p_object_type text, ctx jsonb, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
declare matched jsonb; amb text; fields jsonb; gates jsonb;
begin
  -- ONE gather for the whole object
  select coalesce(jsonb_agg(to_jsonb(mr)), '[]'::jsonb) into matched
  from halle.match_rules(p_object_type, ctx, p_as_of) mr;

  with m as (
    select * from jsonb_to_recordset(matched) as x(
      name text, effect jsonb, effect_type text, predicate jsonb,
      authority_type text, authority_entity_id uuid, sort_order int)
  ),
  c as (
    select effect_type,
           effect->>'field' as field,
           authority_type, authority_entity_id,
           coalesce(effect->>'combine','protective') as combine,
           (select count(*) from jsonb_object_keys(predicate)) as spec,
           case effect_type when 'setter'  then (effect->>'value')::numeric
                            when 'floor'   then (effect->>'min')::numeric
                            when 'ceiling' then (effect->>'max')::numeric end as val
    from m
    where effect_type in ('setter','floor','ceiling') and (effect ? 'field')
  ),
  flags as (
    select c.*,
           bool_or(combine = 'override') over w as grp_override,
           max(spec) over w as max_spec
    from c
    window w as (partition by field, effect_type, authority_type, authority_entity_id)
  ),
  winners as (                                   -- STAGE 1: reduce within each authority
    select * from flags
    where (effect_type <> 'setter' and not grp_override)   -- protective floor/ceiling → keep all
       or spec = max_spec                                   -- setter or override → most-specific only
  ),
  ties as (                                      -- surviving same-authority disagreement → conflict
    select field
    from winners
    where effect_type = 'setter' or grp_override
    group by field, effect_type, authority_type, authority_entity_id
    having count(distinct val) > 1
  ),
  perfield as (                                  -- STAGE 2: combine across authorities
    -- ⚠ HIGH STUB (Samer #2): cross-authority setter ranking is HARDCODED here as
    --   system < employer < client < location. This is a PLACEHOLDER, not a decision.
    --   Needs more worked examples (employer-24 vs client-22; pay vs markup vs PTO may
    --   not rank alike) before this ordering is trusted to decide real money.
    select field,
      (array_agg(val order by array_position(array['system','employer','client','location'], authority_type) desc,
                        spec desc)
         filter (where effect_type = 'setter' and val is not null))[1] as setter_v,
      max(val) filter (where effect_type = 'floor')  as flo,
      min(val) filter (where effect_type = 'ceiling') as cei
    from winners group by field
  )
  select
    coalesce(jsonb_object_agg(pf.field, jsonb_build_object(
      'value', halle.clamp_value(pf.setter_v, pf.flo, pf.cei),
      'floor', pf.flo, 'ceiling', pf.cei,
      'unsatisfiable', (pf.flo is not null and pf.cei is not null and pf.cei < pf.flo))), '{}'::jsonb),
    (select string_agg(distinct field, ', ') from ties)
  into fields, amb
  from perfield pf;

  if amb is not null then
    raise exception 'BRE: conflicting rules for field(s): %', amb
      using hint = 'Two equally-specific rules in one authority disagree on the value. Resolve the authoring conflict; the engine will not guess.';
  end if;

  -- unsatisfied gates (all-must-pass)
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'requires', effect->>'requires')
                            order by sort_order nulls last), '[]'::jsonb)
    into gates
  from jsonb_to_recordset(matched) as x(name text, effect jsonb, effect_type text, sort_order int)
  where effect_type = 'gate'
    and not coalesce((ctx ->> (effect->>'requires'))::boolean, false);

  return jsonb_build_object('fields', fields, 'gates_failed', gates);
end; $function$;

CREATE OR REPLACE FUNCTION halle.resolve_field(p_field text, p_object_type text, ctx jsonb, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select coalesce(halle.resolve_object(p_object_type, ctx, p_as_of) -> 'fields' -> p_field,
                  jsonb_build_object('value', null, 'floor', null, 'ceiling', null, 'unsatisfiable', false));
$function$;

CREATE OR REPLACE FUNCTION halle.unsatisfied_gates(p_object_type text, ctx jsonb, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS SETOF halle.rule
 LANGUAGE sql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select r.* from halle.match_rules(p_object_type, ctx, p_as_of) r
  where r.effect_type = 'gate'
    and not coalesce((ctx ->> (r.effect->>'requires'))::boolean, false)
  order by r.sort_order nulls last;
$function$;

CREATE OR REPLACE FUNCTION halle.ledger_balance(p_worker uuid, p_type text, ctx jsonb, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
declare s numeric; cap numeric;
begin
  select coalesce(sum(amount),0) into s from halle.ledger_event
   where worker_id = p_worker and accrual_type = p_type and effective_date <= p_as_of;
  cap := (halle.resolve_field(p_type||'_cap','engagement',ctx,p_as_of)->>'ceiling')::numeric;
  if cap is not null and s > cap then s := cap; end if;
  return s;
end; $function$;

CREATE OR REPLACE FUNCTION halle.instrument_rules(p_instrument uuid)
 RETURNS SETOF halle.rule
 LANGUAGE sql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select * from halle.rule where origin_type = 'instrument' and origin_id = p_instrument;
$function$;

CREATE OR REPLACE FUNCTION halle.msa_rules(p_msa uuid)
 RETURNS SETOF halle.rule
 LANGUAGE sql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select r.* from halle.rule r join halle.msa_clause mc on mc.id = r.origin_id
  where r.origin_type = 'clause' and mc.msa_id = p_msa;
$function$;

CREATE OR REPLACE FUNCTION halle.resolve_and_log(p_object_type text, p_object_id uuid, p_action text, ctx jsonb, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'halle', 'public'
AS $function$           -- VOLATILE: it writes the log
declare res jsonb; did uuid;
begin
  res := halle.resolve_object(p_object_type, ctx, p_as_of);
  insert into halle.decision (object_type, object_id, action, context, result, as_of)
    values (p_object_type, p_object_id, p_action, ctx, res, p_as_of)
    returning id into did;
  insert into halle.decision_rule (decision_id, rule_id)
    select did, r.id from halle.match_rules(p_object_type, ctx, p_as_of) r;
  return res;
end; $function$;

CREATE OR REPLACE FUNCTION halle.supersede_rule(p_old uuid, p_new_effect jsonb, p_new_predicate jsonb DEFAULT NULL::jsonb, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'halle', 'public'
AS $function$
declare o halle.rule; nid uuid;
begin
  select * into o from halle.rule where id = p_old;
  if not found then raise exception 'BRE: rule % not found', p_old; end if;
  if o.effective_to is not null and o.effective_to <= p_as_of then
    raise exception 'BRE: rule % already ended on %', p_old, o.effective_to;
  end if;

  update halle.rule set effective_to = p_as_of where id = p_old;   -- close the old version

  insert into halle.rule (name, predicate, effect, effect_type, authority_type, authority_entity_id,
                    origin_type, origin_id, sort_order, create_violation_action, update_violation_action,
                    effective_from, supersedes_id)
    values (o.name, coalesce(p_new_predicate, o.predicate), p_new_effect, o.effect_type,
            o.authority_type, o.authority_entity_id, o.origin_type, o.origin_id, o.sort_order,
            o.create_violation_action, o.update_violation_action, p_as_of, p_old)
    returning id into nid;

  -- carry over the successor's object-type targeting from the old version
  insert into halle.rule_object_type (rule_id, object_type_id)
    select nid, object_type_id from halle.rule_object_type where rule_id = p_old;
  return nid;
end; $function$;

CREATE OR REPLACE FUNCTION halle.rule_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'halle', 'public'
AS $function$
begin
  if new.name is distinct from old.name
     or new.predicate is distinct from old.predicate
     or new.effect is distinct from old.effect
     or new.effect_type is distinct from old.effect_type
     or new.authority_type is distinct from old.authority_type
     or new.authority_entity_id is distinct from old.authority_entity_id
     or new.origin_type is distinct from old.origin_type
     or new.origin_id is distinct from old.origin_id
     or new.create_violation_action is distinct from old.create_violation_action
     or new.update_violation_action is distinct from old.update_violation_action
     or new.effective_from is distinct from old.effective_from
     or new.supersedes_id is distinct from old.supersedes_id then
    raise exception 'BRE: rules are immutable — supersede instead (supersede_rule). Only effective_to may change.';
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION halle.append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'halle', 'public'
AS $function$
begin raise exception 'BRE: % is append-only', tg_table_name; end; $function$;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
drop trigger if exists rule_validate on halle.rule;
create trigger rule_validate before insert or update on halle.rule
  for each row execute function halle.validate_rule();

drop trigger if exists rule_shred on halle.rule;
create trigger rule_shred after insert or update of predicate, authority_type, authority_entity_id on halle.rule
  for each row execute function halle.shred_predicate();

drop trigger if exists rule_no_mutate on halle.rule;
create trigger rule_no_mutate before update on halle.rule
  for each row execute function halle.rule_immutable();

drop trigger if exists decision_append_only on halle.decision;
create trigger decision_append_only before delete or update on halle.decision
  for each row execute function halle.append_only();

drop trigger if exists decision_rule_append_only on halle.decision_rule;
create trigger decision_rule_append_only before delete or update on halle.decision_rule
  for each row execute function halle.append_only();

-- ----------------------------------------------------------------------------
-- Row-level security (enabled on every table; no policies — service-role access,
-- matching the live mockup state).
-- ----------------------------------------------------------------------------
alter table halle.entity            enable row level security;
alter table halle.geo_level         enable row level security;
alter table halle.geo               enable row level security;
alter table halle.worker            enable row level security;
alter table halle.jd                enable row level security;
alter table halle.predicate_key     enable row level security;
alter table halle.object_type       enable row level security;
alter table halle.clause            enable row level security;
alter table halle.paycode           enable row level security;
alter table halle.msa               enable row level security;
alter table halle.msa_clause        enable row level security;
alter table halle.instrument        enable row level security;
alter table halle.rule              enable row level security;
alter table halle.rule_condition    enable row level security;
alter table halle.rule_match_meta   enable row level security;
alter table halle.rule_object_type  enable row level security;
alter table halle.ledger_event      enable row level security;
alter table halle.job_order         enable row level security;
alter table halle.job               enable row level security;
alter table halle.timecard          enable row level security;
alter table halle.punch             enable row level security;
alter table halle.timecard_punch    enable row level security;
alter table halle.paycheck          enable row level security;
alter table halle.txn               enable row level security;
alter table halle.invoice           enable row level security;
alter table halle.decision          enable row level security;
alter table halle.decision_rule     enable row level security;

-- ----------------------------------------------------------------------------
-- Seed (demo data). rule_condition + rule_match_meta are NOT seeded — the
-- rule_shred trigger regenerates them from each rule's predicate on insert.
-- ----------------------------------------------------------------------------

-- entity
insert into halle.entity (id,name,is_billing_entity,is_billable_entity) values ('0000000a-0000-0000-0000-00000000000a','Client A','f','t') on conflict do nothing;
insert into halle.entity (id,name,is_billing_entity,is_billable_entity) values ('0000abc0-0000-0000-0000-00000000abc0','Client ABC','f','t') on conflict do nothing;
insert into halle.entity (id,name,is_billing_entity,is_billable_entity) values ('00000123-0000-0000-0000-000000000123','Client 123','f','t') on conflict do nothing;
insert into halle.entity (id,name,is_billing_entity,is_billable_entity) values ('11111111-1111-1111-1111-111111111111','TCWGlobal','t','f') on conflict do nothing;
insert into halle.entity (id,name,is_billing_entity,is_billable_entity) values ('22222222-2222-2222-2222-222222222222','Employer B','t','f') on conflict do nothing;

-- geo_level
insert into halle.geo_level (level,rank) values ('country','1') on conflict do nothing;
insert into halle.geo_level (level,rank) values ('state','2') on conflict do nothing;
insert into halle.geo_level (level,rank) values ('county','3') on conflict do nothing;
insert into halle.geo_level (level,rank) values ('city','4') on conflict do nothing;

-- geo
insert into halle.geo (id,level,parent_id,code,name) values ('c0000001-0000-0000-0000-000000000001','country',NULL,'US','United States') on conflict do nothing;
insert into halle.geo (id,level,parent_id,code,name) values ('c0000001-0000-0000-0000-000000000002','state','c0000001-0000-0000-0000-000000000001','CA','California') on conflict do nothing;
insert into halle.geo (id,level,parent_id,code,name) values ('c0000001-0000-0000-0000-000000000003','state','c0000001-0000-0000-0000-000000000001','HI','Hawaii') on conflict do nothing;
insert into halle.geo (id,level,parent_id,code,name) values ('c0000001-0000-0000-0000-000000000004','city','c0000001-0000-0000-0000-000000000002','SF','San Francisco') on conflict do nothing;

-- worker
insert into halle.worker (id,full_name,home_city,home_state,home_country,phone,email) values ('0000000d-0000-0000-0000-00000000000d','Jane Doe',NULL,NULL,NULL,NULL,NULL) on conflict do nothing;

-- predicate_key
insert into halle.predicate_key (key,value_type,description) values ('client_id','uuid','billable entity (client) the rule scopes/filters to') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('employer_id','uuid','billing entity (EoR/TCW)') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('geo_country','uuid','worksite country (geo ref)') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('geo_state','uuid','worksite state') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('geo_county','uuid','worksite county') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('geo_city','uuid','worksite city') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('jd','text','job description / role') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('tier','number','risk tier') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('tenure_years','number','worker tenure band input') on conflict do nothing;
insert into halle.predicate_key (key,value_type,description) values ('location_id','uuid','location/worksite entity the rule scopes to') on conflict do nothing;

-- object_type
insert into halle.object_type (id,physical_table,trigger_events) values ('order','job_order','{create,update}') on conflict do nothing;
insert into halle.object_type (id,physical_table,trigger_events) values ('engagement','job','{create,update}') on conflict do nothing;
insert into halle.object_type (id,physical_table,trigger_events) values ('timecard','timecard','{submit,approve}') on conflict do nothing;
insert into halle.object_type (id,physical_table,trigger_events) values ('invoice','invoice','{generate}') on conflict do nothing;

-- clause
insert into halle.clause (id,name,body,rule_template,version) values ('c1a00001-0000-0000-0000-000000000001','Governing Law','Governed by the laws of {state}.',NULL,'1') on conflict do nothing;
insert into halle.clause (id,name,body,rule_template,version) values ('c1a00002-0000-0000-0000-000000000002','Compensation','Pay band for {jd} is {min}–{max}/hr.','{"effect_type": ["floor", "ceiling"], "object_type": ["engagement"]}','1') on conflict do nothing;
insert into halle.clause (id,name,body,rule_template,version) values ('c1a00003-0000-0000-0000-000000000003','PTO Policy','Accrual {rate}/hr to a {cap}h cap after {waiting} days.','{"object_type": ["engagement"]}','1') on conflict do nothing;

-- msa
insert into halle.msa (id,name,billable_entity_id,billing_entity_id,version,signed_at,effective_from,effective_to,supersedes_id) values ('a5a00001-0000-0000-0000-000000000001','Client A × TCW MSA','0000000a-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','1','2026-06-25 03:34:12.794196+00','2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.msa (id,name,billable_entity_id,billing_entity_id,version,signed_at,effective_from,effective_to,supersedes_id) values ('a5a00123-0000-0000-0000-000000000123','Client 123 × TCW MSA','00000123-0000-0000-0000-000000000123','11111111-1111-1111-1111-111111111111','1','2026-06-25 03:34:12.794196+00','2023-01-01',NULL,NULL) on conflict do nothing;

-- msa_clause
insert into halle.msa_clause (id,msa_id,clause_id,sort_order,parameters,change_tier) values ('cc000001-0000-0000-0000-000000000001','a5a00001-0000-0000-0000-000000000001','c1a00001-0000-0000-0000-000000000001','1','{"state": "California"}','notify') on conflict do nothing;
insert into halle.msa_clause (id,msa_id,clause_id,sort_order,parameters,change_tier) values ('cc000002-0000-0000-0000-000000000002','a5a00001-0000-0000-0000-000000000001','c1a00002-0000-0000-0000-000000000002','2','{"jd": "engineer", "max": 60, "min": 40}','signature') on conflict do nothing;
insert into halle.msa_clause (id,msa_id,clause_id,sort_order,parameters,change_tier) values ('cc000003-0000-0000-0000-000000000003','a5a00123-0000-0000-0000-000000000123','c1a00003-0000-0000-0000-000000000003','1','{"cap": 240, "waiting_days": 90}','evidence') on conflict do nothing;

-- instrument
insert into halle.instrument (id,instrument_type,name,authority_type,authority_entity_id,version,signed_at,effective_from,effective_to,supersedes_id,origin_msa_clause_id) values ('b111ca3d-0000-0000-0000-000000000003','bill_card','Client A Bill Card v3','employer','22222222-2222-2222-2222-222222222222','3','2026-06-25 03:34:12.794196+00','2023-01-01',NULL,NULL,NULL) on conflict do nothing;

-- rule
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('50000005-0000-0000-0000-000000000003','123 PTO cap','{}','{"max": 240, "field": "pto_cap"}','ceiling','client','00000123-0000-0000-0000-000000000123','clause','cc000003-0000-0000-0000-000000000003',NULL,'flag_soft','flag_soft','2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('50000005-0000-0000-0000-000000000004','123 PTO eligibility','{}','{"gate": "pto.accrue", "requires": "past_waiting_period"}','gate','client','00000123-0000-0000-0000-000000000123','clause','cc000003-0000-0000-0000-000000000003','1','flag_soft','flag_soft','2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('50000005-0000-0000-0000-000000000001','123 PTO rate — 0–5 yrs','{"tenure_years": {"max": 5, "min": 0}}','{"field": "pto_accrual_rate", "value": 0.0385}','setter','client','00000123-0000-0000-0000-000000000123','clause','cc000003-0000-0000-0000-000000000003',NULL,NULL,NULL,'2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('50000005-0000-0000-0000-000000000002','123 PTO rate — 5+ yrs','{"tenure_years": {"min": 5}}','{"field": "pto_accrual_rate", "value": 0.0577}','setter','client','00000123-0000-0000-0000-000000000123','clause','cc000003-0000-0000-0000-000000000003',NULL,NULL,NULL,'2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('30000003-0000-0000-0000-000000000002','ABC docs — background check','{}','{"gate": "engagement.start", "requires": "bgc_clear"}','gate','client','0000abc0-0000-0000-0000-00000000abc0','manual',NULL,'2','block','flag_hard','2022-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('30000003-0000-0000-0000-000000000001','ABC docs — I-9','{}','{"gate": "engagement.start", "requires": "i9_complete"}','gate','client','0000abc0-0000-0000-0000-00000000abc0','manual',NULL,'1','block','flag_hard','2022-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('40000004-0000-0000-0000-000000000002','Client A band — engineer ceiling','{"jd": "engineer"}','{"max": 60, "field": "pay_rate", "combine": "override"}','ceiling','client','0000000a-0000-0000-0000-00000000000a','clause','cc000002-0000-0000-0000-000000000002',NULL,'block','flag_hard','2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('40000004-0000-0000-0000-000000000001','Client A band — engineer floor','{"jd": "engineer"}','{"min": 40, "field": "pay_rate", "combine": "override"}','floor','client','0000000a-0000-0000-0000-00000000000a','clause','cc000002-0000-0000-0000-000000000002',NULL,'block','resolve_loud','2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('40000004-0000-0000-0000-000000000004','Client A band — engineer SF ceiling','{"jd": "engineer", "geo_city": "c0000001-0000-0000-0000-000000000004"}','{"max": 80, "field": "pay_rate", "combine": "override"}','ceiling','client','0000000a-0000-0000-0000-00000000000a','clause','cc000002-0000-0000-0000-000000000002',NULL,'block','flag_hard','2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('40000004-0000-0000-0000-000000000003','Client A band — engineer SF floor','{"jd": "engineer", "geo_city": "c0000001-0000-0000-0000-000000000004"}','{"min": 55, "field": "pay_rate", "combine": "override"}','floor','client','0000000a-0000-0000-0000-00000000000a','clause','cc000002-0000-0000-0000-000000000002',NULL,'block','resolve_loud','2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('60000006-0000-0000-0000-000000000001','markup — A×B tier-1','{"tier": 1, "client_id": "0000000a-0000-0000-0000-00000000000a"}','{"field": "markup_pct", "value": 21}','setter','employer','22222222-2222-2222-2222-222222222222','instrument','b111ca3d-0000-0000-0000-000000000003',NULL,NULL,NULL,'2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('60000006-0000-0000-0000-000000000002','markup — A×B tier-1 HI','{"tier": 1, "client_id": "0000000a-0000-0000-0000-00000000000a", "geo_state": "c0000001-0000-0000-0000-000000000003"}','{"field": "markup_pct", "value": 25}','setter','employer','22222222-2222-2222-2222-222222222222','instrument','b111ca3d-0000-0000-0000-000000000003',NULL,NULL,NULL,'2023-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('10000001-0000-0000-0000-000000000002','min wage — CA','{"geo_state": "c0000001-0000-0000-0000-000000000002"}','{"min": 16.00, "field": "hourly_wage"}','floor','system',NULL,'statute',NULL,NULL,'block','resolve_loud','2024-01-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('10000001-0000-0000-0000-000000000001','min wage — federal','{}','{"min": 7.25, "field": "hourly_wage"}','floor','system',NULL,'statute',NULL,NULL,'block','resolve_loud','2009-07-24',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('10000001-0000-0000-0000-000000000003','min wage — San Francisco','{"geo_city": "c0000001-0000-0000-0000-000000000004"}','{"min": 18.67, "field": "hourly_wage"}','floor','system',NULL,'statute',NULL,NULL,'block','resolve_loud','2024-07-01',NULL,NULL) on conflict do nothing;
insert into halle.rule (id,name,predicate,effect,effect_type,authority_type,authority_entity_id,origin_type,origin_id,sort_order,create_violation_action,update_violation_action,effective_from,effective_to,supersedes_id) values ('20000002-0000-0000-0000-000000000001','TCW offer letter','{}','{"gate": "engagement.start", "requires": "offer_letter_signed"}','gate','employer','11111111-1111-1111-1111-111111111111','operator_default',NULL,'1','block','flag_hard','2020-01-01',NULL,NULL) on conflict do nothing;

-- rule_object_type
insert into halle.rule_object_type (rule_id,object_type_id) values ('10000001-0000-0000-0000-000000000001','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('10000001-0000-0000-0000-000000000002','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('10000001-0000-0000-0000-000000000003','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('20000002-0000-0000-0000-000000000001','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('30000003-0000-0000-0000-000000000001','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('30000003-0000-0000-0000-000000000002','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('40000004-0000-0000-0000-000000000001','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('40000004-0000-0000-0000-000000000002','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('40000004-0000-0000-0000-000000000003','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('40000004-0000-0000-0000-000000000004','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('50000005-0000-0000-0000-000000000001','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('50000005-0000-0000-0000-000000000002','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('50000005-0000-0000-0000-000000000003','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('50000005-0000-0000-0000-000000000004','engagement') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('60000006-0000-0000-0000-000000000001','order') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('60000006-0000-0000-0000-000000000001','invoice') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('60000006-0000-0000-0000-000000000002','order') on conflict do nothing;
insert into halle.rule_object_type (rule_id,object_type_id) values ('60000006-0000-0000-0000-000000000002','invoice') on conflict do nothing;

-- ledger_event
insert into halle.ledger_event (id,worker_id,accrual_type,event_type,amount,effective_date,source_rule_id,created_at) values ('e0000001-0000-0000-0000-000000000001','0000000d-0000-0000-0000-00000000000d','pto','accrual','8','2024-01-31',NULL,'2026-06-25 03:34:12.794196+00') on conflict do nothing;
insert into halle.ledger_event (id,worker_id,accrual_type,event_type,amount,effective_date,source_rule_id,created_at) values ('e0000002-0000-0000-0000-000000000002','0000000d-0000-0000-0000-00000000000d','pto','accrual','8','2024-02-29',NULL,'2026-06-25 03:34:12.794196+00') on conflict do nothing;
insert into halle.ledger_event (id,worker_id,accrual_type,event_type,amount,effective_date,source_rule_id,created_at) values ('e0000003-0000-0000-0000-000000000003','0000000d-0000-0000-0000-00000000000d','pto','usage','-8','2024-03-15',NULL,'2026-06-25 03:34:12.794196+00') on conflict do nothing;
