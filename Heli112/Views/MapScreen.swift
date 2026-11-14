import SwiftUI
import MapKit

/// The live map: every followed aircraft, its route, hospitals/bases and "meerdere helikopters op één plek".
struct MapScreen: View {
    @EnvironmentObject private var store: LiveStore
    @EnvironmentObject private var router: Router

    @State private var position: MapCameraPosition = .region(MapScreen.netherlands)
    @State private var selectedHex: String?
    @State private var track: [TrackPoint] = []
    @State private var routeMinutes = 60
    @State private var showLayers = false
    @AppStorage("map.places") private var showPlaces = true
    @AppStorage("map.traffic") private var showTraffic = false
    @AppStorage("map.satellite") private var satellite = false
    @AppStorage("map.topview") private var topView = true

    static let netherlands = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 52.2, longitude: 5.4),
                                                span: MKCoordinateSpan(latitudeDelta: 3.4, longitudeDelta: 3.8))

    private var selected: Aircraft? { selectedHex.flatMap { store.aircraft(hex: $0) } }

    var body: some View {
        Map(position: $position) {
            UserAnnotation()
            if showPlaces {
                ForEach(MapPlace.all) { place in
                    Annotation(place.naam, coordinate: place.coordinate, anchor: .center) {
                        Image(systemName: place.symbol)
                            .font(.footnote)
                            .foregroundStyle(Color.white, place.kind == .basis ? Color.orange : Color.red)
                            .background(Circle().fill(.white).padding(2))
                    }
                    .annotationTitles(.hidden)
                }
            }
            if track.count > 1, let a = selected {
                MapPolyline(coordinates: track.map(\.coordinate) + (a.coordinate.map { [$0] } ?? []))
                    .stroke(a.soort.color, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round, dash: [6, 4]))
            }
            ForEach(store.incidents) { incident in
                Annotation(incident.title, coordinate: incident.coordinate, anchor: .center) {
                    IncidentPulse()
                }
                .annotationTitles(.hidden)
            }
            ForEach(store.visibleAircraft.filter { $0.coordinate != nil }) { a in
                Annotation(a.title, coordinate: a.coordinate!, anchor: .center) {
                    HeliMarker(aircraft: a, selected: selectedHex == a.hex, topView: topView)
                        .onTapGesture { select(a.hex) }
                        .accessibilityAddTraits(.isButton)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(satellite
                  ? .hybrid(elevation: .flat, pointsOfInterest: .excludingAll, showsTraffic: showTraffic)
                  : .standard(elevation: .flat, pointsOfInterest: .excludingAll, showsTraffic: showTraffic))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
        .safeAreaInset(edge: .top) { statusBar }
        .sheet(isPresented: detailBinding) {
            if let hex = selectedHex {
                NavigationStack {
                    AircraftDetailView(hex: hex, routeMinutes: $routeMinutes)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Sluiten") { selectedHex = nil }
                            }
                        }
                }
                #if os(iOS)
                .presentationDetents([.fraction(0.42), .large])
                .presentationBackgroundInteraction(.enabled(upThrough: .fraction(0.42)))
                #else
                .frame(minWidth: 460, minHeight: 560)
                #endif
            }
        }
        .sheet(isPresented: $showLayers) {
            NavigationStack {
                LayersView(showPlaces: $showPlaces, showTraffic: $showTraffic, satellite: $satellite, topView: $topView)
            }
            #if os(iOS)
            .presentationDetents([.medium, .large])
            #else
            .frame(minWidth: 420, minHeight: 520)
            #endif
        }
        .task(id: "\(selectedHex ?? "")-\(routeMinutes)-\(store.updated?.timeIntervalSince1970 ?? 0)") { await loadTrack() }
        .onChange(of: router.focusHex) { _, hex in
            guard let hex else { return }
            select(hex)
            router.focusHex = nil
        }
        .onChange(of: router.focusSpot?.lat) { _, _ in
            guard let spot = router.focusSpot else { return }
            withAnimation { position = .region(MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: spot.lat, longitude: spot.lon), span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15))) }
            router.focusSpot = nil
        }
        .onChange(of: selectedHex) { _, hex in router.sheetOpen = hex != nil }
        .onChange(of: showLayers) { _, open in router.sheetOpen = open }
        .sensoryFeedback(.selection, trigger: selectedHex)
    }

    private var detailBinding: Binding<Bool> {
        Binding(get: { selectedHex != nil }, set: { if !$0 { selectedHex = nil } })
    }

    private func select(_ hex: String) {
        selectedHex = hex
        track = []
        if let c = store.aircraft(hex: hex)?.coordinate {
            withAnimation(.easeInOut) {
                position = .region(MKCoordinateRegion(center: c, span: MKCoordinateSpan(latitudeDelta: 0.6, longitudeDelta: 0.6)))
            }
        }
    }

    private func loadTrack() async {
        guard let hex = selectedHex else { track = []; return }
        if let points = try? await HeliAPI.shared.track(hex: hex, minutes: routeMinutes) { track = points }
    }

    // MARK: - Status bar

    private var statusBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                let inAir = store.visibleAircraft.filter(\.airborne).count
                Label {
                    Text("In de lucht: \(inAir)")
                } icon: {
                    Circle().fill(store.failed ? Color.orange : Color.green).frame(width: 8, height: 8)
                }
                .font(.subheadline.weight(.semibold))
                Spacer()
                Button { showLayers = true } label: {
                    Image(systemName: "square.3.layers.3d")
                }
                .accessibilityLabel("Kaartlagen")
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(.regularMaterial, in: Capsule())

            if let weer = store.weer {
                Label(weer.tekst, systemImage: "cloud.fog.fill")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(.orange.opacity(0.9), in: Capsule())
                    .foregroundStyle(.white)
            }
            ForEach(store.incidents) { incident in
                Button {
                    withAnimation {
                        position = .region(MKCoordinateRegion(center: incident.coordinate, span: MKCoordinateSpan(latitudeDelta: 0.12, longitudeDelta: 0.12)))
                    }
                } label: {
                    Label(incident.title, systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(Theme.incident, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal)
        .padding(.top, 6)
    }
}

/// Red pulsing ring where several helicopters stand together.
struct IncidentPulse: View {
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle().stroke(Theme.incident, lineWidth: 3).frame(width: 60, height: 60)
                .scaleEffect(pulse ? 1.6 : 0.8).opacity(pulse ? 0 : 1)
            Circle().fill(Theme.incident.opacity(0.25)).frame(width: 44, height: 44)
        }
        .onAppear { withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { pulse = true } }
        .accessibilityLabel("Meerdere helikopters op één plek")
    }
}

