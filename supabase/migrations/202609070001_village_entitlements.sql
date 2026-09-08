create type public.village_plan_type as enum (
  'TRIAL',
  'MONTHLY',
  'ANNUAL',
  'LIFETIME_FOUNDING_1',
  'LIFETIME_FOUNDING_2'
);

create type public.village_entitlement_status as enum (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'GRACE_PERIOD',
  'EXPIRED',
  'LIFETIME',
  'CANCELLED'
);

create type public.billing_interval as enum ('MONTH', 'YEAR', 'LIFETIME');

-- This singleton contains commercial timing and inventory settings. It is safe
-- for clients to read, but only trusted server roles can change it.
create table public.billing_settings (
  id boolean primary key default true check (id),
  trial_days integer not null check (trial_days between 1 and 365),
  grace_days integer not null check (grace_days between 0 and 90),
  founding_total_limit integer not null check (founding_total_limit > 0),
  founding_offer_available boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.billing_settings(
  id, trial_days, grace_days, founding_total_limit, founding_offer_available
) values (true, 30, 7, 200, true);

-- Provider product and price identifiers are publishable catalog identifiers,
-- not credentials. Keeping them here lets prices change without an app release.
create table public.billing_catalog (
  plan_type public.village_plan_type primary key,
  billing_interval public.billing_interval,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider_name text,
  provider_product_id text,
  provider_price_id text,
  founding_quantity_limit integer,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  check (
    (plan_type = 'TRIAL' and billing_interval is null and amount_minor = 0
      and provider_name is null and provider_product_id is null
      and provider_price_id is null and founding_quantity_limit is null)
    or
    (plan_type in ('MONTHLY', 'ANNUAL') and billing_interval is not null
      and amount_minor > 0 and provider_name is not null
      and provider_product_id is not null and provider_price_id is not null
      and founding_quantity_limit is null)
    or
    (plan_type in ('LIFETIME_FOUNDING_1', 'LIFETIME_FOUNDING_2')
      and billing_interval = 'LIFETIME' and amount_minor > 0
      and provider_name is not null and provider_product_id is not null
      and provider_price_id is not null and founding_quantity_limit > 0)
  ),
  check (
    (plan_type = 'MONTHLY' and billing_interval = 'MONTH')
    or (plan_type = 'ANNUAL' and billing_interval = 'YEAR')
    or plan_type not in ('MONTHLY', 'ANNUAL')
  ),
  check (provider_name is null or btrim(provider_name) <> ''),
  check (provider_product_id is null or btrim(provider_product_id) <> ''),
  check (provider_price_id is null or btrim(provider_price_id) <> '')
);

insert into public.billing_catalog(
  plan_type, billing_interval, amount_minor, currency, provider_name,
  provider_product_id, provider_price_id, founding_quantity_limit
) values
  ('TRIAL', null, 0, 'USD', null, null, null, null),
  ('MONTHLY', 'MONTH', 299, 'USD', 'UNCONFIGURED', 'UNCONFIGURED', 'UNCONFIGURED', null),
  ('ANNUAL', 'YEAR', 2999, 'USD', 'UNCONFIGURED', 'UNCONFIGURED', 'UNCONFIGURED', null),
  ('LIFETIME_FOUNDING_1', 'LIFETIME', 5900, 'USD', 'UNCONFIGURED', 'UNCONFIGURED', 'UNCONFIGURED', 50),
  ('LIFETIME_FOUNDING_2', 'LIFETIME', 7900, 'USD', 'UNCONFIGURED', 'UNCONFIGURED', 'UNCONFIGURED', 150);

create table public.village_entitlements (
  household_id uuid primary key references public.households(id) on delete cascade,
  plan_type public.village_plan_type not null,
  lifecycle_status public.village_entitlement_status not null,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  paid_period_started_at timestamptz,
  paid_period_ends_at timestamptz,
  cancelled_at timestamptz,
  effective_ends_at timestamptz,
  grace_expires_at timestamptz,
  provider_name text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_product_id text,
  provider_price_id text,
  founding_cohort integer,
  founding_allocation_number integer,
  founding_purchased_at timestamptz,
  last_provider_event_id text,
  last_provider_event_created_at timestamptz,
  provider_state_updated_at timestamptz,
  last_reconciled_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trial_ends_at is null or (trial_started_at is not null and trial_ends_at > trial_started_at)),
  check (paid_period_ends_at is null or (paid_period_started_at is not null and paid_period_ends_at > paid_period_started_at)),
  check (effective_ends_at is null or effective_ends_at >= coalesce(cancelled_at, '-infinity'::timestamptz)),
  check (grace_expires_at is null or grace_expires_at > coalesce(paid_period_ends_at, '-infinity'::timestamptz)),
  check (provider_name is null or btrim(provider_name) <> ''),
  check (provider_customer_id is null or btrim(provider_customer_id) <> ''),
  check (provider_subscription_id is null or btrim(provider_subscription_id) <> ''),
  check (provider_product_id is null or btrim(provider_product_id) <> ''),
  check (provider_price_id is null or btrim(provider_price_id) <> ''),
  check (last_provider_event_id is null or btrim(last_provider_event_id) <> ''),
  check (
    (plan_type = 'TRIAL' and lifecycle_status in ('TRIALING', 'EXPIRED', 'CANCELLED')
      and trial_started_at is not null and trial_ends_at is not null)
    or
    (plan_type in ('MONTHLY', 'ANNUAL')
      and lifecycle_status in ('ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELLED')
      and paid_period_started_at is not null and paid_period_ends_at is not null
      and provider_name is not null and provider_product_id is not null
      and provider_price_id is not null)
    or
    (plan_type in ('LIFETIME_FOUNDING_1', 'LIFETIME_FOUNDING_2')
      and lifecycle_status in ('LIFETIME', 'EXPIRED', 'CANCELLED')
      and provider_name is not null and provider_product_id is not null
      and provider_price_id is not null and founding_purchased_at is not null
      and founding_allocation_number is not null)
  ),
  check (
    (plan_type = 'LIFETIME_FOUNDING_1' and founding_cohort = 1)
    or (plan_type = 'LIFETIME_FOUNDING_2' and founding_cohort = 2)
    or (plan_type not in ('LIFETIME_FOUNDING_1', 'LIFETIME_FOUNDING_2')
      and founding_cohort is null and founding_allocation_number is null
      and founding_purchased_at is null)
  )
);

