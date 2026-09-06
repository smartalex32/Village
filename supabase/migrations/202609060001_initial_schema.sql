create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.member_role as enum ('OWNER', 'PARENT_GUARDIAN', 'TRUSTED_CAREGIVER', 'LIMITED_CAREGIVER');
create type public.membership_status as enum ('ACTIVE', 'REMOVED');
create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');
create type public.capability_type as enum ('PICKUP', 'DROPOFF', 'TRANSPORTATION', 'BABYSITTING', 'EMERGENCY', 'OTHER');
create type public.care_event_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');
create type public.help_request_status as enum ('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED');
create type public.recipient_response as enum ('PENDING', 'ACCEPTED', 'DECLINED');
create type public.handoff_status as enum ('SCHEDULED', 'READY', 'COMPLETED', 'CANCELLED');
create type public.notification_type as enum ('INVITATION', 'HELP_REQUEST', 'HELP_ACCEPTED', 'ASSIGNMENT_CHANGED', 'HANDOFF_UPCOMING', 'HANDOFF_COMPLETED', 'HANDOFF_CANCELLED', 'COVERAGE_GAP');
create type public.delivery_channel as enum ('PUSH', 'EMAIL');
create type public.delivery_status as enum ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  email text not null,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_user_id uuid not null references public.profiles(id),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  relationship_label text not null default 'Caregiver',
  status public.membership_status not null default 'ACTIVE',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (household_id, user_id)
);
create index household_members_user_active_idx on public.household_members(user_id, household_id) where status = 'ACTIVE';

create table public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text,
  birth_date date,
  avatar_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index children_household_idx on public.children(household_id) where archived_at is null;

