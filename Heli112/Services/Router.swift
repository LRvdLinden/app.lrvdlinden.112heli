import SwiftUI

/// Navigation shared by deep links (heli112://aircraft/<hex>), notifications and widgets.
@MainActor
final class Router: ObservableObject {
    static let shared = Router()

    enum Tab: Hashable { case kaart, toestellen, historie, instellingen }

    @Published var tab: Tab = .kaart
    /// Aircraft to show on the map (opens its detail sheet).
    @Published var focusHex: String?
    /// Spot of a "meerdere helikopters op één plek" push to centre the map on.
    @Published var focusSpot: (lat: Double, lon: Double)?
    /// True while a sheet is open; the review prompt waits for a calm moment.
    @Published var sheetOpen = false

    func open(hex: String) {
        tab = .kaart
        focusHex = hex.lowercased()
    }

    func open(url: URL) {
        guard url.scheme == "heli112" else { return }
        let parts = url.pathComponents.filter { $0 != "/" }
        if url.host() == "aircraft", let hex = parts.first { open(hex: hex) }
        else if url.host() == "history" { tab = .historie }
        else { tab = .kaart }
    }

    /// From the custom keys of a push (see worker/src/engine.js → notify).
    func open(push info: [AnyHashable: Any]) {
        if let hex = info["hex"] as? String {
            open(hex: hex)
        } else if let lat = info["lat"] as? Double, let lon = info["lon"] as? Double {
            tab = .kaart
            focusSpot = (lat, lon)
        }
    }
}
