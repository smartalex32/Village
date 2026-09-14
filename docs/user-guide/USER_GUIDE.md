# Village User Guide

Village is a native iOS app for seeing a household’s childcare schedule, coverage needs, help requests, and caregiver handoffs.

## Get started

Open Village and choose **Get Started** to create an account, **Sign In** to use an existing account, or **Explore the demo** to try the app without a server. Demo changes remain in memory and never leave the device.

New accounts may require email confirmation. After signing in for the first time, enter a household name and the first child’s name. Village uses the iPhone’s current IANA timezone when creating the household.

## Navigate the app

The native tab bar has five areas:

| Area         | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| **Today**    | Children, coverage gaps, and the next events             |
| **Schedule** | A calendar and the events scheduled for the selected day |
| **Actions**  | Open help requests and active handoffs                   |
| **Family**   | Child profiles and their upcoming events                 |
| **Village**  | Household caregivers, roles, and capabilities            |

Pull down on **Today** to refresh remote household data. The green demo banner indicates that the app is using local sample data.

Household owners and parent/guardians can use **+** in Family to add a child, the person-add button in Village to invite a caregiver, and **+** in Actions to create a help request or handoff.

## Add a schedule event

1. Open **Schedule** and select a day.
2. Tap **+**.
3. Enter a title, child, time, and optional location.
4. Turn on **Needs a caregiver** if the event requires an assignment.
5. Tap **Add**.

Unassigned events that need a caregiver appear under **Needs attention** on Today.

## Invite a caregiver

Open **Village**, tap the person-add button, then enter the caregiver’s email and relationship. Choose their access role, children, and capabilities before tapping **Send**. Invitations are delivered through the protected Supabase Edge Function and remain subject to household permissions.

## Ask for help

Open **Actions**, tap **+**, and choose **Ask for help**. Select the child, help type, time, place, and eligible caregivers. “Other” requests also require a short description. Sending creates one linked schedule event and one request with client-generated idempotency IDs.

## Respond to help requests

Open **Actions** to see active help requests. Review the responsibility, date, time, and location, then tap **I can help**. Acceptance uses the backend’s atomic function, so only one eligible caregiver can receive the assignment. If someone else accepted first, Village refreshes the current state.

## Complete a handoff

Open an active handoff from **Actions**. Review the location and care note, then tap checklist rows as items become ready. The designated receiving caregiver taps **Acknowledge handoff** when the real-world transfer occurs. Acknowledgment atomically completes the handoff and transfers coordination responsibility; completed handoffs are immutable.

To schedule one, tap **+** in Actions and choose **Create handoff**. Select the child, sender, receiver, time, and location. Enter checklist items one per line.

## Notifications and account

On Today, tap the bell to read in-app notifications or mark all of them as read. Tap the account icon to review the household and timezone or sign out. Authentication sessions are stored in the iOS Keychain.

## Privacy and troubleshooting

- “Currently with” and handoff state are coordination records, not GPS tracking.
- Access is limited by household membership, role, and row-level security.
- Never put passwords, invitation links, or unnecessary sensitive information in care notes.
- If data looks stale, pull down on Today after reconnecting.
- A permission error means the current household role or child access does not allow the attempted action.
- If an action fails, check whether another caregiver already completed it before retrying.
