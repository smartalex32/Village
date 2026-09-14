import SwiftUI

struct ActionsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var presentedForm: ActionForm?

    var activeRequests: [HelpRequest] { store.snapshot.requests.filter { $0.status == .open || $0.status == .assigned } }
    var activeHandoffs: [Handoff] { store.snapshot.handoffs.filter { $0.status == .scheduled || $0.status == .ready } }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    Text("Help requests").font(.title3.bold())
                    if activeRequests.isEmpty { EmptyState(symbol: "hands.sparkles", title: "No open requests", message: "Your village is covered right now.") }
                    ForEach(activeRequests) { request in
                        VillageCard {
                            Text(request.requestTypeLabel).font(.headline)
                            Text("\(store.day(request.startsAt)) at \(store.time(request.startsAt))").foregroundStyle(VillageTheme.muted)
                            Text(request.location).font(.subheadline)
                            if request.status == .open { Button("I can help") { Task { await store.acceptHelpRequest(request.id) } }.buttonStyle(.borderedProminent).padding(.top, 6) }
                        }
                    }
                    Text("Handoffs").font(.title3.bold())
                    if activeHandoffs.isEmpty { EmptyState(symbol: "checkmark.circle", title: "No active handoffs", message: "New handoffs will appear here.") }
                    ForEach(activeHandoffs) { handoff in NavigationLink { HandoffDetailView(handoffId: handoff.id) } label: { HandoffSummary(handoff: handoff) }.buttonStyle(.plain) }
                }.padding(16)
            }
            .background(VillageTheme.canvas)
            .navigationTitle("Actions")
            .toolbar {
                if store.canManage { ToolbarItem(placement: .primaryAction) {
                    Menu { Button("Ask for help", systemImage: "hands.sparkles") { presentedForm = .help }; Button("Create handoff", systemImage: "arrow.left.arrow.right") { presentedForm = .handoff } } label: { Label("New action", systemImage: "plus") }
                } }
            }
            .sheet(item: $presentedForm) { form in if form == .help { NewHelpRequestView() } else { NewHandoffView() } }
        }
    }
}

private enum ActionForm: String, Identifiable { case help, handoff; var id: String { rawValue } }

private struct NewHelpRequestView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var childId: UUID?
    @State private var typeId: UUID?
    @State private var startsAt = Date().addingTimeInterval(3600)
    @State private var location = ""
    @State private var context = ""
    @State private var notes = ""
    @State private var recipients: Set<UUID> = []

    private var selectedType: HelpRequestType? { store.snapshot.helpRequestTypes.first { $0.id == typeId } }

    var body: some View {
        NavigationStack {
            Form {
                Section("Request") {
                    Picker("Child", selection: $childId) { Text("Choose").tag(nil as UUID?); ForEach(store.activeChildren) { Text($0.firstName).tag($0.id as UUID?) } }
                    Picker("Help type", selection: $typeId) { Text("Choose").tag(nil as UUID?); ForEach(store.snapshot.helpRequestTypes) { Text($0.label).tag($0.id as UUID?) } }
                    DatePicker("When", selection: $startsAt)
                    TextField("Location", text: $location)
                    if selectedType?.isOther == true { TextField("What do you need?", text: $context, axis: .vertical) }
                    TextField("Care note (optional)", text: $notes, axis: .vertical)
                }
                Section("Ask") {
                    ForEach(eligibleMembers) { member in Toggle(member.displayName, isOn: recipientBinding(member.id)) }
                }
            }
            .navigationTitle("Ask for help")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Send") { submit() }.disabled(!isValid) }
            }
        }
    }

    private var eligibleMembers: [VillageMember] {
        store.snapshot.members.filter { member in
            let canSeeChild = store.isDemo || childId == nil || member.memberChildPermissions?.contains { $0.childId == childId } == true
            let hasCapability = selectedType?.capability == nil || member.capabilities.contains(selectedType!.capability!)
            return member.id != store.snapshot.currentMemberId && canSeeChild && hasCapability
        }
    }
    private var isValid: Bool { childId != nil && selectedType != nil && !location.trimmingCharacters(in: .whitespaces).isEmpty && !recipients.isEmpty && (selectedType?.isOther != true || !context.trimmingCharacters(in: .whitespaces).isEmpty) }
    private func recipientBinding(_ id: UUID) -> Binding<Bool> { Binding(get: { recipients.contains(id) }, set: { if $0 { recipients.insert(id) } else { recipients.remove(id) } }) }
    private func submit() { guard let childId, let type = selectedType else { return }; Task { await store.createHelpRequest(.init(childId: childId, type: type, startsAt: startsAt, location: location, context: context, notes: notes, recipientIds: Array(recipients))); if store.errorMessage == nil { dismiss() } } }
}

