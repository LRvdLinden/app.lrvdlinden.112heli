import SwiftUI
import MapKit

/// Flights and "meerdere helikopters op één plek" of the last 30 days.
struct HistoryView: View {
    enum Mode: Hashable { case vluchten, incidenten }

    @State private var mode: Mode = .vluchten
    @State private var flights: [Flight] = []
    @State private var incidents: [Incident] = []
    @State private var loaded = false
    @State private var failed = false
    @State private var soort: Soort?

    private var shownFlights: [Flight] { soort.map { s in flights.filter { $0.soort == s } } ?? flights }

    private var flightsByDay: [(day: Date, flights: [Flight])] {
        let cal = Calendar.current
        let groups = Dictionary(grouping: shownFlights) { cal.startOfDay(for: $0.startDate) }
        return groups.keys.sorted(by: >).map { ($0, groups[$0]!.sorted { $0.start > $1.start }) }
    }

    var body: some View {
        List {
            Section {
                Picker("Weergave", selection: $mode) {
                    Text("Vluchten").tag(Mode.vluchten)
                    Text("Meerdere heli's").tag(Mode.incidenten)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                if mode == .vluchten {
                    Picker("Soort", selection: $soort) {
                        Text("Alles").tag(Soort?.none)
                        ForEach(Soort.allCases) { Text($0.meervoud).tag(Soort?.some($0)) }
                    }
                }
            }
            if mode == .vluchten {
                ForEach(flightsByDay, id: \.day) { group in
                    Section {
                        ForEach(group.flights) { f in
                            NavigationLink(value: f) { FlightRow(flight: f) }
                        }
                    } header: {
                        Text(group.day, format: .dateTime.weekday(.wide).day().month(.wide))
                    }
                }
            } else {
                ForEach(incidents) { i in
                    VStack(alignment: .leading, spacing: 4) {
                        Label(i.title, systemImage: "exclamationmark.triangle.fill")
                            .font(.headline)
                            .foregroundStyle(i.isActive ? Theme.incident : .primary)
                        Text(i.startDate, format: .dateTime.weekday().day().month().hour().minute())
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .overlay {
            if !loaded {
                ProgressView()
            } else if failed && flights.isEmpty && incidents.isEmpty {
                ContentUnavailableView {
                    Label("Geen verbinding", systemImage: "wifi.exclamationmark")
                } description: {
                    Text("De historie kon niet worden opgehaald.")
                } actions: {
                    Button("Opnieuw proberen") { Task { await load() } }
                }
            } else if mode == .vluchten && shownFlights.isEmpty {
                ContentUnavailableView("Nog geen vluchten", systemImage: "clock",
                                       description: Text("Vluchten van de afgelopen 30 dagen verschijnen hier."))
            } else if mode == .incidenten && incidents.isEmpty {
                ContentUnavailableView("Niets bijzonders", systemImage: "checkmark.circle",
                                       description: Text("Er stonden de afgelopen 30 dagen geen helikopters samen op één plek."))
            }
        }
        .navigationTitle("Historie")
        .navigationDestination(for: Flight.self) { FlightMapView(flight: $0) }
        .refreshable { await load() }
        .task { if !loaded { await load() } }
    }

    private func load() async {
        let fl = try? await HeliAPI.shared.flights(days: 30)
        let inc = try? await HeliAPI.shared.incidents(days: 30)
        failed = fl == nil && inc == nil
        if let fl { flights = fl }
        if let inc { incidents = inc }
        loaded = true
    }
}

/// The route of one flight on a map.
struct FlightMapView: View {
    let flight: Flight
    @State private var points: [TrackPoint] = []
    @State private var loaded = false

    var body: some View {
        Map {
            if points.count > 1 {
                MapPolyline(coordinates: points.map(\.coordinate))
                    .stroke(flight.soort.color, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            }
            if let first = points.first {
                Marker("Vertrek", systemImage: "airplane.departure", coordinate: first.coordinate).tint(.green)
            }
            if let last = points.last, flight.end != nil {
                Marker("Einde", systemImage: "airplane.arrival", coordinate: last.coordinate).tint(.red)
            }
        }
        .overlay {
            if loaded && points.count < 2 {
                ContentUnavailableView("Geen route", systemImage: "point.topleft.down.to.point.bottomright.curvepath",
                                       description: Text("Van deze vlucht zijn te weinig posities ontvangen."))
            }
        }
        .safeAreaInset(edge: .bottom) {
            FlightRow(flight: flight)
                .padding()
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding()
        }
        .navigationTitle(flight.title)
        .task {
            points = (try? await HeliAPI.shared.flightTrack(id: flight.id)) ?? []
            loaded = true
        }
    }
}
