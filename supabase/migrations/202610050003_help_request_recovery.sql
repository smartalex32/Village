-- Preserve actual replies when another caregiver accepts.
create or replace function public.accept_help_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.help_requests%rowtype; v_event public.care_events%rowtype; v_member uuid;
begin
  select * into v_request from public.help_requests where id = p_request_id for update;
  if not found then raise exception 'request unavailable' using errcode = 'P0001'; end if;
  v_member := private.current_member_id(v_request.household_id);
  if v_request.status = 'ASSIGNED' and v_request.assigned_member_id = v_member then return v_member; end if;
  if v_request.status <> 'OPEN' or v_member is null then raise exception 'request is not open' using errcode = 'P0001'; end if;
  if not exists(select 1 from public.help_request_recipients where request_id = p_request_id and member_id = v_member and response = 'PENDING') then
    raise exception 'not a pending recipient' using errcode = '42501';
  end if;
  select * into v_event from public.care_events where id = v_request.event_id for update;
  if not found or v_event.status <> 'SCHEDULED' or v_event.assigned_member_id is not null then
    raise exception 'care event is not awaiting coverage' using errcode = 'P0001';
  end if;
  update public.help_requests set status = 'ASSIGNED', assigned_member_id = v_member where id = p_request_id;
  update public.help_request_recipients set response = 'ACCEPTED', responded_at = now() where request_id = p_request_id and member_id = v_member;
  update public.care_events set assigned_member_id = v_member where id = v_request.event_id;
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route)
    values (v_request.household_id, v_request.created_by, 'HELP_ACCEPTED', 'Help is covered', 'A caregiver accepted your request.', '/help-sent?id=' || p_request_id);
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route)
    select v_request.household_id, member_id, 'HELP_ACCEPTED', 'Help is covered', 'Another caregiver accepted this request.', '/help-sent?id=' || p_request_id
    from public.help_request_recipients where request_id = p_request_id and member_id <> v_member;
  return v_member;
end $$;

create or replace function public.respond_to_help_request(p_request_id uuid, p_can_help boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.help_requests%rowtype; v_member uuid; v_response public.recipient_response;
begin
  if p_can_help then return public.accept_help_request(p_request_id); end if;
  select * into v_request from public.help_requests where id = p_request_id for update;
  if not found then raise exception 'request unavailable' using errcode = 'P0001'; end if;
  v_member := private.current_member_id(v_request.household_id);
  select response into v_response from public.help_request_recipients where request_id = p_request_id and member_id = v_member;
  if v_member is null or not found then raise exception 'not a recipient' using errcode = '42501'; end if;
  if v_response = 'DECLINED' then return v_member; end if;
  if v_request.status <> 'OPEN' then raise exception 'request is not open' using errcode = 'P0001'; end if;
  update public.help_request_recipients set response = 'DECLINED', responded_at = now() where request_id = p_request_id and member_id = v_member;
  return v_member;
end $$;

create table private.help_request_recipient_additions (
  operation_id uuid primary key,
  request_id uuid not null references public.help_requests(id) on delete cascade,
  actor_member_id uuid not null references public.household_members(id),
  recipient_member_ids uuid[] not null,
  created_at timestamptz not null default now()
);
revoke all on private.help_request_recipient_additions from public, anon, authenticated;

create function public.add_help_request_recipients(p_request_id uuid, p_recipient_member_ids uuid[], p_operation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.help_requests%rowtype;
  v_event public.care_events%rowtype;
  v_member uuid;
  v_recipients uuid[];
  v_previous private.help_request_recipient_additions%rowtype;
  v_capability public.capability_type;
  v_recipient uuid;
  v_inserted integer;
begin
  select * into v_request from public.help_requests where id = p_request_id for update;
  if not found then raise exception 'request unavailable' using errcode = 'P0001'; end if;
  v_member := private.current_member_id(v_request.household_id);
  if v_member is null or (v_request.created_by <> v_member and not private.is_manager(v_request.household_id)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_operation_id is null or coalesce(cardinality(p_recipient_member_ids), 0) = 0 or array_position(p_recipient_member_ids, null) is not null then
    raise exception 'operation and recipients required' using errcode = '22023';
  end if;
  select array_agg(distinct member_id order by member_id) into v_recipients from unnest(p_recipient_member_ids) member_id;
  select * into v_previous from private.help_request_recipient_additions where operation_id = p_operation_id;
  if found then
    if v_previous.request_id <> p_request_id or v_previous.actor_member_id <> v_member or v_previous.recipient_member_ids <> v_recipients then
      raise exception 'idempotency key conflict' using errcode = '23505';
    end if;
    return p_request_id;
  end if;
  if v_request.status <> 'OPEN' then raise exception 'request is not open' using errcode = 'P0001'; end if;
  select * into v_event from public.care_events where id = v_request.event_id for update;
  if not found or v_event.status <> 'SCHEDULED' or v_event.assigned_member_id is not null then
    raise exception 'care event is not awaiting coverage' using errcode = 'P0001';
  end if;
  -- Archived types remain usable for requests already sent.
  select capability into v_capability from public.help_request_types where household_id = v_request.household_id and id = v_request.request_type;
  if not found then raise exception 'help type unavailable' using errcode = '22023'; end if;
  if exists(
    select 1 from unnest(v_recipients) recipient_id where not exists(
      select 1 from public.household_members member
      join public.member_child_permissions permission on permission.member_id = member.id and permission.child_id = v_request.child_id
      where member.id = recipient_id and member.household_id = v_request.household_id and member.status = 'ACTIVE'
        and (v_capability is null or exists(
          select 1 from public.member_capabilities capability where capability.member_id = member.id and capability.capability = v_capability
        ))
    )
  ) then raise exception 'ineligible recipient' using errcode = '42501'; end if;
  insert into private.help_request_recipient_additions(operation_id, request_id, actor_member_id, recipient_member_ids)
    values (p_operation_id, p_request_id, v_member, v_recipients);
  foreach v_recipient in array v_recipients loop
    insert into public.help_request_recipients(request_id, member_id) values (p_request_id, v_recipient) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted > 0 then
      insert into public.notifications(household_id, recipient_member_id, type, title, body, route)
        values (v_request.household_id, v_recipient, 'HELP_REQUEST', 'Help requested', 'A childcare request needs your response.', '/help-sent?id=' || p_request_id);
    end if;
  end loop;
  return p_request_id;
end $$;
revoke execute on function public.add_help_request_recipients(uuid, uuid[], uuid) from public, anon;
grant execute on function public.add_help_request_recipients(uuid, uuid[], uuid) to authenticated;

-- Participant visibility must not recursively reapply recipient RLS.
create function private.can_view_help_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.help_requests request
    where request.id = p_request_id and private.current_member_id(request.household_id) is not null
      and (private.is_manager(request.household_id)
        or request.created_by = private.current_member_id(request.household_id)
        or exists(select 1 from public.help_request_recipients recipient where recipient.request_id = request.id and recipient.member_id = private.current_member_id(request.household_id)))
  )
$$;
revoke execute on function private.can_view_help_request(uuid) from public, anon;
grant execute on function private.can_view_help_request(uuid) to authenticated;
drop policy help_participant_select on public.help_requests;
create policy help_participant_select on public.help_requests for select to authenticated using (private.can_view_help_request(id));
drop policy help_recipients_participant_select on public.help_request_recipients;
create policy help_recipients_participant_select on public.help_request_recipients for select to authenticated using (private.can_view_help_request(request_id));
do $$ begin
  alter publication supabase_realtime add table public.help_request_recipients;
exception when duplicate_object then null; end $$;
