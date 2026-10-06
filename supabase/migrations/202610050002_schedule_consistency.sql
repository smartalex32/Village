-- Keep the request and its care event on the same schedule when a parent edits it.
create or replace function private.check_linked_event_child()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.child_id is distinct from old.child_id and exists (
    select 1 from public.help_requests
    where event_id = old.id and status in ('OPEN', 'ASSIGNED')
  ) then
    raise exception 'cancel the active help request before changing the child' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger check_linked_event_child before update of child_id on public.care_events
for each row execute function private.check_linked_event_child();
revoke execute on function private.check_linked_event_child() from public, anon, authenticated;

-- Acceptance updates the request first; direct event edits must preserve its assignee.
create or replace function private.check_linked_event_caregiver()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'SCHEDULED' and exists (
    select 1 from public.help_requests request
    where request.event_id = old.id and request.status in ('OPEN', 'ASSIGNED')
      and new.assigned_member_id is distinct from request.assigned_member_id
  ) then
    raise exception 'manage the caregiver through the active help request' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger check_linked_event_caregiver before update of assigned_member_id on public.care_events
for each row execute function private.check_linked_event_caregiver();
revoke execute on function private.check_linked_event_caregiver() from public, anon, authenticated;

-- RLS policies call these helpers as the authenticated role.
grant execute on function private.current_member_id(uuid), private.is_active_member(uuid),
  private.is_manager(uuid), private.can_access_child(uuid, text) to authenticated;

create or replace function private.sync_linked_request_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.help_requests
  set starts_at = new.starts_at,
      location = coalesce(new.location, ''),
      status = case when new.status in ('COMPLETED', 'CANCELLED')
        then new.status::text::public.help_request_status else status end,
      completed_at = case when new.status = 'COMPLETED' then now() else completed_at end,
      cancelled_at = case when new.status = 'CANCELLED' then now() else cancelled_at end
  where event_id = new.id and status in ('OPEN', 'ASSIGNED');
  return new;
end $$;

create trigger sync_linked_request_schedule after update of starts_at, location, status on public.care_events
for each row execute function private.sync_linked_request_schedule();
revoke execute on function private.sync_linked_request_schedule() from public, anon, authenticated;

-- Match the request-before-event lock order used by acceptance and closure.
create or replace function public.update_care_event(p_event_id uuid, p_changes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_household uuid;
begin
  select household_id into v_household from public.care_events where id = p_event_id;
  if not found or not private.is_manager(v_household) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'event changes must be an object' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_changes) key
    where key not in ('child_id', 'event_type', 'title', 'starts_at', 'ends_at',
      'location', 'assigned_member_id', 'notes', 'requires_caregiver', 'status')
  ) then
    raise exception 'unsupported event change' using errcode = '22023';
  end if;
  perform 1 from public.help_requests where event_id = p_event_id for update;
  perform 1 from public.care_events where id = p_event_id and household_id = v_household for update;
  if not found or not private.is_manager(v_household) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.care_events event set
    child_id = case when p_changes ? 'child_id' then (p_changes->>'child_id')::uuid else event.child_id end,
    event_type = case when p_changes ? 'event_type' then p_changes->>'event_type' else event.event_type end,
    title = case when p_changes ? 'title' then p_changes->>'title' else event.title end,
    starts_at = case when p_changes ? 'starts_at' then (p_changes->>'starts_at')::timestamptz else event.starts_at end,
    ends_at = case when p_changes ? 'ends_at' then (p_changes->>'ends_at')::timestamptz else event.ends_at end,
    location = case when p_changes ? 'location' then p_changes->>'location' else event.location end,
    assigned_member_id = case when p_changes ? 'assigned_member_id' then (p_changes->>'assigned_member_id')::uuid else event.assigned_member_id end,
    notes = case when p_changes ? 'notes' then p_changes->>'notes' else event.notes end,
    requires_caregiver = case when p_changes ? 'requires_caregiver' then (p_changes->>'requires_caregiver')::boolean else event.requires_caregiver end,
    status = case when p_changes ? 'status' then (p_changes->>'status')::public.care_event_status else event.status end
  where id = p_event_id;
end $$;
revoke execute on function public.update_care_event(uuid, jsonb) from public, anon;
grant execute on function public.update_care_event(uuid, jsonb) to authenticated;

-- Release accepted future requests before unassigning a removed caregiver.
-- Keep the original responsibility available for another coverage attempt.
create or replace function public.remove_household_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_member public.household_members%rowtype;
begin
  select * into v_member from public.household_members where id = p_member_id for no key update;
  if not found or not private.is_manager(v_member.household_id) or v_member.role = 'OWNER' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- Serialize active response/recovery operations while membership is revoked.
  -- NO KEY UPDATE above permits the assignee FK's KEY SHARE during acceptance.
  perform 1 from public.help_requests request
    where request.household_id = v_member.household_id and request.status in ('OPEN', 'ASSIGNED')
    order by request.id for update;
  update public.household_members set status = 'REMOVED', removed_at = now() where id = p_member_id;
  update public.help_requests request set status = 'OPEN', assigned_member_id = null
    from public.care_events event
    where event.id = request.event_id and request.assigned_member_id = p_member_id
      and request.status = 'ASSIGNED' and event.status = 'SCHEDULED' and event.starts_at > now();
  delete from public.help_request_recipients recipient using public.help_requests request
    where recipient.request_id = request.id and recipient.member_id = p_member_id and request.status = 'OPEN';
  with gaps as (
    update public.care_events set assigned_member_id = null
    where assigned_member_id = p_member_id and status = 'SCHEDULED' and starts_at > now()
    returning id, household_id, title
  )
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route)
    select gaps.household_id, managers.id, 'COVERAGE_GAP', 'Care coverage needed',
      gaps.title || ' no longer has an assigned caregiver.', '/event-form?id=' || gaps.id
    from gaps join public.household_members managers on managers.household_id = gaps.household_id
    where managers.status = 'ACTIVE' and managers.role in ('OWNER', 'PARENT_GUARDIAN');
  with cancelled as (
    update public.handoffs set status = 'CANCELLED'
    where (from_member_id = p_member_id or to_member_id = p_member_id) and status in ('SCHEDULED', 'READY')
    returning id, household_id, from_member_id, to_member_id
  )
  insert into public.notifications(household_id, recipient_member_id, type, title, body, route)
    select household_id, case when from_member_id = p_member_id then to_member_id else from_member_id end,
      'HANDOFF_CANCELLED', 'Handoff cancelled',
      'A scheduled handoff was cancelled because a caregiver was removed.', '/handoff/' || id
    from cancelled;
end $$;
