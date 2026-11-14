import Foundation
import SwiftUI
#if canImport(WidgetKit) && !os(tvOS)
import WidgetKit
#endif

/// Live aircraft for the map, the lists and Apple TV. Polls the API every 10 seconds while visible.
@MainActor
final class LiveStore: ObservableObject {
    @Published private(set) var aircraft: [Aircraft] = []
    @Published private(set) var incidents: [Incident] = []
    @Published private(set) var weer: WeerBeperking?
    @Published private(set) var updated: Date?
    @Published private(set) var failed = false
    @Published private(set) var loaded = false
    @Published private(set) var favorites: Set<String> = []
    /// Map layers that are switched on (LuchtSoort ids); Lifeliners, Zulu and (for fun) Max Verstappen by default.
    @Published var lagen: Set<String> = LiveStore.loadLagen() { didSet { UserDefaults.standard.set(Array(lagen), forKey: "map.lagen") } }

    /// "Offline verbergen": only aircraft in the air on the map (not on the ground, at the base or out of view).
    @Published var hideOffline: Bool = UserDefaults.standard.bool(forKey: "map.hideOffline") {
        didSet { UserDefaults.standard.set(hideOffline, forKey: "map.hideOffline") }
    }

    /// Show helicopters and/or aeroplanes (map, lists and Apple TV).
    @Published var toonHelis: Bool = UserDefaults.standard.object(forKey: "map.toonHelis") as? Bool ?? true {
        didSet { UserDefaults.standard.set(toonHelis, forKey: "map.toonHelis") }
    }
    @Published var toonVliegtuigen: Bool = UserDefaults.standard.object(forKey: "map.toonVliegtuigen") as? Bool ?? true {
        didSet { UserDefaults.standard.set(toonVliegtuigen, forKey: "map.toonVliegtuigen") }
    }
    /// Any filter switched on (to mark the filter button).
    var filterActief: Bool { hideOffline || !toonHelis || !toonVliegtuigen }
    /// Helicopter/aeroplane choice, used everywhere aircraft are listed.
    func toont(_ a: Aircraft) -> Bool { a.isHeli ? toonHelis : toonVliegtuigen }

    private var pollTask: Task<Void, Never>?

    init() {
        favorites = Set(Favorites.all())
        if let cached = SnapshotCache.load() { apply(cached) }
    }

    /// On the map: the chosen layers plus favourites; with "offline verbergen" only what is in the air.
    var visibleAircraft: [Aircraft] {
        aircraft.filter { (lagen.contains($0.laag) || favorites.contains($0.hex)) && (!hideOffline || $0.isOnline) && toont($0) }
    }

    private static func loadLagen() -> Set<String> {
        if let list = UserDefaults.standard.stringArray(forKey: "map.lagen") { return Set(list) }
        return ["trauma", "politie", "verstappen"]
    }
    var airborne: [Aircraft] { aircraft.filter(\.airborne) }
    var favoriteAircraft: [Aircraft] { aircraft.filter { favorites.contains($0.hex) } }

    func aircraft(hex: String) -> Aircraft? { aircraft.first { $0.hex == hex } }
    func isFavorite(_ hex: String) -> Bool { favorites.contains(hex) }

    func start() {
        guard pollTask == nil else { return }
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                try? await Task.sleep(for: .seconds(10))
            }
        }
    }

    func stop() {
        pollTask?.cancel()
        pollTask = nil
    }

    func refresh() async {
        do {
            let snapshot = try await HeliAPI.shared.live()
            apply(snapshot)
            SnapshotCache.save(snapshot)
            failed = false
        } catch {
            if !(error is CancellationError) { failed = true }
        }
        loaded = true
    }

    func toggleFavorite(_ hex: String) {
        if favorites.contains(hex) { favorites.remove(hex) } else { favorites.insert(hex) }
        Favorites.save(favorites.sorted())
        #if canImport(WidgetKit) && !os(tvOS)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
        NotificationCenter.default.post(name: .favoritesChanged, object: nil)
    }

    private func apply(_ snapshot: LiveSnapshot) {
        // In the air first, then by name.
        aircraft = snapshot.aircraft.sorted {
            if $0.airborne != $1.airborne { return $0.airborne }
            return $0.title.localizedStandardCompare($1.title) == .orderedAscending
        }
        incidents = snapshot.incidents
        weer = snapshot.weer
        updated = Date(timeIntervalSince1970: snapshot.updated)
    }
}

extension Notification.Name {
    static let favoritesChanged = Notification.Name("heli112.favoritesChanged")
}
