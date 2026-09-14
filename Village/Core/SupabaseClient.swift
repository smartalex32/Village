import Foundation

enum APIError: LocalizedError {
    case notConfigured
    case invalidResponse
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: "Supabase is not configured."
        case .invalidResponse: "The server returned an unreadable response."
        case .message(let message): message
        }
    }
}

actor SupabaseClient {
    private let configuration: AppConfiguration
    private let urlSession: URLSession

    init(configuration: AppConfiguration, urlSession: URLSession = .shared) {
        self.configuration = configuration
        self.urlSession = urlSession
    }

    func signIn(email: String, password: String) async throws -> Session {
        let response: AuthResponse = try await request(
            path: "/auth/v1/token",
            query: [URLQueryItem(name: "grant_type", value: "password")],
            method: "POST",
            body: ["email": email, "password": password]
        )
        return response.session
    }

    func signUp(name: String, email: String, password: String) async throws -> Session? {
        let payload: SignupResponse = try await request(
            path: "/auth/v1/signup",
            method: "POST",
            body: ["email": email, "password": password, "data": ["display_name": name]]
        )
        guard let token = payload.accessToken, let refresh = payload.refreshToken, let expires = payload.expiresIn else { return nil }
        return Session(accessToken: token, refreshToken: refresh, expiresAt: .now.addingTimeInterval(expires), user: payload.user)
    }

    func refresh(_ session: Session) async throws -> Session {
        let response: AuthResponse = try await request(
            path: "/auth/v1/token",
            query: [URLQueryItem(name: "grant_type", value: "refresh_token")],
            method: "POST",
            body: ["refresh_token": session.refreshToken]
        )
        return response.session
    }

    func signOut(session: Session) async throws {
        let _: EmptyResponse = try await request(path: "/auth/v1/logout", method: "POST", session: session)
    }

    func loadSnapshot(session inputSession: Session) async throws -> (AppSnapshot, Session) {
        let session = try await validSession(inputSession)
        let memberships: [MembershipRow] = try await request(
            path: "/rest/v1/household_members",
            query: [
                .init(name: "select", value: "id,household_id"),
                .init(name: "user_id", value: "eq.\(session.user.id.uuidString)"),
                .init(name: "status", value: "eq.ACTIVE"),
                .init(name: "limit", value: "1")
            ], session: session
        )
        guard let membership = memberships.first else { return (AppSnapshot(), session) }
        let householdId = membership.householdId.uuidString

        async let householdRows: [Household] = request(path: "/rest/v1/households", query: [.init(name: "select", value: "id,name,timezone"), .init(name: "id", value: "eq.\(householdId)")], session: session)
        async let children: [Child] = request(path: "/rest/v1/children", query: [.init(name: "select", value: "id,first_name,last_name,birth_date,avatar_path,archived_at"), .init(name: "household_id", value: "eq.\(householdId)"), .init(name: "order", value: "first_name")], session: session)
        async let members: [VillageMember] = request(path: "/rest/v1/household_members", query: [.init(name: "select", value: "id,role,relationship_label,status,profile:profiles(display_name),member_capabilities(capability),member_child_permissions(child_id,can_view_profile,can_view_schedule,can_view_care_notes,can_participate_handoffs)"), .init(name: "household_id", value: "eq.\(householdId)"), .init(name: "status", value: "eq.ACTIVE")], session: session)
        async let events: [CareEvent] = request(path: "/rest/v1/care_events", query: [.init(name: "select", value: "id,child_id,event_type,title,starts_at,ends_at,location,assigned_member_id,notes,requires_caregiver,status"), .init(name: "household_id", value: "eq.\(householdId)"), .init(name: "order", value: "starts_at")], session: session)
        async let requests: [HelpRequest] = request(path: "/rest/v1/help_requests", query: [.init(name: "select", value: "id,child_id,event_id,request_type,request_type_label,starts_at,location,notes,status,assigned_member_id"), .init(name: "household_id", value: "eq.\(householdId)"), .init(name: "order", value: "starts_at")], session: session)
        async let helpRequestTypes: [HelpRequestType] = request(path: "/rest/v1/help_request_types", query: [.init(name: "select", value: "id,label,capability,is_other"), .init(name: "household_id", value: "eq.\(householdId)"), .init(name: "archived_at", value: "is.null"), .init(name: "order", value: "created_at")], session: session)
        async let handoffs: [Handoff] = request(path: "/rest/v1/handoffs", query: [.init(name: "select", value: "id,child_id,from_member_id,to_member_id,scheduled_at,location,notes,status,accepted_at,handoff_items(id,label,is_ready,position)"), .init(name: "household_id", value: "eq.\(householdId)"), .init(name: "order", value: "scheduled_at.desc")], session: session)
        async let notifications: [VillageNotification] = request(path: "/rest/v1/notifications", query: [.init(name: "select", value: "id,title,body,route,read_at,created_at"), .init(name: "recipient_member_id", value: "eq.\(membership.id.uuidString)"), .init(name: "order", value: "created_at.desc"), .init(name: "limit", value: "100")], session: session)

        return try await (AppSnapshot(household: householdRows.first, currentMemberId: membership.id, children: children, members: members, events: events, requests: requests, helpRequestTypes: helpRequestTypes, handoffs: handoffs, notifications: notifications), session)
    }

    func createHousehold(name: String, childName: String, timezone: String, session: Session) async throws {
        let _: UUIDResponse = try await request(path: "/rest/v1/rpc/create_household", method: "POST", body: ["p_name": name, "p_timezone": timezone, "p_child_first_name": childName], session: session)
    }

    func createEvent(_ event: CareEvent, householdId: UUID, memberId: UUID, session: Session) async throws {
        let body: [String: Any] = [
            "id": event.id.uuidString, "household_id": householdId.uuidString, "child_id": event.childId.uuidString,
            "event_type": event.eventType, "title": event.title, "starts_at": ISO8601DateFormatter.withFractional.string(from: event.startsAt),
            "location": event.location ?? "", "requires_caregiver": event.requiresCaregiver, "status": event.status.rawValue,
            "created_by": memberId.uuidString
        ]
        let _: EmptyResponse = try await request(path: "/rest/v1/care_events", method: "POST", body: body, session: session)
    }

    func createChild(firstName: String, householdId: UUID, session: Session) async throws {
        let _: EmptyResponse = try await request(path: "/rest/v1/children", method: "POST", body: ["household_id": householdId.uuidString, "first_name": firstName], session: session)
    }

    func createHelpRequest(_ input: NewHelpRequest, session: Session) async throws {
        let _: UUIDResponse = try await request(path: "/rest/v1/rpc/create_help_request_with_event", method: "POST", body: [
            "p_request_id": UUID().uuidString,
            "p_event_id": UUID().uuidString,
            "p_child_id": input.childId.uuidString,
            "p_request_type": input.type.id.uuidString,
            "p_starts_at": ISO8601DateFormatter.withFractional.string(from: input.startsAt),
            "p_location": input.location,
            "p_context": input.context.isEmpty ? NSNull() : input.context,
            "p_notes": input.notes.isEmpty ? NSNull() : input.notes,
            "p_recipient_member_ids": input.recipientIds.map(\.uuidString)
        ], session: session)
    }

    func createHandoff(_ input: NewHandoff, householdId: UUID, memberId: UUID, session: Session) async throws {
        let handoffId = UUID()
        let _: EmptyResponse = try await request(path: "/rest/v1/handoffs", method: "POST", body: [
            "id": handoffId.uuidString,
            "household_id": householdId.uuidString,
            "child_id": input.childId.uuidString,
            "from_member_id": input.fromMemberId.uuidString,
            "to_member_id": input.toMemberId.uuidString,
            "scheduled_at": ISO8601DateFormatter.withFractional.string(from: input.scheduledAt),
            "location": input.location,
            "notes": input.notes,
            "created_by": memberId.uuidString
        ], session: session)
        let items: [[String: Any]] = input.itemLabels.enumerated().map { index, label in
            ["id": UUID().uuidString, "handoff_id": handoffId.uuidString, "label": label, "is_ready": false, "position": index]
        }
        if !items.isEmpty { let _: EmptyResponse = try await request(path: "/rest/v1/handoff_items", method: "POST", body: items, session: session) }
    }

    func sendInvitation(email: String, relationship: String, role: MemberRole, capabilities: [Capability], childIds: [UUID], household: Household, inviterName: String, session: Session) async throws {
        let _: InvitationResponse = try await request(path: "/functions/v1/send-invitation", method: "POST", body: [
            "householdId": household.id.uuidString,
            "email": email,
            "relationshipLabel": relationship,
            "role": role.rawValue,
            "childIds": childIds.map(\.uuidString),
            "capabilities": capabilities.map(\.rawValue),
            "householdName": household.name,
            "inviterName": inviterName
        ], session: session)
    }

    func updateHandoffItem(_ id: UUID, ready: Bool, session: Session) async throws {
        let _: EmptyResponse = try await request(path: "/rest/v1/handoff_items", query: [.init(name: "id", value: "eq.\(id.uuidString)")], method: "PATCH", body: ["is_ready": ready], session: session)
    }

    func acknowledgeHandoff(_ id: UUID, session: Session) async throws {
        let _: UUIDResponse = try await request(path: "/rest/v1/rpc/acknowledge_handoff", method: "POST", body: ["p_handoff_id": id.uuidString], session: session)
    }

    func acceptHelpRequest(_ id: UUID, session: Session) async throws {
        let _: UUIDResponse = try await request(path: "/rest/v1/rpc/accept_help_request", method: "POST", body: ["p_request_id": id.uuidString], session: session)
    }

    func markNotificationsRead(memberId: UUID, session: Session) async throws {
        let _: EmptyResponse = try await request(path: "/rest/v1/notifications", query: [.init(name: "recipient_member_id", value: "eq.\(memberId.uuidString)"), .init(name: "read_at", value: "is.null")], method: "PATCH", body: ["read_at": ISO8601DateFormatter.withFractional.string(from: .now)], session: session)
    }

    private func validSession(_ session: Session) async throws -> Session {
        session.expiresAt.timeIntervalSinceNow > 60 ? session : try await refresh(session)
    }

    private func request<Response: Decodable>(path: String, query: [URLQueryItem] = [], method: String = "GET", body: Any? = nil, session: Session? = nil) async throws -> Response {
        guard let base = configuration.supabaseURL else { throw APIError.notConfigured }
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard var components = URLComponents(url: base.appendingPathComponent(normalizedPath), resolvingAgainstBaseURL: false) else { throw APIError.invalidResponse }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.invalidResponse }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let session { request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }

        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let payload = try? JSONDecoder().decode(ErrorPayload.self, from: data)
            throw APIError.message(payload?.message ?? payload?.errorDescription ?? "Request failed (\(http.statusCode)).")
        }
        if Response.self == EmptyResponse.self, data.isEmpty { return EmptyResponse() as! Response }
        if Response.self == UUIDResponse.self, let string = try? JSONDecoder().decode(String.self, from: data), let id = UUID(uuidString: string) { return UUIDResponse(id: id) as! Response }
        return try JSONDecoder.village.decode(Response.self, from: data)
    }
}

private struct SignupResponse: Decodable {
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Double?
    let user: AuthUser

    private enum CodingKeys: String, CodingKey {
        case accessToken
        case refreshToken
        case expiresIn
        case user
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try container.decodeIfPresent(String.self, forKey: .accessToken)
        refreshToken = try container.decodeIfPresent(String.self, forKey: .refreshToken)
        expiresIn = try container.decodeIfPresent(Double.self, forKey: .expiresIn)
        user = try container.decodeIfPresent(AuthUser.self, forKey: .user) ?? AuthUser(from: decoder)
    }
}
private struct MembershipRow: Codable { let id: UUID; let householdId: UUID }
private struct EmptyResponse: Codable { init() {} }
private struct UUIDResponse: Codable { let id: UUID }
private struct InvitationResponse: Codable { let invitationId: UUID; let inviteUrl: String; let emailDelivered: Bool }
private struct ErrorPayload: Codable { let message: String?; let errorDescription: String? }
