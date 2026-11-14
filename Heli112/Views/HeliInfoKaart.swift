import SwiftUI
import MapKit

// The aircraft card on the map, the same as in A-Alerts: name, "Nu boven …", koers/hoogte/snelheid, the trail
// (Deze vlucht / 30 min / 2 uur) with playback, the places of the flight, the last flights and "Klopt dit toestel niet?".

/// Trail, places and flights of the selected aircraft, refreshed every 20 seconds while it is shown.
@MainActor
@Observable
final class HeliSpoorStore {
    private(set) var punten: [HeliSpoorPunt] = []
    private(set) var vluchten: [HeliVlucht] = []
    private(set) var plaatsen: [SpoorPlaats] = []
    private(set) var vlucht: HeliVlucht?
    private(set) var hex: String?
    var bereik: SpoorBereik = .vlucht {
        didSet { if oldValue != bereik { stopAfspelen(); Task { await load() } } }
    }
    @ObservationIgnored private var task: Task<Void, Never>?

    // MARK: Playback ("Vlucht terugspelen")
    /// 0…1 along the trail while playing back; nil = live.
    var afspeel: Double?
    private(set) var speelt = false
    /// Seconds of flight per second.
    var snelheid: Double = 60
    @ObservationIgnored private var speelTask: Task<Void, Never>?

    var duur: TimeInterval { guard let a = punten.first?.t, let b = punten.last?.t else { return 0 }; return b.timeIntervalSince(a) }

