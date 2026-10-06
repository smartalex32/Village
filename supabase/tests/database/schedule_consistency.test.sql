begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users(id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000001', 'schedule-owner@example.test', '{"display_name":"Schedule Owner"}');
insert into public.households(id, name, owner_user_id, timezone)
values ('70000000-0000-0000-0000-000000000010', 'Schedule Test', '70000000-0000-0000-0000-000000000001', 'America/Chicago');
insert into public.household_members(id, household_id, user_id, role)
values ('70000000-0000-0000-0000-000000000020', '70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000001', 'OWNER');
insert into public.children(id, household_id, first_name) values
('70000000-0000-0000-0000-000000000030', '70000000-0000-0000-0000-000000000010', 'First'),
('70000000-0000-0000-0000-000000000031', '70000000-0000-0000-0000-000000000010', 'Second');
insert into public.care_events(id, household_id, child_id, event_type, title, starts_at, ends_at, location, requires_caregiver, created_by)
select id, '70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000030',
       'BABYSITTING', 'Care', '2026-10-05T18:00:00Z', '2026-10-05T22:00:00Z', 'Home', true,
       '70000000-0000-0000-0000-000000000020'
from unnest(array[
  '70000000-0000-0000-0000-000000000040'::uuid,
  '70000000-0000-0000-0000-000000000041'::uuid,
  '70000000-0000-0000-0000-000000000042'::uuid
]) id;
insert into public.help_requests(id, household_id, child_id, event_id, request_type, request_type_label, starts_at, location, created_by, status)
values
('70000000-0000-0000-0000-000000000050', '70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000030', '70000000-0000-0000-0000-000000000040', 'BABYSITTING', 'Babysitting', '2026-10-05T18:00:00Z', 'Home', '70000000-0000-0000-0000-000000000020', 'OPEN'),
('70000000-0000-0000-0000-000000000051', '70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000030', '70000000-0000-0000-0000-000000000041', 'BABYSITTING', 'Babysitting', '2026-10-05T18:00:00Z', 'Home', '70000000-0000-0000-0000-000000000020', 'ASSIGNED'),
('70000000-0000-0000-0000-000000000052', '70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000030', '70000000-0000-0000-0000-000000000042', 'BABYSITTING', 'Babysitting', '2026-10-05T18:00:00Z', 'Home', '70000000-0000-0000-0000-000000000020', 'COMPLETED');

select ok(not has_function_privilege('anon', 'public.update_care_event(uuid,jsonb)', 'execute'), 'anonymous callers cannot edit care');
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok($$select * from public.care_events$$, 'authenticated schedule hydration can execute its RLS helpers');
select lives_ok($$select * from public.help_requests$$, 'authenticated request hydration works without recursive policies');
select lives_ok($$select public.update_care_event('70000000-0000-0000-0000-000000000040', '{"starts_at":"2026-10-05T19:00:00Z","location":"School"}')$$, 'an authenticated manager can edit the linked schedule atomically');
select throws_ok($$select public.update_care_event('70000000-0000-0000-0000-000000000040', '{"household_id":"70000000-0000-0000-0000-000000000010"}')$$, '22023', 'unsupported event change', 'the edit function cannot move records between households');
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000099', true);
select throws_ok($$select public.update_care_event('70000000-0000-0000-0000-000000000040', '{"location":"Other"}')$$, '42501', 'not authorized', 'nonmembers cannot edit another household schedule');
reset role;

update public.care_events set starts_at = '2026-10-05T19:00:00Z', location = 'School'
where household_id = '70000000-0000-0000-0000-000000000010';
select is((select starts_at from public.help_requests where id = '70000000-0000-0000-0000-000000000050'), '2026-10-05T19:00:00Z'::timestamptz, 'editing an event updates its open request time');
select is((select location from public.help_requests where id = '70000000-0000-0000-0000-000000000050'), 'School', 'editing an event updates its open request location');
select is((select starts_at from public.help_requests where id = '70000000-0000-0000-0000-000000000051'), '2026-10-05T19:00:00Z'::timestamptz, 'accepted requests retain the edited event time');
select is((select starts_at from public.help_requests where id = '70000000-0000-0000-0000-000000000052'), '2026-10-05T18:00:00Z'::timestamptz, 'completed request history is preserved');
select throws_ok($$update public.care_events set child_id = '70000000-0000-0000-0000-000000000031' where id = '70000000-0000-0000-0000-000000000040'$$, '22023', 'cancel the active help request before changing the child', 'existing recipients cannot be moved to a different child');
select throws_ok($$update public.care_events set assigned_member_id = '70000000-0000-0000-0000-000000000020' where id = '70000000-0000-0000-0000-000000000040'$$, '22023', 'manage the caregiver through the active help request', 'an open request cannot be bypassed by assigning its event');
select throws_ok($$update public.care_events set assigned_member_id = '70000000-0000-0000-0000-000000000020' where id = '70000000-0000-0000-0000-000000000041'$$, '22023', 'manage the caregiver through the active help request', 'an accepted request cannot silently lose its caregiver');
update public.care_events set status = 'CANCELLED' where id = '70000000-0000-0000-0000-000000000041';
select is((select status::text from public.help_requests where id = '70000000-0000-0000-0000-000000000051'), 'CANCELLED', 'cancelling care closes the accepted request');
select ok((select cancelled_at is not null from public.help_requests where id = '70000000-0000-0000-0000-000000000051'), 'cancellation records its timestamp');
update public.care_events set status = 'COMPLETED' where id = '70000000-0000-0000-0000-000000000040';
select is((select status::text from public.help_requests where id = '70000000-0000-0000-0000-000000000050'), 'COMPLETED', 'marking care complete resolves the open request');
select ok((select completed_at is not null from public.help_requests where id = '70000000-0000-0000-0000-000000000050'), 'completion records its timestamp');
update public.care_events set ends_at = null where id = '70000000-0000-0000-0000-000000000040';
select ok((select ends_at is null from public.care_events where id = '70000000-0000-0000-0000-000000000040'), 'the optional end time can be cleared');

select * from finish();
rollback;
