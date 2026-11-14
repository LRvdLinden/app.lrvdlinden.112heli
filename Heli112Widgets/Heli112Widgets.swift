import WidgetKit
import SwiftUI

@main
struct Heli112WidgetsBundle: WidgetBundle {
    var body: some Widget {
        InAirWidget()
        FavoritesWidget()
        #if os(iOS)
        HeliLiveActivity()
        #endif
    }
}

// MARK: - Data

struct HeliEntry: TimelineEntry {
    let date: Date
    let aircraft: [Aircraft]
    let incidents: [Incident]
    let offline: Bool
}

/// Fetches the live snapshot (falls back to the copy the app saved) every 10 minutes.
struct HeliProvider: TimelineProvider {
    var favoritesOnly = false

    func placeholder(in context: Context) -> HeliEntry {
        HeliEntry(date: .now, aircraft: Self.sample, incidents: [], offline: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (HeliEntry) -> Void) {
        if context.isPreview { completion(placeholder(in: context)); return }
        Task { completion(await load()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HeliEntry>) -> Void) {
        Task {
            let entry = await load()
            completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(10 * 60))))
        }
    }

    private func load() async -> HeliEntry {
        var snapshot = try? await HeliAPI.shared.live()
        let offline = snapshot == nil
        if let s = snapshot { SnapshotCache.save(s) } else { snapshot = SnapshotCache.load() }
        var list = snapshot?.aircraft ?? []
        if favoritesOnly {
            let favs = Set(Favorites.all())
            list = list.filter { favs.contains($0.hex) }
        } else {
            list = list.filter(\.airborne)
        }
        list.sort { $0.airborne != $1.airborne ? $0.airborne : $0.title < $1.title }
        return HeliEntry(date: .now, aircraft: list, incidents: snapshot?.incidents ?? [], offline: offline)
    }

    static let sample: [Aircraft] = [
        Aircraft(hex: "000001", key: "lifeliner3", reg: "PH-UMC", callsign: "LIFELN3", soort: .trauma, icoon: nil, type: "EC35",
                 naam: "Lifeliner 3", basis: "Volkel", lat: 51.7, lon: 5.6, alt: 1500, gs: 120, track: 80, airborne: true,
                 seen: Date().timeIntervalSince1970, since: nil, stale: false, boven: "Uden", plek: nil, status_: "lucht"),
        Aircraft(hex: "000002", key: "zulu26", reg: "PH-PXZ", callsign: "ZXP26", soort: .politie, icoon: nil, type: "A139",
                 naam: "Zulu 26", basis: nil, lat: 52.3, lon: 4.9, alt: 1200, gs: 100, track: 250, airborne: true,
                 seen: Date().timeIntervalSince1970, since: nil, stale: false, boven: "Amsterdam", plek: nil, status_: "lucht"),
    ]
}

// MARK: - Widgets

struct InAirWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "app.lrvdlinden.112heli.inair", provider: HeliProvider()) { entry in
            HeliWidgetView(entry: entry, title: String(localized: "In de lucht"), empty: String(localized: "Er is nu niets in de lucht."))
                .containerBackground(for: .widget) { Color(light: 0xFFFFFF, dark: 0x121726) }
                .widgetURL(URL(string: "heli112://map"))
        }
        .configurationDisplayName("In de lucht")
        .description("Welke hulpdiensttoestellen nu vliegen.")
        .supportedFamilies(families)
    }
}

struct FavoritesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "app.lrvdlinden.112heli.favorites", provider: HeliProvider(favoritesOnly: true)) { entry in
            HeliWidgetView(entry: entry, title: String(localized: "Favorieten"), empty: String(localized: "Zet een toestel in je favorieten in de app."))
                .containerBackground(for: .widget) { Color(light: 0xFFFFFF, dark: 0x121726) }
        }
        .configurationDisplayName("Favorieten")
        .description("Waar je favoriete toestellen zijn.")
        .supportedFamilies(families)
    }
}

private var families: [WidgetFamily] {
    #if os(iOS)
    [.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular]
    #else
    [.systemSmall, .systemMedium, .systemLarge]
    #endif
}

struct HeliWidgetView: View {
    let entry: HeliEntry
    let title: String
    let empty: String
    @Environment(\.widgetFamily) private var family

    private var maxRows: Int {
        switch family {
        case .systemSmall: 2
        case .systemMedium: 3
        case .systemLarge: 7
        default: 1
        }
    }

    var body: some View {
        switch family {
        #if os(iOS)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                if let a = entry.aircraft.first {
                    Text(a.title).font(.caption)
                    Text(a.plaatsTekst ?? a.status).font(.caption2).lineLimit(1)
                } else {
                    Text("Niets in de lucht").font(.caption)
                }
            }
        #endif
        default:
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(title).font(.headline)
                    Spacer()
                    Text("\(entry.aircraft.count)")
                        .font(.headline.monospacedDigit())
                        .foregroundStyle(Theme.accent)
                }
                if let incident = entry.incidents.first, family != .systemSmall {
                    Label(incident.title, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.incident)
                        .lineLimit(1)
                }
                if entry.aircraft.isEmpty {
                    Spacer(minLength: 0)
                    Text(empty).font(.caption).foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                } else {
                    ForEach(entry.aircraft.prefix(maxRows)) { a in
                        Link(destination: URL(string: "heli112://aircraft/\(a.hex)")!) {
                            HStack(spacing: 8) {
                                AircraftThumb(a, width: family == .systemSmall ? 44 : 56)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(a.title).font(.caption.weight(.semibold)).lineLimit(1)
                                    Text(a.airborne ? Format.altitude(a.alt) : a.status)
                                        .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }
                if entry.offline {
                    Text("Laatst bekend").font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
    }
}
