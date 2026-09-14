import SwiftUI

enum VillageTheme {
    static let canvas = Color(red: 0.957, green: 0.98, blue: 0.973)
    static let surface = Color.white
    static let surfaceMuted = Color(red: 0.933, green: 0.961, blue: 0.957)
    static let forest = Color(red: 0.051, green: 0.357, blue: 0.302)
    static let forestDark = Color(red: 0.031, green: 0.243, blue: 0.212)
    static let mint = Color(red: 0.867, green: 0.957, blue: 0.918)
    static let blue = Color(red: 0.894, green: 0.941, blue: 1)
    static let ink = Color(red: 0.071, green: 0.129, blue: 0.122)
    static let muted = Color(red: 0.376, green: 0.443, blue: 0.431)
    static let amber = Color(red: 1, green: 0.949, blue: 0.871)
    static let danger = Color(red: 0.725, green: 0.263, blue: 0.231)
}

struct VillageCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: VillageTheme.forest.opacity(0.07), radius: 12, y: 5)
    }
}

struct InitialsAvatar: View {
    let name: String
    var color = VillageTheme.mint
    var size: CGFloat = 44

    var body: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: size * 0.38, weight: .bold, design: .rounded))
            .foregroundStyle(VillageTheme.forestDark)
            .frame(width: size, height: size)
            .background(color, in: Circle())
            .accessibilityLabel(name)
    }
}

struct EmptyState: View {
    let symbol: String
    let title: String
    let message: String
    var body: some View {
        ContentUnavailableView(title, systemImage: symbol, description: Text(message))
            .foregroundStyle(VillageTheme.muted)
    }
}
