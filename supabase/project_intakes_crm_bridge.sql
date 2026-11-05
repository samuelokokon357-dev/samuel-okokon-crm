-- SAMUEL OKOKON CRM — WEBSITE INTAKES BRIDGE
-- Run this AFTER the V18 portfolio migration: supabase/project_intakes.sql
-- This migration adds an idempotent, duplicate-aware promotion action to the existing Leads table.
-- It does not alter payments, projects, proposals, tasks, or existing lead records.

alter table public.project_intakes
  add column if not exists converted_lead_id uuid,
  add column if not exists converted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_intakes_converted_lead_id_fkey'
      and conrelid = 'public.project_intakes'::regclass
  ) then
    alter table public.project_intakes
      add constraint project_intakes_converted_lead_id_fkey
      foreign key (converted_lead_id) references public.leads(id) on delete set null;
  end if;
end $$;

create index if not exists project_intakes_converted_lead_idx
  on public.project_intakes (converted_lead_id)
  where converted_lead_id is not null;

create or replace function public.promote_project_intake(p_intake_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake public.project_intakes%rowtype;
  v_lead_id uuid;
  v_created boolean := false;
  v_phone_digits text;
  v_first_name text;
  v_last_name text;
  v_business_type text;
  v_notes text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to promote an intake.';
  end if;

  select * into v_intake
  from public.project_intakes
  where id = p_intake_id
  for update;

  if not found then
    raise exception 'Website intake was not found.';
  end if;

  -- Safe on repeat clicks and network retries: return the previously linked lead.
  if v_intake.converted_lead_id is not null then
    return jsonb_build_object(
      'ok', true,
      'lead_id', v_intake.converted_lead_id,
      'created', false,
      'already_converted', true
    );
  end if;

  if v_intake.status not in ('NEW', 'REVIEWED', 'QUALIFIED') then
    raise exception 'Only submitted, reviewed or qualified intakes can be promoted.';
  end if;

  if not coalesce(v_intake.contact_consent, false) then
    raise exception 'The visitor has not given permission to be contacted. This intake cannot be promoted.';
  end if;

  if nullif(trim(coalesce(v_intake.contact_name, '')), '') is null
     or nullif(trim(coalesce(v_intake.business_name, '')), '') is null
     or nullif(trim(coalesce(v_intake.whatsapp, '')), '') is null then
    raise exception 'The intake is missing the contact name, organisation name or WhatsApp number.';
  end if;

  v_phone_digits := regexp_replace(coalesce(v_intake.whatsapp, ''), '[^0-9]', '', 'g');
  v_first_name := split_part(trim(v_intake.contact_name), ' ', 1);
  v_last_name := nullif(trim(substr(trim(v_intake.contact_name), length(v_first_name) + 1)), '');
  v_business_type := case v_intake.project_type
    when 'school' then 'PRIVATE_SCHOOL'
    when 'other' then 'OTHER'
    else 'BUSINESS'
  end;

  -- Reuse a matching CRM lead instead of duplicating a person already in the pipeline.
  select l.id into v_lead_id
  from public.leads l
  where (
    nullif(trim(coalesce(v_intake.email, '')), '') is not null
    and lower(trim(coalesce(l.email, ''))) = lower(trim(v_intake.email))
  ) or (
    v_phone_digits <> ''
    and (
      regexp_replace(coalesce(l.whatsapp, ''), '[^0-9]', '', 'g') = v_phone_digits
      or regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
    )
  )
  order by l.created_at asc nulls last
  limit 1;

  if v_lead_id is null then
    v_notes := concat_ws(E'\n',
      'Website intake reference: ' || coalesce(v_intake.reference_code, '—'),
      'Project type: ' || coalesce(v_intake.project_type, 'Not provided'),
      'Current website: ' || coalesce(v_intake.website_status, 'Not provided'),
      'Industry: ' || coalesce(v_intake.industry, 'Not provided'),
      'Location: ' || coalesce(v_intake.location, 'Not provided'),
      'Main goals: ' || coalesce(array_to_string(v_intake.goals, ', '), 'Not provided'),
      'Visitor actions: ' || coalesce(array_to_string(v_intake.visitor_actions, ', '), 'Not provided'),
      'Website scope: ' || coalesce(v_intake.scope, 'Not provided'),
      'Requested features: ' || coalesce(array_to_string(v_intake.features, ', '), 'Not provided'),
      'Budget range: ' || coalesce(v_intake.budget_range, 'Not provided'),
      'Preferred timeline: ' || coalesce(v_intake.timeline, 'Not provided'),
      'Package interest: ' || coalesce(v_intake.package_interest, 'Not provided'),
      case when nullif(trim(coalesce(v_intake.additional_notes, '')), '') is not null
        then 'Additional notes: ' || trim(v_intake.additional_notes) end
    );

    insert into public.leads (
      first_name,
      last_name,
      business_name,
      business_type,
      email,
      phone,
      whatsapp,
      source,
      source_details,
      stage,
      estimated_value,
      notes,
      owner_id
    ) values (
      v_first_name,
      v_last_name,
      v_intake.business_name,
      v_business_type,
      nullif(trim(coalesce(v_intake.email, '')), ''),
      v_intake.whatsapp,
      v_intake.whatsapp,
      'WEBSITE',
      'Portfolio website · ' || coalesce(v_intake.reference_code, 'project intake'),
      'NEW_LEAD',
      0,
      v_notes,
      auth.uid()
    ) returning id into v_lead_id;

    v_created := true;
  end if;

  update public.project_intakes
  set status = 'CONVERTED',
      converted_lead_id = v_lead_id,
      converted_at = now()
  where id = v_intake.id;

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'created', v_created,
    'already_converted', false
  );
end;
$$;

revoke all on function public.promote_project_intake(uuid) from public, anon;
grant execute on function public.promote_project_intake(uuid) to authenticated;

comment on column public.project_intakes.converted_lead_id is
  'CRM lead linked when this website intake is promoted; can point to an existing matching lead to prevent duplicates.';
comment on function public.promote_project_intake(uuid) is
  'Idempotently promotes a consented website intake into the existing Leads pipeline, reusing a matching email or phone before creating a new lead.';