create unique index village_entitlements_provider_subscription_idx
  on public.village_entitlements(provider_name, provider_subscription_id)
  where provider_subscription_id is not null;
create unique index village_entitlements_founding_allocation_idx
  on public.village_entitlements(founding_allocation_number)
  where founding_allocation_number is not null;

create table public.village_entitlement_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  entitlement_version bigint not null check (entitlement_version > 0),
  event_type text not null check (btrim(event_type) <> ''),
  provider_name text,
  provider_event_id text,
  provider_event_created_at timestamptz,
  previous_plan_type public.village_plan_type,
  plan_type public.village_plan_type not null,
  previous_lifecycle_status public.village_entitlement_status,
  lifecycle_status public.village_entitlement_status not null,
  effective_at timestamptz not null default now(),
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data) = 'object'),
  recorded_at timestamptz not null default now(),
  check (provider_name is null or btrim(provider_name) <> ''),
  check (provider_event_id is null or btrim(provider_event_id) <> '')
);

create index village_entitlement_events_household_recorded_idx
  on public.village_entitlement_events(household_id, recorded_at desc);
create unique index village_entitlement_events_provider_event_idx
  on public.village_entitlement_events(provider_name, provider_event_id)
  where provider_event_id is not null;

create or replace function private.touch_billing_configuration()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger touch_billing_settings before update on public.billing_settings
for each row execute function private.touch_billing_configuration();
create trigger touch_billing_catalog before update on public.billing_catalog
for each row execute function private.touch_billing_configuration();

create or replace function private.touch_village_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  return new;
end $$;

create trigger touch_village_entitlement before update on public.village_entitlements
for each row execute function private.touch_village_entitlement();

create or replace function private.record_village_entitlement_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.village_entitlement_events(
    household_id,
    entitlement_version,
    event_type,
    provider_name,
    provider_event_id,
    provider_event_created_at,
    previous_plan_type,
    plan_type,
    previous_lifecycle_status,
    lifecycle_status,
    effective_at
  ) values (
    new.household_id,
    new.version,
    case when tg_op = 'INSERT' then 'ENTITLEMENT_CREATED' else 'ENTITLEMENT_UPDATED' end,
    new.provider_name,
    new.last_provider_event_id,
    new.last_provider_event_created_at,
    case when tg_op = 'UPDATE' then old.plan_type else null end,
    new.plan_type,
    case when tg_op = 'UPDATE' then old.lifecycle_status else null end,
    new.lifecycle_status,
    coalesce(new.provider_state_updated_at, now())
  ) on conflict (provider_name, provider_event_id) where provider_event_id is not null do nothing;
  return new;
end $$;

create trigger record_village_entitlement_event
after insert or update on public.village_entitlements
for each row execute function private.record_village_entitlement_event();

revoke execute on function private.touch_billing_configuration() from public, anon, authenticated;
revoke execute on function private.touch_village_entitlement() from public, anon, authenticated;
revoke execute on function private.record_village_entitlement_event() from public, anon, authenticated;

