-- ============================================================================
-- halle — geo hierarchy-aware specificity
-- ============================================================================
-- Previously `resolve_object` ranked within-authority specificity by the raw
-- count of predicate keys, so a `geo_state` rule and a `geo_city` rule tied
-- (1 key each). A city-level override couldn't beat a state-level rule, and two
-- equal-count rules with different values raised a false "conflicting rules"
-- error.
--
-- Fix: specificity = (key_count * 10) + (deepest geo level rank present). Key
-- count stays the dominant signal; the geo level rank (country=1 … city=4, from
-- geo_level) breaks ties among equal-count rules so the more-specific
-- jurisdiction wins. predicate_specificity is now actually used by resolve_object
-- (it inlined a plain count before).
-- ============================================================================

set check_function_bodies = off;

-- Hierarchy-aware specificity. STABLE (reads geo_level), self-documenting.
CREATE OR REPLACE FUNCTION halle.predicate_specificity(p jsonb)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'halle', 'public'
AS $function$
  select (select count(*) from jsonb_object_keys(p))::int * 10
       + coalesce((select max(gl.rank)
                   from jsonb_object_keys(p) k
                   join halle.geo_level gl on ('geo_' || gl.level) = k), 0);
$function$;

-- resolve_object: use the hierarchy-aware specificity (only the `spec` source
-- line changes vs the captured version).
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
           halle.predicate_specificity(predicate) as spec,
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
