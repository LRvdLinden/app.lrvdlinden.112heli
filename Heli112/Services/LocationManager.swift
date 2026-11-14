import CoreLocation
import SwiftUI

/// "When in use" location: for the distance to an aircraft and the area of the pushmeldingen.
@MainActor
final class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = LocationManager()

    @Published private(set) var location: CLLocation?
    @Published private(set) var status: CLAuthorizationStatus

    private let manager = CLLocationManager()

    override init() {
        status = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
        if isAllowed { manager.requestLocation() }
    }

    var isAllowed: Bool {
        #if os(macOS)
        status == .authorizedAlways || status == .authorized
        #else
        status == .authorizedWhenInUse || status == .authorizedAlways
        #endif
    }

    func request() {
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
        } else if isAllowed {
            manager.requestLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let s = manager.authorizationStatus
        Task { @MainActor in
            self.status = s
            if self.isAllowed { self.manager.requestLocation() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        Task { @MainActor in
            let moved = self.location.map { $0.distance(from: last) > 2_000 } ?? true
            self.location = last
            if moved { PushManager.shared.scheduleSync() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    func distanceKm(to a: Aircraft) -> Double? {
        guard let location, let lat = a.lat, let lon = a.lon else { return nil }
        return location.distance(from: CLLocation(latitude: lat, longitude: lon)) / 1000
    }
}
