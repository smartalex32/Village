-- Keep every relationship inside its owning household, even when a privileged
-- client supplies a valid UUID from another household.
alter table public.household_members add constraint household_members_household_id_id_key unique (household_id, id);
alter table public.children add constraint children_household_id_id_key unique (household_id, id);
alter table public.care_events add constraint care_events_household_id_id_key unique (household_id, id);

alter table public.household_invitations
  add constraint invitations_inviter_same_household_fk foreign key (household_id, invited_by) references public.household_members(household_id, id),
  add constraint invitations_acceptor_same_household_fk foreign key (household_id, accepted_by) references public.household_members(household_id, id);

alter table public.care_events
  add constraint care_events_child_same_household_fk foreign key (household_id, child_id) references public.children(household_id, id),
  add constraint care_events_assignee_same_household_fk foreign key (household_id, assigned_member_id) references public.household_members(household_id, id),
  add constraint care_events_creator_same_household_fk foreign key (household_id, created_by) references public.household_members(household_id, id);

alter table public.help_requests
  add constraint help_child_same_household_fk foreign key (household_id, child_id) references public.children(household_id, id),
  add constraint help_event_same_household_fk foreign key (household_id, event_id) references public.care_events(household_id, id),
  add constraint help_assignee_same_household_fk foreign key (household_id, assigned_member_id) references public.household_members(household_id, id),
  add constraint help_creator_same_household_fk foreign key (household_id, created_by) references public.household_members(household_id, id);

alter table public.handoffs
  add constraint handoffs_child_same_household_fk foreign key (household_id, child_id) references public.children(household_id, id),
  add constraint handoffs_sender_same_household_fk foreign key (household_id, from_member_id) references public.household_members(household_id, id),
  add constraint handoffs_receiver_same_household_fk foreign key (household_id, to_member_id) references public.household_members(household_id, id),
  add constraint handoffs_acceptor_same_household_fk foreign key (household_id, accepted_by) references public.household_members(household_id, id),
  add constraint handoffs_creator_same_household_fk foreign key (household_id, created_by) references public.household_members(household_id, id),
  add constraint handoffs_event_same_household_fk foreign key (household_id, associated_event_id) references public.care_events(household_id, id);

alter table public.notifications
  add constraint notifications_recipient_same_household_fk foreign key (household_id, recipient_member_id) references public.household_members(household_id, id);

create or replace function private.enforce_join_household()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_left uuid; v_right uuid;
begin
  if tg_table_name = 'member_child_permissions' then
    select household_id into v_left from public.household_members where id = new.member_id;
    select household_id into v_right from public.children where id = new.child_id;
  elsif tg_table_name = 'invitation_child_permissions' then
    select household_id into v_left from public.household_invitations where id = new.invitation_id;
    select household_id into v_right from public.children where id = new.child_id;
  elsif tg_table_name = 'help_request_recipients' then
    select household_id into v_left from public.help_requests where id = new.request_id;
    select household_id into v_right from public.household_members where id = new.member_id;
  elsif tg_table_name = 'child_care_notes' then
    select household_id into v_left from public.children where id = new.child_id;
    select household_id into v_right from public.household_members where id = new.updated_by;
  end if;
  if v_left is null or v_right is null or v_left <> v_right then
    raise exception 'cross-household relationship denied' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger permissions_same_household before insert or update on public.member_child_permissions
for each row execute function private.enforce_join_household();
create trigger invitation_permissions_same_household before insert or update on public.invitation_child_permissions
for each row execute function private.enforce_join_household();
create trigger help_recipients_same_household before insert or update on public.help_request_recipients
for each row execute function private.enforce_join_household();
create trigger child_notes_same_household before insert or update on public.child_care_notes
for each row execute function private.enforce_join_household();

revoke execute on function private.enforce_join_household() from public, anon, authenticated;

create or replace function private.grant_manager_child_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.member_child_permissions(
    member_id, child_id, can_view_profile, can_view_schedule,
    can_view_care_notes, can_participate_handoffs
  )
  select id, new.id, true, true, true, true
  from public.household_members
  where household_id = new.household_id
    and status = 'ACTIVE'
    and role in ('OWNER', 'PARENT_GUARDIAN')
  on conflict (member_id, child_id) do update set
    can_view_profile = true,
    can_view_schedule = true,
    can_view_care_notes = true,
    can_participate_handoffs = true;
  return new;
end $$;
create trigger grant_manager_child_permissions after insert on public.children
for each row execute function private.grant_manager_child_permissions();
revoke execute on function private.grant_manager_child_permissions() from public, anon, authenticated;

create policy avatar_update on storage.objects for update to authenticated
using (bucket_id = 'avatars' and exists(select 1 from public.household_members hm where hm.user_id = (select auth.uid()) and hm.status = 'ACTIVE' and hm.role in ('OWNER', 'PARENT_GUARDIAN') and (storage.foldername(name))[1] = hm.household_id::text))
with check (bucket_id = 'avatars' and exists(select 1 from public.household_members hm where hm.user_id = (select auth.uid()) and hm.status = 'ACTIVE' and hm.role in ('OWNER', 'PARENT_GUARDIAN') and (storage.foldername(name))[1] = hm.household_id::text));
create policy avatar_delete on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and exists(select 1 from public.household_members hm where hm.user_id = (select auth.uid()) and hm.status = 'ACTIVE' and hm.role in ('OWNER', 'PARENT_GUARDIAN') and (storage.foldername(name))[1] = hm.household_id::text));

create policy handoffs_sender_insert on public.handoffs for insert to authenticated
with check (
  from_member_id = private.current_member_id(household_id)
  and private.can_access_child(child_id, 'handoff')
  and exists(select 1 from public.household_members recipient where recipient.id = to_member_id and recipient.household_id = handoffs.household_id and recipient.status = 'ACTIVE')
);
create policy handoff_items_sender_insert on public.handoff_items for insert to authenticated
with check (exists(select 1 from public.handoffs h where h.id = handoff_id and h.from_member_id = private.current_member_id(h.household_id) and h.status = 'SCHEDULED'));
