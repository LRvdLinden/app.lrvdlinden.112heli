import Foundation
import SwiftUI
import CoreLocation

/// Groups of aircraft – the same "soort" values as A-Alerts uses.
enum Soort: String, Codable, CaseIterable, Identifiable, Hashable, Sendable {
    case trauma, politie, kustwacht, defensie, kmar, regering, bijzonder

    var id: String { rawValue }

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Soort(rawValue: raw) ?? .defensie
    }

    var naam: String {
        switch self {
        case .trauma: String(localized: "Traumahelikopter")
        case .politie: String(localized: "Politiehelikopter")
        case .kustwacht: String(localized: "Kustwacht")
        case .defensie: String(localized: "Defensie")
        case .kmar: String(localized: "Koninklijke Marechaussee")
        case .regering: String(localized: "Regering")
        case .bijzonder: String(localized: "Privéjet")
        }
    }

    /// Short name for filters and settings.
    var meervoud: String {
        switch self {
        case .trauma: String(localized: "Lifeliners")
        case .politie: String(localized: "Politie (Zulu)")
        case .kustwacht: String(localized: "Kustwacht")
        case .defensie: String(localized: "Defensie")
        case .kmar: String(localized: "Marechaussee")
        case .regering: String(localized: "Regeringsvliegtuig")
        case .bijzonder: String(localized: "Max Verstappen")
        }
    }

    /// Colours as in A-Alerts (traumaheli purple, police blue, defence olive), coastguard cyan.
    var color: Color {
        switch self {
        case .trauma: Color(hex: 0x9333EA)
        case .politie: Color(light: 0x15428B, dark: 0x3F74D8)
        case .kustwacht: Color(hex: 0x0891B2)
        case .defensie, .kmar, .regering: Color(light: 0x586A33, dark: 0x7D9148)
        case .bijzonder: Color(hex: 0xFF6600)
        }
    }

    /// On by default for pushmeldingen and on the map, like A-Alerts.
    static let standaard: Set<Soort> = [.trauma, .politie]
}

/// The kinds with their own drawing (the A-Alerts list "Alles wat vliegt").
struct LuchtSoort: Identifiable, Hashable {
    let id: String
    let titel: String
    let afbeelding: String
    let soort: Soort

    static let alle: [LuchtSoort] = [
        .init(id: "trauma", titel: "Lifeliner", afbeelding: "heli_lifeliner_ec135", soort: .trauma),
        .init(id: "politie", titel: String(localized: "Zulu (politie)"), afbeelding: "heli_politie_ec135", soort: .politie),
        .init(id: "chinook", titel: "Chinook", afbeelding: "lucht_chinook", soort: .defensie),
        .init(id: "apache", titel: "Apache", afbeelding: "lucht_apache", soort: .defensie),
        .init(id: "cougar", titel: "Cougar", afbeelding: "lucht_cougar", soort: .defensie),
        .init(id: "nh90", titel: "NH90", afbeelding: "lucht_nh90", soort: .defensie),
        .init(id: "heli", titel: String(localized: "Overige helikopter (Defensie)"), afbeelding: "lucht_heli", soort: .defensie),
        .init(id: "f35", titel: String(localized: "Straaljager"), afbeelding: "lucht_f35", soort: .defensie),
        .init(id: "hercules", titel: String(localized: "Transportvliegtuig"), afbeelding: "lucht_hercules", soort: .defensie),
        .init(id: "les", titel: String(localized: "Lesvliegtuig"), afbeelding: "lucht_les", soort: .defensie),
        .init(id: "vliegtuig", titel: String(localized: "Overig vliegtuig (Defensie)"), afbeelding: "lucht_vliegtuig", soort: .defensie),
        .init(id: "kustwacht_dash8", titel: String(localized: "Kustwacht vliegtuig"), afbeelding: "lucht_kustwacht_dash8", soort: .kustwacht),
        .init(id: "kustwacht_aw189", titel: String(localized: "Kustwacht helikopter"), afbeelding: "lucht_kustwacht_aw189", soort: .kustwacht),
        .init(id: "kmar", titel: String(localized: "Koninklijke Marechaussee"), afbeelding: "lucht_kmar", soort: .kmar),
        .init(id: "phgov", titel: String(localized: "Regeringsvliegtuig PH-GOV"), afbeelding: "lucht_phgov", soort: .regering),
        .init(id: "verstappen", titel: String(localized: "Max Verstappen (PH-UTL)"), afbeelding: "lucht_verstappen", soort: .bijzonder),
    ]
}

