-- Atomic "confirm intake" provisioning. Everything happens in ONE transaction
-- (a plpgsql function body), so an abandoned/partial confirm leaves no orphan
-- rows. Called from the confirm server action via supabase.rpc(...).

create or replace function public.create_prospect_from_intake(
    p_legal_name      text,
    p_persona         public.intake_persona,
    p_brief           text,
    p_transcript      jsonb,
    p_inferred_signals jsonb,
    p_service_codes   text[],
    p_sources         jsonb        -- { "<service_code>": "ai" | "manual" }
) returns uuid
language plpgsql
as $$
declare
    v_entity_id uuid;
begin
    -- 1. Create the prospect entity (client, billable, prospect lifecycle).
    insert into public.entity (legal_name, kind, is_billable_entity, status)
    values (p_legal_name, 'client', true, 'prospect')
    returning id into v_entity_id;

    -- 2. Record the intake session.
    insert into public.intake_session
        (entity_id, persona, brief, transcript, inferred_signals, status)
    values
        (v_entity_id, p_persona, p_brief, p_transcript, p_inferred_signals, 'confirmed');

    -- 3. Chosen services (status 'selected'; source ai|manual per service).
    insert into public.entity_service (entity_id, service_id, status, source)
    select v_entity_id, s.id, 'selected',
           coalesce(p_sources ->> s.code, 'manual')::public.entity_service_source
    from public.service s
    where s.code = any (p_service_codes);

    -- 4. Materialize resolved module toggles = union of modules from chosen
    --    services (enabled true), with provenance.
    insert into public.entity_module (entity_id, module_id, enabled, source)
    select v_entity_id, m.id, true, 'service:' || min(s.code)
    from public.service s
    join public.service_module sm on sm.service_id = s.id
    join public.module m on m.id = sm.module_id
    where s.code = any (p_service_codes)
    group by m.id
    on conflict (entity_id, module_id) do nothing;

    -- 5. If EoR was chosen, default the EoR to the seeded master (TargetCW).
    if 'eor' = any (p_service_codes) then
        update public.entity
        set default_eor_id = (
            select id from public.entity
            where kind = 'tcw' and is_default_eor = true
            order by created_at
            limit 1
        )
        where id = v_entity_id;
    end if;

    return v_entity_id;
end;
$$;
