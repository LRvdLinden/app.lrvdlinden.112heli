#if os(iOS)
import ActivityKit
import Foundation

/// Live Activity that follows one aircraft on the lock screen and in the Dynamic Island.
/// The worker sends updates with the same keys (see worker/src/engine.js → activityState).
struct HeliActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var naam: String
        var soort: String
        var icoon: String
        var reg: String
        var status: String
        var airborne: Bool
        var altitudeFt: Double
        var speedKt: Double
        var heading: Double
        var lat: Double
        var lon: Double
        /// Seconds since 1970 (not Date: ActivityKit decodes Date as seconds since 2001).
        var updated: Double
    }

    var hex: String
}

extension HeliActivityAttributes.ContentState {
    var soortValue: Soort { Soort(rawValue: soort) ?? .defensie }
    var afbeelding: String { Aircraft.afbeelding(soort: soortValue, icoon: icoon.isEmpty ? nil : icoon, type: nil, key: nil) }

    init(aircraft a: Aircraft) {
        self.init(naam: a.title, soort: a.soort.rawValue, icoon: a.icoon ?? "", reg: a.reg ?? "", status: a.status, airborne: a.airborne,
                  altitudeFt: a.alt ?? 0, speedKt: a.gs ?? 0, heading: a.track ?? 0,
                  lat: a.lat ?? 0, lon: a.lon ?? 0, updated: a.seen ?? Date().timeIntervalSince1970)
    }
}
#endif
