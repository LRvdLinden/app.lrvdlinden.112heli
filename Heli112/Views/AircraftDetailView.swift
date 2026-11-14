import SwiftUI
import MapKit

/// Everything about one aircraft: status, figures, route length, weather, recent flights and actions.
struct AircraftDetailView: View {
    let hex: String
    @Binding var routeMinutes: Int

    @EnvironmentObject private var store: LiveStore
    @EnvironmentObject private var location: LocationManager
    #if os(iOS)
    @StateObject private var activities = LiveActivityManager.shared
    #endif
    @State private var flights: [Flight] = []
    @State private var showReport = false

    private var aircraft: Aircraft? { store.aircraft(hex: hex) }

    var body: some View {
        Group {
            if let a = aircraft {
                List {
                    header(a)
                    figures(a)
                    Section("Route op de kaart") {
                        Picker("Route", selection: $routeMinutes) {
                            Text("Kort (1 uur)").tag(60)
                            Text("Lang (6 uur)").tag(360)
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                    }
                    if let c = a.coordinate {
                        Section("Weer bij het toestel") { WeatherCard(coordinate: c) }
                    }
                    actions(a)
                    if !flights.isEmpty {
                        Section("Vluchten (30 dagen)") {
                            ForEach(flights.prefix(8)) { FlightRow(flight: $0) }
                        }
                    }
                }
                #if os(iOS)
                .listStyle(.insetGrouped)
                #endif
                .navigationTitle(a.title)
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
            } else {
                ContentUnavailableView("Toestel niet gevonden", systemImage: "airplane",
                                       description: Text("Dit toestel is de laatste twee weken niet gezien."))
            }
        }
        .task(id: hex) { flights = (try? await HeliAPI.shared.flights(days: 30, hex: hex)) ?? [] }
    }

    private func header(_ a: Aircraft) -> some View {
        Section {
            VStack(spacing: 10) {
                AircraftDrawing(afbeelding: a.afbeelding, west: a.vliegtWest)
                    .frame(maxWidth: 320)
                    .frame(height: 100)
                Text(a.subtitle).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                HStack(spacing: 8) {
                    Text(a.status)
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background((a.airborne ? Color.green : Color.secondary).opacity(0.18), in: Capsule())
                    if let plaats = a.plaatsTekst {
                        Label(plaats, systemImage: a.airborne ? "location.north.fill" : "mappin")
                            .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .listRowBackground(Color.clear)
        }
    }

    private func figures(_ a: Aircraft) -> some View {
        Section {
            LabeledContent("Hoogte", value: a.airborne ? Format.altitude(a.alt) : "–")
            LabeledContent("Snelheid", value: a.airborne ? Format.speed(a.gs) : "–")
            LabeledContent("Koers", value: a.airborne ? Format.heading(a.track) : "–")
            if let km = location.distanceKm(to: a) {
                LabeledContent("Afstand", value: "\(km.formatted(.number.precision(.fractionLength(0...1)))) km")
            }
            if let since = a.sinceDate {
                LabeledContent(a.airborne ? "In de lucht sinds" : "Geland") {
                    Text(since, format: .dateTime.hour().minute())
                }
            }
            if a.seenDate != nil {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    LabeledContent("Positie") {
                        Text(a.positionAge(at: context.date).map { String(localized: "\(Format.age($0)) oud") } ?? "–")
                            .foregroundStyle(a.isOld(at: context.date) ? Color.orange : .secondary)
                    }
                }
            }
            if let basis = a.basis { LabeledContent("Basis", value: basis) }
            if let callsign = a.callsign { LabeledContent("Roepnaam", value: callsign) }
        }
    }

    private func actions(_ a: Aircraft) -> some View {
        Section {
            Button {
                store.toggleFavorite(a.hex)
            } label: {
                Label(store.isFavorite(a.hex) ? "Verwijder uit favorieten" : "Zet in favorieten",
                      systemImage: store.isFavorite(a.hex) ? "star.slash" : "star")
            }
            .sensoryFeedback(.success, trigger: store.isFavorite(a.hex))
            #if os(iOS)
            if activities.isAvailable {
                Button {
                    activities.toggle(a)
                } label: {
                    Label(activities.isFollowing(a.hex) ? "Stop volgen op toegangsscherm" : "Volg op toegangsscherm",
                          systemImage: "livephoto")
                }
            }
            #endif
            ShareLink(item: shareText(a)) {
                Label("Deel", systemImage: "square.and.arrow.up")
            }
            Button { showReport = true } label: {
                Label("Dit toestel klopt niet", systemImage: "exclamationmark.bubble")
            }
            .sheet(isPresented: $showReport) { NavigationStack { ReportView(aircraft: a) } }
        }
    }

    private func shareText(_ a: Aircraft) -> String {
        var parts = ["\(a.title) – \(a.status.lowercased())"]
        if let plaats = a.plaatsTekst { parts.append(plaats) }
        if let lat = a.lat, let lon = a.lon {
            parts.append("https://maps.apple.com/?ll=\(lat),\(lon)&q=\(a.title.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")")
        }
        parts.append(String(localized: "Via 112Heli"))
        return parts.joined(separator: "\n")
    }
}

/// One flight in a list: start and landing place ("Geland bij …").
struct FlightRow: View {
    let flight: Flight

    private var route: String {
        switch (flight.startPlace, flight.endPlace) {
        case let (start?, end?): return "\(start) → \(end)"
        case let (start?, nil): return flight.end == nil ? start : "\(start) → \(String(localized: "op locatie"))"
        case let (nil, end?): return "→ \(end)"
        default: return flight.soort.naam
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            AircraftThumb(afbeelding: flight.afbeelding, soort: flight.soort, width: 56)
            VStack(alignment: .leading, spacing: 2) {
                Text(flight.title).font(.subheadline.weight(.semibold))
                Text(route).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(flight.startDate, format: .dateTime.day().month(.abbreviated).hour().minute())
                    .font(.caption.monospacedDigit())
                Text(flight.end == nil ? String(localized: "nu in de lucht") : Format.duration(flight.duration))
                    .font(.caption2).foregroundStyle(flight.end == nil ? Color.green : .secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
