-- ============================================================================
-- halle — resolvable_field registry + Bug #2 fix (unify pay onto hourly_rate)
-- ============================================================================
-- Two changes, both idempotent:
--
-- 1. A `resolvable_field` registry (mirror of `predicate_key`): every output
--    field a rule may target, its pay basis, and whether the statutory minimum
--    wage floors it. `validate_rule` is extended so NEW floor/ceiling/setter
--    rules may only target a registered field — structurally preventing the
--    "mislabeled field" class of bug going forward.
--
-- 2. Bug #2 fix: the pay band used `pay_rate` while minimum wage used
--    `hourly_wage`, so the statutory floor never clamped pay. Both are unified
--    onto the single canonical `hourly_rate`. Done via `supersede_rule` with
--    each rule's ORIGINAL effective_from, so the corrected rule keeps its start
--    date and the mislabeled version is retained (zero-length window) for audit
--    — never destroyed. Idempotent: only acts on still-active rules whose field
--    is one of the legacy names.
--
-- Non-hourly pay types (weekly_pay / daily_pay / unit_pay) are registered but
-- min_wage_floored = false: minimum-wage enforcement on non-hourly bases is a
-- deliberate stub for now (it needs hourly-equivalent normalization).
-- ============================================================================

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. resolvable_field registry
-- ----------------------------------------------------------------------------
create table if not exists halle.resolvable_field (
  field            text primary key,
  pay_basis        text check (pay_basis in ('hourly','weekly','daily','unit')),  -- null = not a pay field
  min_wage_floored boolean not null default false,
  description      text
);
alter table halle.resolvable_field enable row level security;

insert into halle.resolvable_field (field, pay_basis, min_wage_floored, description) values
  ('hourly_rate',      'hourly', true,  'Hourly pay rate; floored by statutory minimum wage'),
  ('weekly_pay',       'weekly', false, 'Salary / weekly pay; min-wage enforcement on non-hourly bases is stubbed'),
  ('daily_pay',        'daily',  false, 'Daily pay; min-wage enforcement on non-hourly bases is stubbed'),
  ('unit_pay',         'unit',   false, 'Per-unit / piece-rate pay; min-wage enforcement on non-hourly bases is stubbed'),
  ('markup_pct',       null,     false, 'Bill markup percentage'),
  ('pto_accrual_rate', null,     false, 'PTO accrual rate (hours accrued per hour worked)'),
  ('pto_cap',          null,     false, 'PTO balance cap (hours)')
on conflict (field) do nothing;

-- ----------------------------------------------------------------------------
-- 2. validate_rule — add field-registration check (new rules only; legacy rules
--    predate the registry, so gate on INSERT). Body otherwise unchanged.
-- ----------------------------------------------------------------------------
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

  -- 5. effect field must be a registered resolvable_field. New rules only —
  --    legacy rules predate the registry, so gate on INSERT to avoid breaking
  --    historical supersession (which UPDATEs effective_to on old versions).
  if tg_op = 'INSERT' and (new.effect ? 'field')
     and not exists (select 1 from halle.resolvable_field rf where rf.field = new.effect->>'field') then
    raise exception 'BRE: effect field "%" is not a registered resolvable_field — register it first.', new.effect->>'field';
  end if;

  return new;
end; $function$;

-- ----------------------------------------------------------------------------
-- 3. Bug #2 fix: unify pay band (pay_rate) and minimum wage (hourly_wage) onto
--    hourly_rate, preserving each rule's original effective_from.
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select id, effect, effective_from from halle.rule
    where (effect->>'field') in ('pay_rate','hourly_wage') and effective_to is null
  loop
    perform halle.supersede_rule(
      r.id,
      jsonb_set(r.effect, '{field}', '"hourly_rate"'),
      null,
      r.effective_from);
  end loop;
end $$;
