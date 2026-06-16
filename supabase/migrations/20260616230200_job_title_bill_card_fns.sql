-- Page 6 (job types / risk tiering / bill cards) write logic, as atomic
-- functions. bill_rate_rule is untouched.

-- save_job_titles: upsert client_job_title rows (matched on entity_id + title).
-- Resolves risk_tier_code -> risk_tier_id; status is 'confirmed' when a tier
-- resolves and the caller didn't flag review, else 'needs_review'.
create or replace function public.save_job_titles(
    p_entity_id uuid,
    p_titles    jsonb   -- [{ title, blurb?, risk_tier_code?, ai_rationale?, needs_review?, clarifications? }]
) returns setof public.client_job_title
language plpgsql
as $$
declare
    t jsonb;
    v_title text;
    v_tier_id uuid;
    v_needs_review boolean;
    v_status public.job_title_status;
    v_existing uuid;
begin
    for t in select e from jsonb_array_elements(coalesce(p_titles, '[]'::jsonb)) as e loop
        v_title := trim(coalesce(t ->> 'title', ''));
        if v_title = '' then continue; end if;

        v_tier_id := (select id from public.risk_tier where code = nullif(t ->> 'risk_tier_code', ''));
        v_needs_review := coalesce((t ->> 'needs_review')::boolean, false) or v_tier_id is null;
        v_status := (case when v_needs_review then 'needs_review' else 'confirmed' end)::public.job_title_status;
        v_existing := (select id from public.client_job_title
                       where entity_id = p_entity_id and title = v_title limit 1);

        if v_existing is not null then
            update public.client_job_title set
                blurb          = nullif(t ->> 'blurb', ''),
                risk_tier_id   = v_tier_id,
                ai_rationale   = nullif(t ->> 'ai_rationale', ''),
                needs_review   = v_needs_review,
                status         = v_status,
                clarifications = coalesce(t -> 'clarifications', '[]'::jsonb)
            where id = v_existing;
            return query select * from public.client_job_title where id = v_existing;
        else
            return query
            insert into public.client_job_title
                (entity_id, title, blurb, risk_tier_id, ai_rationale, needs_review, status, clarifications)
            values
                (p_entity_id, v_title, nullif(t ->> 'blurb', ''), v_tier_id, nullif(t ->> 'ai_rationale', ''),
                 v_needs_review, v_status, coalesce(t -> 'clarifications', '[]'::jsonb))
            returning *;
        end if;
    end loop;
end;
$$;

-- derive_bill_cards: one draft bill_card per DISTINCT risk tier across the
-- client's confirmed titles, seeded with the tier's default markup and
-- states ["ALL"], skipping tiers that already have a card. Returns new cards.
create or replace function public.derive_bill_cards(p_entity_id uuid)
returns setof public.bill_card
language plpgsql
as $$
begin
    return query
    insert into public.bill_card (entity_id, risk_tier_id, states, markup_pct, status)
    select p_entity_id, t.id, '["ALL"]'::jsonb, t.default_markup_pct, 'draft'
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
        where bc.entity_id = p_entity_id and bc.risk_tier_id = t.id
    )
    returning *;
end;
$$;
