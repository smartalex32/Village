begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

create function pg_temp.statement_fails(p_sql text, p_expected_state text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return sqlstate = p_expected_state;
end $$;

select has_table('public', 'billing_settings', 'billing settings table exists');
select has_table('public', 'billing_catalog', 'billing catalog table exists');
select has_table('public', 'village_entitlements', 'Village entitlements table exists');
select has_table('public', 'village_entitlement_events', 'entitlement event history exists');
select ok(to_regtype('public.village_plan_type') is not null, 'plan type enum exists');
select ok(to_regtype('public.village_entitlement_status') is not null, 'lifecycle status enum exists');
select ok(to_regtype('public.billing_interval') is not null, 'billing interval enum exists');
select has_function('public', 'is_village_entitled', array['uuid', 'timestamp with time zone']);
select has_function('public', 'get_village_entitlement_summary', array['uuid', 'timestamp with time zone']);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.billing_settings'::regclass),
  'billing settings have RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.billing_catalog'::regclass),
  'billing catalog has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.village_entitlements'::regclass),
  'entitlement snapshots have RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.village_entitlement_events'::regclass),
  'entitlement history has RLS'
);
select ok(has_table_privilege('authenticated', 'public.billing_catalog', 'select'), 'members can read the safe catalog');
select ok(not has_table_privilege('authenticated', 'public.billing_catalog', 'update'), 'members cannot change the catalog');
select ok(not has_table_privilege('authenticated', 'public.billing_settings', 'update'), 'members cannot change billing settings');
select ok(not has_table_privilege('authenticated', 'public.village_entitlements', 'select'), 'members cannot read billing identifiers');
select ok(not has_table_privilege('authenticated', 'public.village_entitlement_events', 'select'), 'members cannot read provider history');
select ok(has_function_privilege('authenticated', 'public.get_village_entitlement_summary(uuid,timestamptz)', 'execute'), 'members can request a safe summary');
select ok(not has_function_privilege('authenticated', 'public.is_village_entitled(uuid,timestamptz)', 'execute'), 'raw evaluator is server-only');

select is((select amount_minor from public.billing_catalog where plan_type = 'MONTHLY'), 299, 'monthly price is configured in minor units');
select is((select amount_minor from public.billing_catalog where plan_type = 'ANNUAL'), 2999, 'annual price is configured in minor units');
select ok(
  (select trial_days = 30 and grace_days = 7 from public.billing_settings where id),
  'trial and grace durations are configurable'
);
select ok(
  (select founding_total_limit = 200 from public.billing_settings where id)
    and (select sum(founding_quantity_limit) = 200 from public.billing_catalog where founding_quantity_limit is not null),
  'founding inventory is configured as 50 plus 150'
);
select ok(
  pg_temp.statement_fails(
    'update public.billing_settings set trial_days = 0 where id = true',
    '23514'
  ),
  'billing timing validation rejects invalid values'
);
select ok(
  pg_temp.statement_fails(
    $$update public.billing_catalog
      set billing_interval = 'YEAR', amount_minor = -1, currency = 'usd'
      where plan_type = 'MONTHLY'$$,
    '23514'
  ),
  'catalog validation rejects invalid commercial values'
);

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'owner-entitlement@example.test', '', now(),
  '{}'::jsonb, '{"display_name":"Entitlement Owner"}'::jsonb, now(), now()
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.create_household('Entitlement Test Village', 'UTC', 'Test Child')$$,
  'household creation atomically provisions a trial'
);
reset role;

select is(
  (
    select count(*)
    from public.households h
    join public.household_members hm on hm.household_id = h.id and hm.role = 'OWNER'
    join public.village_entitlements ve on ve.household_id = h.id
    where h.name = 'Entitlement Test Village'
  ),
  1::bigint,
  'new Village has one owner and one entitlement'
);
select ok(
  (
    select lifecycle_status = 'TRIALING'
      and trial_ends_at = trial_started_at + interval '30 days'
    from public.village_entitlements
    where household_id = (select id from public.households where name = 'Entitlement Test Village')
  ),
  'new Village receives a full 30-day trial'
);
select is(
  (
    select count(*)
    from public.village_entitlement_events
    where household_id = (select id from public.households where name = 'Entitlement Test Village')
      and event_type = 'ENTITLEMENT_CREATED'
  ),
  1::bigint,
  'trial provisioning writes audit history'
);

select set_config(
  'test.village_id',
  (select id::text from public.households where name = 'Entitlement Test Village'),
  true
);
set local role authenticated;
select ok(
  (
    select is_entitled and plan_type = 'TRIAL' and lifecycle_status = 'TRIALING'
    from public.get_village_entitlement_summary(
      current_setting('test.village_id')::uuid,
      now()
    )
  ),
  'owner receives only the entitled summary'
);
reset role;

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'caregiver-entitlement@example.test', '', now(),
  '{}'::jsonb, '{"display_name":"Free Caregiver"}'::jsonb, now(), now()
);
insert into public.household_members(household_id, user_id, role, relationship_label)
select id, '10000000-0000-0000-0000-000000000002', 'TRUSTED_CAREGIVER', 'Caregiver'
from public.households where name = 'Entitlement Test Village';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select ok(
  (
    select is_entitled
    from public.get_village_entitlement_summary(
      current_setting('test.village_id')::uuid,
      now()
    )
  ),
  'a caregiver receives the Village entitlement without personal billing state'
);
select ok(
  pg_temp.statement_fails(
    $$select * from public.get_village_entitlement_summary(
      '00000000-0000-0000-0000-000000000099', now()
    )$$,
    '42501'
  ),
  'membership authorization is enforced independently'
);
reset role;

