# Village

Village is a private mobile app for coordinating childcare responsibilities, help requests, and caregiver handoffs. It is built with Expo/React Native and Supabase.

New to Supabase or mobile-app distribution? Follow the complete [first-time backend and release setup guide](docs/SETUP_GUIDE.md).

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Leave the Supabase values blank to use the seeded local demo, or run `npm run supabase:start` and copy the local API URL and publishable key into `.env`.
4. Run `npm start`, `npm run android`, `npm run ios`, or `npm run web`.

In demo mode, any syntactically valid email and password of at least eight characters will sign in. No invitation, email, or push request leaves the device.

## Production configuration

- Create separate staging and production Supabase projects and apply migrations from `supabase/migrations`.
- Configure Supabase Auth SMTP with Resend and set the mobile redirect URLs from `supabase/config.toml`.
- Set Edge Function secrets: `RESEND_API_KEY`, `INVITATION_FROM_EMAIL`, `LINK_BASE_URL`, and `NOTIFICATION_WEBHOOK_SECRET`.
- Deploy `send-invitation` and `deliver-notifications`. Invoke notification delivery from a protected database webhook or scheduled job.
- Replace `com.village.mobile`, `links.village.app`, and the EAS project ID with owned production values before generating beta builds.
- Host Apple App Site Association and Android Asset Links files on the chosen link domain.

## Validation

```sh
npm run format:check
npm run typecheck
npm run lint
npm run test:ci
npx expo export --platform web
```

With the local Supabase stack running, also run `npm run supabase:lint` and `npm run supabase:test`. Maestro flows live in `.maestro/`; the Android EAS workflow runs them against an installable test build.

The local demo covers onboarding, household dashboards, invitations and permission presets, family profiles, scheduling, help requests, and one-step handoff acknowledgment. Production mode adds persisted sessions, private avatar uploads, realtime reconciliation, Resend invitations, and Expo push routing through Supabase.

## Privacy model

All household tables use row-level security. Manager actions and child-level permissions are checked in Postgres, while race-sensitive operations use explicit transactional functions. Avatar storage is private. Sensitive notes and tokens are intentionally excluded from notification delivery logs.
