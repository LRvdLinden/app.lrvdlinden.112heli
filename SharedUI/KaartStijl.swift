import SwiftUI
import MapKit

/// Map look, the same choices as A-Alerts: map type, colours and "Rustige kaartkleuren" (on by default: aircraft stand out).
enum KaartStijl {
    static let typeKey = "map.type"        // standard, satellite, hybrid
    static let kleurenKey = "map.kleuren"  // auto, licht, donker
    static let rustigKey = "map.rustig"    // muted colours (default on)

    static func style(type: String, rustig: Bool, traffic: Bool = false) -> MapStyle {
        switch type {
        case "satellite": return .imagery(elevation: .realistic)
        case "hybrid": return .hybrid(elevation: .realistic, pointsOfInterest: .excludingAll, showsTraffic: traffic)
        default: return .standard(elevation: .realistic, emphasis: rustig ? .muted : .automatic, pointsOfInterest: .excludingAll, showsTraffic: traffic)
        }
    }

    static func colorScheme(_ kleuren: String) -> ColorScheme? {
        switch kleuren {
        case "licht": .light
        case "donker": .dark
        default: nil
        }
    }
}

/// Applies the chosen colours to a map only (the rest of the app keeps its own appearance).
struct KaartKleuren: ViewModifier {
    @AppStorage(KaartStijl.kleurenKey) private var kleuren = "auto"
    func body(content: Content) -> some View {
        if let scheme = KaartStijl.colorScheme(kleuren) { content.environment(\.colorScheme, scheme) } else { content }
    }
}

#if !os(tvOS)
/// The settings: map type, colours, calm colours (in Kaartlagen and Instellingen).
struct KaartStijlInstellingen: View {
    @AppStorage(KaartStijl.typeKey) private var type = "standard"
    @AppStorage(KaartStijl.kleurenKey) private var kleuren = "auto"
    @AppStorage(KaartStijl.rustigKey) private var rustig = true

    var body: some View {
        Picker("Kaarttype", selection: $type) {
            Text("Standaard").tag("standard")
            Text("Satelliet").tag("satellite")
            Text("Hybride").tag("hybrid")
        }
        Picker("Kleuren", selection: $kleuren) {
            Text("Automatisch").tag("auto")
            Text("Licht").tag("licht")
            Text("Donker").tag("donker")
        }
        Toggle("Rustige kaartkleuren", isOn: $rustig)
            .disabled(type == "satellite")
    }
}
#endif
