import SwiftUI

/// Three welcome screens, only at the first start. Permission is asked here with a button, never by itself.
struct OnboardingView: View {
    var onFinish: () -> Void

    @EnvironmentObject private var push: PushManager
    @EnvironmentObject private var location: LocationManager
    @State private var page = 0

    var body: some View {
        VStack(spacing: 0) {
            Group {
                switch page {
                case 0: welcome
                case 1: notifications
                default: locationPage
                }
            }
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(28)
            .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))

            HStack(spacing: 8) {
                ForEach(0..<3) { i in
                    Capsule().fill(i == page ? Theme.accent : Color.secondary.opacity(0.3))
                        .frame(width: i == page ? 22 : 8, height: 8)
                }
            }
            .padding(.bottom, 24)
            .accessibilityHidden(true)
        }
        .animation(.snappy, value: page)
    }

    private var welcome: some View {
        VStack(spacing: 22) {
            Spacer()
            AircraftDrawing(afbeelding: "heli_politie_aw139").frame(maxWidth: 300)
            Text("Alles wat vliegt voor de hulpdiensten").font(.largeTitle.bold()).multilineTextAlignment(.center)
            Text("Lifeliners, politiehelikopters, Kustwacht en Defensie live op de kaart, met waar ze vandaan komen en waar ze staan.")
                .font(.title3).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Spacer()
            primary("Volgende") { page = 1 }
        }
    }

    private var notifications: some View {
        VStack(spacing: 22) {
            Spacer()
            Image(systemName: "bell.badge.fill").font(.system(size: 64)).foregroundStyle(Theme.accent).symbolRenderingMode(.hierarchical)
            Text("Weten wanneer er een heli opstijgt").font(.largeTitle.bold()).multilineTextAlignment(.center)
            Text("Een melding als een Lifeliner of Zulu bij jou in de buurt opstijgt, als je favoriet de lucht in gaat of als er meerdere helikopters op één plek staan. Je kiest zelf welke.")
                .font(.title3).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Spacer()
            primary("Meldingen aanzetten") {
                Task { await push.requestPermission(); page = 2 }
            }
            Button("Later") { page = 2 }.buttonStyle(.borderless)
        }
    }

    private var locationPage: some View {
        VStack(spacing: 22) {
            Spacer()
            Image(systemName: "location.circle.fill").font(.system(size: 64)).foregroundStyle(Theme.accent).symbolRenderingMode(.hierarchical)
            Text("Wat vliegt er bij jou?").font(.largeTitle.bold()).multilineTextAlignment(.center)
            Text("Met je locatie zie je hoe ver een toestel weg is en krijg je alleen meldingen uit je eigen omgeving. Je locatie wordt afgerond op ongeveer een kilometer.")
                .font(.title3).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Spacer()
            primary("Gebruik mijn locatie") { location.request(); onFinish() }
            Button("Niet nu") { onFinish() }.buttonStyle(.borderless)
        }
    }

    private func primary(_ title: LocalizedStringKey, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .sensoryFeedback(.selection, trigger: page)
    }
}
