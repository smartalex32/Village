# Village Project Reference

## Architecture

- Native iOS application built with Swift 5, SwiftUI, and an Xcode project. The deployment target is iOS 17.
- `Village/App` owns lifecycle and app state, `Village/Core` contains domain and Supabase infrastructure, and `Village/Features` contains SwiftUI screens.
- The client talks to Supabase Auth, PostgREST, and database RPCs directly through `URLSession`; no JavaScript runtime or third-party iOS SDK is required.
- Supabase migrations, RLS helpers, transactional functions, Edge Functions, and pgTAP tests live in `supabase/`.
- When Supabase environment variables are absent, the app uses the seeded in-memory household for UI review. When present, `VillageProvider` hydrates from Supabase and subscribes to authorized realtime changes.

## Domain Rules

- A household member row is the identity used for assignments and permissions.
- Times are stored as UTC `timestamptz`; the household stores an IANA timezone.
- Care notes live separately from child profile rows so profile permission never implies care-note permission.
- Client-generated UUIDs are used as mutation idempotency keys; retry-sensitive database functions must return the original successful result without duplicating notifications.
- Help request acceptance and handoff acknowledgment must use database functions so state transitions are atomic.
- Handoff acknowledgment immediately completes the handoff and transfers coordination responsibility.
- Completed handoffs are immutable. Removing a caregiver revokes membership, unassigns future events, and cancels active handoffs.
- RLS is mandatory for every exposed table. Never use user-editable JWT metadata for authorization.

## Validation

- On macOS: `xcodebuild test -project Village.xcodeproj -scheme Village -destination 'platform=iOS Simulator,name=iPhone 16 Pro' CODE_SIGNING_ALLOWED=NO`
- `npm run format:check` validates backend TypeScript, JSON, and Markdown only.
- With Docker: `npm run supabase:start`, `npm run supabase:lint`, and `npm run supabase:test`.
- With Deno: `deno lint supabase/functions` and `deno test supabase/functions`

Do not log child notes, invitation tokens, authentication tokens, or precise family schedule details.
