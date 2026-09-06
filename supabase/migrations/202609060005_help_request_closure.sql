create or replace function public.close_help_request(
  p_request_id uuid,
  p_status public.help_request_status
) returns void language plpgsql security definer set search_path = '' as $$
declare v_request public.help_requests%rowtype; v_member uuid;
begin
  if p_status not in ('COMPLETED', 'CANCELLED') then
    raise exception 'invalid terminal state' using errcode = '22023';
  end if;
  select * into v_request from public.help_requests where id = p_request_id for update;
  if not found then raise exception 'request unavailable' using errcode = 'P0001'; end if;
  v_member := private.current_member_id(v_request.household_id);
  if v_member is null or (v_request.created_by <> v_member and not private.is_manager(v_request.household_id)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_request.status = p_status then return; end if;
  if p_status = 'COMPLETED' and v_request.status <> 'ASSIGNED' then
    raise exception 'only assigned requests can be completed' using errcode = 'P0001';
  end if;
  if p_status = 'CANCELLED' and v_request.status not in ('OPEN', 'ASSIGNED') then
    raise exception 'request cannot be cancelled' using errcode = 'P0001';
  end if;
  update public.help_requests
  set status = p_status,
      completed_at = case when p_status = 'COMPLETED' then now() else completed_at end,
      cancelled_at = case when p_status = 'CANCELLED' then now() else cancelled_at end
  where id = p_request_id;
  update public.care_events set status = p_status::text::public.care_event_status
  where id = v_request.event_id;
end $$;

revoke execute on function public.close_help_request(uuid, public.help_request_status) from public, anon;
grant execute on function public.close_help_request(uuid, public.help_request_status) to authenticated;

create or replace function public.expire_household_invitations()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.household_invitations
  set status = 'EXPIRED', responded_at = now()
  where status = 'PENDING' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.expire_household_invitations() from public, anon, authenticated;
grant execute on function public.expire_household_invitations() to service_role;
