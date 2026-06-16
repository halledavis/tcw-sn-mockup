-- Page 5 (operating scope + org structure) write logic, as atomic functions
-- so the whole save runs in one transaction.

-- save_scope_and_org: upsert countries + subdivisions, insert locations +
-- departments. Rules:
--  * non-US country => addendum_status 'pending'; US => 'not_applicable'
--  * a location whose country/state isn't in scope is auto-added (same rule),
--    accumulating a human-readable note
--  * if any non-US country is in scope but the client lacks the intl_compliance
--    module, return a warning
-- Returns { ok, warnings[], notes[] }.
create or replace function public.save_scope_and_org(
    p_entity_id    uuid,
    p_countries    jsonb,   -- [{ "country_code": "US" }]
    p_subdivisions jsonb,   -- [{ "country_code","subdivision_code","subdivision_type" }]
    p_locations    jsonb,   -- [{ name,street,city,state,country,postal,internal_id,is_primary }]
    p_departments  jsonb    -- [{ name, internal_id }]
) returns jsonb
language plpgsql
as $$
declare
    c jsonb;
    s jsonb;
    loc jsonb;
    d jsonb;
    v_country text;
    v_state text;
    v_loc_label text;
    v_notes text[] := '{}';
    v_warnings text[] := '{}';
    v_has_intl boolean;
    v_nonus_count int;
begin
    -- 1. Countries (idempotent — don't clobber an in-progress addendum).
    for c in select e from jsonb_array_elements(coalesce(p_countries, '[]'::jsonb)) as e loop
        v_country := upper(coalesce(c ->> 'country_code', ''));
        if v_country = '' then continue; end if;
        insert into public.client_country_scope (entity_id, country_code, addendum_status)
        values (p_entity_id, v_country,
                (case when v_country = 'US' then 'not_applicable' else 'pending' end)::public.addendum_status)
        on conflict (entity_id, country_code) do nothing;
    end loop;

    -- 2. Subdivisions.
    for s in select e from jsonb_array_elements(coalesce(p_subdivisions, '[]'::jsonb)) as e loop
        if coalesce(s ->> 'subdivision_code', '') = '' then continue; end if;
        insert into public.client_subdivision_scope (entity_id, country_code, subdivision_code, subdivision_type)
        values (p_entity_id, upper(coalesce(s ->> 'country_code', '')), s ->> 'subdivision_code',
                coalesce(nullif(s ->> 'subdivision_type', ''), 'state')::public.subdivision_type)
        on conflict (entity_id, country_code, subdivision_code) do nothing;
    end loop;

    -- 3. Locations, auto-adding any country/state not yet in scope.
    for loc in select e from jsonb_array_elements(coalesce(p_locations, '[]'::jsonb)) as e loop
        v_country := upper(coalesce(loc ->> 'country', ''));
        v_state := coalesce(loc ->> 'state', '');
        v_loc_label := coalesce(nullif(loc ->> 'name', ''), nullif(loc ->> 'city', ''), 'a location');

        insert into public.location (entity_id, name, street, city, state, country, postal, internal_id, is_primary)
        values (p_entity_id, nullif(loc ->> 'name', ''), loc ->> 'street', loc ->> 'city', loc ->> 'state',
                loc ->> 'country', nullif(loc ->> 'postal', ''), nullif(loc ->> 'internal_id', ''),
                coalesce((loc ->> 'is_primary')::boolean, false));

        if v_country <> '' and not exists (
            select 1 from public.client_country_scope
            where entity_id = p_entity_id and country_code = v_country
        ) then
            insert into public.client_country_scope (entity_id, country_code, addendum_status)
            values (p_entity_id, v_country,
                    (case when v_country = 'US' then 'not_applicable' else 'pending' end)::public.addendum_status)
            on conflict (entity_id, country_code) do nothing;
            v_notes := array_append(v_notes, format('Auto-added country %s to scope (%s), from %s.',
                v_country,
                case when v_country = 'US' then 'not applicable' else 'addendum pending' end,
                v_loc_label));
        end if;

        if v_country <> '' and v_state <> '' and not exists (
            select 1 from public.client_subdivision_scope
            where entity_id = p_entity_id and country_code = v_country and subdivision_code = v_state
        ) then
            insert into public.client_subdivision_scope (entity_id, country_code, subdivision_code, subdivision_type)
            values (p_entity_id, v_country, v_state,
                    (case when v_country = 'CA' then 'province' else 'state' end)::public.subdivision_type)
            on conflict (entity_id, country_code, subdivision_code) do nothing;
            v_notes := array_append(v_notes, format('Auto-added %s subdivision %s to scope, from %s.', v_country, v_state, v_loc_label));
        end if;
    end loop;

    -- 4. Departments.
    for d in select e from jsonb_array_elements(coalesce(p_departments, '[]'::jsonb)) as e loop
        if coalesce(d ->> 'name', '') = '' then continue; end if;
        insert into public.department (entity_id, name, internal_id)
        values (p_entity_id, d ->> 'name', nullif(d ->> 'internal_id', ''))
        on conflict (entity_id, name) do nothing;
    end loop;

    -- 5. Gate: non-US scope without the intl_compliance module.
    select count(*) into v_nonus_count
    from public.client_country_scope
    where entity_id = p_entity_id and country_code <> 'US';

    select exists (
        select 1 from public.entity_module em
        join public.module m on m.id = em.module_id
        where em.entity_id = p_entity_id and m.code = 'intl_compliance' and em.enabled
    ) into v_has_intl;

    if v_nonus_count > 0 and not v_has_intl then
        v_warnings := array_append(v_warnings,
            'Client operates in non-US countries but is missing the International Compliance module. Enable Globalized Compliance.');
    end if;

    return jsonb_build_object('ok', true, 'warnings', to_jsonb(v_warnings), 'notes', to_jsonb(v_notes));
end;
$$;

-- enable_globalized_compliance: turn on the intl_compliance module (re-enabling
-- if previously disabled) and add the globalized_compliance service if missing.
create or replace function public.enable_globalized_compliance(p_entity_id uuid)
returns void
language plpgsql
as $$
begin
    insert into public.entity_module (entity_id, module_id, enabled, source)
    select p_entity_id, m.id, true, 'manual:globalized_compliance'
    from public.module m
    where m.code = 'intl_compliance'
    on conflict (entity_id, module_id) do update set enabled = true;

    insert into public.entity_service (entity_id, service_id, status, source)
    select p_entity_id, s.id, 'selected', 'manual'
    from public.service s
    where s.code = 'globalized_compliance'
    on conflict (entity_id, service_id) do nothing;
end;
$$;
