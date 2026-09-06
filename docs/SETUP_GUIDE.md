# Village: first-time backend and mobile release setup

This guide takes Village from a fresh checkout to a hosted Supabase backend, EAS builds, TestFlight, and Google Play closed testing. It assumes you have never configured these services before.

The services are separate:

- **Supabase** stores users and app data and runs server-side functions.
- **Resend** sends verification, reset, and household invitation email.
- **Expo Application Services (EAS)** builds and signs the iOS and Android apps.
- **Apple Developer and App Store Connect** distribute the iOS beta through TestFlight.
- **Google Play Console** distributes the Android beta through a closed test.

Complete the sections in order. Keep every password, API key, and downloaded credential file out of Git.

## 1. Decide who will own the app

Make this decision before creating store accounts or choosing application identifiers.

### Personal ownership

Choose personal accounts when the app is owned by you personally.

- Apple displays your legal name as the App Store seller.
- Google allows a public developer name, but still verifies your legal identity.
- New Google Play personal accounts have additional device and closed-testing requirements.

### Organization ownership

Choose organization accounts when a registered company or nonprofit owns Village.

- Apple and Google display or verify the legal entity.
- Both normally require the organization's D-U-N-S number.
- Apple also requires a public company website, a domain-based work email address, and a person authorized to bind the organization.

Do not create a personal account temporarily if the company should own the app. Account conversion and app transfer add avoidable work.

