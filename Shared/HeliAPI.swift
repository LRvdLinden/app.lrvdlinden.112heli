import Foundation

/// Client for the 112Heli worker (worker/ in this repo).
struct HeliAPI: Sendable {
    static let shared = HeliAPI()

    let base: URL

    init() {
        let configured = Bundle.main.object(forInfoDictionaryKey: "HeliAPIURL") as? String
        let value = (configured?.isEmpty == false ? configured! : "https://112heli-api.112heli.workers.dev")
        base = URL(string: value) ?? URL(string: "https://112heli-api.112heli.workers.dev")!
    }

    private var session: URLSession {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: config)
    }

    private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        var components = URLComponents(url: base.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        let (data, response) = try await session.data(from: components.url!)
        try Self.check(response)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func send(_ method: String, _ path: String, body: [String: Any]? = nil) async throws {
        var request = URLRequest(url: base.appending(path: path))
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (_, response) = try await session.data(for: request)
        try Self.check(response)
    }

    private static func check(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    // MARK: - Endpoints

    func live() async throws -> LiveSnapshot { try await get("v1/live") }

    func track(hex: String, minutes: Int) async throws -> [TrackPoint] {
        struct R: Decodable { var points: [TrackPoint] }
        let r: R = try await get("v1/aircraft/\(hex)/track", query: [URLQueryItem(name: "minutes", value: String(minutes))])
        return r.points
    }

    func flights(days: Int = 30, hex: String? = nil) async throws -> [Flight] {
        struct R: Decodable { var flights: [Flight] }
        var q = [URLQueryItem(name: "days", value: String(days))]
        if let hex { q.append(URLQueryItem(name: "hex", value: hex)) }
        let r: R = try await get("v1/flights", query: q)
        return r.flights
    }

    func flightTrack(id: Int) async throws -> [TrackPoint] {
        struct R: Decodable { var points: [TrackPoint] }
        let r: R = try await get("v1/flights/\(id)/track")
        return r.points
    }

    func incidents(days: Int = 30) async throws -> [Incident] {
        struct R: Decodable { var incidents: [Incident] }
        let r: R = try await get("v1/incidents", query: [URLQueryItem(name: "days", value: String(days))])
        return r.incidents
    }

    func registerDevice(_ body: [String: Any]) async throws { try await send("POST", "v1/devices", body: body) }
    func deleteDevice(token: String) async throws { try await send("DELETE", "v1/devices/\(token)") }

    func registerActivity(token: String, hex: String, environment: String) async throws {
        try await send("POST", "v1/activities", body: ["token": token, "hex": hex, "environment": environment])
    }

    func deleteActivity(token: String) async throws { try await send("DELETE", "v1/activities/\(token)") }

    /// "Dit toestel ontbreekt of klopt niet".
    func report(_ body: [String: Any]) async throws { try await send("POST", "v1/reports", body: body) }

    /// "sandbox" for Debug builds, "production" for TestFlight/App Store.
    static var pushEnvironment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }
}
