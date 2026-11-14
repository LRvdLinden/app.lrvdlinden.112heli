import SwiftUI
import MapKit

/// The live map: every followed aircraft, its route, hospitals/bases and "meerdere helikopters op één plek".
struct MapScreen: View {
    @EnvironmentObject private var store: LiveStore
    @EnvironmentObject private var router: Router
    @EnvironmentObject private var location: LocationManager

    @State private var position: MapCameraPosition = .region(MapScreen.netherlands)
    @State private var selectedHex: String?
    @State private var spoor = HeliSpoorStore()
    @State private var showLayers = false
    @AppStorage("map.places") private var showPlaces = true
    @AppStorage("map.traffic") private var showTraffic = false
    @AppStorage("map.satellite") private var satellite = false

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
            if let a = selected {
                let lijn = spoor.coordinates(live: spoor.afspeel == nil && a.airborne ? a.coordinate : nil)
                if lijn.count > 1 {
                    MapPolyline(coordinates: lijn)
                        .stroke(a.soort.color.opacity(spoor.afspeel == nil ? 0.9 : 0.35),
                                style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                }
                if spoor.afspeel != nil {
                    let gespeeld = spoor.afgespeeldeLijn
                    if gespeeld.count > 1 {
                        MapPolyline(coordinates: gespeeld)
                            .stroke(a.soort.color, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                    }
                    if let p = spoor.afspeelPunt {
                        Annotation(a.title, coordinate: p.coordinate, anchor: .center) {
                            AircraftDrawing(afbeelding: a.afbeelding)
                                .frame(width: 70, height: 25)
                                .shadow(color: .black.opacity(0.35), radius: 3, y: 2)
                        }
                        .annotationTitles(.hidden)
                    }
                }
            }
            ForEach(store.incidents) { incident in
                Annotation(incident.title, coordinate: incident.coordinate, anchor: .center) {
                    IncidentPulse()
                }
                .annotationTitles(.hidden)
            }
            ForEach(store.visibleAircraft.filter { $0.coordinate != nil }) { a in
                Annotation(a.title, coordinate: a.coordinate!, anchor: .center) {
                    HeliMarker(aircraft: a, selected: selectedHex == a.hex, toonNaam: selectedHex == a.hex)
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
        .overlay(alignment: .bottom) { infoKaart }
        .sheet(isPresented: $showLayers) {
            NavigationStack {
                LayersView(showPlaces: $showPlaces, showTraffic: $showTraffic, satellite: $satellite, hideOffline: $store.hideOffline)
            }
            #if os(iOS)
            .presentationDetents([.medium, .large])
            #else
            .frame(minWidth: 420, minHeight: 520)
            #endif
        }
        .onChange(of: selectedHex, initial: true) { _, hex in spoor.volg(hex) }
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

    /// The A-Alerts card, floating over the bottom of the map; scrolls when it is taller than the space left.
    @ViewBuilder private var infoKaart: some View {
        if let a = selected {
            GeometryReader { geo in
                VStack {
                    Spacer(minLength: 0)
                    ScrollView {
                        HeliInfoKaart(aircraft: a, afstandKm: location.distanceKm(to: a), spoor: spoor) {
                            withAnimation(.spring(duration: 0.3)) { selectedHex = nil }
                        }
                        .id(a.hex)
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    .frame(maxHeight: geo.size.height * 0.62)
                    .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 12)
                .padding(.bottom, 8)
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private func select(_ hex: String) {
        withAnimation(.spring(duration: 0.3)) { selectedHex = hex }
        if let c = store.aircraft(hex: hex)?.coordinate {
            withAnimation(.easeInOut) {
                position = .region(MKCoordinateRegion(center: c, span: MKCoordinateSpan(latitudeDelta: 0.6, longitudeDelta: 0.6)))
            }
        }
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
                FilterMenu()
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
    @Binding var hideOffline: Bool

    var body: some View {
        Form {
            Section {
                FilterToggles()
            } header: {
                Text("Wat wil je zien")
            } footer: {
                Text("Geldt ook voor de lijst en Apple TV. Offline: op de grond, op de basis of uit beeld.")
            }
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
                Toggle("Ziekenhuizen en bases", isOn: $showPlaces)
                Toggle("Verkeer", isOn: $showTraffic)
                Toggle("Satelliet", isOn: $satellite)
            } footer: {
                Text("Favorieten staan altijd op de kaart, behalve als je offline toestellen verbergt en ze niet vliegen.")
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Kaartlagen")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("Klaar") { dismiss() } }
        }
    }
}
