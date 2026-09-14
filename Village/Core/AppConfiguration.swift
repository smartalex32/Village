import Foundation

struct AppConfiguration: Sendable {
    let supabaseURL: URL?
    let publishableKey: String
    let linkBaseURL: URL?

    var isRemoteConfigured: Bool { supabaseURL != nil && !publishableKey.isEmpty }

    static var current: AppConfiguration {
        let info = Bundle.main.infoDictionary ?? [:]
        let environment = ProcessInfo.processInfo.environment
        let urlString = environment["SUPABASE_URL"] ?? info["SUPABASE_URL"] as? String ?? ""
        let key = environment["SUPABASE_PUBLISHABLE_KEY"] ?? info["SUPABASE_PUBLISHABLE_KEY"] as? String ?? ""
        let link = environment["LINK_BASE_URL"] ?? info["LINK_BASE_URL"] as? String ?? ""
        return AppConfiguration(supabaseURL: URL(string: urlString), publishableKey: key, linkBaseURL: URL(string: link))
    }
}