create or replace function public.is_village_entitled(
  p_household_id uuid,
  p_at timestamptz default now()
) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when ve.lifecycle_status = 'LIFETIME'
        then p_at >= ve.founding_purchased_at
      when ve.lifecycle_status = 'TRIALING'
        then p_at >= ve.trial_started_at and p_at < ve.trial_ends_at
      when ve.lifecycle_status in ('ACTIVE', 'PAST_DUE')
        then p_at >= ve.paid_period_started_at and p_at < ve.paid_period_ends_at
      when ve.lifecycle_status = 'GRACE_PERIOD'
        then p_at >= ve.paid_period_ends_at and p_at < ve.grace_expires_at
      when ve.lifecycle_status = 'CANCELLED'
        then p_at >= coalesce(ve.paid_period_started_at, ve.trial_started_at)
          and p_at < ve.effective_ends_at
      else false
    end
    from public.village_entitlements ve
    where ve.household_id = p_household_id
  ), false)
$$;

create or replace function public.get_village_entitlement_summary(
  p_household_id uuid,
  p_at timestamptz default now()
) returns table (
  household_id uuid,
  plan_type public.village_plan_type,
  lifecycle_status public.village_entitlement_status,
  is_entitled boolean,
  access_expires_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_member(p_household_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    ve.household_id,
    ve.plan_type,
    ve.lifecycle_status,
    public.is_village_entitled(ve.household_id, p_at),
    case
      when ve.lifecycle_status = 'TRIALING' then ve.trial_ends_at
      when ve.lifecycle_status in ('ACTIVE', 'PAST_DUE') then ve.paid_period_ends_at
      when ve.lifecycle_status = 'GRACE_PERIOD' then ve.grace_expires_at
      when ve.lifecycle_status = 'CANCELLED' then ve.effective_ends_at
      else null
    end
  from public.village_entitlements ve
  where ve.household_id = p_household_id;
end $$;

create or replace function private.backfill_village_entitlements(
  p_as_of timestamptz default now()
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.village_entitlements(
    household_id, plan_type, lifecycle_status, trial_started_at, trial_ends_at
  )
  select
    h.id,
    'TRIAL'::public.village_plan_type,
    case
      when h.created_at + make_interval(days => bs.trial_days) > p_as_of
        then 'TRIALING'::public.village_entitlement_status
      else 'EXPIRED'::public.village_entitlement_status
    end,
    h.created_at,
    h.created_at + make_interval(days => bs.trial_days)
  from public.households h
  cross join public.billing_settings bs
  where bs.id = true
  on conflict (household_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

select private.backfill_village_entitlements(now());

create or replace function public.create_household(p_name text, p_timezone text, p_child_first_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_member uuid;
  v_trial_days integer;
  v_trial_started_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;

  select trial_days into strict v_trial_days
  from public.billing_settings
  where id = true;

  insert into public.households(name, owner_user_id, timezone)
  values (trim(p_name), auth.uid(), p_timezone)
  returning id into v_household;

  insert into public.household_members(household_id, user_id, role, relationship_label)
  values (v_household, auth.uid(), 'OWNER', 'Parent')
  returning id into v_member;

  insert into public.village_entitlements(
    household_id, plan_type, lifecycle_status, trial_started_at, trial_ends_at
  ) values (
    v_household,
    'TRIAL',
    'TRIALING',
    v_trial_started_at,
    v_trial_started_at + make_interval(days => v_trial_days)
  );

  insert into public.children(household_id, first_name)
  values (v_household, trim(p_child_first_name));

  return v_household;
end $$;

alter table public.billing_settings enable row level security;
alter table public.billing_catalog enable row level security;
alter table public.village_entitlements enable row level security;
alter table public.village_entitlement_events enable row level security;

create policy billing_settings_client_select on public.billing_settings
for select to anon, authenticated using (true);
create policy billing_catalog_client_select on public.billing_catalog
for select to anon, authenticated using (true);

revoke all on table public.billing_settings from public, anon, authenticated;
revoke all on table public.billing_catalog from public, anon, authenticated;
revoke all on table public.village_entitlements from public, anon, authenticated;
revoke all on table public.village_entitlement_events from public, anon, authenticated;
grant select on table public.billing_settings to anon, authenticated;
grant select on table public.billing_catalog to anon, authenticated;
grant all on table public.billing_settings to service_role;
grant all on table public.billing_catalog to service_role;
grant all on table public.village_entitlements to service_role;
grant all on table public.village_entitlement_events to service_role;

revoke execute on function public.is_village_entitled(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.is_village_entitled(uuid, timestamptz) to service_role;
revoke execute on function public.get_village_entitlement_summary(uuid, timestamptz) from public, anon;
grant execute on function public.get_village_entitlement_summary(uuid, timestamptz) to authenticated;
revoke execute on function private.backfill_village_entitlements(timestamptz) from public, anon, authenticated;
