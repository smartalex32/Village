import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Household") { LabeledContent("Name", value: store.snapshot.household?.name ?? "Village"); LabeledContent("Time zone", value: store.snapshot.household?.timezone ?? TimeZone.current.identifier) }
                Section("Account") { LabeledContent("Signed in as", value: store.currentMember?.displayName ?? (store.isDemo ? "Demo parent" : "Member")) }
                Section { Button("Sign out", role: .destructive) { Task { await store.signOut(); dismiss() } } }
            }
            .navigationTitle("Account")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
