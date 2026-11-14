#if os(iOS)
import ActivityKit
import WidgetKit
import SwiftUI

/// Lock screen and Dynamic Island for one followed aircraft (updates come from the 112heli worker).
struct HeliLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: HeliActivityAttributes.self) { context in
            LockScreenView(state: context.state)
                .padding(16)
                .activityBackgroundTint(Color(hex: 0x121726))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "heli112://aircraft/\(context.attributes.hex)"))
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    AircraftDrawing(afbeelding: s.afbeelding).frame(width: 84, height: 30)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(s.status).font(.caption.weight(.bold)).foregroundStyle(s.airborne ? .green : .secondary)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(s.naam).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Figures(state: s)
                }
            } compactLeading: {
                AircraftDrawing(afbeelding: s.afbeelding).frame(width: 40, height: 16)
            } compactTrailing: {
                Text(s.airborne ? Format.altitude(s.altitudeFt) : s.status)
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Circle().fill(s.soortValue.color).frame(width: 12, height: 12)
            }
            .widgetURL(URL(string: "heli112://aircraft/\(context.attributes.hex)"))
            .keylineTint(s.soortValue.color)
        }
    }
}

private struct LockScreenView: View {
    let state: HeliActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                AircraftDrawing(afbeelding: state.afbeelding).frame(width: 100, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.naam).font(.headline).foregroundStyle(.white)
                    Text(state.reg.isEmpty ? state.soortValue.naam : "\(state.soortValue.naam) · \(state.reg)")
                        .font(.caption).foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                Text(state.status)
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background((state.airborne ? Color.green : Color.gray).opacity(0.3), in: Capsule())
                    .foregroundStyle(.white)
            }
            Figures(state: state).foregroundStyle(.white)
        }
    }
}

private struct Figures: View {
    let state: HeliActivityAttributes.ContentState

    var body: some View {
        HStack {
            figure("Hoogte", state.airborne ? Format.altitude(state.altitudeFt) : "–")
            Spacer()
            figure("Snelheid", state.airborne ? Format.speed(state.speedKt) : "–")
            Spacer()
            figure("Koers", state.airborne ? Format.heading(state.heading) : "–")
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("Bijgewerkt").font(.caption2).opacity(0.7)
                Text(Date(timeIntervalSince1970: state.updated), style: .time).font(.caption.monospacedDigit())
            }
        }
    }

    private func figure(_ title: LocalizedStringKey, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.caption2).opacity(0.7)
            Text(value).font(.caption.weight(.semibold).monospacedDigit())
        }
    }
}
#endif
