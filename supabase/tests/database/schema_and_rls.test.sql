begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'households', 'households table exists');
select has_table('public', 'household_members', 'household members table exists');
select has_table('public', 'children', 'children table exists');
select has_table('public', 'child_care_notes', 'care notes table exists');
select has_table('public', 'member_child_permissions', 'member child permissions table exists');
select has_table('public', 'care_events', 'care events table exists');
select has_table('public', 'help_requests', 'help requests table exists');
select has_table('public', 'help_request_types', 'help request types table exists');
select has_table('public', 'help_request_recipients', 'help request recipients table exists');
select has_table('public', 'handoffs', 'handoffs table exists');
select has_table('public', 'handoff_items', 'handoff items table exists');
select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'notification_outbox', 'notification outbox table exists');

select has_function('public', 'accept_household_invitation', array['text']);
select has_function('public', 'create_help_request_with_event', array['uuid','uuid','uuid','text','timestamp with time zone','text','text','text','uuid[]']);
select has_function('public', 'accept_help_request', array['uuid']);
select has_function('public', 'acknowledge_handoff', array['uuid']);
select has_function('public', 'remove_household_member', array['uuid']);
select has_function('public', 'close_help_request', array['uuid','help_request_status']);

select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'children'), 'children has RLS');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'care_events'), 'care events have RLS');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'help_request_types'), 'help request types have RLS');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'handoffs'), 'handoffs have RLS');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'child_care_notes'), 'care notes have RLS');
select ok(not has_function_privilege('anon', 'public.accept_help_request(uuid)', 'execute'), 'anon cannot accept help requests');
select ok(not has_function_privilege('anon', 'public.acknowledge_handoff(uuid)', 'execute'), 'anon cannot acknowledge handoffs');
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'care_events_assignee_same_household_fk'
      and conrelid = 'public.care_events'::regclass
      and contype = 'f'
  ),
  'care event assignee is constrained to the event household'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'handoffs_receiver_same_household_fk'
      and conrelid = 'public.handoffs'::regclass
      and contype = 'f'
  ),
  'handoff receiver is constrained to the handoff household'
);

select * from finish();
rollback;
