begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create function pg_temp.statement_fails(p_sql text, p_expected_state text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then return sqlstate = p_expected_state;
end $$;

insert into auth.users(id, email, raw_user_meta_data)
select ('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'recovery-' || i || '@example.test', jsonb_build_object('display_name', 'Recovery ' || i)
from generate_series(1, 7) i;
insert into public.households(id, name, owner_user_id, timezone) values
  ('30000000-0000-0000-0000-000000000001', 'Recovery test', '10000000-0000-0000-0000-000000000001', 'UTC'),
  ('30000000-0000-0000-0000-000000000002', 'Other recovery village', '10000000-0000-0000-0000-000000000007', 'UTC');
insert into public.household_members(id, household_id, user_id, role, relationship_label)
select ('20000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  '30000000-0000-0000-0000-000000000001',
  ('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  case when i = 1 then 'OWNER' when i = 2 then 'PARENT_GUARDIAN' else 'TRUSTED_CAREGIVER' end::public.member_role,
  'Caregiver' from generate_series(1, 6) i;
insert into public.household_members(id, household_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 'OWNER');
insert into public.children(id, household_id, first_name) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Test Child');
insert into public.member_child_permissions(member_id, child_id, can_view_profile, can_view_schedule)
select ('20000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  '40000000-0000-0000-0000-000000000001', true, true from generate_series(3, 6) i;
insert into public.member_capabilities(member_id, capability)
select ('20000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'PICKUP' from generate_series(3, 5) i;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok($$select public.create_help_request_with_event(
  '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001', 'PICKUP', now() + interval '1 day',
  'Test location', null, null, array['20000000-0000-0000-0000-000000000003']::uuid[])$$, 'create one care responsibility');
select is((select count(*) from public.help_request_recipients), 1::bigint, 'manager can hydrate recipient replies');
reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is((select count(*) from public.help_request_recipients), 1::bigint, 'recipient can read response states');
select lives_ok($$select public.respond_to_help_request('60000000-0000-0000-0000-000000000001', false)$$, 'recipient declines');
select lives_ok($$select public.respond_to_help_request('60000000-0000-0000-0000-000000000001', false)$$, 'decline retry succeeds');
select ok(pg_temp.statement_fails($$select public.accept_help_request('60000000-0000-0000-0000-000000000001')$$, '42501'), 'declined recipient cannot later accept');
select ok(pg_temp.statement_fails($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000004']::uuid[], '70000000-0000-0000-0000-000000000001')$$, '42501'), 'recipient cannot invite additional caregivers');
reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
set local role authenticated;
select is((select count(*) from public.help_requests), 0::bigint, 'nonparticipant caregiver cannot see request');
select is((select count(*) from public.help_request_recipients), 0::bigint, 'nonparticipant cannot see responses');
reset role;

-- Existing responsibilities can recover after their help type is archived.
update public.help_request_types set archived_at = now() where household_id = '30000000-0000-0000-0000-000000000001' and id = 'PICKUP';
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select lives_ok($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000004']::uuid[], '70000000-0000-0000-0000-000000000001')$$, 'manager adds eligible caregivers for archived type');
select lives_ok($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000004']::uuid[], '70000000-0000-0000-0000-000000000001')$$, 'retry canonicalizes duplicate and reordered input');
select lives_ok($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000004']::uuid[], '70000000-0000-0000-0000-000000000002')$$, 'adding an existing recipient is harmless');
select is((select count(*) from public.help_requests), 1::bigint, 'recovery keeps one request');
select is((select count(*) from public.care_events), 1::bigint, 'recovery keeps one care event');
select is((select count(*) from public.help_request_recipients), 3::bigint, 'recipient rows are unique');
select is((select response::text from public.help_request_recipients where member_id = '20000000-0000-0000-0000-000000000003'), 'DECLINED', 'recovery keeps original decline');
select ok(pg_temp.statement_fails($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000005']::uuid[], '70000000-0000-0000-0000-000000000001')$$, '23505'), 'operation key cannot be reused with another payload');
select ok(pg_temp.statement_fails($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000006']::uuid[], '70000000-0000-0000-0000-000000000003')$$, '42501'), 'missing capability is rejected');
select ok(pg_temp.statement_fails($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000007']::uuid[], '70000000-0000-0000-0000-000000000004')$$, '42501'), 'cross-household recipient is rejected');
select ok(pg_temp.statement_fails($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array[]::uuid[], '70000000-0000-0000-0000-000000000005')$$, '22023'), 'empty recipient list is rejected');
reset role;
select is((select count(*) from public.notifications where type = 'HELP_REQUEST'), 3::bigint, 'retries notify each recipient exactly once');
select is((select count(*) from public.notification_outbox), 3::bigint, 'notification delivery jobs are unique');
select is((select count(*) from private.help_request_recipient_additions), 2::bigint, 'failed operations leave no ledger entry');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select lives_ok($$select public.accept_help_request('60000000-0000-0000-0000-000000000001')$$, 'new caregiver wins coverage');
select lives_ok($$select public.accept_help_request('60000000-0000-0000-0000-000000000001')$$, 'winning acceptance retry succeeds');
select is((select response::text from public.help_request_recipients where member_id = '20000000-0000-0000-0000-000000000005'), 'PENDING', 'nonresponders are not marked declined');
select is((select response::text from public.help_request_recipients where member_id = '20000000-0000-0000-0000-000000000003'), 'DECLINED', 'actual decline remains recorded');
reset role;
select is((select assigned_member_id::text from public.care_events), '20000000-0000-0000-0000-000000000004', 'winner owns original event');
select is((select count(*) from public.notifications where type = 'HELP_ACCEPTED'), 3::bigint, 'acceptance retry does not duplicate notifications');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select ok(pg_temp.statement_fails($$select public.accept_help_request('60000000-0000-0000-0000-000000000001')$$, 'P0001'), 'second acceptance cannot replace winner');
select ok(pg_temp.statement_fails($$select public.respond_to_help_request('60000000-0000-0000-0000-000000000001', false)$$, 'P0001'), 'late decline cannot change a closed response window');
reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select lives_ok($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000005']::uuid[], '70000000-0000-0000-0000-000000000001')$$, 'successful addition retry works after acceptance');
select ok(pg_temp.statement_fails($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000006']::uuid[], '70000000-0000-0000-0000-000000000006')$$, 'P0001'), 'assigned requests reject new additions');
select lives_ok($$select public.close_help_request('60000000-0000-0000-0000-000000000001', 'COMPLETED')$$, 'manager completes covered care');
select ok(pg_temp.statement_fails($$select public.add_help_request_recipients('60000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000006']::uuid[], '70000000-0000-0000-0000-000000000007')$$, 'P0001'), 'completed requests reject additions');
reset role;
select ok(not has_function_privilege('anon', 'public.add_help_request_recipients(uuid,uuid[],uuid)', 'execute'), 'anonymous addition is forbidden');
select ok(not has_table_privilege('authenticated', 'private.help_request_recipient_additions', 'select'), 'operation ledger stays private');

-- Removing a winner reopens future care; completed history remains intact.
update public.help_request_types set archived_at = null where household_id = '30000000-0000-0000-0000-000000000001' and id = 'PICKUP';
set local role authenticated;
select public.create_help_request_with_event('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'PICKUP', now() + interval '2 days', 'Test location', null, null, array['20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000005']::uuid[]);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select public.accept_help_request('60000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select lives_ok($$select public.remove_household_member('20000000-0000-0000-0000-000000000004')$$, 'manager can remove an assigned caregiver');
select is((select status::text from public.help_requests where id = '60000000-0000-0000-0000-000000000002'), 'OPEN', 'future responsibility reopens for coverage');
select ok((select assigned_member_id is null from public.care_events where id = '50000000-0000-0000-0000-000000000002'), 'future event is unassigned');
select is((select count(*) from public.help_request_recipients where request_id = '60000000-0000-0000-0000-000000000002'), 1::bigint, 'removed member no longer receives active requests');
select is((select status::text from public.help_requests where id = '60000000-0000-0000-0000-000000000001'), 'COMPLETED', 'completed responsibility history is preserved');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select lives_ok($$select public.accept_help_request('60000000-0000-0000-0000-000000000002')$$, 'remaining pending caregiver can cover the same responsibility');
reset role;
select * from finish();
rollback;
