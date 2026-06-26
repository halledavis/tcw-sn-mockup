-- ============================================================================
-- halle — obligation substrate (gap #1, step 1 of 2: the state model)
-- ============================================================================
-- A "WORKFLOW" clause is modeled as a GATE whose trigger is a CLOCK rather than
-- a record event — no new effect_type. Two pieces:
--
--   (1) Trigger-layer metadata on `rule`: a rule declares whether it's evaluated
--       on a record event ('event', the default — gathered by match_rules) or on
--       a schedule ('schedule' — materialized into obligations). `schedule` jsonb
--       carries the recurrence spec.
--
--   (2) `obligation` — a stateful sibling of `ledger_event`: the materialized,
--       trackable occurrences of a scheduled gate for a specific subject. This is
--       genuine STATE (two identical engagements can differ on whether a COI is
--       uploaded), so it cannot be a projection — same test that justified the
--       ledger.
--
-- THIS MIGRATION IS THE SUBSTRATE ONLY. The engine that populates and advances
-- it — the materializer (emit obligations from schedule-rules), the ticker (flip
-- pending→overdue at due_at and fire update_violation_action), recurrence
-- roll-forward, and satisfaction write-back — is step 2 and is NOT included here.
-- Applying this alone yields correct, guarded tables that nothing yet drives.
--
-- Matches the engine's existing rigor: new rule columns are covered by the
-- immutability guard and validated on write; obligation core fields are immutable
-- (only status/satisfied_at may change); RLS enabled. Idempotent throughout.
-- ============================================================================

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- (1) Trigger-layer metadata on rule
-- ----------------------------------------------------------------------------
alter table halle.rule add column if not exists trigger_kind text not null default 'event';
alter table halle.rule add column if not exists schedule     jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rule_trigger_kind_check' and conrelid = 'halle.rule'::regclass) then
    alter table halle.rule add constraint rule_trigger_kind_check check (trigger_kind in ('event','schedule'));
  end if;
end $$;

-- rule_immutable: extend the immutable column set to cover trigger_kind/schedule
-- (they're part of the rule definition → change via supersede, not in place).
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
     or new.supersedes_id is distinct from old.supersedes_id
     or new.trigger_kind is distinct from old.trigger_kind
     or new.schedule is distinct from old.schedule then
    raise exception 'BRE: rules are immutable — supersede instead (supersede_rule). Only effective_to may change.';
  end if;
  return new;
end; $function$;

-- validate_rule: keep checks 1-5, add check 6 for clock-triggered rules.
CREATE OR REPLACE FUNCTION halle.validate_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'halle', 'public'
AS $function$
declare k text; v jsonb; vtype text;
begin
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

  if new.effect ? 'combine' then
    if new.effect_type not in ('floor','ceiling') then
      raise exception 'BRE: combine is only valid on floor/ceiling, not %', new.effect_type;
    elsif (new.effect->>'combine') not in ('protective','override') then
      raise exception 'BRE: combine must be protective|override, got "%"', new.effect->>'combine';
    end if;
  end if;

  if new.effect_type = 'setter'
     and (new.create_violation_action is not null or new.update_violation_action is not null) then
    raise exception 'BRE: setter rules must have null violation actions (setters cannot be violated)';
  end if;

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
      end if;
    elsif not halle.type_ok(vtype, v) then
      raise exception 'BRE: predicate key "%" expects % but got %', k, vtype, v;
    end if;
  end loop;

  if tg_op = 'INSERT' and (new.effect ? 'field')
     and not exists (select 1 from halle.resolvable_field rf where rf.field = new.effect->>'field') then
    raise exception 'BRE: effect field "%" is not a registered resolvable_field — register it first.', new.effect->>'field';
  end if;

  -- 6. clock-triggered rules: schedule iff trigger_kind='schedule'; obligations are gates.
  if new.trigger_kind = 'schedule' then
    if new.effect_type <> 'gate' then
      raise exception 'BRE: scheduled (clock-triggered) rules must be gates (obligations), not % (relaxable later)', new.effect_type;
    end if;
    if new.schedule is null or jsonb_typeof(new.schedule) <> 'object' or not (new.schedule ? 'anchor') then
      raise exception 'BRE: a scheduled rule needs a schedule jsonb object with an "anchor" key';
    end if;
  elsif new.schedule is not null then
    raise exception 'BRE: schedule must be null when trigger_kind = ''event''';
  end if;

  return new;
end; $function$;

-- ----------------------------------------------------------------------------
-- (2) obligation — materialized occurrences of scheduled gates (stateful)
-- ----------------------------------------------------------------------------
create table if not exists halle.obligation (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid not null references halle.rule(id),
  subject_type text not null,                          -- 'engagement','worker',... (polymorphic, no FK)
  subject_id   uuid not null,
  due_at       date not null,
  status       text not null default 'pending' check (status in ('pending','satisfied','overdue','waived')),
  satisfied_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (rule_id, subject_id, due_at)                 -- one occurrence per (rule, subject, due) → idempotent materialize
);

create index if not exists obligation_due     on halle.obligation (status, due_at);
create index if not exists obligation_subject on halle.obligation (subject_type, subject_id);
create index if not exists obligation_rule     on halle.obligation (rule_id);

alter table halle.obligation enable row level security;

-- Core fields immutable; only status/satisfied_at may change (matches the engine's
-- "facts don't get rewritten" discipline).
CREATE OR REPLACE FUNCTION halle.obligation_core_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'halle', 'public'
AS $function$
begin
  if new.rule_id is distinct from old.rule_id
     or new.subject_type is distinct from old.subject_type
     or new.subject_id is distinct from old.subject_id
     or new.due_at is distinct from old.due_at
     or new.created_at is distinct from old.created_at then
    raise exception 'BRE: obligation core fields are immutable — only status/satisfied_at may change';
  end if;
  return new;
end; $function$;

drop trigger if exists obligation_no_rewrite on halle.obligation;
create trigger obligation_no_rewrite before update on halle.obligation
  for each row execute function halle.obligation_core_immutable();
