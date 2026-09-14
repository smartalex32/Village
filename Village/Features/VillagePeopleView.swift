import SwiftUI

struct VillagePeopleView: View {
    @EnvironmentObject private var store: AppStore
    @State private var showsInvite = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(store.snapshot.members) { member in
                        NavigationLink { MemberDetailView(member: member) } label: {
                            VillageCard {
                                HStack(spacing: 14) {
                                    InitialsAvatar(name: member.displayName)
                                    VStack(alignment: .leading, spacing: 3) { Text(member.displayName).font(.headline); Text("\(member.relationshipLabel) · \(member.role.label)").font(.caption).foregroundStyle(VillageTheme.muted) }
                                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                                }
                            }
                        }.buttonStyle(.plain)
                    }
                }.padding(16)
            }.background(VillageTheme.canvas).navigationTitle("Your village")
                .toolbar { if store.canManage { ToolbarItem(placement: .primaryAction) { Button { showsInvite = true } label: { Label("Invite caregiver", systemImage: "person.badge.plus") } } } }
                .sheet(isPresented: $showsInvite) { InviteCaregiverView() }
        }
    }
}

private struct InviteCaregiverView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var relationship = "Caregiver"
    @State private var role: MemberRole = .trustedCaregiver
    @State private var capabilities: Set<Capability> = [.pickup]
    @State private var childIds: Set<UUID> = []

    var body: some View {
        NavigationStack {
            Form {
                Section("Caregiver") {
                    TextField("Email", text: $email).textContentType(.emailAddress).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                    TextField("Relationship", text: $relationship)
                    Picker("Access", selection: $role) {
                        Text(MemberRole.parentGuardian.label).tag(MemberRole.parentGuardian)
                        Text(MemberRole.trustedCaregiver.label).tag(MemberRole.trustedCaregiver)
                        Text(MemberRole.limitedCaregiver.label).tag(MemberRole.limitedCaregiver)
                    }
                }
                Section("Children") { ForEach(store.activeChildren) { child in Toggle(child.firstName, isOn: binding(for: child.id, in: $childIds)) } }
                Section("Can help with") { ForEach(Capability.allCases.filter { $0 != .other }) { capability in Toggle(capability.label, isOn: binding(for: capability, in: $capabilities)) } }
            }
            .navigationTitle("Invite caregiver")
            .onAppear { if childIds.isEmpty { childIds = Set(store.activeChildren.map(\.id)) } }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Send") { Task { await store.inviteCaregiver(email: email, relationship: relationship, role: role, capabilities: Array(capabilities), childIds: Array(childIds)); if store.errorMessage == nil { dismiss() } } }.disabled(!email.contains("@") || relationship.trimmingCharacters(in: .whitespaces).isEmpty || childIds.isEmpty) }
            }
        }
    }

    private func binding<Value: Hashable>(for value: Value, in set: Binding<Set<Value>>) -> Binding<Bool> {
        Binding(get: { set.wrappedValue.contains(value) }, set: { enabled in
            var values = set.wrappedValue
            if enabled { values.insert(value) } else { values.remove(value) }
            set.wrappedValue = values
        })
    }
}

struct MemberDetailView: View {
    let member: VillageMember
    var body: some View {
        List {
            Section {
                HStack { Spacer(); VStack { InitialsAvatar(name: member.displayName, size: 82); Text(member.displayName).font(.title2.bold()); Text(member.relationshipLabel).foregroundStyle(VillageTheme.muted) }; Spacer() }
            }
            Section("Role") { Text(member.role.label) }
            Section("Can help with") {
                if member.capabilities.isEmpty { Text("No capabilities selected").foregroundStyle(VillageTheme.muted) }
                ForEach(member.capabilities) { Label($0.label, systemImage: "checkmark.circle.fill").foregroundStyle(VillageTheme.forest) }
            }
        }.navigationTitle("Caregiver").navigationBarTitleDisplayMode(.inline)
    }
}
