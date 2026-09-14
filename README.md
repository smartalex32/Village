# Village

Village is a private, native iOS app for coordinating childcare responsibilities, help requests, schedules, and caregiver handoffs. The client is written in SwiftUI and uses the existing Supabase backend.

## Requirements

- macOS with Xcode 16 or newer
- iOS 17 or newer
- Node.js 22 and Docker only when running the local Supabase stack

## Run the iOS app

1. Open `Village.xcodeproj` in Xcode.
2. Copy `Config/Secrets.xcconfig.example` to `Config/Secrets.xcconfig`.
3. Add the Supabase project URL and publishable key. Leave both blank to use the on-device demo.
4. Select an iPhone simulator and run the `Village` scheme.

The native client has no CocoaPods, Swift Package, React Native, Expo, or JavaScript runtime dependency. It uses SwiftUI, `URLSession`, and Keychain Services.

## Validation

```sh
xcodebuild test \
  -project Village.xcodeproj \
  -scheme Village \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  CODE_SIGNING_ALLOWED=NO
```

Backend validation remains available with `npm run supabase:lint`, `npm run supabase:test`, and Deno lint/test for the Edge Functions.

## Configuration and release

See the [setup guide](docs/SETUP_GUIDE.md) for Supabase, signing, associated domains, TestFlight, and production configuration.

## Privacy model

All household tables use row-level security. Manager actions and child-level permissions are checked in Postgres, while race-sensitive operations use transactional functions. Sessions are stored in the iOS Keychain. Care notes, invitation tokens, auth tokens, and precise schedule details must never be logged.
