import SwiftUI
import WeatherKit
import CoreLocation

/// Flying weather at a position (WeatherKit) with the required Apple Weather attribution.
struct WeatherCard: View {
    let coordinate: CLLocationCoordinate2D

    @Environment(\.colorScheme) private var scheme
    @State private var current: CurrentWeather?
    @State private var attribution: WeatherAttribution?
    @State private var failed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let w = current {
                HStack(spacing: 14) {
                    Image(systemName: w.symbolName).font(.title).symbolRenderingMode(.multicolor)
                    VStack(alignment: .leading) {
                        Text(w.temperature.formatted(.measurement(width: .abbreviated, usage: .weather, numberFormatStyle: .number.precision(.fractionLength(0)))))
                            .font(.title2.bold())
                        Text(w.condition.description).font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
                    GridRow {
                        Label("Wind", systemImage: "wind").foregroundStyle(.secondary)
                        Text("\(Int(w.wind.speed.converted(to: .kilometersPerHour).value.rounded())) km/u \(w.wind.compassDirection.abbreviation)")
                    }
                    if let gust = w.wind.gust {
                        GridRow {
                            Label("Windstoten", systemImage: "tornado").foregroundStyle(.secondary)
                            Text("\(Int(gust.converted(to: .kilometersPerHour).value.rounded())) km/u")
                        }
                    }
                    GridRow {
                        Label("Zicht", systemImage: "eye").foregroundStyle(.secondary)
                        Text("\(w.visibility.converted(to: .kilometers).value.formatted(.number.precision(.fractionLength(0...1)))) km")
                    }
                    GridRow {
                        Label("Bewolking", systemImage: "cloud").foregroundStyle(.secondary)
                        Text(w.cloudCover.formatted(.percent.precision(.fractionLength(0))))
                    }
                }
                .font(.subheadline)
                if let attribution {
                    HStack(spacing: 8) {
                        AsyncImage(url: scheme == .dark ? attribution.combinedMarkDarkURL : attribution.combinedMarkLightURL) { image in
                            image.resizable().scaledToFit()
                        } placeholder: { EmptyView() }
                        .frame(height: 12)
                        Link("Gegevensbronnen", destination: attribution.legalPageURL).font(.caption2)
                    }
                }
            } else if failed {
                Text("Het weer is nu niet beschikbaar.").font(.subheadline).foregroundStyle(.secondary)
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .task(id: "\(coordinate.latitude.rounded(toPlaces: 1)),\(coordinate.longitude.rounded(toPlaces: 1))") {
            do {
                let service = WeatherService.shared
                current = try await service.weather(for: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude), including: .current)
                attribution = try? await service.attribution
                failed = false
            } catch {
                failed = true
            }
        }
    }
}

private extension Double {
    func rounded(toPlaces p: Int) -> Double {
        let f = pow(10, Double(p))
        return (self * f).rounded() / f
    }
}
