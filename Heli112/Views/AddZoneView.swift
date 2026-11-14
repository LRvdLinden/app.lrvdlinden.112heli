import SwiftUI
import MapKit

/// Add an own zone: the current location or a place/neighbourhood found by name.
struct AddZoneView: View {
    @EnvironmentObject private var push: PushManager
    @EnvironmentObject private var location: LocationManager
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: [MKMapItem] = []
    @State private var km: Double = 3
    @State private var searching = false

    var body: some View {
        Form {
            Section("Straal") {
                Picker("Straal", selection: $km) {
                    ForEach([1.0, 2, 3, 5, 10, 25], id: \.self) { Text("\(Int($0)) km").tag($0) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            }
            Section {
                Button {
                    if let loc = location.location {
                        add(naam: String(localized: "Mijn locatie"), coordinate: loc.coordinate)
                    } else {
                        location.request()
                    }
                } label: {
                    Label(location.location == nil ? "Sta locatie toe" : "Mijn huidige locatie", systemImage: "location.fill")
                }
            }
            Section("Zoek een plaats of wijk") {
                TextField("Bijvoorbeeld Apeldoorn-Zuid", text: $query)
                    .onSubmit { Task { await search() } }
                    .autocorrectionDisabled()
                if searching { ProgressView() }
                ForEach(results, id: \.self) { item in
                    Button {
                        add(naam: item.name ?? query, coordinate: item.placemark.coordinate)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(item.name ?? "").foregroundStyle(.primary)
                            Text(item.placemark.title ?? "").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Zone toevoegen")
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { dismiss() } } }
    }

    private func search() async {
        let text = query.trimmingCharacters(in: .whitespaces)
        guard text.count >= 2 else { return }
        searching = true
        defer { searching = false }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = text
        request.region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 52.2, longitude: 5.4),
                                            span: MKCoordinateSpan(latitudeDelta: 3.5, longitudeDelta: 4))
        request.resultTypes = .address
        results = (try? await MKLocalSearch(request: request).start().mapItems) ?? []
    }

    private func add(naam: String, coordinate: CLLocationCoordinate2D) {
        push.zones.append(.init(naam: naam, lat: (coordinate.latitude * 1000).rounded() / 1000,
                                lon: (coordinate.longitude * 1000).rounded() / 1000, km: km))
        dismiss()
    }
}
