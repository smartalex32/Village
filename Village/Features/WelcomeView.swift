import SwiftUI

struct WelcomeView: View {
    @State private var authMode: AuthMode?

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                Spacer()
                Image(systemName: "house.and.flag.fill")
                    .font(.system(size: 78))
                    .foregroundStyle(VillageTheme.forest)
                    .symbolRenderingMode(.hierarchical)
                Text("Village")
                    .font(.system(size: 48, weight: .black, design: .rounded))
                    .foregroundStyle(VillageTheme.forestDark)
                Text("A calmer way to coordinate care for the people you care about most.")
                    .font(.title3)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(VillageTheme.muted)
                    .padding(.horizontal, 34)
                    .padding(.top, 16)
                Spacer()
                HillsView().frame(height: max(150, geometry.size.height * 0.23))
                VStack(spacing: 12) {
                    Button("Get Started") { authMode = .signUp }
                        .buttonStyle(PrimaryButtonStyle())
                    Button("Sign In") { authMode = .signIn }
                        .buttonStyle(SecondaryButtonStyle())
                    Button("Explore the demo") { authMode = .demo }
                        .font(.subheadline.weight(.semibold))
                    Text("Your family. Your people. Your village.")
                        .font(.caption).foregroundStyle(VillageTheme.muted)
                }
                .padding(16)
            }
        }
        .background(VillageTheme.canvas)
        .sheet(item: $authMode) { mode in AuthView(mode: mode) }
    }
}

enum AuthMode: String, Identifiable { case signIn, signUp, demo; var id: String { rawValue } }

private struct HillsView: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                Color(red: 0.902, green: 0.961, blue: 0.949)
                Circle().fill(Color(red: 1, green: 0.827, blue: 0.6)).frame(width: 68).offset(y: -64)
                Ellipse().fill(Color(red: 0.663, green: 0.839, blue: 0.8)).frame(width: proxy.size.width * 1.3, height: 150).offset(x: -100, y: 70)
                Ellipse().fill(Color(red: 0.439, green: 0.682, blue: 0.506)).frame(width: proxy.size.width * 1.2, height: 135).offset(x: 130, y: 75)
                Image(systemName: "house.fill").font(.system(size: 60)).foregroundStyle(Color(red: 0.957, green: 0.894, blue: 0.82)).padding(.bottom, 18)
            }.clipped()
        }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.fontWeight(.bold).frame(maxWidth: .infinity).padding(.vertical, 15)
            .foregroundStyle(.white).background(VillageTheme.forest.opacity(configuration.isPressed ? 0.8 : 1), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.fontWeight(.bold).frame(maxWidth: .infinity).padding(.vertical, 14)
            .foregroundStyle(VillageTheme.forest).background(.white, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(VillageTheme.forest.opacity(0.2)))
    }
}
