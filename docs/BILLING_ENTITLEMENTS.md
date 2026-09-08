# Village entitlement foundation

Village's core paid capability belongs to a household, not to a user. A user may
therefore participate in any number of entitled Villages without having personal
billing state.

## Data model and access

`village_entitlements` is the one-row-per-household authoritative snapshot. Plan
type and lifecycle status are deliberately separate. The snapshot retains the
provider product and exact price identifiers used for the purchase, along with
period, cancellation, grace, lifetime cohort, provider-event, and reconciliation
timestamps.

`village_entitlement_events` is an append-only audit trail populated whenever the
snapshot is inserted or updated. Later webhook processing can associate changes
with a unique provider event through the snapshot's `last_provider_event_id`.

Authenticated and anonymous app clients cannot read either table. The service
role can mutate them, while active household members can call
`get_village_entitlement_summary` to obtain only the plan, lifecycle status,
effective access result, and access expiration. The authoritative
`is_village_entitled` evaluator is service-role-only and never reads user billing
state.

`billing_settings` and `billing_catalog` contain client-safe commercial
configuration. App roles may read them but cannot mutate them. They contain no
credentials or webhook secrets. Replace the initial `UNCONFIGURED` provider
product and price identifiers with the provider's publishable identifiers before
enabling checkout. Prices are stored as integer minor units and currencies as
three-letter uppercase codes.

## Existing-household backfill

The migration calls `private.backfill_village_entitlements` once. For each
household without an entitlement, it anchors the trial start to the household's
original `created_at` value and derives the end using the configured trial days.
The initial lifecycle status is `TRIALING` only when that derived end is still in
the future; otherwise it is `EXPIRED`.

The backfill inserts with `on conflict (household_id) do nothing`, so rerunning it
never alters an existing entitlement or restarts a trial. Database administrators
may safely run it again after restoring historical data:

```sql
select private.backfill_village_entitlements(now());
```

Because `create_household` inserts the household, owner membership, trial
entitlement, and first child in one database transaction, any entitlement failure
rolls back all of those records.
