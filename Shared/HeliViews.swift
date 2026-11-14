import SwiftUI

/// The A-Alerts side-view drawing of an aircraft, mirrored when it flies west.
struct AircraftDrawing: View {
    let afbeelding: String
    var west = false

    var body: some View {
        Image(afbeelding)
            .resizable()
            .scaledToFit()
            .scaleEffect(x: west ? -1 : 1, y: 1)
            .accessibilityHidden(true)
    }
}

/// Small tile for lists and widgets: the drawing on a tint of the soort colour.
struct AircraftThumb: View {
    let afbeelding: String
    let soort: Soort
    var width: CGFloat = 64
    var dimmed = false

    var body: some View {
        AircraftDrawing(afbeelding: afbeelding)
            .padding(.horizontal, width * 0.06)
            .frame(width: width, height: width * 0.5)
            .background(soort.color.opacity(0.14), in: RoundedRectangle(cornerRadius: width * 0.14, style: .continuous))
            .overlay(alignment: .bottomTrailing) {
                Circle().fill(soort.color).frame(width: width * 0.13, height: width * 0.13).padding(width * 0.06)
            }
            .opacity(dimmed ? 0.55 : 1)
    }
}

extension AircraftThumb {
    init(_ a: Aircraft, width: CGFloat = 64) {
        self.init(afbeelding: a.afbeelding, soort: a.soort, width: width, dimmed: !a.airborne)
    }
}

/// Map marker like in A-Alerts: the drawing, mirrored when flying west, and the name.
/// Older than a minute it turns grey with "positie 40 s oud", so a standing icon is not taken for live.
struct HeliMarker: View {
    let aircraft: Aircraft
    var selected = false
    /// Height of the drawing in points (it is about 2.8× as wide).
    var size: CGFloat = 30

    var body: some View {
        TimelineView(.periodic(from: .now, by: 5)) { context in
            let old = aircraft.isOld(at: context.date)
            VStack(spacing: 2) {
                AircraftDrawing(afbeelding: aircraft.afbeelding, west: aircraft.vliegtWest)
                    .frame(width: size * 2.8, height: size)
                    .saturation(old ? 0 : 1)
                    .shadow(color: .black.opacity(0.35), radius: 3, y: 2)
                VStack(spacing: 0) {
                    Text(aircraft.title)
                        .font(.caption2.weight(.bold))
                        .lineLimit(1)
                    if old, let age = aircraft.positionAge(at: context.date) {
                        Text("positie \(Format.age(age)) oud")
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(.regularMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(aircraft.soort.color, lineWidth: selected ? 2 : 0))
            }
            .opacity(old ? 0.7 : 1)
            .scaleEffect(selected ? 1.15 : 1)
            .animation(.spring(duration: 0.25), value: selected)
            .animation(.easeInOut(duration: 0.3), value: aircraft.vliegtWest)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(aircraft.title), \(aircraft.soort.naam), \(aircraft.status)")
    }
}
