-- Client builder (page 4): profile fields + signatory/primary contacts, and an
-- expanded atomic create that supersedes create_prospect_from_intake.

-- Profile columns on entity (dba_name + address jsonb already exist).
alter table public.entity
    add column fein             text,
    add column duns             text,
    add column website          text,
    add column default_currency text,
    add column description      text,
    add column logo_url         text;

create type public.contact_kind as enum ('signatory', 'primary');

create table public.entity_contact (
    id         uuid primary key default gen_random_uuid(),
    entity_id  uuid not null references public.entity (id) on delete cascade,
    kind       public.contact_kind not null,
    first_name text not null,
    last_name  text not null,
    email      text not null,
    phone      text,
    created_at timestamptz not null default now(),
    unique (entity_id, kind)
);
create index idx_entity_contact_entity_id on public.entity_contact (entity_id);

-- Atomic create for the full builder flow: prospect entity + profile + intake
-- session + chosen services + materialized modules + EoR default + contacts,
-- all in one transaction.
create or replace function public.create_client_from_intake(
    p_legal_name      text,
    p_dba             text,
    p_address         jsonb,
    p_fein            text,
    p_duns            text,
    p_website         text,
    p_currency        text,
    p_description     text,
    p_logo_url        text,
    p_persona         public.intake_persona,
    p_brief           text,
    p_transcript      jsonb,
    p_inferred_signals jsonb,
    p_service_codes   text[],
    p_sources         jsonb,        -- { "<service_code>": "ai" | "manual" }
    p_contacts        jsonb         -- [ { kind, first_name, last_name, email, phone } ]
) returns uuid
language plpgsql
as $$
declare
    v_entity_id uuid;
begin
    insert into public.entity (
        legal_name, dba_name, kind, is_billable_entity, status,
        address, fein, duns, website, default_currency, description, logo_url
    )
    values (
        p_legal_name, nullif(p_dba, ''), 'client', true, 'prospect',
        p_address, nullif(p_fein, ''), nullif(p_duns, ''), nullif(p_website, ''),
        nullif(p_currency, ''), nullif(p_description, ''), nullif(p_logo_url, '')
    )
    returning id into v_entity_id;

    insert into public.intake_session
        (entity_id, persona, brief, transcript, inferred_signals, status)
    values
        (v_entity_id, p_persona, p_brief, p_transcript, p_inferred_signals, 'confirmed');

    insert into public.entity_service (entity_id, service_id, status, source)
    select v_entity_id, s.id, 'selected',
           coalesce(p_sources ->> s.code, 'manual')::public.entity_service_source
    from public.service s
    where s.code = any (p_service_codes);

    insert into public.entity_module (entity_id, module_id, enabled, source)
    select v_entity_id, m.id, true, 'service:' || min(s.code)
    from public.service s
    join public.service_module sm on sm.service_id = s.id
    join public.module m on m.id = sm.module_id
    where s.code = any (p_service_codes)
    group by m.id
    on conflict (entity_id, module_id) do nothing;

    if 'eor' = any (p_service_codes) then
        update public.entity
        set default_eor_id = (
            select id from public.entity
            where kind = 'tcw' and is_default_eor = true
            order by created_at limit 1
        )
        where id = v_entity_id;
    end if;

    insert into public.entity_contact (entity_id, kind, first_name, last_name, email, phone)
    select v_entity_id,
           (c ->> 'kind')::public.contact_kind,
           c ->> 'first_name',
           c ->> 'last_name',
           c ->> 'email',
           nullif(c ->> 'phone', '')
    from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) as c
    where coalesce(c ->> 'first_name', '') <> ''
    on conflict (entity_id, kind) do nothing;

    return v_entity_id;
end;
$$;