struct Aircraft: Codable, Identifiable, Hashable, Sendable {
    let hex: String
    /// A-Alerts id: lifeliner3, zulu26 … (the hex for other aircraft).
    var key: String?
    var reg: String?
    var callsign: String?
    var soort: Soort
    /// A-Alerts drawing for defence/coastguard/government ("chinook", "f35" …); nil for Lifeliner and Zulu.
    var icoon: String?
    var type: String?
    var naam: String?
    var basis: String?
    var lat: Double?
    var lon: Double?
    /// Feet.
    var alt: Double?
    /// Knots.
    var gs: Double?
    var track: Double?
    var airborne: Bool
    var seen: Double?
    var since: Double?
    var stale: Bool
    /// "Teuge, Voorst": the place it flies above (nil on the ground, above sea or abroad).
    var boven: String?
    /// On the ground: the hospital or base it stands at.
    var plek: String?
    /// A-Alerts "status per toestel": lucht, basis, grond or uit_beeld.
    var status_: String?

    enum CodingKeys: String, CodingKey {
        case hex, key, reg, callsign, soort, icoon, type, naam, basis, lat, lon, alt, gs, track, airborne, seen, since, stale, boven, plek
        case status_ = "status"
    }

    var id: String { hex }
    var title: String { naam ?? soort.naam }

    /// Side-view drawing (A-Alerts): nose to the right.
    var afbeelding: String { Aircraft.afbeelding(soort: soort, icoon: icoon, type: type, key: key) }

    static func afbeelding(soort: Soort, icoon: String?, type: String?, key: String?) -> String {
        if let icoon, !icoon.isEmpty { return "lucht_" + icoon }
        if soort == .trauma { return "heli_lifeliner_ec135" }
        if (type ?? "").uppercased() == "A139" || ["zulu24", "zulu25", "zulu26"].contains(key ?? "") { return "heli_politie_aw139" }
        return "heli_politie_ec135"
    }

    /// Filter layer: the drawing kind, or the soort for Lifeliner and Zulu.
    var laag: String { icoon ?? soort.rawValue }

    /// Flying west (course 180°–360°) mirrors the drawing.
    var vliegtWest: Bool {
        guard let track, airborne else { return false }
        let h = (track.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        return h > 180 && h < 360
    }

    var subtitle: String {
        [soort.naam, reg, type].compactMap { $0 }.joined(separator: " · ")
    }

    var plaatsTekst: String? {
        if airborne, let boven { return String(localized: "Boven \(boven)") }
        if !airborne, let plek { return plek }
        return nil
    }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lon else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    var seenDate: Date? { seen.map { Date(timeIntervalSince1970: $0) } }
    var sinceDate: Date? { since.map { Date(timeIntervalSince1970: $0) } }

    var status: String {
        switch status_ {
        case "lucht": return String(localized: "In de lucht")
        case "basis": return String(localized: "Op de basis")
        case "grond": return String(localized: "Op de grond")
        case "uit_beeld": return String(localized: "Uit beeld")
        default:
            if seen == nil { return String(localized: "Geen signaal") }
            return airborne ? String(localized: "In de lucht") : String(localized: "Op de grond")
        }
    }

    /// Seconds since the last position.
    func positionAge(at now: Date = .now) -> TimeInterval? {
        seen.map { max(0, now.timeIntervalSince1970 - $0) }
    }

    /// In the air and still sending its position (not on the ground, at the base or out of view).
    var isOnline: Bool { airborne && status_ != "uit_beeld" }

    // MARK: A-Alerts style values

    /// Altitude in metres, and the same in feet.
    var hoogteTekst: String { airborne ? Format.altitude(alt) : "–" }
    var hoogteTweede: String? {
        guard airborne, let alt else { return nil }
        return "\(Int((alt / 25).rounded() * 25).formatted()) ft"
    }
    /// Speed in km/u, and the same in knots.
    var snelheidTekst: String { airborne ? Format.speed(gs) : "–" }
    var snelheidTweede: String? {
        guard airborne, let gs else { return nil }
        return "\(Int(gs.rounded())) kn"
    }

    /// Older than a minute: shown grey with "positie 40 s oud", so a standing icon is not taken for live.
    func isOld(at now: Date = .now) -> Bool { (positionAge(at: now) ?? .infinity) > 60 }

}

struct Incident: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    var start: Double
    var last: Double
    var end: Double?
    var lat: Double
    var lon: Double
    var place: String?
    var hexes: [String]

