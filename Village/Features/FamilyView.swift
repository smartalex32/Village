import SwiftUI

struct FamilyView: View {
    @EnvironmentObject private var store: AppStore
    @State private var showsNewChild = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(store.activeChildren) { child in
                        NavigationLink { ChildDetailView(child: child) } label: {
                            VillageCard {
                                HStack(spacing: 14) {
                                    InitialsAvatar(name: child.firstName, color: VillageTheme.blue, size: 52)
                                    VStack(alignment: .leading) { Text(child.displayName).font(.headline); if let birth = child.birthDate { Text("Born \(birth)").font(.subheadline).foregroundStyle(VillageTheme.muted) } }
                                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                                }
                            }
                        }.buttonStyle(.plain)
                    }
                }.padding(16)
            }.background(VillageTheme.canvas).navigationTitle("Family")
                .toolbar { if store.canManage { ToolbarItem(placement: .primaryAction) { Button { showsNewChild = true } label: { Label("Add child", systemImage: "plus") } } } }
                .sheet(isPresented: $showsNewChild) { NewChildView() }
        }
    }
}

private struct NewChildView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var firstName = ""

    var body: some View {
        NavigationStack {
            Form { Section("Child") { TextField("First name", text: $firstName).textContentType(.name) } }
                .navigationTitle("Add child")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) { Button("Add") { Task { await store.addChild(firstName: firstName.trimmingCharacters(in: .whitespaces)); dismiss() } }.disabled(firstName.trimmingCharacters(in: .whitespaces).isEmpty) }
                }
        }
    }
}

struct ChildDetailView: View {
    let child: Child
    @EnvironmentObject private var store: AppStore
    private var events: [CareEvent] { store.snapshot.events.filter { $0.childId == child.id && $0.status == .scheduled }.sorted { $0.startsAt < $1.startsAt } }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                InitialsAvatar(name: child.firstName, color: VillageTheme.blue, size: 90)
                Text(child.displayName).font(.largeTitle.bold())
                VStack(alignment: .leading, spacing: 10) {
                    Text("Upcoming schedule").font(.title3.bold())
                    if events.isEmpty { EmptyState(symbol: "calendar", title: "No upcoming events", message: "This child’s schedule is clear.") }
                    ForEach(events) { EventRow(event: $0) }
                }
            }.padding(16)
        }.background(VillageTheme.canvas).navigationTitle(child.firstName).navigationBarTitleDisplayMode(.inline)
    }
}
