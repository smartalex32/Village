import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(store.snapshot.notifications) { notification in
                HStack(alignment: .top, spacing: 12) {
                    Circle().fill(notification.readAt == nil ? VillageTheme.forest : .clear).frame(width: 8, height: 8).padding(.top, 7)
                    VStack(alignment: .leading, spacing: 4) { Text(notification.title).font(.headline); Text(notification.body).foregroundStyle(VillageTheme.muted); Text(notification.createdAt.formatted(.relative(presentation: .named))).font(.caption).foregroundStyle(.tertiary) }
                }
            }
            .overlay { if store.snapshot.notifications.isEmpty { EmptyState(symbol: "bell.slash", title: "No notifications", message: "Updates from your village will show up here.") } }
            .navigationTitle("Notifications")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
                ToolbarItem(placement: .primaryAction) { Button("Mark all read") { Task { await store.markNotificationsRead() } }.disabled(store.unreadCount == 0) }
            }
        }
    }
}
