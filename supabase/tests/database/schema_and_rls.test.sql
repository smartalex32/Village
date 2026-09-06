begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

select has_table('public', 'profiles');
select has_table('public', 'households');
select has_table('public', 'household_members');
select has_table('public', 'children');
select has_table('public', 'child_care_notes');
select has_table('public', 'member_child_permissions');
select has_table('public', 'care_events');
select has_table('public', 'help_requests');
select has_table('public', 'help_request_recipients');
select has_table('public', 'handoffs');
select has_table('public', 'handoff_items');
select has_table('public', 'notifications');
select has_table('public', 'notification_outbox');

select has_function('public', 'accept_household_invitation', array['text']);
select has_function('public', 'create_help_request_with_event', array['uuid','uuid','uuid','capability_type','timestamp with time zone','text','text','uuid[]']);
select has_function('public', 'accept_help_request', array['uuid']);
select has_function('public', 'acknowledge_handoff', array['uuid']);
select has_function('public', 'remove_household_member', array['uuid']);
select has_function('public', 'close_help_request', array['uuid','help_request_status']);

select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'children'), 'children has RLS');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'care_events'), 'care events have RLS');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'handoffs'), 'handoffs have RLS');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'child_care_notes'), 'care notes have RLS');
select ok(not has_function_privilege('anon', 'public.accept_help_request(uuid)', 'execute'), 'anon cannot accept help requests');
select ok(not has_function_privilege('anon', 'public.acknowledge_handoff(uuid)', 'execute'), 'anon cannot acknowledge handoffs');
select has_constraint('public', 'care_events', 'care_events_assignee_same_household_fk');
select has_constraint('public', 'handoffs', 'handoffs_receiver_same_household_fk');

select * from finish();
rollback;
