import SwiftUI

@main
struct VillageApp: App {
    @StateObject private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(VillageTheme.forest)
                .task { await store.launch() }
        }
    }
}