/// Which aircraft and map extras are shown (like "Kaartlagen" in A-Alerts).
struct LayersView: View {
    @EnvironmentObject private var store: LiveStore
    @Environment(\.dismiss) private var dismiss
    @Binding var showPlaces: Bool
    @Binding var showTraffic: Bool
    @Binding var satellite: Bool
    @Binding var topView: Bool

    var body: some View {
        Form {
            Section("Toestellen") {
                ForEach(LuchtSoort.alle) { soort in
                    Toggle(isOn: Binding(
                        get: { store.lagen.contains(soort.id) },
                        set: { on in if on { store.lagen.insert(soort.id) } else { store.lagen.remove(soort.id) } })) {
                        HStack(spacing: 12) {
                            AircraftThumb(afbeelding: soort.afbeelding, soort: soort.soort, width: 56)
                            Text(soort.titel)
                        }
                    }
                }
            }
            Section {
                Picker("Iconen op de kaart", selection: $topView) {
                    Text("Bovenaanzicht").tag(true)
                    Text("Zijaanzicht").tag(false)
                }
                Toggle("Ziekenhuizen en bases", isOn: $showPlaces)
                Toggle("Verkeer", isOn: $showTraffic)
                Toggle("Satelliet", isOn: $satellite)
            } footer: {
                Text("Het bovenaanzicht draait mee met de koers. Favorieten staan altijd op de kaart.")
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Kaartlagen")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("Klaar") { dismiss() } }
        }
    }
}
