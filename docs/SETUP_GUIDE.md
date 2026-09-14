# Native iOS setup and release

This guide takes Village from a fresh checkout to a native iOS development build and TestFlight release.

## 1. Install the prerequisites

Install Xcode 16 or newer from the Mac App Store and open it once to install the iOS platform. An Apple Developer Program membership is required for TestFlight and App Store distribution, but not for simulator development.

Node.js and Docker are optional and are only used for local Supabase development.

## 2. Configure the app

Copy `Config/Secrets.xcconfig.example` to `Config/Secrets.xcconfig`. The destination file is gitignored.

```xcconfig
SUPABASE_URL = https:/$()/YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY = YOUR_PUBLISHABLE_OR_ANON_KEY
LINK_BASE_URL = https:/$()/links.village.app
```

The unusual `$()/` spelling prevents Xcode from interpreting `//` in a URL as a comment. Only use a Supabase publishable or legacy anon key in the app. Never place a secret/service-role key in an iOS build setting.

If the Supabase URL or key is blank, Village opens with an optional seeded demo. Demo changes stay in memory and do not leave the device.

## 3. Run locally

Open `Village.xcodeproj`, select the shared `Village` scheme and an iPhone simulator, then press Run. The project has no external iOS dependencies to resolve.

To run tests from Terminal:

```sh
xcodebuild test -project Village.xcodeproj -scheme Village \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  CODE_SIGNING_ALLOWED=NO
```

## 4. Run Supabase locally (optional)

```sh
npm install
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
npm run supabase:test
```

For a simulator to reach Supabase running on the same Mac, set `SUPABASE_URL` to `http:/$()/127.0.0.1:54321` and copy the local publishable/anon key printed by the Supabase CLI.

## 5. Configure signing and links

In Xcode, select the Village target and choose the permanent development team under Signing & Capabilities. Before release, replace `com.village.mobile` in `Config/Base.xcconfig` if the organization owns a different bundle identifier.

The included entitlement declares `applinks:links.village.app`. Replace that domain if needed and host a valid `apple-app-site-association` file containing the final Apple Team ID and bundle identifier.

## 6. Configure Supabase production

- Create separate staging and production projects and apply every migration under `supabase/migrations`.
- Configure Supabase Auth SMTP and add the app’s universal-link and `village://` callback URLs.
- Deploy the `send-invitation` and `deliver-notifications` Edge Functions.
- Configure `RESEND_API_KEY`, `INVITATION_FROM_EMAIL`, `LINK_BASE_URL`, and `NOTIFICATION_WEBHOOK_SECRET` as server-side Edge Function secrets.
- Keep row-level security enabled and run the pgTAP suite before release.

## 7. Ship through TestFlight

1. In App Store Connect, create the app using the exact bundle identifier.
2. Set an Apple Development Team in Xcode and verify the Release configuration.
3. Choose **Product → Archive** on a generic iOS device.
4. In Organizer, validate and upload the archive.
5. Complete privacy, export-compliance, beta description, and tester information in App Store Connect.
6. Test authentication, household permissions, scheduling, help acceptance, and atomic handoff acknowledgment on a physical device before inviting external testers.

Do not commit signing certificates, provisioning profiles, `Secrets.xcconfig`, or any production credentials.
