import Foundation
import CoreLocation

// Trail, places and flights of one aircraft, in the same format as A-Alerts
// (GET /v1/aircraft/<hex>/spoor?scope=… and /vluchten on the 112Heli worker).

enum ISODate {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    static func parse(_ s: String?) -> Date? {
        guard let s else { return nil }
        return withFraction.date(from: s) ?? plain.date(from: s)
    }
}

struct HeliSpoorPunt: Decodable, Hashable, Sendable {
    let t: Date
    let lat: Double
    let lon: Double
    let hoogteFt: Double?

    enum CodingKeys: String, CodingKey { case t, lat, lon, hoogteFt = "hoogte_ft" }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        t = ISODate.parse(try? c.decode(String.self, forKey: .t)) ?? .now
        lat = try c.decode(Double.self, forKey: .lat)
        lon = try c.decode(Double.self, forKey: .lon)
        hoogteFt = try? c.decodeIfPresent(Double.self, forKey: .hoogteFt)
    }
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lon) }
}

struct HeliVlucht: Decodable, Hashable, Identifiable, Sendable {
    let start: Date
    let einde: Date?
    let onderweg: Bool
    let duurMin: Int
    let afstandKm: Double
    let maxHoogteFt: Double
    var id: Date { start }

    enum CodingKeys: String, CodingKey {
        case start, einde, onderweg
        case duurMin = "duur_min", afstandKm = "afstand_km", maxHoogteFt = "max_hoogte_ft"
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        start = ISODate.parse(try? c.decode(String.self, forKey: .start)) ?? .now
        einde = ISODate.parse((try? c.decodeIfPresent(String.self, forKey: .einde)) ?? nil)
        onderweg = (try? c.decode(Bool.self, forKey: .onderweg)) ?? false
        duurMin = (try? c.decode(Int.self, forKey: .duurMin)) ?? 0
        afstandKm = (try? c.decode(Double.self, forKey: .afstandKm)) ?? 0
        maxHoogteFt = (try? c.decode(Double.self, forKey: .maxHoogteFt)) ?? 0
    }

    /// "25 min in de lucht" / "1 u 05 min in de lucht".
    var inDeLucht: String {
        if duurMin < 1 { return String(localized: "Net opgestegen") }
        if duurMin < 60 { return String(localized: "\(duurMin) min in de lucht") }
        return String(localized: "\(duurMin / 60) u \(String(format: "%02d", duurMin % 60)) min in de lucht")
    }
}

/// One stretch of a flight above a place (nil = above sea or abroad).
struct SpoorPlaats: Decodable, Hashable, Identifiable, Sendable {
    let van: Date
    let tot: Date
    let plaats: String?
    let gemeente: String?
    var id: Date { van }

    enum CodingKeys: String, CodingKey { case van, tot, plaats, gemeente }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        van = ISODate.parse(try? c.decode(String.self, forKey: .van)) ?? .now
        tot = ISODate.parse(try? c.decode(String.self, forKey: .tot)) ?? van
        plaats = try? c.decodeIfPresent(String.self, forKey: .plaats)
        gemeente = try? c.decodeIfPresent(String.self, forKey: .gemeente)
    }
}

struct SpoorResponse: Decodable, Sendable {
    let punten: [HeliSpoorPunt]
    let plaatsen: [SpoorPlaats]
    let vlucht: HeliVlucht?

    enum CodingKeys: String, CodingKey { case punten, plaatsen, vlucht }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        punten = (try? c.decode([HeliSpoorPunt].self, forKey: .punten)) ?? []
        plaatsen = (try? c.decodeIfPresent([SpoorPlaats].self, forKey: .plaatsen)) ?? []
        vlucht = try? c.decodeIfPresent(HeliVlucht.self, forKey: .vlucht)
    }
}

/// How much of the trail to show: the current (or last) flight, the last 30 minutes, or 2 hours.
enum SpoorBereik: String, CaseIterable, Identifiable, Sendable {
    case vlucht, kort, lang
    var id: String { rawValue }
    var label: String {
        switch self {
        case .vlucht: String(localized: "Deze vlucht")
        case .kort: String(localized: "30 min")
        case .lang: String(localized: "2 uur")
        }
    }
}

extension HeliAPI {
    func spoor(hex: String, bereik: SpoorBereik) async throws -> SpoorResponse {
        try await getJSON("v1/aircraft/\(hex)/spoor", query: [URLQueryItem(name: "scope", value: bereik.rawValue)])
    }

    func vluchten(hex: String) async throws -> [HeliVlucht] {
        struct R: Decodable { let vluchten: [HeliVlucht] }
        let r: R = try await getJSON("v1/aircraft/\(hex)/vluchten")
        return r.vluchten
    }
}
