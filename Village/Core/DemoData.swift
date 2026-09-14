import Foundation

enum DemoData {
    static let alex = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
    static let grandma = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    static let grandpa = UUID(uuidString: "00000000-0000-0000-0000-000000000003")!
    static let emma = UUID(uuidString: "10000000-0000-0000-0000-000000000001")!
    static let noah = UUID(uuidString: "10000000-0000-0000-0000-000000000002")!

    static func date(day: Int = 0, hour: Int, minute: Int = 0) -> Date {
        Calendar.current.date(byAdding: .day, value: day, to: Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: .now)!)!
    }

    static var snapshot: AppSnapshot {
        AppSnapshot(
            household: Household(id: UUID(), name: "The Morgan Family", timezone: TimeZone.current.identifier),
            currentMemberId: alex,
            children: [
                Child(id: emma, firstName: "Emma", birthDate: "2018-04-12"),
                Child(id: noah, firstName: "Noah", birthDate: "2021-02-08")
            ],
            members: [
                VillageMember(id: alex, role: .owner, relationshipLabel: "Parent", status: "ACTIVE", profile: .init(displayName: "Alex"), memberCapabilities: Capability.allCases.dropLast().map { .init(capability: $0) }),
                VillageMember(id: grandma, role: .trustedCaregiver, relationshipLabel: "Grandmother", status: "ACTIVE", profile: .init(displayName: "Grandma"), memberCapabilities: [.init(capability: .pickup), .init(capability: .babysitting)]),
                VillageMember(id: grandpa, role: .trustedCaregiver, relationshipLabel: "Grandfather", status: "ACTIVE", profile: .init(displayName: "Grandpa"), memberCapabilities: [.init(capability: .pickup), .init(capability: .emergency)])
            ],
            events: [
                CareEvent(id: UUID(), childId: emma, eventType: "SCHOOL", title: "School", startsAt: date(hour: 8), location: "Westside Elementary", assignedMemberId: alex, requiresCaregiver: false, status: .scheduled),
                CareEvent(id: UUID(), childId: emma, eventType: "PICKUP", title: "School pickup", startsAt: date(hour: 15, minute: 15), location: "Westside Elementary", assignedMemberId: grandma, requiresCaregiver: true, status: .scheduled),
                CareEvent(id: UUID(), childId: noah, eventType: "APPOINTMENT", title: "Dentist", startsAt: date(hour: 16), location: "Riverside Dental", assignedMemberId: alex, requiresCaregiver: true, status: .scheduled),
                CareEvent(id: UUID(), childId: emma, eventType: "ACTIVITY", title: "Soccer practice", startsAt: date(hour: 17, minute: 30), location: "Lakeside Fields", assignedMemberId: alex, requiresCaregiver: true, status: .scheduled),
                CareEvent(id: UUID(), childId: emma, eventType: "PICKUP", title: "School pickup", startsAt: date(day: 2, hour: 15, minute: 15), location: "Westside Elementary", requiresCaregiver: true, status: .scheduled)
            ],
            helpRequestTypes: [
                HelpRequestType(id: UUID(uuidString: "20000000-0000-0000-0000-000000000001")!, label: "Pickup", capability: .pickup, isOther: false),
                HelpRequestType(id: UUID(uuidString: "20000000-0000-0000-0000-000000000002")!, label: "Dropoff", capability: .dropoff, isOther: false),
                HelpRequestType(id: UUID(uuidString: "20000000-0000-0000-0000-000000000003")!, label: "Babysitting", capability: .babysitting, isOther: false),
                HelpRequestType(id: UUID(uuidString: "20000000-0000-0000-0000-000000000004")!, label: "Other", isOther: true)
            ],
            handoffs: [
                Handoff(id: UUID(), childId: emma, fromMemberId: grandma, toMemberId: alex, scheduledAt: date(hour: 17, minute: 15), location: "At home", notes: "Reading homework still needs to be finished.", status: .scheduled, handoffItems: [
                    .init(id: UUID(), label: "Backpack", isReady: true, position: 0),
                    .init(id: UUID(), label: "Soccer cleats", isReady: true, position: 1),
                    .init(id: UUID(), label: "Water bottle", isReady: false, position: 2)
                ])
            ],
            notifications: [
                VillageNotification(id: UUID(), title: "Handoff today", body: "Grandma will hand Emma off to you at 5:15 PM.", route: nil, createdAt: date(hour: 9))
            ]
        )
    }
}