Official references: [Apple enrollment](https://developer.apple.com/help/account/membership/program-enrollment/), [Apple D-U-N-S requirements](https://developer.apple.com/help/account/membership/D-U-N-S/), and [Google account types](https://support.google.com/googleplay/android-developer/answer/13634885).

## 2. Create the accounts

Use an email address that the long-term app owner controls. Turn on two-factor authentication everywhere it is offered.

### Supabase

1. Create an account at [supabase.com](https://supabase.com/).
2. Create an organization for Village.
3. Do not create the production project yet; the environment setup below explains the naming and region choices.

### Resend

1. Create an account at [resend.com](https://resend.com/).
2. Add a domain you own, such as `mail.your-village-domain.com`.
3. Add the DNS records Resend provides at your domain registrar.
4. Wait until Resend marks the domain as verified.

### Expo

1. Create an account at [expo.dev](https://expo.dev/).
2. If a company owns Village, create an Expo organization and add the people who need build access.

### Apple

1. Create or select an Apple Account and enable two-factor authentication.
2. Enroll at [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/).
3. Select **Individual** or **Organization** based on section 1.
4. Complete identity or business verification and accept the agreements.
5. Pay the membership fee. Apple currently lists the Developer Program at USD 99 per year, with regional pricing where available.
6. Wait for the membership confirmation email before attempting an App Store build.

If enrolling an organization, obtain its D-U-N-S number first. Apple notes that a new D-U-N-S number may take several business days to reach its systems.

### Google Play

1. Sign in at [Google Play Console](https://play.google.com/console/).
2. Accept the distribution agreement.
3. Pay the one-time USD 25 registration fee.
4. Select **Personal** or **Organization** based on section 1.
5. Complete identity, contact, payment-profile, and—when requested—Android-device verification.

For personal accounts created after November 13, 2023, Google currently requires at least 12 testers to remain opted into a closed test continuously for 14 days before production access can be requested. This does not prevent an initial internal or closed beta.

Official references: [Google Play registration](https://support.google.com/googleplay/android-developer/answer/6112435) and [new personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).

## 3. Choose permanent app identifiers and a link domain

Village currently contains placeholders:

- iOS bundle identifier: `com.village.mobile`
- Android application ID: `com.village.mobile`
- App/universal-link host: `links.village.app`

Replace them before creating store records. Good identifiers use a domain the owner controls in reverse order, for example `com.example.village`.

Change these values in `app.json`:

- `expo.ios.bundleIdentifier`
- `expo.android.package`
- `expo.ios.associatedDomains`
- `expo.android.intentFilters[0].data[0].host`

Change the link host in `.env.example` and `supabase/config.toml` if applicable. Bundle identifiers should be treated as permanent after the first store upload.

The link domain must eventually serve:

- `https://YOUR_LINK_DOMAIN/.well-known/apple-app-site-association`
- `https://YOUR_LINK_DOMAIN/.well-known/assetlinks.json`

Those files require the final Apple Team ID, Android package name, and Android signing-certificate fingerprint. Configure them after EAS has created the signing credentials.

## 4. Prepare the computer

Install:

- [Git](https://git-scm.com/downloads)
- [Node.js 22 LTS](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for local Supabase

On Windows, start Docker Desktop and wait until it reports that the engine is running. Then open PowerShell in the repository:

```powershell
cd D:\Programming\Codex\Village
npm install
Copy-Item .env.example .env
```

Never commit `.env`. The repository already ignores it.

## 5. Run Supabase locally

The Supabase CLI is already a development dependency, so a global installation is unnecessary.

```powershell
npm run supabase:start
```

The first start downloads several Docker images and can take a while. At the end, the CLI prints the local API URL and publishable/anonymous key. Put them in `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PASTE_THE_LOCAL_PUBLISHABLE_OR_ANON_KEY
EXPO_PUBLIC_LINK_BASE_URL=https://YOUR_LINK_DOMAIN
EXPO_PUBLIC_EAS_PROJECT_ID=
```

Recreate and validate the local database:

```powershell
npm run supabase:reset
npm run supabase:lint
npm run supabase:test
```

Useful local addresses are printed by `supabase start`. Supabase Studio is normally at `http://127.0.0.1:54323`, and the local email inbox is normally available through Inbucket.

Stop the services when finished:

```powershell
npx supabase stop
```

The local stack is for development only and must not be exposed to the internet. See Supabase's [local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows).

## 6. Create hosted Supabase environments

Create two projects in the Village Supabase organization:

1. `village-staging`
2. `village-production`

Choose regions close to the expected users. Save each generated database password in a password manager. Do not reuse passwords between environments.

Start with staging:

1. Open its Supabase dashboard.
2. Copy the project reference from the dashboard URL: `https://supabase.com/dashboard/project/PROJECT_REF`.
3. Open **Project Settings → API** and copy the project URL and publishable key.
4. Sign the CLI in and link the repository:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

`db push` applies the committed migrations. Do not use `db reset --linked` against production because it deletes remote data.

Generate fresh TypeScript types after schema changes:

```powershell
npx supabase gen types typescript --linked > src/data/database.types.ts
```

Review generated changes before committing them. Repeat the linking and `db push` process for production only after staging validation succeeds.

## 7. Configure Supabase authentication and email

In each hosted Supabase project:

1. Open **Authentication → Providers → Email**.
2. Enable email/password sign-up.
3. Require email confirmation.
4. Open **Authentication → URL Configuration**.
5. Set the site URL to the owned HTTPS link domain.
6. Add redirect URLs for the HTTPS domain and the custom-scheme fallbacks:

```text
https://YOUR_LINK_DOMAIN/**
village://onboarding
village://update-password
village://accept-invite/**
```

### Configure Resend SMTP

Supabase's default email sender is intentionally limited and is not suitable for a private beta with arbitrary testers.

1. In Resend, open the verified domain and create an SMTP credential/API key for Supabase Auth.
2. In Supabase, open **Project Settings → Authentication → SMTP Settings**.
3. Enable custom SMTP.
4. Enter the Resend SMTP host, port, username, and password exactly as Resend displays them.
5. Use a sender such as `Village <no-reply@YOUR_VERIFIED_DOMAIN>`.
6. Save and send a registration email to an address outside the Supabase organization.
7. Review **Authentication → Email Templates** and update confirmation and reset copy.
8. Review **Authentication → Rate Limits** before inviting beta testers.

See Supabase's [custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

## 8. Configure and deploy the Edge Functions

Create a long random value for `NOTIFICATION_WEBHOOK_SECRET` using a password manager. Then set the hosted secrets. Run these commands once for staging and again for production with the correct project reference and values:

```powershell
npx supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY INVITATION_FROM_EMAIL="Village <invites@YOUR_VERIFIED_DOMAIN>" LINK_BASE_URL=https://YOUR_LINK_DOMAIN NOTIFICATION_WEBHOOK_SECRET=YOUR_LONG_RANDOM_SECRET --project-ref YOUR_PROJECT_REF
npx supabase secrets list --project-ref YOUR_PROJECT_REF
```

Deploy both functions:

```powershell
npx supabase functions deploy send-invitation --project-ref YOUR_PROJECT_REF
npx supabase functions deploy deliver-notifications --project-ref YOUR_PROJECT_REF
```

The first function is called by a signed-in user and keeps JWT verification enabled. The delivery worker has platform JWT verification disabled but rejects calls unless the exact `x-webhook-secret` header matches its stored secret.

### Schedule notification delivery

The outbox needs a recurring worker call:

1. In the Supabase dashboard, open **Integrations → Cron**.
2. Create a job that calls `https://YOUR_PROJECT_REF.supabase.co/functions/v1/deliver-notifications` every minute.
3. Use `POST` with JSON content type.
4. Add the `x-webhook-secret` header using the same secret stored above.
5. Store sensitive header values using Supabase Vault rather than plain SQL.
6. Trigger a test notification and confirm the job is recorded as successful.

Supabase documents this pattern in [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions). Never print the webhook secret, service-role key, invitation token, or care notes in logs.

## 9. Connect Village to EAS

Use the current CLI without installing it globally:

```powershell
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
```

Choose the correct Expo account or organization. `eas init` creates or links the EAS project and writes `extra.eas.projectId` into the Expo app configuration. Copy that UUID into local `.env` as `EXPO_PUBLIC_EAS_PROJECT_ID`; Village uses it when requesting Expo push tokens.

Review the resulting changes before committing them. The repository already contains `eas.json` build profiles.

### Add EAS environment variables

`EXPO_PUBLIC_` values are compiled into the app and are not secrets. Never put a Supabase service-role/secret key or Resend key in an `EXPO_PUBLIC_` variable.

For the preview environment, use the staging Supabase project:

```powershell
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR_STAGING_PROJECT_REF.supabase.co --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value YOUR_STAGING_PUBLISHABLE_KEY --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_LINK_BASE_URL --value https://YOUR_LINK_DOMAIN --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_EAS_PROJECT_ID --value YOUR_EAS_PROJECT_ID --environment preview --visibility plaintext
```

Repeat with production values and `--environment production`. List the configured names:

```powershell
npx eas-cli@latest env:list --environment preview
npx eas-cli@latest env:list --environment production
```

The build profiles explicitly select their matching EAS environments. See Expo's [EAS environment-variable guide](https://docs.expo.dev/eas/environment-variables/).

## 10. Make development and preview builds

The EAS development-client package is already included. If dependencies were installed before it was added, refresh them with:

```powershell
npx expo install expo-dev-client
```

Create a development build:

```powershell
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform ios --profile development
```

For a shareable pre-store preview, use:

```powershell
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

EAS can generate and securely store a new Android keystore, Apple distribution certificate, and provisioning profile. Choose EAS-managed credentials unless the app owner already has credentials that must be reused. Never download credentials into the repository.

See Expo's [first EAS build guide](https://docs.expo.dev/build/setup/).

## 11. Configure push credentials

Push notifications require a real development or store build; Expo Go is not the production test environment.

Run:

```powershell
npx eas-cli@latest credentials --platform android
npx eas-cli@latest credentials --platform ios
```

For Android, follow EAS prompts to configure Firebase Cloud Messaging V1 credentials. For iOS, allow EAS to manage the APNs key unless the Apple team already has a key-management policy.

Build and install a new binary after credentials are configured. Sign in, enable notifications from Village's Notifications screen, and verify that a token appears in `device_push_tokens`. Expo's current walkthrough is [Push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## 12. Create the Apple app and TestFlight beta

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com/).
2. Open **Apps**, select **+**, then **New App**.
3. Choose iOS, enter `Village`, choose the final bundle identifier, create a unique SKU, and select the correct owner access.
4. Open **App Information** and note the numeric Apple ID. Add it to `eas.json` as `submit.production.ios.ascAppId`.
5. Create and submit the production build:

```powershell
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production --latest
```

EAS will offer to create or reuse an App Store Connect API key. Only the Apple Account Holder or Admin can create that key. After upload, Apple processes the build before it appears under **TestFlight**.

### Add testers

- **Internal testing** is for App Store Connect team members and supports up to 100 internal testers.
- **External testing** supports people outside the team. The first build assigned to an external group normally goes through Beta App Review.

In **TestFlight**:

1. Complete the beta description, feedback email, privacy URL, and export-compliance questions.
2. Create an internal group and add the processed build.
3. Invite internal testers.
4. When ready, create an external group, add the build, provide review credentials for Village, and submit the beta build for review.

TestFlight builds expire after 90 days. See [Apple's TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview) and [Expo's TestFlight guide](https://docs.expo.dev/submit/testflight/).

## 13. Create the Google Play closed test

1. Sign in to [Google Play Console](https://play.google.com/console/).
2. Select **Create app**.
3. Enter `Village`, choose App, select Free, add a support email, accept the declarations, and create the app.
4. Complete every required dashboard task: app access, ads, content rating, target audience, data safety, privacy policy, store listing, and contact details.
5. If reviewers need a login, provide a stable test account and clear navigation instructions under **App access**.

Google requires the first Android App Bundle to be uploaded manually before API-based EAS submissions can manage later releases:

```powershell
npx eas-cli@latest build --platform android --profile production
```

Download the `.aab` from the EAS build page. In Play Console, open **Testing → Closed testing**, create a track, create a release, and upload the bundle.

Add testers with an email list or Google Group, publish the closed-test release, and share the opt-in URL. Testers must use a Google Account and accept the opt-in before the Play Store shows the app.

See Google's [closed-testing instructions](https://support.google.com/googleplay/android-developer/answer/9845334).

### Enable later EAS submissions

After the first manual upload:

1. Create a Google Cloud service account for Play submission.
2. Enable the Google Play Android Developer API.
3. Grant the service account narrowly scoped release permissions in Play Console.
4. Create and download its JSON key.
5. Upload the key through `npx eas-cli@latest credentials --platform android` or the EAS project credentials page.
6. Delete the local downloaded copy after confirming EAS has it; never commit it.

Future uploads can use:

```powershell
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production --latest
```

See Expo's [Google Play submission guide](https://docs.expo.dev/submit/android/).

## 14. Final private-beta checklist

- The final bundle identifier, Android application ID, and link domain are owned and no longer placeholders.
- Supabase staging and production have separate passwords, keys, and projects.
- All database migrations pass on a clean local reset and on staging.
- RLS and pgTAP tests pass.
- Resend DNS is verified and confirmation/reset/invitation email reaches non-team addresses.
- Edge Function secrets are set separately in staging and production.
- The outbox worker runs successfully and does not log sensitive content.
- EAS preview uses staging variables; EAS production uses production variables.
- Apple and Android signing credentials are controlled by the permanent app owner.
- Universal/app links work from real email on real devices.
- Push works on a physical iOS device and Android device.
- Privacy policy and support URLs are public.
- Store reviewers have working credentials and instructions.
- TestFlight and Google Play testers know how to report problems.

## Troubleshooting shortcuts

### `supabase start` says Docker is unavailable

Open Docker Desktop, wait for the engine to finish starting, then rerun the command. On Windows, also confirm Docker Desktop is using its supported WSL 2 backend.

### The app opens in demo mode unexpectedly

Check that `.env` contains both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then stop and restart Expo so the variables are rebundled.

### Supabase sends no confirmation email

Confirm the recipient is allowed by the current SMTP mode. For arbitrary testers, verify the Resend domain and custom SMTP settings, then inspect Supabase Auth logs and Resend delivery logs.

### EAS says the project is not configured

Run `npx eas-cli@latest init`, verify `extra.eas.projectId` exists in the resolved Expo config, and run `npx eas-cli@latest whoami`.

### An iOS build is stuck on “Missing Compliance”

Answer the export-compliance question in App Store Connect. Only add `ios.config.usesNonExemptEncryption` to `app.json` after confirming the app and every linked library qualify for the selected declaration.

### Google Play rejects a package name or version

Confirm `expo.android.package` exactly matches the Play Console app. Never change the package name after the first accepted upload. EAS production builds use remote auto-incrementing version codes from `eas.json`.

### A tester cannot open the app from an invitation email

Verify the HTTPS link-domain files, platform identifiers, signing fingerprints, Supabase redirect allow-list, and `LINK_BASE_URL`. Until universal links are configured, test the `village://` custom-scheme fallback directly on an installed build.