select ok(
  public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'),
    now() + interval '29 days'
  )
  and not public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'),
    now() + interval '31 days'
  ),
  'trial entitlement is bounded by its time window'
);

update public.village_entitlements
set plan_type = 'MONTHLY',
    lifecycle_status = 'ACTIVE',
    paid_period_started_at = now() - interval '1 day',
    paid_period_ends_at = now() + interval '29 days',
    provider_name = 'test-provider',
    provider_customer_id = 'customer-1',
    provider_subscription_id = 'subscription-1',
    provider_product_id = 'product-monthly',
    provider_price_id = 'price-original'
where household_id = (select id from public.households where name = 'Entitlement Test Village');
select ok(
  public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'), now()
  ),
  'active paid period is entitled'
);

update public.village_entitlements
set lifecycle_status = 'PAST_DUE'
where household_id = (select id from public.households where name = 'Entitlement Test Village');
select ok(
  public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'), now()
  ),
  'past-due status retains access through the paid period'
);

update public.village_entitlements
set lifecycle_status = 'CANCELLED',
    cancelled_at = now(),
    effective_ends_at = now() + interval '29 days'
where household_id = (select id from public.households where name = 'Entitlement Test Village');
select ok(
  public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'),
    now() + interval '28 days'
  )
  and not public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'),
    now() + interval '30 days'
  ),
  'cancelled access ends at its effective boundary'
);

update public.village_entitlements
set lifecycle_status = 'GRACE_PERIOD',
    grace_expires_at = now() + interval '36 days'
where household_id = (select id from public.households where name = 'Entitlement Test Village');
select ok(
  public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'),
    now() + interval '35 days'
  )
  and not public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'),
    now() + interval '37 days'
  ),
  'grace period entitlement expires at the configured boundary'
);

update public.village_entitlements
set plan_type = 'LIFETIME_FOUNDING_1',
    lifecycle_status = 'LIFETIME',
    provider_subscription_id = null,
    provider_product_id = 'product-founding',
    provider_price_id = 'price-founding-original',
    founding_cohort = 1,
    founding_allocation_number = 1,
    founding_purchased_at = now()
where household_id = (select id from public.households where name = 'Entitlement Test Village');
select ok(
  public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'),
    now() + interval '100 years'
  )
  and not public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'),
    now() - interval '1 day'
  ),
  'lifetime entitlement does not expire with time'
);

update public.village_entitlements
set lifecycle_status = 'EXPIRED'
where household_id = (select id from public.households where name = 'Entitlement Test Village');
select ok(
  not public.is_village_entitled(
    (select id from public.households where name = 'Entitlement Test Village'), now()
  ),
  'expired lifecycle state is not entitled'
);
select is(
  (
    select count(*) from public.children
    where household_id = (select id from public.households where name = 'Entitlement Test Village')
  ),
  1::bigint,
  'expiration never deletes Village data'
);
select ok(
  (
    select count(*) >= 5
    from public.village_entitlement_events
    where household_id = (select id from public.households where name = 'Entitlement Test Village')
  ),
  'state transitions append entitlement history'
);

update public.billing_catalog
set provider_price_id = 'price-founding-new'
where plan_type = 'LIFETIME_FOUNDING_1';
select is(
  (
    select provider_price_id from public.village_entitlements
    where household_id = (select id from public.households where name = 'Entitlement Test Village')
  ),
  'price-founding-original',
  'catalog changes do not rewrite the purchased provider price identifier'
);

select ok(
  pg_temp.statement_fails(
    format(
      $$insert into public.village_entitlements(
        household_id, plan_type, lifecycle_status, trial_started_at, trial_ends_at
      ) values (%L, 'TRIAL', 'TRIALING', now(), now() + interval '30 days')$$,
      (select id from public.households where name = 'Entitlement Test Village')
    ),
    '23505'
  ),
  'one authoritative entitlement is allowed per Village'
);

create function pg_temp.reject_test_entitlement()
returns trigger language plpgsql as $$
begin
  if exists(
    select 1 from public.households
    where id = new.household_id and name = 'Must Roll Back Village'
  ) then
    raise exception 'test entitlement failure' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger reject_test_entitlement
before insert on public.village_entitlements
for each row execute function pg_temp.reject_test_entitlement();

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select ok(
  pg_temp.statement_fails(
    $$select public.create_household('Must Roll Back Village', 'UTC', 'No Child')$$,
    '23514'
  ),
  'an entitlement provisioning failure aborts household creation'
);
reset role;
drop trigger reject_test_entitlement on public.village_entitlements;
select is(
  (select count(*) from public.households where name = 'Must Roll Back Village'),
  0::bigint,
  'failed entitlement provisioning leaves no household behind'
);

insert into public.households(id, name, owner_user_id, timezone, created_at)
values (
  '20000000-0000-0000-0000-000000000001',
  'Existing Village',
  '10000000-0000-0000-0000-000000000001',
  'UTC',
  '2020-01-01 00:00:00+00'
);
select is(
  private.backfill_village_entitlements('2026-09-07 00:00:00+00'),
  1,
  'backfill inserts only the missing entitlement'
);
select ok(
  (
    select lifecycle_status = 'EXPIRED'
      and trial_started_at = '2020-01-01 00:00:00+00'
      and trial_ends_at = '2020-01-31 00:00:00+00'
    from public.village_entitlements
    where household_id = '20000000-0000-0000-0000-000000000001'
  ),
  'existing Village trial is anchored to original creation and is not restarted'
);
select is(
  private.backfill_village_entitlements('2026-09-08 00:00:00+00'),
  0,
  'backfill is safe to rerun'
);

select * from finish();
rollback;
