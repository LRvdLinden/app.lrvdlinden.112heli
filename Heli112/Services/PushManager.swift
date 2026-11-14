import Foundation
import SwiftUI
import UserNotifications
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Pushmeldingen: permission, device token and the user's choices, sent to the 112heli worker.
@MainActor
final class PushManager: ObservableObject {
    static let shared = PushManager()

    @Published private(set) var authorization: UNAuthorizationStatus = .notDetermined
    @Published private(set) var token: String?

    // Choices (stored locally and sent to the server).
    @Published var takeoff: Bool { didSet { save() } }
    @Published var incidents: Bool { didSet { save() } }
    @Published var favAlerts: Bool { didSet { save() } }
    @Published var soorten: Set<Soort> { didSet { save() } }
    /// 0 = heel Nederland.
    @Published var radiusKm: Int { didSet { save() } }
    /// Push when a favourite changes callsign (often the start of a call-out).
    @Published var callsign: Bool { didSet { save() } }
    /// Own zones: a push when anything of the chosen kinds flies above them.
    @Published var zones: [Zone] { didSet { save() } }

    struct Zone: Codable, Hashable, Identifiable {
        var naam: String
        var lat: Double
        var lon: Double
        var km: Double
        var id: String { "\(naam)-\(lat)-\(lon)" }
    }

    private let defaults = UserDefaults.standard
    private var syncTask: Task<Void, Never>?

    private init() {
        takeoff = defaults.object(forKey: "push.takeoff") as? Bool ?? true
        incidents = defaults.object(forKey: "push.incidents") as? Bool ?? true
        favAlerts = defaults.object(forKey: "push.favAlerts") as? Bool ?? true
        let stored = defaults.stringArray(forKey: "push.soorten")?.compactMap(Soort.init(rawValue:))
        soorten = stored.map { Set($0) } ?? Soort.standaard
        radiusKm = defaults.object(forKey: "push.radiusKm") as? Int ?? 50
        callsign = defaults.object(forKey: "push.callsign") as? Bool ?? true
        zones = (defaults.data(forKey: "push.zones")).flatMap { try? JSONDecoder().decode([Zone].self, from: $0) } ?? []
        token = defaults.string(forKey: "push.token")
        NotificationCenter.default.addObserver(forName: .favoritesChanged, object: nil, queue: .main) { _ in
            Task { @MainActor in PushManager.shared.scheduleSync() }
        }
    }

    var isAuthorized: Bool { authorization == .authorized || authorization == .provisional }

    func refreshStatus() async {
        authorization = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        if isAuthorized { registerForRemote() }
    }

    /// Asks permission (only from a button or the welcome screen, never at first start) and registers.
    func requestPermission() async {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        await refreshStatus()
        if granted { registerForRemote() }
    }

    private func registerForRemote() {
        #if os(iOS)
        UIApplication.shared.registerForRemoteNotifications()
        #elseif os(macOS)
        NSApplication.shared.registerForRemoteNotifications()
        #endif
    }

    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        token = hex
        defaults.set(hex, forKey: "push.token")
        scheduleSync()
    }

    private func save() {
        defaults.set(takeoff, forKey: "push.takeoff")
        defaults.set(incidents, forKey: "push.incidents")
        defaults.set(favAlerts, forKey: "push.favAlerts")
        defaults.set(soorten.map(\.rawValue).sorted(), forKey: "push.soorten")
        defaults.set(radiusKm, forKey: "push.radiusKm")
        defaults.set(callsign, forKey: "push.callsign")
        defaults.set(try? JSONEncoder().encode(zones), forKey: "push.zones")
        scheduleSync()
    }

    /// Sends the choices after a short pause, so a row of toggles is one request.
    func scheduleSync() {
        syncTask?.cancel()
        syncTask = Task {
            try? await Task.sleep(for: .seconds(1.5))
            guard !Task.isCancelled else { return }
            await sync()
        }
    }

    /// Sends a testmelding via the server and Apple. Returns a short Dutch line for the settings screen.
    func sendTest() async -> (ok: Bool, tekst: String) {
        guard let token else { return (false, "Dit toestel heeft nog geen pushadres. Open de app opnieuw en probeer het nog eens.") }
        syncTask?.cancel()
        await sync()
        do {
            let r = try await HeliAPI.shared.testPush(token: token)
            if r.ok { return (true, "Verstuurd. Je krijgt zo een testmelding.") }
            return (false, r.reden ?? "Apple weigerde de melding.")
        } catch {
            return (false, "Geen verbinding met de server. Probeer het later opnieuw.")
        }
    }

    private func sync() async {
        guard let token else { return }
        var body: [String: Any] = [
            "token": token,
            "platform": platform,
            "environment": HeliAPI.pushEnvironment,
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
            "enabled": isAuthorized,
            "takeoff": takeoff,
            "incidents": incidents,
            "favAlerts": favAlerts,
            "soorten": soorten.map(\.rawValue).sorted(),
            "favorites": Favorites.all(),
            "radiusKm": radiusKm,
            "callsign": callsign,
            "zones": zones.map { ["naam": $0.naam, "lat": $0.lat, "lon": $0.lon, "km": $0.km] },
        ]
        // About 1 km precision is enough for "within 50 km".
        if let loc = LocationManager.shared.location {
            body["lat"] = (loc.coordinate.latitude * 100).rounded() / 100
            body["lon"] = (loc.coordinate.longitude * 100).rounded() / 100
        }
        try? await HeliAPI.shared.registerDevice(body)
    }

    private var platform: String {
        #if os(macOS)
        "macos"
        #else
        UIDevice.current.userInterfaceIdiom == .pad ? "ipados" : "ios"
        #endif
    }
}
