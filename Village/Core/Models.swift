import Foundation

enum MemberRole: String, Codable, CaseIterable, Sendable {
    case owner = "OWNER"
    case parentGuardian = "PARENT_GUARDIAN"
    case trustedCaregiver = "TRUSTED_CAREGIVER"
    case limitedCaregiver = "LIMITED_CAREGIVER"

    var label: String {
        switch self {
        case .owner: "Owner"
        case .parentGuardian: "Parent / guardian"
        case .trustedCaregiver: "Trusted caregiver"
        case .limitedCaregiver: "Limited caregiver"
        }
    }
}

enum Capability: String, Codable, CaseIterable, Identifiable, Sendable {
    case pickup = "PICKUP"
    case dropoff = "DROPOFF"
    case transportation = "TRANSPORTATION"
    case babysitting = "BABYSITTING"
    case emergency = "EMERGENCY"
    case other = "OTHER"

    var id: String { rawValue }
    var label: String { rawValue.replacingOccurrences(of: "_", with: " ").capitalized }
}

struct Child: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var firstName: String
    var lastName: String? = nil
    var birthDate: String? = nil
    var avatarPath: String? = nil
    var archivedAt: Date? = nil

    var displayName: String { [firstName, lastName].compactMap { $0 }.joined(separator: " ") }
    var isArchived: Bool { archivedAt != nil }
}

struct VillageMember: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var role: MemberRole
    var relationshipLabel: String
    var status: String
    var profile: MemberProfile?
    var memberCapabilities: [MemberCapability]?
    var memberChildPermissions: [MemberChildPermission]? = nil

    var displayName: String { profile?.displayName ?? relationshipLabel }
    var capabilities: [Capability] { memberCapabilities?.map(\.capability) ?? [] }
}

struct MemberProfile: Codable, Hashable, Sendable { let displayName: String }
struct MemberCapability: Codable, Hashable, Sendable { let capability: Capability }
struct MemberChildPermission: Codable, Hashable, Sendable {
    let childId: UUID
    let canViewProfile: Bool
    let canViewSchedule: Bool
    let canViewCareNotes: Bool
    let canParticipateHandoffs: Bool
}

enum CareEventStatus: String, Codable, Sendable { case scheduled = "SCHEDULED", completed = "COMPLETED", cancelled = "CANCELLED" }

struct CareEvent: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var childId: UUID
    var eventType: String
    var title: String
    var startsAt: Date
    var endsAt: Date? = nil
    var location: String? = nil
    var assignedMemberId: UUID? = nil
    var notes: String? = nil
    var requiresCaregiver: Bool
    var status: CareEventStatus
}

enum HelpRequestStatus: String, Codable, Sendable { case open = "OPEN", assigned = "ASSIGNED", completed = "COMPLETED", cancelled = "CANCELLED" }

struct HelpRequest: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var childId: UUID
    var eventId: UUID
    var requestType: String
    var requestTypeLabel: String
    var startsAt: Date
    var location: String
    var notes: String? = nil
    var status: HelpRequestStatus
    var assignedMemberId: UUID? = nil
}

struct HelpRequestType: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var label: String
    var capability: Capability?
    var isOther: Bool
}

enum HandoffStatus: String, Codable, Sendable { case scheduled = "SCHEDULED", ready = "READY", completed = "COMPLETED", cancelled = "CANCELLED" }

struct Handoff: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var childId: UUID
    var fromMemberId: UUID
    var toMemberId: UUID
    var scheduledAt: Date
    var location: String? = nil
    var notes: String? = nil
    var status: HandoffStatus
    var acceptedAt: Date? = nil
    var handoffItems: [HandoffItem]? = nil
}

struct HandoffItem: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var label: String
    var isReady: Bool
    var position: Int
}

struct VillageNotification: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var title: String
    var body: String
    var route: String? = nil
    var readAt: Date? = nil
    var createdAt: Date
}

struct Household: Identifiable, Codable, Sendable {
    let id: UUID
    var name: String
    var timezone: String
}

struct Session: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
    let user: AuthUser
}

struct AuthUser: Codable, Sendable { let id: UUID; let email: String? }

struct AuthResponse: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Double
    let user: AuthUser

    var session: Session {
        Session(accessToken: accessToken, refreshToken: refreshToken, expiresAt: .now.addingTimeInterval(expiresIn), user: user)
    }
}

struct AppSnapshot: Sendable {
    var household: Household?
    var currentMemberId: UUID?
    var children: [Child] = []
    var members: [VillageMember] = []
    var events: [CareEvent] = []
    var requests: [HelpRequest] = []
    var helpRequestTypes: [HelpRequestType] = []
    var handoffs: [Handoff] = []
    var notifications: [VillageNotification] = []
}

struct NewEvent: Sendable {
    var childId: UUID
    var title: String
    var startsAt: Date
    var location: String
    var requiresCaregiver: Bool
}

struct NewHelpRequest: Sendable {
    var childId: UUID
    var type: HelpRequestType
    var startsAt: Date
    var location: String
    var context: String
    var notes: String
    var recipientIds: [UUID]
}

struct NewHandoff: Sendable {
    var childId: UUID
    var fromMemberId: UUID
    var toMemberId: UUID
    var scheduledAt: Date
    var location: String
    var notes: String
    var itemLabels: [String]
}

extension JSONDecoder {
    static let village: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = ISO8601DateFormatter.withFractional.date(from: value) ?? ISO8601DateFormatter().date(from: value) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO-8601 date")
        }
        return decoder
    }()
}

extension JSONEncoder {
    static let village: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}

extension ISO8601DateFormatter {
    static let withFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