create table public.child_care_notes (
  child_id uuid primary key references public.children(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  updated_by uuid not null references public.household_members(id),
  updated_at timestamptz not null default now()
);

create table public.member_child_permissions (
  member_id uuid not null references public.household_members(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  can_view_profile boolean not null default true,
  can_view_schedule boolean not null default false,
  can_view_care_notes boolean not null default false,
  can_participate_handoffs boolean not null default false,
  primary key (member_id, child_id)
);

create table public.member_capabilities (
  member_id uuid not null references public.household_members(id) on delete cascade,
  capability public.capability_type not null,
  primary key (member_id, capability)
);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null check (invited_email = lower(invited_email)),
  relationship_label text not null,
  role public.member_role not null check (role <> 'OWNER'),
  capabilities public.capability_type[] not null default '{}',
  token_hash text not null unique,
  status public.invitation_status not null default 'PENDING',
  expires_at timestamptz not null default now() + interval '7 days',
  invited_by uuid not null references public.household_members(id),
  accepted_by uuid references public.household_members(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index invitations_email_idx on public.household_invitations(invited_email, status);

create table public.invitation_child_permissions (
  invitation_id uuid not null references public.household_invitations(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  can_view_profile boolean not null default true,
  can_view_schedule boolean not null default false,
  can_view_care_notes boolean not null default false,
  can_participate_handoffs boolean not null default true,
  primary key (invitation_id, child_id)
);

create table public.care_events (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.children(id),
  event_type text not null,
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  assigned_member_id uuid references public.household_members(id),
  notes text check (char_length(notes) <= 4000),
  requires_caregiver boolean not null default false,
  status public.care_event_status not null default 'SCHEDULED',
  created_by uuid not null references public.household_members(id),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index care_events_household_starts_idx on public.care_events(household_id, starts_at) where status = 'SCHEDULED';
create index care_events_child_idx on public.care_events(child_id, starts_at);

create table public.help_requests (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.children(id),
  event_id uuid not null unique references public.care_events(id),
  request_type public.capability_type not null,
  starts_at timestamptz not null,
  location text not null,
  notes text check (char_length(notes) <= 2000),
  status public.help_request_status not null default 'OPEN',
  assigned_member_id uuid references public.household_members(id),
  created_by uuid not null references public.household_members(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create table public.help_request_recipients (
  request_id uuid not null references public.help_requests(id) on delete cascade,
  member_id uuid not null references public.household_members(id),
  response public.recipient_response not null default 'PENDING',
  responded_at timestamptz,
  primary key (request_id, member_id)
);

create table public.handoffs (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.children(id),
  from_member_id uuid not null references public.household_members(id),
  to_member_id uuid not null references public.household_members(id),
  scheduled_at timestamptz not null,
  location text,
  notes text check (char_length(notes) <= 4000),
  associated_event_id uuid references public.care_events(id),
  status public.handoff_status not null default 'SCHEDULED',
  accepted_by uuid references public.household_members(id),
  accepted_at timestamptz,
  created_by uuid not null references public.household_members(id),
  created_at timestamptz not null default now(),
  check (from_member_id <> to_member_id)
);
create index handoffs_child_time_idx on public.handoffs(child_id, scheduled_at desc);

create table public.handoff_items (
  id uuid primary key,
  handoff_id uuid not null references public.handoffs(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  is_ready boolean not null default false,
  position smallint not null default 0
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_member_id uuid not null references public.household_members(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  route text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_member_id, created_at desc);

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  invitation_id uuid references public.household_invitations(id) on delete cascade,
  channel public.delivery_channel not null,
  status public.delivery_status not null default 'PENDING',
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  lock_token uuid,
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  check ((notification_id is not null) <> (invitation_id is not null))
);

create or replace function private.current_member_id(p_household_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select hm.id from public.household_members hm
  where hm.household_id = p_household_id and hm.user_id = (select auth.uid()) and hm.status = 'ACTIVE'
  limit 1
$$;

create or replace function private.is_active_member(p_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_member_id(p_household_id) is not null
$$;

create or replace function private.is_manager(p_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.household_members hm where hm.household_id = p_household_id and hm.user_id = (select auth.uid()) and hm.status = 'ACTIVE' and hm.role in ('OWNER', 'PARENT_GUARDIAN'))
$$;

create or replace function private.can_access_child(p_child_id uuid, p_scope text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.children c
    join public.household_members hm on hm.household_id = c.household_id and hm.user_id = (select auth.uid()) and hm.status = 'ACTIVE'
    left join public.member_child_permissions mcp on mcp.member_id = hm.id and mcp.child_id = c.id
    where c.id = p_child_id and (
      hm.role in ('OWNER', 'PARENT_GUARDIAN') or
      (p_scope = 'profile' and mcp.can_view_profile) or
      (p_scope = 'schedule' and mcp.can_view_schedule) or
      (p_scope = 'care_notes' and mcp.can_view_care_notes) or
      (p_scope = 'handoff' and mcp.can_participate_handoffs)
    )
  )
$$;

revoke execute on all functions in schema private from public, anon, authenticated;

create or replace function public.create_household(p_name text, p_timezone text, p_child_first_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_household uuid; v_member uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  insert into public.households(name, owner_user_id, timezone) values (trim(p_name), auth.uid(), p_timezone) returning id into v_household;
  insert into public.household_members(household_id, user_id, role, relationship_label) values (v_household, auth.uid(), 'OWNER', 'Parent') returning id into v_member;
  insert into public.children(household_id, first_name) values (v_household, trim(p_child_first_name));
  return v_household;
end $$;

create or replace function public.accept_household_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.household_invitations%rowtype; v_member uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into v_inv from public.household_invitations where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or v_inv.status <> 'PENDING' then raise exception 'invitation unavailable' using errcode = 'P0001'; end if;
  if v_inv.expires_at <= now() then update public.household_invitations set status = 'EXPIRED', responded_at = now() where id = v_inv.id; raise exception 'invitation expired' using errcode = 'P0001'; end if;
  if v_inv.invited_email <> v_email then raise exception 'invitation email mismatch' using errcode = '42501'; end if;
  insert into public.household_members(household_id, user_id, role, relationship_label) values (v_inv.household_id, auth.uid(), v_inv.role, v_inv.relationship_label)
  on conflict (household_id, user_id) do update set status = 'ACTIVE', removed_at = null returning id into v_member;
  insert into public.member_child_permissions(member_id, child_id, can_view_profile, can_view_schedule, can_view_care_notes, can_participate_handoffs)
  select v_member, child_id, can_view_profile, can_view_schedule, can_view_care_notes, can_participate_handoffs from public.invitation_child_permissions where invitation_id = v_inv.id
  on conflict (member_id, child_id) do update set can_view_profile = excluded.can_view_profile, can_view_schedule = excluded.can_view_schedule, can_view_care_notes = excluded.can_view_care_notes, can_participate_handoffs = excluded.can_participate_handoffs;
  insert into public.member_capabilities(member_id, capability)
  select v_member, capability from unnest(v_inv.capabilities) capability
  on conflict (member_id, capability) do nothing;
  update public.household_invitations set status = 'ACCEPTED', accepted_by = v_member, responded_at = now(), token_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex') where id = v_inv.id;
  return v_member;
end $$;

create or replace function public.create_help_request_with_event(
  p_request_id uuid, p_event_id uuid, p_child_id uuid, p_request_type public.capability_type, p_starts_at timestamptz,
  p_location text, p_notes text, p_recipient_member_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_household uuid; v_creator uuid; v_recipient uuid; v_inserted integer;
begin
  select household_id into v_household from public.children where id = p_child_id;
  v_creator := private.current_member_id(v_household);
  if v_creator is null or not private.is_manager(v_household) then raise exception 'not authorized' using errcode = '42501'; end if;
  if coalesce(array_length(p_recipient_member_ids, 1), 0) = 0 then raise exception 'recipient required' using errcode = '22023'; end if;
  if exists(select 1 from unnest(p_recipient_member_ids) rid where not exists(select 1 from public.household_members hm join public.member_child_permissions mcp on mcp.member_id = hm.id and mcp.child_id = p_child_id join public.member_capabilities mc on mc.member_id = hm.id and mc.capability = p_request_type where hm.id = rid and hm.household_id = v_household and hm.status = 'ACTIVE')) then raise exception 'ineligible recipient' using errcode = '42501'; end if;
  insert into public.care_events(id, household_id, child_id, event_type, title, starts_at, location, notes, requires_caregiver, created_by)
  values (p_event_id, v_household, p_child_id, p_request_type::text, initcap(replace(p_request_type::text, '_', ' ')), p_starts_at, p_location, p_notes, true, v_creator)
  on conflict (id) do nothing;
  insert into public.help_requests(id, household_id, child_id, event_id, request_type, starts_at, location, notes, created_by)
  values (p_request_id, v_household, p_child_id, p_event_id, p_request_type, p_starts_at, p_location, p_notes, v_creator)
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    if not exists(select 1 from public.help_requests where id = p_request_id and household_id = v_household and child_id = p_child_id and event_id = p_event_id) then
      raise exception 'idempotency key conflict' using errcode = '23505';
    end if;
    return p_request_id;
  end if;
  foreach v_recipient in array p_recipient_member_ids loop
    insert into public.help_request_recipients(request_id, member_id) values (p_request_id, v_recipient) on conflict do nothing;
    insert into public.notifications(household_id, recipient_member_id, type, title, body, route) values (v_household, v_recipient, 'HELP_REQUEST', 'Help requested', 'A childcare request needs your response.', '/help-sent?id=' || p_request_id);
  end loop;
  return p_request_id;
end $$;

create or replace function public.accept_help_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.help_requests%rowtype; v_member uuid;
begin
  select * into v_request from public.help_requests where id = p_request_id for update;
  if not found then raise exception 'request unavailable' using errcode = 'P0001'; end if;
  v_member := private.current_member_id(v_request.household_id);
  if v_request.status = 'ASSIGNED' and v_request.assigned_member_id = v_member then return v_member; end if;
  if v_request.status <> 'OPEN' or v_member is null then raise exception 'request is not open' using errcode = 'P0001'; end if;
  if not exists(select 1 from public.help_request_recipients where request_id = p_request_id and member_id = v_member) then raise exception 'not a recipient' using errcode = '42501'; end if;
  update public.help_requests set status = 'ASSIGNED', assigned_member_id = v_member where id = p_request_id;
  update public.help_request_recipients set response = 'ACCEPTED', responded_at = now() where request_id = p_request_id and member_id = v_member;
  update public.help_request_recipients set response = 'DECLINED', responded_at = now() where request_id = p_request_id and member_id <> v_member and response = 'PENDING';
  update public.care_events set assigned_member_id = v_member where id = v_request.event_id;
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route) values (v_request.household_id, v_request.created_by, 'HELP_ACCEPTED', 'Help is covered', 'A caregiver accepted your request.', '/help-sent?id=' || p_request_id);
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route)
  select v_request.household_id, member_id, 'HELP_ACCEPTED', 'Help is covered', 'Another caregiver accepted this request.', '/help-sent?id=' || p_request_id
  from public.help_request_recipients where request_id = p_request_id and member_id <> v_member;
  return v_member;
end $$;

create or replace function public.acknowledge_handoff(p_handoff_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_handoff public.handoffs%rowtype; v_member uuid;
begin
  select * into v_handoff from public.handoffs where id = p_handoff_id for update;
  if not found then raise exception 'handoff unavailable' using errcode = 'P0001'; end if;
  v_member := private.current_member_id(v_handoff.household_id);
  if v_handoff.status = 'COMPLETED' and v_handoff.accepted_by = v_member then return v_member; end if;
  if v_member is distinct from v_handoff.to_member_id then raise exception 'only the recipient may acknowledge' using errcode = '42501'; end if;
  if v_handoff.status not in ('SCHEDULED', 'READY') then raise exception 'handoff is not active' using errcode = 'P0001'; end if;
  update public.handoffs set status = 'COMPLETED', accepted_by = v_member, accepted_at = now() where id = p_handoff_id;
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route) values (v_handoff.household_id, v_handoff.from_member_id, 'HANDOFF_COMPLETED', 'Handoff acknowledged', 'Responsibility was transferred.', '/handoff/' || p_handoff_id);
  return v_member;
end $$;

create or replace function public.remove_household_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_member public.household_members%rowtype;
begin
  select * into v_member from public.household_members where id = p_member_id for update;
  if not found or not private.is_manager(v_member.household_id) or v_member.role = 'OWNER' then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.household_members set status = 'REMOVED', removed_at = now() where id = p_member_id;
  delete from public.help_request_recipients hrr using public.help_requests hr where hrr.request_id = hr.id and hrr.member_id = p_member_id and hr.status = 'OPEN';
  with gaps as (
    update public.care_events set assigned_member_id = null
    where assigned_member_id = p_member_id and status = 'SCHEDULED' and starts_at > now()
    returning id, household_id, title
  )
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route)
  select gaps.household_id, managers.id, 'COVERAGE_GAP', 'Care coverage needed', gaps.title || ' no longer has an assigned caregiver.', '/event-form?id=' || gaps.id
  from gaps
  join public.household_members managers on managers.household_id = gaps.household_id
  where managers.status = 'ACTIVE' and managers.role in ('OWNER', 'PARENT_GUARDIAN');
  with cancelled as (
    update public.handoffs set status = 'CANCELLED'
    where (from_member_id = p_member_id or to_member_id = p_member_id) and status in ('SCHEDULED', 'READY')
    returning id, household_id, from_member_id, to_member_id
  )
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route)
  select household_id,
    case when from_member_id = p_member_id then to_member_id else from_member_id end,
    'HANDOFF_CANCELLED', 'Handoff cancelled', 'A scheduled handoff was cancelled because a caregiver was removed.', '/handoff/' || id
  from cancelled;
end $$;

revoke execute on function public.create_household(text, text, text) from public, anon;
revoke execute on function public.accept_household_invitation(text) from public, anon;
revoke execute on function public.create_help_request_with_event(uuid, uuid, uuid, public.capability_type, timestamptz, text, text, uuid[]) from public, anon;
revoke execute on function public.accept_help_request(uuid) from public, anon;
revoke execute on function public.acknowledge_handoff(uuid) from public, anon;
revoke execute on function public.remove_household_member(uuid) from public, anon;
grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
grant execute on function public.create_help_request_with_event(uuid, uuid, uuid, public.capability_type, timestamptz, text, text, uuid[]) to authenticated;
grant execute on function public.accept_help_request(uuid) to authenticated;
grant execute on function public.acknowledge_handoff(uuid) to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.children enable row level security;
alter table public.child_care_notes enable row level security;
alter table public.member_child_permissions enable row level security;
alter table public.member_capabilities enable row level security;
alter table public.household_invitations enable row level security;
alter table public.invitation_child_permissions enable row level security;
alter table public.care_events enable row level security;
alter table public.help_requests enable row level security;
alter table public.help_request_recipients enable row level security;
alter table public.handoffs enable row level security;
alter table public.handoff_items enable row level security;
alter table public.notifications enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.notification_outbox enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()) or exists(select 1 from public.household_members mine join public.household_members theirs on theirs.household_id = mine.household_id where mine.user_id = (select auth.uid()) and mine.status = 'ACTIVE' and theirs.user_id = profiles.id and theirs.status = 'ACTIVE'));
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy households_member_select on public.households for select to authenticated using (private.is_active_member(id));
create policy members_household_select on public.household_members for select to authenticated using (private.is_active_member(household_id));
create policy members_manager_update on public.household_members for update to authenticated using (private.is_manager(household_id)) with check (private.is_manager(household_id));
create policy children_permitted_select on public.children for select to authenticated using (private.can_access_child(id, 'profile'));
create policy children_manager_all on public.children for all to authenticated using (private.is_manager(household_id)) with check (private.is_manager(household_id));
create policy child_notes_permitted_select on public.child_care_notes for select to authenticated using (private.can_access_child(child_id, 'care_notes'));
create policy child_notes_manager_all on public.child_care_notes for all to authenticated using (exists(select 1 from public.children c where c.id = child_id and private.is_manager(c.household_id))) with check (exists(select 1 from public.children c where c.id = child_id and private.is_manager(c.household_id)));
create policy permissions_household_select on public.member_child_permissions for select to authenticated using (exists(select 1 from public.household_members hm where hm.id = member_id and private.is_active_member(hm.household_id)));
create policy permissions_manager_all on public.member_child_permissions for all to authenticated using (exists(select 1 from public.household_members hm where hm.id = member_id and private.is_manager(hm.household_id))) with check (exists(select 1 from public.household_members hm where hm.id = member_id and private.is_manager(hm.household_id)));
create policy capabilities_household_select on public.member_capabilities for select to authenticated using (exists(select 1 from public.household_members hm where hm.id = member_id and private.is_active_member(hm.household_id)));
create policy capabilities_manager_all on public.member_capabilities for all to authenticated using (exists(select 1 from public.household_members hm where hm.id = member_id and private.is_manager(hm.household_id))) with check (exists(select 1 from public.household_members hm where hm.id = member_id and private.is_manager(hm.household_id)));
create policy invitations_manager_all on public.household_invitations for all to authenticated using (private.is_manager(household_id)) with check (private.is_manager(household_id));
create policy invitation_permissions_manager_all on public.invitation_child_permissions for all to authenticated using (exists(select 1 from public.household_invitations i where i.id = invitation_id and private.is_manager(i.household_id))) with check (exists(select 1 from public.household_invitations i where i.id = invitation_id and private.is_manager(i.household_id)));
create policy events_permitted_select on public.care_events for select to authenticated using (private.can_access_child(child_id, 'schedule') or assigned_member_id = private.current_member_id(household_id));
create policy events_manager_all on public.care_events for all to authenticated using (private.is_manager(household_id)) with check (private.is_manager(household_id));
create policy help_participant_select on public.help_requests for select to authenticated using (private.is_manager(household_id) or created_by = private.current_member_id(household_id) or exists(select 1 from public.help_request_recipients hrr where hrr.request_id = id and hrr.member_id = private.current_member_id(household_id)));
create policy help_recipients_participant_select on public.help_request_recipients for select to authenticated using (exists(select 1 from public.help_requests hr where hr.id = request_id and (private.is_manager(hr.household_id) or hr.created_by = private.current_member_id(hr.household_id) or exists(select 1 from public.help_request_recipients own where own.request_id = hr.id and own.member_id = private.current_member_id(hr.household_id)))));
create policy handoffs_participant_select on public.handoffs for select to authenticated using (private.is_manager(household_id) or from_member_id = private.current_member_id(household_id) or to_member_id = private.current_member_id(household_id));
create policy handoffs_manager_all on public.handoffs for all to authenticated using (private.is_manager(household_id)) with check (private.is_manager(household_id));
create policy handoff_items_participant_select on public.handoff_items for select to authenticated using (exists(select 1 from public.handoffs h where h.id = handoff_id and (private.is_manager(h.household_id) or h.from_member_id = private.current_member_id(h.household_id) or h.to_member_id = private.current_member_id(h.household_id))));
create policy handoff_items_sender_update on public.handoff_items for update to authenticated using (exists(select 1 from public.handoffs h where h.id = handoff_id and h.from_member_id = private.current_member_id(h.household_id) and h.status in ('SCHEDULED', 'READY')));
create policy notifications_own_select on public.notifications for select to authenticated using (recipient_member_id = private.current_member_id(household_id));
create policy notifications_own_update on public.notifications for update to authenticated using (recipient_member_id = private.current_member_id(household_id)) with check (recipient_member_id = private.current_member_id(household_id));
create policy device_tokens_own_all on public.device_push_tokens for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
create policy avatar_read on storage.objects for select to authenticated using (bucket_id = 'avatars' and exists(select 1 from public.household_members hm where hm.user_id = (select auth.uid()) and hm.status = 'ACTIVE' and (storage.foldername(name))[1] = hm.household_id::text));
create policy avatar_write on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and exists(select 1 from public.household_members hm where hm.user_id = (select auth.uid()) and hm.status = 'ACTIVE' and hm.role in ('OWNER', 'PARENT_GUARDIAN') and (storage.foldername(name))[1] = hm.household_id::text));

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, email) values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), lower(new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
revoke execute on function private.handle_new_user() from public, anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.care_events, public.help_requests, public.handoffs, public.notifications;
exception when duplicate_object then null; end $$;
