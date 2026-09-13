create table public.help_request_types (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80),
  label text not null check (label = btrim(label) and char_length(label) between 1 and 60),
  capability public.capability_type,
  is_other boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);

create unique index help_request_types_active_label_idx
  on public.help_request_types(household_id, lower(label))
  where archived_at is null;
create unique index help_request_types_one_other_idx
  on public.help_request_types(household_id)
  where is_other and archived_at is null;

create or replace function private.seed_help_request_types()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.help_request_types(household_id, id, label, capability, is_other)
  values
    (new.id, 'PICKUP', 'Pickup', 'PICKUP', false),
    (new.id, 'DROPOFF', 'Dropoff', 'DROPOFF', false),
    (new.id, 'TRANSPORTATION', 'Transportation', 'TRANSPORTATION', false),
    (new.id, 'BABYSITTING', 'Babysitting', 'BABYSITTING', false),
    (new.id, 'OTHER', 'Other', null, true)
  on conflict (household_id, id) do nothing;
  return new;
end $$;

create trigger seed_help_request_types_after_household
after insert on public.households
for each row execute function private.seed_help_request_types();

insert into public.help_request_types(household_id, id, label, capability, is_other)
select household.id, defaults.id, defaults.label, defaults.capability, defaults.is_other
from public.households household
cross join (
  values
    ('PICKUP', 'Pickup', 'PICKUP'::public.capability_type, false),
    ('DROPOFF', 'Dropoff', 'DROPOFF'::public.capability_type, false),
    ('TRANSPORTATION', 'Transportation', 'TRANSPORTATION'::public.capability_type, false),
    ('BABYSITTING', 'Babysitting', 'BABYSITTING'::public.capability_type, false),
    ('OTHER', 'Other', null::public.capability_type, true)
) as defaults(id, label, capability, is_other)
on conflict (household_id, id) do nothing;

alter table public.help_requests
  alter column request_type type text using request_type::text,
  add column request_type_label text,
  add column context text check (char_length(context) between 1 and 1000);

update public.help_requests
set request_type_label = initcap(replace(request_type, '_', ' '));

alter table public.help_requests
  alter column request_type_label set not null;

create or replace function private.is_household_owner(p_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.households household
    where household.id = p_household_id
      and household.owner_user_id = (select auth.uid())
  )
$$;

create or replace function private.protect_other_help_request_type()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.is_other and (
    new.is_other is distinct from old.is_other
    or new.archived_at is not null
    or new.label is distinct from old.label
  ) then
    raise exception 'Other help type cannot be changed or removed' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger protect_other_help_request_type_before_update
before update on public.help_request_types
for each row execute function private.protect_other_help_request_type();

alter table public.help_request_types enable row level security;

create policy help_request_types_member_select on public.help_request_types
for select to authenticated
using (private.is_active_member(household_id));

create policy help_request_types_owner_insert on public.help_request_types
for insert to authenticated
with check (private.is_household_owner(household_id) and not is_other);

create policy help_request_types_owner_update on public.help_request_types
for update to authenticated
using (private.is_household_owner(household_id))
with check (private.is_household_owner(household_id));

drop function public.create_help_request_with_event(
  uuid, uuid, uuid, public.capability_type, timestamptz, text, text, uuid[]
);

create function public.create_help_request_with_event(
  p_request_id uuid,
  p_event_id uuid,
  p_child_id uuid,
  p_request_type text,
  p_starts_at timestamptz,
  p_location text,
  p_context text,
  p_notes text,
  p_recipient_member_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_creator uuid;
  v_recipient uuid;
  v_inserted integer;
  v_type public.help_request_types%rowtype;
begin
  select household_id into v_household from public.children where id = p_child_id;
  v_creator := private.current_member_id(v_household);
  if v_creator is null or not private.is_manager(v_household) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_type
  from public.help_request_types
  where household_id = v_household
    and id = p_request_type
    and archived_at is null;
  if not found then
    raise exception 'help type unavailable' using errcode = '22023';
  end if;
  if v_type.is_other and nullif(btrim(p_context), '') is null then
    raise exception 'context is required for Other help requests' using errcode = '22023';
  end if;
  if coalesce(array_length(p_recipient_member_ids, 1), 0) = 0 then
    raise exception 'recipient required' using errcode = '22023';
  end if;
  if exists(
    select 1
    from unnest(p_recipient_member_ids) recipient_id
    where not exists(
      select 1
      from public.household_members member
      join public.member_child_permissions permission
        on permission.member_id = member.id and permission.child_id = p_child_id
      where member.id = recipient_id
        and member.household_id = v_household
        and member.status = 'ACTIVE'
        and (
          v_type.capability is null
          or exists(
            select 1
            from public.member_capabilities capability
            where capability.member_id = member.id
              and capability.capability = v_type.capability
          )
        )
    )
  ) then
    raise exception 'ineligible recipient' using errcode = '42501';
  end if;
  insert into public.care_events(
    id, household_id, child_id, event_type, title, starts_at, location, notes,
    requires_caregiver, created_by
  ) values (
    p_event_id, v_household, p_child_id, v_type.label, v_type.label,
    p_starts_at, p_location, p_notes, true, v_creator
  ) on conflict (id) do nothing;
  insert into public.help_requests(
    id, household_id, child_id, event_id, request_type, request_type_label,
    starts_at, location, context, notes, created_by
  ) values (
    p_request_id, v_household, p_child_id, p_event_id, v_type.id, v_type.label,
    p_starts_at, p_location, nullif(btrim(p_context), ''), p_notes, v_creator
  ) on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    if not exists(
      select 1 from public.help_requests
      where id = p_request_id
        and household_id = v_household
        and child_id = p_child_id
        and event_id = p_event_id
    ) then
      raise exception 'idempotency key conflict' using errcode = '23505';
    end if;
    return p_request_id;
  end if;
  foreach v_recipient in array p_recipient_member_ids loop
    insert into public.help_request_recipients(request_id, member_id)
    values (p_request_id, v_recipient)
    on conflict do nothing;
    insert into public.notifications(
      household_id, recipient_member_id, type, title, body, route
    ) values (
      v_household, v_recipient, 'HELP_REQUEST', 'Help requested',
      'A childcare request needs your response.', '/help-sent?id=' || p_request_id
    );
  end loop;
  return p_request_id;
end $$;

revoke execute on function public.create_help_request_with_event(
  uuid, uuid, uuid, text, timestamptz, text, text, text, uuid[]
) from public, anon;
grant execute on function public.create_help_request_with_event(
  uuid, uuid, uuid, text, timestamptz, text, text, text, uuid[]
) to authenticated;
revoke execute on function private.seed_help_request_types() from public, anon, authenticated;
revoke execute on function private.is_household_owner(uuid) from public, anon, authenticated;
revoke execute on function private.protect_other_help_request_type() from public, anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.help_request_types;
exception when duplicate_object then null; end $$;
