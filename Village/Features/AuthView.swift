import SwiftUI

struct AuthView: View {
    let mode: AuthMode
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmationSent = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if mode == .signUp { TextField("Your name", text: $name).textContentType(.name) }
                    if mode != .demo {
                        TextField("Email", text: $email).textContentType(.emailAddress).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                        SecureField("Password", text: $password).textContentType(mode == .signUp ? .newPassword : .password)
                    }
                }
                Section {
                    Button(actionTitle) { Task { await submit() } }
                        .disabled(!isValid || store.isBusy)
                    if store.isBusy { ProgressView().frame(maxWidth: .infinity) }
                }
                if mode == .demo {
                    Section("Demo mode") { Text("Demo data stays on this device. You can explore schedules, coverage gaps, handoffs, and family views without an account.") }
                }
            }
            .navigationTitle(title)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .alert("Check your email", isPresented: $confirmationSent) {
                Button("OK") { dismiss() }
            } message: { Text("Follow the confirmation link, then return here to sign in.") }
        }
    }

    private var title: String { mode == .signUp ? "Create account" : mode == .signIn ? "Welcome back" : "Explore Village" }
    private var actionTitle: String { mode == .signUp ? "Create account" : mode == .signIn ? "Sign in" : "Open demo" }
    private var isValid: Bool { mode == .demo || (email.contains("@") && password.count >= 8 && (mode == .signIn || !name.trimmingCharacters(in: .whitespaces).isEmpty)) }

    private func submit() async {
        switch mode {
        case .demo: store.exploreDemo(); dismiss()
        case .signIn: await store.signIn(email: email, password: password); if store.phase != .welcome { dismiss() }
        case .signUp:
            confirmationSent = await store.signUp(name: name, email: email, password: password)
            if !confirmationSent && store.phase != .welcome { dismiss() }
        }
    }
}