    func speel() {
        guard punten.count >= 2, duur > 0 else { return }
        if afspeel == nil || (afspeel ?? 0) >= 1 { afspeel = 0 }
        speelt = true
        speelTask?.cancel()
        speelTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(100))
                guard let self, self.speelt else { return }
                let volgende = min(1, (self.afspeel ?? 0) + 0.1 * self.snelheid / max(self.duur, 1))
                self.afspeel = volgende
                if volgende >= 1 { self.speelt = false; return }
            }
        }
    }
    func pauze() { speelt = false; speelTask?.cancel() }
    func stopAfspelen() { pauze(); afspeel = nil }

    var afspeelMoment: Date? {
        guard let f = afspeel, let a = punten.first?.t else { return nil }
        return a.addingTimeInterval(duur * f)
    }
    /// Interpolated point at the playback position.
    var afspeelPunt: (coordinate: CLLocationCoordinate2D, hoogteFt: Double?)? {
        guard let t = afspeelMoment, punten.count >= 2, let last = punten.last else { return nil }
        guard let i = punten.firstIndex(where: { $0.t >= t }) else { return (last.coordinate, last.hoogteFt) }
        if i == 0 { return (punten[0].coordinate, punten[0].hoogteFt) }
        let a = punten[i - 1], b = punten[i]
        let span = b.t.timeIntervalSince(a.t)
        let f = span > 0 ? t.timeIntervalSince(a.t) / span : 1
        return (CLLocationCoordinate2D(latitude: a.lat + (b.lat - a.lat) * f, longitude: a.lon + (b.lon - a.lon) * f), a.hoogteFt ?? b.hoogteFt)
    }
    /// Trail up to the playback position.
    var afgespeeldeLijn: [CLLocationCoordinate2D] {
        guard let t = afspeelMoment else { return [] }
        var out = punten.filter { $0.t <= t }.map(\.coordinate)
        if let p = afspeelPunt?.coordinate { out.append(p) }
        return out
    }

    func volg(_ hex: String?) {
        guard hex != self.hex else { return }
        self.hex = hex
        stopAfspelen()
        punten = []; vluchten = []; plaatsen = []; vlucht = nil
        task?.cancel()
        guard hex != nil else { return }
        task = Task { [weak self] in
            while !Task.isCancelled {
                await self?.load()
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    func load() async {
        guard let hex else { return }
        async let p = try? HeliAPI.shared.spoor(hex: hex, bereik: bereik)
        async let v = try? HeliAPI.shared.vluchten(hex: hex)
        let (pp, vv) = await (p, v)
        guard hex == self.hex else { return }
        if let pp {
            if afspeel == nil { punten = pp.punten }
            plaatsen = pp.plaatsen
            vlucht = pp.vlucht
        }
        if let vv { vluchten = vv }
    }

    /// Coordinates for the map (at most ~400 points), plus the live position at the end.
    func coordinates(live: CLLocationCoordinate2D?) -> [CLLocationCoordinate2D] {
        let step = max(1, punten.count / 400)
        var out = stride(from: 0, to: punten.count, by: step).map { punten[$0].coordinate }
        if step > 1, let last = punten.last?.coordinate { out.append(last) }
        if let live { out.append(live) }
        return out
    }
}

/// The card itself (floats over the map).
struct HeliInfoKaart: View {
    let aircraft: Aircraft
    var afstandKm: Double?
    var spoor: HeliSpoorStore
    /// The card opens small (the aircraft and its trail stay in sight) and unfolds on "Meer" or a swipe up, as in A-Alerts.
    var inklapbaar = true
    var onClose: () -> Void

    @EnvironmentObject private var store: LiveStore
    @State private var showReport = false
    @State private var uitgevouwen = false

    private var a: Aircraft { aircraft }
    private var klein: Bool { inklapbaar && !uitgevouwen }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if inklapbaar {
                Capsule().fill(Color.secondary.opacity(0.4)).frame(width: 38, height: 5)
                    .frame(maxWidth: .infinity)
                    .padding(.top, -4)
            }
            HStack(spacing: 12) {
                AircraftDrawing(afbeelding: a.afbeelding, west: a.vliegtWest)
                    .frame(width: 84, height: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.title).font(.title2.weight(.bold)).lineLimit(1).minimumScaleFactor(0.7)
                    Text([a.soort.naam, a.reg, a.basis.map { String(localized: "basis \($0)") }].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                bel
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill").font(.title3).foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Sluit")
            }

            if a.airborne {
                // "Nu boven Teuge, Voorst · 25 min in de lucht"
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(a.boven.map { String(localized: "Nu boven \($0)") } ?? String(localized: "Nu boven zee of over de grens"))
                        .font(.subheadline.weight(.semibold))
                    if let v = spoor.vlucht, v.onderweg {
                        Text(v.inDeLucht).font(.caption.weight(.semibold)).foregroundStyle(.green)
                    }
                    Spacer(minLength: 0)
                }
            } else {
                HStack(spacing: 6) {
                    Text(a.status).font(.subheadline.weight(.semibold))
                    if let plek = a.plek { Text(verbatim: "· \(plek)").font(.subheadline).foregroundStyle(.secondary) }
                    if let since = a.sinceDate {
                        Text("sinds \(since.formatted(date: .omitted, time: .shortened))").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
            }

            if klein {
                // The basics on one line; everything else behind "Meer".
                HStack(spacing: 14) {
                    if a.airborne {
                        kort(Format.heading(a.track), String(localized: "koers"))
                        kort(a.hoogteTekst, String(localized: "hoogte"))
                        kort(a.snelheidTekst, nil)
                    } else if let seen = a.seenDate {
                        kort(String(localized: "Positie van \(seen.formatted(date: .omitted, time: .shortened))"), nil)
                    }
                    Spacer(minLength: 0)
                }
                vouwKnop
            } else {
                uitgebreid
                if inklapbaar { vouwKnop }
            }
        }
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.15), radius: 10, y: 4)
        .gesture(DragGesture(minimumDistance: 24).onEnded { g in
            guard inklapbaar, abs(g.translation.height) > abs(g.translation.width) else { return }
            withAnimation(.snappy) { uitgevouwen = g.translation.height < 0 }
        })
        .sheet(isPresented: $showReport) { NavigationStack { ReportView(aircraft: a) } }
    }

    private var vouwKnop: some View {
        Button {
            withAnimation(.snappy) { uitgevouwen.toggle() }
        } label: {
            Label(uitgevouwen ? String(localized: "Minder") : String(localized: "Meer over deze vlucht"),
                  systemImage: uitgevouwen ? "chevron.down" : "chevron.up")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.accent)
    }

    private func kort(_ waarde: String, _ naam: String?) -> some View {
        HStack(spacing: 4) {
            Text(verbatim: waarde).font(.footnote.weight(.semibold)).monospacedDigit()
            if let naam { Text(verbatim: naam).font(.footnote).foregroundStyle(.secondary) }
        }
    }

    /// Everything of the full card below the header.
    @ViewBuilder private var uitgebreid: some View {
            HStack(spacing: 8) {
                waarde("Koers", a.airborne ? Format.heading(a.track) : "–", "location.north.line.fill", koers: a.airborne ? a.track : nil)
                waarde("Hoogte", a.hoogteTekst, "arrow.up.and.down", tweede: a.hoogteTweede)
                waarde("Snelheid", a.snelheidTekst, "speedometer", tweede: a.snelheidTweede)
            }
            .fixedSize(horizontal: false, vertical: true)

            Picker("Routespoor", selection: Binding(get: { spoor.bereik }, set: { spoor.bereik = $0 })) {
                ForEach(SpoorBereik.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            AfspeelBalk(spoor: spoor)
            HeliPlaatsenLijst(plaatsen: spoor.plaatsen, onderweg: spoor.vlucht?.onderweg ?? false)
            HeliVluchtenLijst(vluchten: spoor.vluchten, aantal: 3)

            TimelineView(.periodic(from: .now, by: 5)) { context in
                let old = a.isOld(at: context.date)
                HStack(spacing: 6) {
                    if let afstandKm {
                        Text("\(afstandKm.formatted(.number.precision(.fractionLength(1)))) km van je af")
                        Text(verbatim: "·")
                    }
                    if let seen = a.seenDate {
                        Text("Positie van \(seen.formatted(date: .omitted, time: .standard))")
                        if old { Text("(verouderd)") }
                    } else {
                        Text("Geen positie")
                    }
                }
                .font(.caption2)
                .foregroundStyle(old ? Color.orange : Color.secondary)
            }

            Button { showReport = true } label: {
                Label("Klopt dit toestel niet?", systemImage: "exclamationmark.bubble")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
    }

    /// The bell: a push when this aircraft takes off (it becomes a favourite, like the bell in A-Alerts).
    private var bel: some View {
        let aan = store.isFavorite(a.hex)
        return Button {
            store.toggleFavorite(a.hex)
        } label: {
            Image(systemName: aan ? "bell.fill" : "bell")
                .font(.title3)
                .foregroundStyle(aan ? Color.orange : Color.secondary)
                .frame(width: 36, height: 36)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: aan)
        .accessibilityLabel(aan ? String(localized: "Geen melding meer als \(a.title) opstijgt") : String(localized: "Melding als \(a.title) opstijgt"))
    }

    /// One value; `tweede` is the same value in the other unit, `koers` draws a small compass.
    private func waarde(_ titel: LocalizedStringKey, _ value: String, _ icon: String, tweede: String? = nil, koers: Double? = nil) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Label(titel, systemImage: icon)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
            HStack(spacing: 6) {
                if let koers {
                    Image(systemName: "location.north.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.red)
                        .rotationEffect(.degrees(koers))
                        .frame(width: 20, height: 20)
                        .background(Circle().stroke(Color.secondary.opacity(0.35), lineWidth: 1.5))
                        .accessibilityHidden(true)
                }
                Text(value).font(.subheadline.weight(.semibold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            }
            if let tweede {
                Text(tweede).font(.caption2.weight(.medium)).foregroundStyle(.secondary).monospacedDigit().lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(10)
        .background(Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

/// Play back the trail shown: play/pause, a slider and the speed.
struct AfspeelBalk: View {
    @Bindable var spoor: HeliSpoorStore

    var body: some View {
        if spoor.punten.count >= 2 {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 10) {
                    Button {
                        spoor.speelt ? spoor.pauze() : spoor.speel()
                    } label: {
                        Image(systemName: spoor.speelt ? "pause.circle.fill" : "play.circle.fill").font(.title2)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(spoor.speelt ? "Pauze" : "Vlucht terugspelen")
                    Slider(value: Binding(get: { spoor.afspeel ?? 1 }, set: { spoor.pauze(); spoor.afspeel = $0 }), in: 0...1)
                        .tint(Theme.accent)
                        .accessibilityLabel("Afspeelpositie")
                    Menu {
                        ForEach([30.0, 60, 120, 300], id: \.self) { v in
                            Button(String("\(Int(v))×")) { spoor.snelheid = v }
                        }
                    } label: {
                        Text(verbatim: "\(Int(spoor.snelheid))×").font(.caption.weight(.semibold)).monospacedDigit()
                    }
                    if spoor.afspeel != nil {
                        Button { spoor.stopAfspelen() } label: { Image(systemName: "xmark.circle") }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Terug naar live")
                    }
                }
                if let t = spoor.afspeelMoment {
                    let h = spoor.afspeelPunt?.hoogteFt.map { " · \(Int(($0 * 0.3048 / 10).rounded()) * 10) m" } ?? ""
                    Text(String(localized: "Terugspelen: \(t.formatted(date: .omitted, time: .standard))") + h)
                        .font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                }
            }
        }
    }
}

/// The flight as a list of places, newest first: "14:12–14:16  Teuge  Voorst".
struct HeliPlaatsenLijst: View {
    let plaatsen: [SpoorPlaats]
    let onderweg: Bool
    var aantal = 6

    var body: some View {
        if !plaatsen.isEmpty {
            VStack(alignment: .leading, spacing: 5) {
                Text("Waar geweest").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                ForEach(Array(plaatsen.prefix(aantal).enumerated()), id: \.element.id) { i, p in
                    let nu = i == 0 && onderweg
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(verbatim: nu ? tijd(p.van) : "\(tijd(p.van))–\(tijd(p.tot))")
                            .font(.caption).monospacedDigit().foregroundStyle(.secondary)
                            .frame(width: 86, alignment: .leading)
                        if let plaats = p.plaats {
                            Text(verbatim: plaats).font(.footnote.weight(.semibold)).foregroundStyle(nu ? Color.green : Color.primary)
                            if let g = p.gemeente, g != plaats {
                                Text(verbatim: g).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                        } else {
                            Text("Boven zee of over de grens").font(.footnote).italic().foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
        }
    }

    private func tijd(_ d: Date) -> String { d.formatted(date: .omitted, time: .shortened) }
}

/// The last flights of an aircraft (take-off, landing, duration, distance).
struct HeliVluchtenLijst: View {
    let vluchten: [HeliVlucht]
    var aantal = 4

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Vluchten").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            if vluchten.isEmpty {
                Text("Nog geen vluchten opgeslagen.").font(.caption).foregroundStyle(.secondary)
            }
            ForEach(vluchten.prefix(aantal)) { v in
                HStack(spacing: 8) {
                    Image(systemName: v.onderweg ? "airplane.departure" : "airplane.arrival")
                        .foregroundStyle(v.onderweg ? Color.green : Color.secondary)
                        .frame(width: 18)
                    Text(verbatim: tijden(v)).font(.footnote.weight(.semibold)).monospacedDigit()
                    Spacer()
                    Text(verbatim: "\(v.duurMin) min · \(v.afstandKm.formatted(.number.precision(.fractionLength(0)))) km")
                        .font(.caption).foregroundStyle(.secondary).monospacedDigit()
                }
            }
        }
    }

    private func tijden(_ v: HeliVlucht) -> String {
        let f = Date.FormatStyle(date: Calendar.current.isDateInToday(v.start) ? .omitted : .abbreviated, time: .shortened)
        let start = v.start.formatted(f)
        if v.onderweg { return String(localized: "\(start) – nog in de lucht") }
        return "\(start) – \(v.einde?.formatted(date: .omitted, time: .shortened) ?? "?")"
    }
}
