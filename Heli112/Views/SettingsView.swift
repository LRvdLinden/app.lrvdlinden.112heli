import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var push: PushManager
    @EnvironmentObject private var location: LocationManager
    @AppStorage("appearance") private var appearance: AppearanceSetting = .system
    @AppStorage("onboarding.done") private var onboardingDone = true
    @State private var showWhatsNew = false
    @State private var showAddZone = false

    private let radii: [Int] = [10, 25, 50, 100, 200, 0]

    var body: some View {
        Form {
            notifications
            if push.isAuthorized {
                Section {
                    ForEach(Soort.allCases) { soort in
                        Toggle(isOn: Binding(
                            get: { push.soorten.contains(soort) },
                            set: { on in if on { push.soorten.insert(soort) } else { push.soorten.remove(soort) } })) {
                            Label {
                                Text(soort.meervoud)
                            } icon: {
                                Circle().fill(soort.color).frame(width: 12, height: 12)
                            }
                        }
                    }
                } header: {
                    Text("Opstijgen melden van")
                }
                Section {
                    ForEach(push.zones) { zone in
                        LabeledContent(zone.naam, value: "\(Int(zone.km)) km")
                    }
                    .onDelete { push.zones.remove(atOffsets: $0) }
                    if push.zones.count < 5 {
                        Button { showAddZone = true } label: { Label("Zone toevoegen", systemImage: "plus.circle") }
                    }
                } header: {
                    Text("Mijn zones")
                } footer: {
                    Text("Een melding als er een toestel van de gekozen soorten boven je wijk of plaats vliegt, welk toestel het ook is. Hoogstens één keer per uur per toestel.")
                }
                Section {
                    Picker("Gebied", selection: $push.radiusKm) {
                        ForEach(radii, id: \.self) { km in
                            if km == 0 { Text("Heel Nederland").tag(0) } else { Text("\(km) km om mij heen").tag(km) }
                        }
                    }
                    if push.radiusKm > 0 && !location.isAllowed {
                        Button("Gebruik mijn locatie") { location.request() }
                    }
                } footer: {
                    Text(push.radiusKm > 0 && !location.isAllowed
                         ? "Zonder locatie krijg je meldingen uit heel Nederland."
                         : "Favorieten melden we altijd, waar ze ook opstijgen.")
                }
            }

            Section("Weergave") {
                Picker("Weergave", selection: $appearance) {
                    ForEach(AppearanceSetting.allCases) { Text($0.label).tag($0) }
                }
            }

            Section {
                if let url = Self.link("HeliPrivacyURL") {
                    Link(destination: url) { Label("Privacyverklaring", systemImage: "hand.raised") }
                }
                if let url = Self.link("HeliSupportURL") {
                    Link(destination: url) { Label("Support en contact", systemImage: "questionmark.circle") }
                }
                Button { showWhatsNew = true } label: { Label("Wat is nieuw", systemImage: "sparkles") }
                Button { onboardingDone = false } label: { Label("Toon het welkomstscherm", systemImage: "hand.wave") }
            } footer: {
                Text("Posities: adsb.lol (ODbL). Ziekenhuizen en bases: OpenStreetMap (ODbL). Een toestel dat zijn positie niet uitzendt, staat niet op de kaart.")
            }

            Section(MoreAppsText.current.section) {
                MoreAppsCard()
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }

            Section {
                AppInfoFooter()
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Instellingen")
        .sheet(isPresented: $showWhatsNew) { NavigationStack { WhatsNewView() } }
        .sheet(isPresented: $showAddZone) { NavigationStack { AddZoneView() } }
    }

    private var notifications: some View {
        Section {
            if push.isAuthorized {
                Toggle("Opstijgen in mijn gebied", isOn: $push.takeoff)
                Toggle("Meerdere helikopters op één plek", isOn: $push.incidents)
                Toggle("Favorieten: opstijgen en landen", isOn: $push.favAlerts)
                Toggle("Favoriet wisselt van roepnaam", isOn: $push.callsign)
            } else if push.authorization == .denied {
                Text("Meldingen staan uit voor 112Heli. Zet ze aan in de systeeminstellingen.").foregroundStyle(.secondary)
            } else {
                Button("Meldingen aanzetten") { Task { await push.requestPermission() } }
            }
        } header: {
            Text("Pushmeldingen")
        }
    }

    private static func link(_ key: String) -> URL? {
        guard let s = Bundle.main.object(forInfoDictionaryKey: key) as? String, !s.isEmpty else { return nil }
        return URL(string: s)
    }
}

struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section("Versie 1.0.0") {
                Label("Live kaart met alles wat vliegt voor de hulpdiensten: Lifeliners, Zulu, Kustwacht, Defensie, Marechaussee en PH-GOV", systemImage: "map")
                Label("Route, hoogte, snelheid, koers en het weer bij elk toestel", systemImage: "airplane")
                Label("Meldingen bij opstijgen en bij meerdere helikopters op één plek", systemImage: "bell.badge")
                Label("Favorieten, widgets en volgen op het toegangsscherm", systemImage: "star")
                Label("Historie van 30 dagen", systemImage: "clock.arrow.circlepath")
                Label("Eigen zones: een melding als er iets boven je wijk of plaats vliegt", systemImage: "scope")
                Label("Landingsplek: geland bij ziekenhuis, terug op de basis of op locatie", systemImage: "mappin.and.ellipse")
                Label("Status per toestel en de leeftijd van elke positie", systemImage: "clock")
                Label("Melding als een favoriet van roepnaam wisselt", systemImage: "arrow.triangle.2.circlepath")
                Label("Weer dat vliegen beperkt (KNMI)", systemImage: "cloud.fog")
                Label("Een eigen helikoptergeluid bij meldingen", systemImage: "speaker.wave.2")
                Label("Meld een toestel dat ontbreekt of niet klopt", systemImage: "exclamationmark.bubble")
                Label("En voor de lol: de jet van Max Verstappen", systemImage: "flag.checkered")
            }
        }
        .navigationTitle("Wat is nieuw")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Klaar") { dismiss() } } }
    }
}
