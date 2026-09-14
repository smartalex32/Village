import Foundation
import Security

enum KeychainStore {
    private static let service = "com.village.mobile.session"

    static func save(_ session: Session) throws {
        let data = try JSONEncoder.village.encode(session)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service]
        SecItemDelete(query as CFDictionary)
        var insert = query
        insert[kSecValueData as String] = data
        guard SecItemAdd(insert as CFDictionary, nil) == errSecSuccess else { throw URLError(.cannotWriteToFile) }
    }

    static func load() -> Session? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder.village.decode(Session.self, from: data)
    }

    static func clear() {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service] as CFDictionary)
    }
}