    var startDate: Date { Date(timeIntervalSince1970: start) }
    var endDate: Date? { end.map { Date(timeIntervalSince1970: $0) } }
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lon) }
    var isActive: Bool { end == nil }
    var title: String {
        if let place { return String(localized: "\(hexes.count) helikopters op één plek in \(place)") }
        return String(localized: "\(hexes.count) helikopters op één plek")
    }
}

struct LiveSnapshot: Codable, Sendable {
    var updated: Double
    var aircraft: [Aircraft]
    var incidents: [Incident]
    /// KNMI weather that usually keeps helicopters on the ground (A-Alerts rule).
    var weer: WeerBeperking?
}

struct WeerBeperking: Codable, Hashable, Sendable {
    var reden: String
    var niveau: String
    var tekst: String { String(localized: "Weinig helikopterinzet verwacht: \(reden)") }
}

struct TrackPoint: Codable, Hashable, Sendable {
    var ts: Double
    var lat: Double
    var lon: Double
    var alt: Double?
    var gs: Double?
    var track: Double?
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lon) }
}

struct Flight: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    var hex: String
    var naam: String?
    var reg: String?
    var soort: Soort
    var icoon: String?
    var type: String?
    var callsign: String?
    var start: Double
    var end: Double?
    var startLat: Double?
    var startLon: Double?
    var startPlace: String?
    var endLat: Double?
    var endLon: Double?
    var endPlace: String?
    var maxAlt: Double?

    var startDate: Date { Date(timeIntervalSince1970: start) }
    var endDate: Date? { end.map { Date(timeIntervalSince1970: $0) } }
    var title: String { naam ?? soort.naam }
    var afbeelding: String { Aircraft.afbeelding(soort: soort, icoon: icoon, type: type, key: nil) }
    var duration: TimeInterval { (end ?? Date().timeIntervalSince1970) - start }
}

/// Number formatting shared by all screens.
enum Format {
    static func altitude(_ feet: Double?) -> String {
        guard let feet else { return "–" }
        let m = (feet * 0.3048).rounded()
        return "\(Int(m).formatted()) m"
    }

    static func speed(_ knots: Double?) -> String {
        guard let knots else { return "–" }
        return "\(Int((knots * 1.852).rounded()).formatted()) km/u"
    }

    static func heading(_ degrees: Double?) -> String {
        guard let degrees else { return "–" }
        let names = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"]
        let i = Int(((degrees.truncatingRemainder(dividingBy: 360) + 360 + 22.5) / 45).rounded(.down)) % 8
        return "\(Int(degrees.rounded()))° \(names[i])"
    }

    /// "40 s", "3 min", "2 uur".
    static func age(_ seconds: TimeInterval) -> String {
        if seconds < 90 { return "\(Int(seconds)) s" }
        if seconds < 3600 { return "\(Int(seconds / 60)) min" }
        return "\(Int(seconds / 3600)) uur"
    }

    static func duration(_ seconds: TimeInterval) -> String {
        let f = DateComponentsFormatter()
        f.allowedUnits = seconds >= 3600 ? [.hour, .minute] : [.minute]
        f.unitsStyle = .abbreviated
        return f.string(from: max(60, seconds)) ?? ""
    }
}