private struct NewHandoffView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var childId: UUID?
    @State private var fromId: UUID?
    @State private var toId: UUID?
    @State private var scheduledAt = Date().addingTimeInterval(3600)
    @State private var location = ""
    @State private var notes = ""
    @State private var checklist = "Backpack\nMedication\nWater bottle"

    var body: some View {
        NavigationStack {
            Form {
                Section("Transfer") {
                    Picker("Child", selection: $childId) { Text("Choose").tag(nil as UUID?); ForEach(store.activeChildren) { Text($0.firstName).tag($0.id as UUID?) } }
                    Picker("From", selection: $fromId) { Text("Choose").tag(nil as UUID?); ForEach(store.snapshot.members) { Text($0.displayName).tag($0.id as UUID?) } }
                    Picker("To", selection: $toId) { Text("Choose").tag(nil as UUID?); ForEach(store.snapshot.members) { Text($0.displayName).tag($0.id as UUID?) } }
                    DatePicker("When", selection: $scheduledAt)
                    TextField("Location", text: $location)
                    TextField("Care note (optional)", text: $notes, axis: .vertical)
                }
                Section("Checklist — one item per line") { TextEditor(text: $checklist).frame(minHeight: 110) }
            }
            .navigationTitle("Create handoff")
            .onAppear { fromId = fromId ?? store.snapshot.currentMemberId }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Create") { submit() }.disabled(childId == nil || fromId == nil || toId == nil || fromId == toId) }
            }
        }
    }

    private func submit() {
        guard let childId, let fromId, let toId else { return }
        let items = checklist.split(whereSeparator: \.isNewline).map { String($0).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        Task { await store.createHandoff(.init(childId: childId, fromMemberId: fromId, toMemberId: toId, scheduledAt: scheduledAt, location: location, notes: notes, itemLabels: items)); if store.errorMessage == nil { dismiss() } }
    }
}

struct HandoffSummary: View {
    let handoff: Handoff
    @EnvironmentObject private var store: AppStore
    var body: some View {
        VillageCard {
            HStack {
                Image(systemName: "arrow.left.arrow.right.circle.fill").font(.title).foregroundStyle(VillageTheme.forest)
                VStack(alignment: .leading) {
                    Text(store.snapshot.children.first(where: { $0.id == handoff.childId })?.firstName ?? "Handoff").font(.headline)
                    Text("\(store.day(handoff.scheduledAt)) at \(store.time(handoff.scheduledAt))").font(.subheadline).foregroundStyle(VillageTheme.muted)
                }
                Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }
        }
    }
}

struct HandoffDetailView: View {
    let handoffId: UUID
    @EnvironmentObject private var store: AppStore
    private var handoff: Handoff? { store.snapshot.handoffs.first { $0.id == handoffId } }

    var body: some View {
        ScrollView {
            if let handoff {
                VStack(alignment: .leading, spacing: 16) {
                    HandoffSummary(handoff: handoff)
                    if let location = handoff.location { Label(location, systemImage: "mappin.and.ellipse") }
                    if let notes = handoff.notes { VillageCard { Text("Care note").font(.headline); Text(notes).foregroundStyle(VillageTheme.muted) } }
                    Text("Ready to go").font(.title3.bold())
                    ForEach((handoff.handoffItems ?? []).sorted { $0.position < $1.position }) { item in
                        Button { Task { await store.toggleHandoffItem(handoffId: handoff.id, itemId: item.id) } } label: {
                            Label(item.label, systemImage: item.isReady ? "checkmark.circle.fill" : "circle").frame(maxWidth: .infinity, alignment: .leading).padding(12).background(.white, in: RoundedRectangle(cornerRadius: 12))
                        }.buttonStyle(.plain)
                    }
                    Button("Acknowledge handoff") { Task { await store.acknowledgeHandoff(handoff.id) } }.buttonStyle(PrimaryButtonStyle())
                }.padding(16)
            }
        }.background(VillageTheme.canvas).navigationTitle("Handoff")
    }
}
