import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var store: AppStore
    @State private var showsNotifications = false
    @State private var showsAccount = false

    private var todayEvents: [CareEvent] {
        store.snapshot.events.filter { store.householdCalendar.isDateInToday($0.startsAt) && $0.status == .scheduled }.sorted { $0.startsAt < $1.startsAt }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    if store.isDemo { demoBanner }
                    section("Children") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) { ForEach(store.activeChildren) { child in childCard(child) } }
                        }
                    }
                    if !store.coverageGaps.isEmpty {
                        section("Needs attention") {
                            ForEach(store.coverageGaps.prefix(2)) { event in
                                VillageCard {
                                    Label("\(event.title) needs a caregiver", systemImage: "exclamationmark.circle.fill").foregroundStyle(VillageTheme.danger)
                                    Text("\(store.day(event.startsAt)) at \(store.time(event.startsAt))").font(.subheadline).foregroundStyle(VillageTheme.muted)
                                }
                            }
                        }
                    }
                    section("Up next") {
                        if todayEvents.isEmpty { EmptyState(symbol: "calendar.badge.checkmark", title: "A clear day", message: "Nothing else is scheduled today.") }
                        ForEach(todayEvents.prefix(4)) { event in EventRow(event: event) }
                    }
                }.padding(16)
            }
            .background(VillageTheme.canvas)
            .navigationTitle("Today")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showsAccount = true } label: { Image(systemName: "person.crop.circle") }
                    Button { showsNotifications = true } label: {
                        Image(systemName: store.unreadCount == 0 ? "bell" : "bell.badge.fill")
                    }.accessibilityLabel("\(store.unreadCount) unread notifications")
                }
            }
            .refreshable { await store.refresh() }
            .sheet(isPresented: $showsNotifications) { NotificationsView() }
            .sheet(isPresented: $showsAccount) { AccountView() }
        }
    }

    private var demoBanner: some View {
        Label("Demo village — changes stay on this device", systemImage: "sparkles")
            .font(.caption.weight(.semibold)).foregroundStyle(VillageTheme.forest)
            .padding(10).frame(maxWidth: .infinity).background(VillageTheme.mint, in: Capsule())
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) { Text(title).font(.title3.bold()); content() }
    }

    private func childCard(_ child: Child) -> some View {
        let handoff = store.snapshot.handoffs.first { $0.childId == child.id && $0.status != .completed && $0.status != .cancelled }
        return VillageCard {
            HStack { InitialsAvatar(name: child.firstName); VStack(alignment: .leading) { Text(child.firstName).font(.headline); Text(handoff == nil ? "No active handoff" : "Handoff at \(store.time(handoff!.scheduledAt))").font(.caption).foregroundStyle(VillageTheme.muted) } }
        }.frame(width: 230)
    }
}

struct EventRow: View {
    let event: CareEvent
    @EnvironmentObject private var store: AppStore
    var body: some View {
        VillageCard {
            HStack(spacing: 14) {
                VStack { Text(store.time(event.startsAt)).font(.subheadline.bold()).foregroundStyle(VillageTheme.forest) }.frame(width: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.title).font(.headline)
                    if let child = store.snapshot.children.first(where: { $0.id == event.childId }) { Text(child.firstName).font(.subheadline).foregroundStyle(VillageTheme.muted) }
                    if let location = event.location, !location.isEmpty { Label(location, systemImage: "mappin").font(.caption).foregroundStyle(VillageTheme.muted) }
                }
                Spacer()
                if event.requiresCaregiver && event.assignedMemberId == nil { Image(systemName: "exclamationmark.circle.fill").foregroundStyle(VillageTheme.danger) }
            }
        }
    }
}
