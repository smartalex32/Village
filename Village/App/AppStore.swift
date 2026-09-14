import Foundation

@MainActor
final class AppStore: ObservableObject {
    enum Phase: Equatable { case launching, welcome, onboarding, ready }

    @Published private(set) var phase: Phase = .launching
    @Published private(set) var snapshot = AppSnapshot()
    @Published private(set) var isDemo = false
    @Published var isBusy = false
    @Published var errorMessage: String?

    private let configuration: AppConfiguration
    private let client: SupabaseClient
    private var session: Session?

    init(configuration: AppConfiguration = .current) {
        self.configuration = configuration
        client = SupabaseClient(configuration: configuration)
    }

    var currentMember: VillageMember? { snapshot.members.first { $0.id == snapshot.currentMemberId } }
    var canManage: Bool { currentMember?.role == .owner || currentMember?.role == .parentGuardian }
    var activeChildren: [Child] { snapshot.children.filter { !$0.isArchived } }
    var unreadCount: Int { snapshot.notifications.filter { $0.readAt == nil }.count }
    var coverageGaps: [CareEvent] { snapshot.events.filter { $0.status == .scheduled && $0.requiresCaregiver && $0.assignedMemberId == nil } }
    var householdCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = snapshot.household.flatMap { TimeZone(identifier: $0.timezone) } ?? .current
        return calendar
    }

    func time(_ date: Date) -> String { formatter(dateStyle: .none, timeStyle: .short).string(from: date) }
    func day(_ date: Date) -> String { formatter(dateStyle: .full, timeStyle: .none).string(from: date) }

    func launch() async {
        guard configuration.isRemoteConfigured, let saved = KeychainStore.load() else { phase = .welcome; return }
        session = saved
        await refresh()
    }

    func exploreDemo() {
        isDemo = true
        snapshot = DemoData.snapshot
        phase = .ready
    }

    func signIn(email: String, password: String) async {
        await perform {
            let session = try await client.signIn(email: email, password: password)
            try KeychainStore.save(session)
            self.session = session
            await self.refresh()
        }
    }

    func signUp(name: String, email: String, password: String) async -> Bool {
        var requiresConfirmation = false
        await perform {
            guard let session = try await client.signUp(name: name, email: email, password: password) else {
                requiresConfirmation = true
                return
            }
            try KeychainStore.save(session)
            self.session = session
            self.phase = .onboarding
        }
        return requiresConfirmation
    }

    func createHousehold(name: String, childName: String) async {
        guard let session else { return }
        await perform {
            try await client.createHousehold(name: name, childName: childName, timezone: TimeZone.current.identifier, session: session)
            await self.refresh()
        }
    }

    func refresh() async {
        if isDemo { return }
        guard let session else { phase = .welcome; return }
        isBusy = true
        defer { isBusy = false }
        do {
            let (snapshot, refreshedSession) = try await client.loadSnapshot(session: session)
            self.session = refreshedSession
            try KeychainStore.save(refreshedSession)
            self.snapshot = snapshot
            phase = snapshot.household == nil ? .onboarding : .ready
        } catch {
            errorMessage = error.localizedDescription
            phase = .welcome
        }
    }

    func signOut() async {
        if let session { try? await client.signOut(session: session) }
        KeychainStore.clear()
        session = nil
        snapshot = AppSnapshot()
        isDemo = false
        phase = .welcome
    }

    func addEvent(_ input: NewEvent) async {
        let event = CareEvent(id: UUID(), childId: input.childId, eventType: "OTHER", title: input.title, startsAt: input.startsAt, location: input.location, requiresCaregiver: input.requiresCaregiver, status: .scheduled)
        snapshot.events.append(event)
        guard !isDemo, let session, let householdId = snapshot.household?.id, let memberId = snapshot.currentMemberId else { return }
        do { try await client.createEvent(event, householdId: householdId, memberId: memberId, session: session) }
        catch { snapshot.events.removeAll { $0.id == event.id }; errorMessage = error.localizedDescription }
    }

    func addChild(firstName: String) async {
        let child = Child(id: UUID(), firstName: firstName)
        snapshot.children.append(child)
        guard !isDemo, let session, let householdId = snapshot.household?.id else { return }
        do { try await client.createChild(firstName: firstName, householdId: householdId, session: session); await refresh() }
        catch { snapshot.children.removeAll { $0.id == child.id }; errorMessage = error.localizedDescription }
    }

    func createHelpRequest(_ input: NewHelpRequest) async {
        if isDemo {
            let eventId = UUID()
            snapshot.events.append(CareEvent(id: eventId, childId: input.childId, eventType: input.type.label, title: input.type.label, startsAt: input.startsAt, location: input.location, notes: input.notes.isEmpty ? nil : input.notes, requiresCaregiver: true, status: .scheduled))
            snapshot.requests.insert(HelpRequest(id: UUID(), childId: input.childId, eventId: eventId, requestType: input.type.id.uuidString, requestTypeLabel: input.type.label, startsAt: input.startsAt, location: input.location, notes: input.notes.isEmpty ? nil : input.notes, status: .open), at: 0)
            return
        }
        guard let session else { return }
        do { try await client.createHelpRequest(input, session: session); await refresh() } catch { errorMessage = error.localizedDescription }
    }

    func createHandoff(_ input: NewHandoff) async {
        if isDemo {
            snapshot.handoffs.insert(Handoff(id: UUID(), childId: input.childId, fromMemberId: input.fromMemberId, toMemberId: input.toMemberId, scheduledAt: input.scheduledAt, location: input.location, notes: input.notes, status: .scheduled, handoffItems: input.itemLabels.enumerated().map { .init(id: UUID(), label: $0.element, isReady: false, position: $0.offset) }), at: 0)
            return
        }
        guard let session, let householdId = snapshot.household?.id, let memberId = snapshot.currentMemberId else { return }
        do { try await client.createHandoff(input, householdId: householdId, memberId: memberId, session: session); await refresh() } catch { errorMessage = error.localizedDescription }
    }

    func inviteCaregiver(email: String, relationship: String, role: MemberRole, capabilities: [Capability], childIds: [UUID]) async {
        if isDemo {
            snapshot.members.append(VillageMember(id: UUID(), role: role, relationshipLabel: relationship, status: "INVITED", profile: .init(displayName: email), memberCapabilities: capabilities.map { .init(capability: $0) }))
            return
        }
        guard let session, let household = snapshot.household else { return }
        do { try await client.sendInvitation(email: email, relationship: relationship, role: role, capabilities: capabilities, childIds: childIds, household: household, inviterName: currentMember?.displayName ?? "A caregiver", session: session) }
        catch { errorMessage = error.localizedDescription }
    }

    func toggleHandoffItem(handoffId: UUID, itemId: UUID) async {
        guard let handoffIndex = snapshot.handoffs.firstIndex(where: { $0.id == handoffId }),
              let itemIndex = snapshot.handoffs[handoffIndex].handoffItems?.firstIndex(where: { $0.id == itemId }) else { return }
        let ready = !(snapshot.handoffs[handoffIndex].handoffItems?[itemIndex].isReady ?? false)
        snapshot.handoffs[handoffIndex].handoffItems?[itemIndex].isReady = ready
        if !isDemo, let session { do { try await client.updateHandoffItem(itemId, ready: ready, session: session) } catch { errorMessage = error.localizedDescription } }
    }

    func acknowledgeHandoff(_ id: UUID) async {
        guard let index = snapshot.handoffs.firstIndex(where: { $0.id == id }) else { return }
        snapshot.handoffs[index].status = .completed
        snapshot.handoffs[index].acceptedAt = .now
        if !isDemo, let session { do { try await client.acknowledgeHandoff(id, session: session) } catch { errorMessage = error.localizedDescription; await refresh() } }
    }

    func acceptHelpRequest(_ id: UUID) async {
        guard let index = snapshot.requests.firstIndex(where: { $0.id == id }) else { return }
        snapshot.requests[index].status = .assigned
        snapshot.requests[index].assignedMemberId = snapshot.currentMemberId
        if !isDemo, let session { do { try await client.acceptHelpRequest(id, session: session) } catch { errorMessage = error.localizedDescription; await refresh() } }
    }

    func markNotificationsRead() async {
        for index in snapshot.notifications.indices { snapshot.notifications[index].readAt = .now }
        if !isDemo, let session, let memberId = snapshot.currentMemberId { try? await client.markNotificationsRead(memberId: memberId, session: session) }
    }

    private func perform(_ operation: () async throws -> Void) async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do { try await operation() } catch { errorMessage = error.localizedDescription }
    }

    private func formatter(dateStyle: DateFormatter.Style, timeStyle: DateFormatter.Style) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = dateStyle
        formatter.timeStyle = timeStyle
        formatter.timeZone = householdCalendar.timeZone
        return formatter
    }
}
