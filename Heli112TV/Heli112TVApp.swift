import SwiftUI
import MapKit

@main
struct Heli112TVApp: App {
    @StateObject private var store = LiveStore()
    @AppStorage("appearance") private var appearance: AppearanceSetting = .dark

    var body: some Scene {
        WindowGroup {
            TVRootView()
                .environmentObject(store)
                .preferredColorScheme(appearance.colorScheme)
                .tint(Theme.accent)
        }
    }
}

struct TVRootView: View {
    @EnvironmentObject private var store: LiveStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var showSplash = true

    var body: some View {
        ZStack {
            TabView {
                TVMapView().tabItem { Label("Kaart", systemImage: "map") }
                TVListView().tabItem { Label("Toestellen", systemImage: "airplane") }
                TVInfoView().tabItem { Label("Info", systemImage: "info.circle") }
            }
            if showSplash {
                SplashView { withAnimation(.easeOut(duration: 0.35)) { showSplash = false } }
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .reviewPrompt(isCalm: !showSplash)
        .onAppear { store.start() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { store.start() } else if phase == .background { store.stop() }
        }
    }
}

/// Big "meldkamer" map with the aircraft in the air next to it; choosing one zooms in and shows its route.
struct TVMapView: View {
    @EnvironmentObject private var store: LiveStore
    @State private var position: MapCameraPosition = .region(MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 52.2, longitude: 5.4), span: MKCoordinateSpan(latitudeDelta: 3.4, longitudeDelta: 3.8)))
    @State private var selectedHex: String?
    @State private var track: [TrackPoint] = []

    var body: some View {
        HStack(spacing: 0) {
            Map(position: $position) {
                if track.count > 1, let a = selectedHex.flatMap({ store.aircraft(hex: $0) }) {
                    MapPolyline(coordinates: track.map(\.coordinate))
                        .stroke(a.soort.color, style: StrokeStyle(lineWidth: 5, lineCap: .round, dash: [10, 6]))
                }
                ForEach(store.incidents) { i in
                    Annotation(i.title, coordinate: i.coordinate) {
                        Circle().fill(Theme.incident.opacity(0.35)).frame(width: 70, height: 70)
                            .overlay(Circle().stroke(Theme.incident, lineWidth: 4))
                    }
                }
                ForEach(store.visibleAircraft.filter { $0.coordinate != nil }) { a in
                    Annotation(a.title, coordinate: a.coordinate!, anchor: .center) {
                        HeliMarker(aircraft: a, selected: selectedHex == a.hex, size: 44, topView: true)
                    }
                    .annotationTitles(.hidden)
                }
            }
            .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))

            VStack(alignment: .leading, spacing: 16) {
                Text("In de lucht").font(.title3.bold())
                if let weer = store.weer {
                    Label(weer.tekst, systemImage: "cloud.fog.fill").font(.caption).foregroundStyle(.orange)
                }
                if store.airborne.isEmpty {
                    Text("Er is nu niets in de lucht.").foregroundStyle(.secondary)
                }
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(store.airborne) { a in
                            Button { select(a) } label: {
                                HStack(spacing: 16) {
                                    AircraftThumb(a, width: 110)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(a.title).font(.headline)
                                        Text(a.plaatsTekst ?? a.soort.naam).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                        Text("\(Format.altitude(a.alt)) · \(Format.speed(a.gs))").font(.caption2).foregroundStyle(.secondary)
                                    }
                                    Spacer(minLength: 0)
                                }
                            }
                        }
                    }
                }
                Spacer(minLength: 0)
                if let updated = store.updated {
                    Text("Bijgewerkt \(updated, style: .time)").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .padding(40)
            .frame(width: 560)
        }
        .ignoresSafeArea(edges: .horizontal)
        .task(id: "\(selectedHex ?? "")-\(store.updated?.timeIntervalSince1970 ?? 0)") {
            guard let hex = selectedHex else { track = []; return }
            track = (try? await HeliAPI.shared.track(hex: hex, minutes: 60)) ?? []
        }
    }

    private func select(_ a: Aircraft) {
        selectedHex = a.hex
        if let c = a.coordinate {
            withAnimation { position = .region(MKCoordinateRegion(center: c, span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5))) }
        }
    }
}

struct TVListView: View {
    @EnvironmentObject private var store: LiveStore

    var body: some View {
        NavigationStack {
            List {
                if store.aircraft.isEmpty {
                    Text(store.failed ? "Geen verbinding met de server." : "Nog geen toestellen gezien.").foregroundStyle(.secondary)
                }
                ForEach(store.aircraft) { a in
                    Button {} label: {
                        HStack(spacing: 24) {
                            AircraftThumb(a, width: 140)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(a.title).font(.headline)
                                Text(a.subtitle).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 6) {
                                Text(a.status).font(.caption.bold())
                                if let p = a.plaatsTekst { Text(p).font(.caption2).foregroundStyle(.secondary) }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Toestellen")
        }
    }
}

struct TVInfoView: View {
    @AppStorage("appearance") private var appearance: AppearanceSetting = .dark

    var body: some View {
        NavigationStack {
            List {
                Section("Weergave") {
                    Picker("Weergave", selection: $appearance) {
                        ForEach(AppearanceSetting.allCases) { Text($0.label).tag($0) }
                    }
                }
                Section("Over 112Heli") {
                    Text("Alles wat vliegt voor de hulpdiensten, live: Lifeliners, politiehelikopters (Zulu), Kustwacht, Defensie, Marechaussee en PH-GOV. En voor de lol de jet van Max Verstappen.")
                    Text("Posities: adsb.lol (ODbL). Ziekenhuizen en bases: OpenStreetMap (ODbL).").foregroundStyle(.secondary)
                }
                Section(MoreAppsText.current.section) {
                    MoreAppsCard()
                }
                Section {
                    AppInfoFooter()
                }
            }
            .navigationTitle("Info")
        }
    }
}
