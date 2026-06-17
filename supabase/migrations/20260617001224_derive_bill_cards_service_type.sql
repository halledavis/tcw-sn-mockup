-- derive_bill_cards now derives per service_type (EoR vs Staffing vs VMS each
-- get their own tier-based cards). Replaces the single-arg version: bill_card
-- gained a NOT NULL service_type, so the function must set it, and the
-- "skip existing" check is scoped per (entity, tier, service_type).

drop function if exists public.derive_bill_cards(uuid);

-- One draft bill_card per DISTINCT risk tier across the client's confirmed
-- titles, for the given service_type, seeded with the tier's default markup
-- and states ["ALL"], skipping (entity, tier, service_type) combos that
-- already have a card. Returns the newly inserted cards.
create or replace function public.derive_bill_cards(
    p_entity_id    uuid,
    p_service_type public.bill_card_service_type
)
returns setof public.bill_card
language plpgsql
as $$
begin
    return query
    insert into public.bill_card (entity_id, risk_tier_id, service_type, states, markup_pct, status)
    select p_entity_id, t.id, p_service_type, '["ALL"]'::jsonb, t.default_markup_pct, 'draft'
    from (
        select distinct rt.id, rt.default_markup_pct
        from public.client_job_title cjt
        join public.risk_tier rt on rt.id = cjt.risk_tier_id
        where cjt.entity_id = p_entity_id
          and cjt.status = 'confirmed'
          and cjt.risk_tier_id is not null
    ) t
    where not exists (
        select 1 from public.bill_card bc
        where bc.entity_id = p_entity_id
          and bc.risk_tier_id = t.id
          and bc.service_type = p_service_type
    )
    returning *;
end;
$$;
