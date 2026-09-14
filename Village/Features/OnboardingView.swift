import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var store: AppStore
    @State private var householdName = ""
    @State private var childName = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                Image(systemName: "person.3.fill").font(.system(size: 54)).foregroundStyle(VillageTheme.forest)
                Text("Start your village").font(.largeTitle.bold())
                Text("Create the private household where schedules, trusted caregivers, and handoffs come together.").foregroundStyle(VillageTheme.muted)
                VStack(spacing: 14) {
                    TextField("Household name", text: $householdName).textFieldStyle(.roundedBorder)
                    TextField("Child’s first name", text: $childName).textFieldStyle(.roundedBorder)
                }
                Button("Create household") { Task { await store.createHousehold(name: householdName, childName: childName) } }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(householdName.trimmingCharacters(in: .whitespaces).isEmpty || childName.trimmingCharacters(in: .whitespaces).isEmpty || store.isBusy)
                if store.isBusy { ProgressView().frame(maxWidth: .infinity) }
                Spacer()
            }
            .padding(24)
            .background(VillageTheme.canvas)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Sign out") { Task { await store.signOut() } } } }
        }
    }
}
