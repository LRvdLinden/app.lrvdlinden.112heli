import Foundation

/// Data shared between the app and its widgets (App Group).
enum AppGroup {
    static let id = "group.app.lrvdlinden.112HELI"
    static var defaults: UserDefaults { UserDefaults(suiteName: id) ?? .standard }
}

/// Favourite aircraft (ICAO hex codes).
enum Favorites {
    private static let key = "favorites.hex"

    static func all() -> [String] { AppGroup.defaults.stringArray(forKey: key) ?? [] }

    static func save(_ list: [String]) { AppGroup.defaults.set(list, forKey: key) }
}

/// Last live snapshot, so the app and widgets show something straight away (also offline).
enum SnapshotCache {
    private static let key = "live.snapshot"

    static func save(_ snapshot: LiveSnapshot) {
        if let data = try? JSONEncoder().encode(snapshot) { AppGroup.defaults.set(data, forKey: key) }
    }

    static func load() -> LiveSnapshot? {
        guard let data = AppGroup.defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(LiveSnapshot.self, from: data)
    }
}
