import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        Group {
            switch store.phase {
            case .launching:
                ProgressView("Opening your village…")
            case .welcome:
                WelcomeView()
            case .onboarding:
                OnboardingView()
            case .ready:
                MainTabView()
            }
        }
        .background(VillageTheme.canvas.ignoresSafeArea())
        .alert("Something went wrong", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
            Button("OK") { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "Please try again.")
        }
    }
}
