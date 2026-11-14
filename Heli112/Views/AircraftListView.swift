import SwiftUI

/// All followed aircraft: favourites, in the air and on the ground. Searchable, pull to refresh.
struct AircraftListView: View {
    @EnvironmentObject private var store: LiveStore
    @EnvironmentObject private var location: LocationManager
    @State private var search = ""
    @State private var routeMinutes = 60
    @State private var showReport = false

    private func matches(_ a: Aircraft) -> Bool {
        guard !search.isEmpty else { return true }
        return [a.title, a.reg, a.callsign, a.type, a.soort.naam, a.boven, a.plek].compactMap { $0 }
            .contains { $0.localizedCaseInsensitiveContains(search) }
    }

    private var favorites: [Aircraft] { store.favoriteAircraft.filter(matches) }
    private func others(_ statuses: Set<String>) -> [Aircraft] {
        store.aircraft.filter { !store.isFavorite($0.hex) && matches($0) && statuses.contains($0.status_ ?? ($0.airborne ? "lucht" : "grond")) }
    }
    private var inAir: [Aircraft] { others(["lucht"]) }
    private var atBase: [Aircraft] { others(["basis"]) }
    private var onGround: [Aircraft] { others(["grond"]) }
    private var outOfView: [Aircraft] { others(["uit_beeld"]) }

    var body: some View {
        List {
            if !favorites.isEmpty {
                Section("Mijn toestellen") { ForEach(favorites) { row($0) } }
            }
            if !inAir.isEmpty {
                Section("In de lucht") { ForEach(inAir) { row($0) } }
            }
            if !atBase.isEmpty {
                Section("Op de basis") { ForEach(atBase) { row($0) } }
            }
            if !onGround.isEmpty {
                Section("Op de grond") { ForEach(onGround) { row($0) } }
            }
            if !outOfView.isEmpty {
                Section("Uit beeld (14 dagen)") { ForEach(outOfView) { row($0) } }
            }
        }
        .overlay {
            if store.aircraft.isEmpty {
                if store.failed {
                    ContentUnavailableView {
                        Label("Geen verbinding", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text("De toestellen konden niet worden opgehaald.")
                    } actions: {
                        Button("Opnieuw proberen") { Task { await store.refresh() } }
                    }
                } else if store.loaded {
                    ContentUnavailableView("Nog geen toestellen", systemImage: "airplane",
                                           description: Text("Zodra een Lifeliner, Zulu of ander toestel zijn positie uitzendt, staat hij hier."))
                } else {
                    ProgressView()
                }
            } else if !search.isEmpty && favorites.isEmpty && inAir.isEmpty && atBase.isEmpty && onGround.isEmpty && outOfView.isEmpty {
                ContentUnavailableView.search(text: search)
            }
        }
        .searchable(text: $search, prompt: "Naam, registratie of plaats")
        .refreshable { await store.refresh() }
        .navigationTitle("Toestellen")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showReport = true } label: { Label("Toestel ontbreekt", systemImage: "exclamationmark.bubble") }
            }
        }
        .sheet(isPresented: $showReport) { NavigationStack { ReportView(aircraft: nil) } }
        .navigationDestination(for: String.self) { hex in
            AircraftDetailView(hex: hex, routeMinutes: $routeMinutes)
        }
    }

    private func row(_ a: Aircraft) -> some View {
        NavigationLink(value: a.hex) {
            HStack(spacing: 12) {
                AircraftThumb(a)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(a.title).font(.headline)
                        if store.isFavorite(a.hex) {
                            Image(systemName: "star.fill").font(.caption).foregroundStyle(.yellow).accessibilityLabel("Favoriet")
                        }
                    }
                    Text(store.isFavorite(a.hex) ? "\(a.status) · \(a.plaatsTekst ?? a.soort.naam)" : (a.plaatsTekst ?? a.subtitle))
                        .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    if a.airborne {
                        Text(Format.altitude(a.alt)).font(.subheadline.monospacedDigit())
                        Text(Format.speed(a.gs)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    } else if let seen = a.seenDate {
                        Text("gezien \(seen, style: .relative) geleden").font(.caption).foregroundStyle(.secondary)
                    }
                    if let km = location.distanceKm(to: a) {
                        Text("\(Int(km.rounded())) km").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .swipeActions {
            Button {
                store.toggleFavorite(a.hex)
            } label: {
                Label("Favoriet", systemImage: store.isFavorite(a.hex) ? "star.slash" : "star")
            }
            .tint(.yellow)
        }
    }
}
