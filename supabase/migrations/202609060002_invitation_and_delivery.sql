create or replace function public.create_household_invitation(
  p_household_id uuid,
  p_email text,
  p_relationship_label text,
  p_role public.member_role,
  p_child_ids uuid[],
  p_capabilities public.capability_type[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_invitation uuid; v_token text; v_inviter uuid; v_child uuid;
begin
  if not private.is_manager(p_household_id) or p_role = 'OWNER' then raise exception 'not authorized' using errcode = '42501'; end if;
  v_inviter := private.current_member_id(p_household_id);
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.household_invitations set status = 'REVOKED', responded_at = now()
  where household_id = p_household_id and invited_email = lower(trim(p_email)) and status = 'PENDING';
  insert into public.household_invitations(household_id, invited_email, relationship_label, role, capabilities, token_hash, invited_by)
  values (p_household_id, lower(trim(p_email)), trim(p_relationship_label), p_role, coalesce(p_capabilities, '{}'), encode(extensions.digest(v_token, 'sha256'), 'hex'), v_inviter)
  returning id into v_invitation;
  foreach v_child in array p_child_ids loop
    if not exists(select 1 from public.children where id = v_child and household_id = p_household_id) then raise exception 'child outside household' using errcode = '42501'; end if;
    insert into public.invitation_child_permissions(invitation_id, child_id, can_view_profile, can_view_schedule, can_view_care_notes, can_participate_handoffs)
    values (
      v_invitation,
      v_child,
      true,
      p_role in ('OWNER', 'PARENT_GUARDIAN', 'TRUSTED_CAREGIVER'),
      p_role in ('OWNER', 'PARENT_GUARDIAN', 'TRUSTED_CAREGIVER'),
      true
    );
  end loop;
  insert into public.notification_outbox(invitation_id, channel)
  values (v_invitation, 'EMAIL');
  return jsonb_build_object('invitation_id', v_invitation, 'token', v_token, 'expires_at', now() + interval '7 days');
end $$;

create or replace function public.decline_household_invitation(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  update public.household_invitations set status = 'DECLINED', responded_at = now(), token_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex')
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and invited_email = v_email and status = 'PENDING' and expires_at > now();
  if not found then raise exception 'invitation unavailable' using errcode = 'P0001'; end if;
end $$;

create or replace function public.respond_to_help_request(p_request_id uuid, p_can_help boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_member uuid; v_household uuid;
begin
  select household_id into v_household from public.help_requests where id = p_request_id;
  v_member := private.current_member_id(v_household);
  if p_can_help then return public.accept_help_request(p_request_id); end if;
  update public.help_request_recipients set response = 'DECLINED', responded_at = now()
  where request_id = p_request_id and member_id = v_member and response = 'PENDING'
    and exists(select 1 from public.help_requests hr where hr.id = p_request_id and hr.status = 'OPEN');
  if not found then raise exception 'request is not open' using errcode = 'P0001'; end if;
  return v_member;
end $$;

create or replace function private.enqueue_push_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_outbox(notification_id, channel) values (new.id, 'PUSH');
  return new;
end $$;
create trigger enqueue_push_after_notification after insert on public.notifications for each row execute function private.enqueue_push_delivery();
revoke execute on function private.enqueue_push_delivery() from public, anon, authenticated;

revoke execute on function public.create_household_invitation(uuid, text, text, public.member_role, uuid[], public.capability_type[]) from public, anon;
revoke execute on function public.decline_household_invitation(text) from public, anon;
revoke execute on function public.respond_to_help_request(uuid, boolean) from public, anon;
grant execute on function public.create_household_invitation(uuid, text, text, public.member_role, uuid[], public.capability_type[]) to authenticated;
grant execute on function public.decline_household_invitation(text) to authenticated;
grant execute on function public.respond_to_help_request(uuid, boolean) to authenticated;

create policy handoff_items_manager_all on public.handoff_items for all to authenticated
using (exists(select 1 from public.handoffs h where h.id = handoff_id and private.is_manager(h.household_id)))
with check (exists(select 1 from public.handoffs h where h.id = handoff_id and private.is_manager(h.household_id)));
