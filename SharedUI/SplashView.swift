import SwiftUI

/// Animated splash in the style of the app icon: blue radar, the Zulu flying in, a red blip that pings, the name,
/// and the Zulu flying off again. Never waits for the network (about 2.7 s). With Reduce Motion it shows the
/// still picture for a moment.
struct SplashView: View {
    var onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var ringsIn = false
    @State private var sweep = 0.0
    @State private var heliX: CGFloat = -1.3      // × screen width
    @State private var heliTilt = -16.0
    @State private var heliScale: CGFloat = 0.8
    @State private var bob = false
    @State private var blipIn = false
    @State private var ping = false
    @State private var titleIn = false
    @State private var subtitleIn = false
    @State private var leaving = false
    @State private var bump = 0

    private static let blueIn = Color(hex: 0x4C6BFF)
    private static let blueOut = Color(hex: 0x2747E8)
    private static let red = Color(hex: 0xE11D48)

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let r = min(w, h * 0.8) * 0.42
            let centre = CGPoint(x: w / 2, y: h * 0.42)
            ZStack {
                RadialGradient(colors: [Self.blueIn, Self.blueOut], center: UnitPoint(x: 0.5, y: 0.42),
                               startRadius: 0, endRadius: max(w, h) * 0.75)
                    .ignoresSafeArea()

                radar(r: r)
                    .position(centre)

                heli(r: r, w: w)
                    .position(centre)

                blip(r: r)
                    .position(x: centre.x + r * 0.6, y: centre.y - r * 0.56)

                VStack(spacing: 8) {
                    Text(verbatim: "112Heli")
                        .font(.system(size: max(34, r * 0.24), weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                        .scaleEffect(titleIn ? 1 : 0.6)
                        .blur(radius: titleIn ? 0 : 12)
                        .opacity(titleIn ? 1 : 0)
                    Text("Hulpdiensten live in de lucht")
                        .font(.system(size: max(15, r * 0.075), weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.85))
                        .offset(y: subtitleIn ? 0 : 14)
                        .opacity(subtitleIn ? 1 : 0)
                }
                .position(x: w / 2, y: centre.y + r + max(60, r * 0.36))
            }
            .scaleEffect(leaving ? 1.06 : 1)
        }
        .accessibilityHidden(true)
        #if os(iOS)
        .sensoryFeedback(.impact(weight: .medium), trigger: bump)
        #endif
        .task { await run() }
    }

    // MARK: parts

    private func radar(r: CGFloat) -> some View {
        ZStack {
            ForEach(Array([1.0, 310.0 / 440, 180.0 / 440].enumerated()), id: \.offset) { i, f in
                Circle()
                    .stroke(.white.opacity(0.28), lineWidth: 2.5)
                    .frame(width: r * 2 * f, height: r * 2 * f)
                    .scaleEffect(ringsIn ? 1 : 0.3)
                    .opacity(ringsIn ? 1 : 0)
                    .animation(.spring(duration: 0.7, bounce: 0.35).delay(Double(2 - i) * 0.08), value: ringsIn)
            }
            Rectangle().fill(.white.opacity(0.16)).frame(width: 2, height: ringsIn ? r * 2 : 0)
            Rectangle().fill(.white.opacity(0.16)).frame(width: ringsIn ? r * 2 : 0, height: 2)
            SweepShape()
                .fill(AngularGradient(colors: [.white.opacity(0), .white.opacity(0.32)], center: .center,
                                      startAngle: .degrees(-90), endAngle: .degrees(0)))
                .frame(width: r * 2, height: r * 2)
                .rotationEffect(.degrees(sweep))
                .opacity(ringsIn ? 1 : 0)
        }
        .scaleEffect(leaving ? 1.25 : 1)
        .opacity(leaving ? 0 : 1)
    }

    private func heli(r: CGFloat, w: CGFloat) -> some View {
        Image("HeliWhite")
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .foregroundStyle(.white)
            .frame(width: r * 1.64)
            .shadow(color: .black.opacity(0.28), radius: 12, y: 10)
            .scaleEffect(heliScale)
            .rotationEffect(.degrees(heliTilt))
            .offset(x: heliX * w, y: (bob ? -6 : 4) - r * 0.02)
    }

    private func blip(r: CGFloat) -> some View {
        let d = max(14, r * 0.13)
        return ZStack {
            Circle().stroke(Self.red, lineWidth: 3)
                .frame(width: d, height: d)
                .scaleEffect(ping ? 4.5 : 1)
                .opacity(ping ? 0 : 0.9)
            Circle().fill(Self.red)
                .frame(width: d, height: d)
                .shadow(color: Self.red.opacity(0.9), radius: d * 0.6)
        }
        .scaleEffect(blipIn ? 1 : 0.01)
        .opacity(leaving ? 0 : 1)
    }

    // MARK: timeline

    private func run() async {
        if reduceMotion {
            ringsIn = true; heliX = 0; heliTilt = 0; heliScale = 1; blipIn = true; titleIn = true; subtitleIn = true
            try? await Task.sleep(for: .seconds(0.9))
            onFinish()
            return
        }
        ringsIn = true
        withAnimation(.linear(duration: 2.6)) { sweep = 540 }
        withAnimation(.spring(duration: 0.9, bounce: 0.28).delay(0.15)) { heliX = 0; heliScale = 1 }
        withAnimation(.spring(duration: 1.1, bounce: 0.45).delay(0.3)) { heliTilt = 0 }
        try? await Task.sleep(for: .seconds(0.85))
        withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) { bob = true }
        withAnimation(.spring(duration: 0.45, bounce: 0.55)) { blipIn = true }
        bump += 1
        withAnimation(.easeOut(duration: 0.8).repeatCount(2, autoreverses: false)) { ping = true }
        try? await Task.sleep(for: .seconds(0.2))
        withAnimation(.spring(duration: 0.6, bounce: 0.4)) { titleIn = true }
        try? await Task.sleep(for: .seconds(0.25))
        withAnimation(.easeOut(duration: 0.45)) { subtitleIn = true }
        try? await Task.sleep(for: .seconds(0.95))
        withAnimation(.easeIn(duration: 0.45)) { heliX = 1.3; heliTilt = -12; leaving = true }
        try? await Task.sleep(for: .seconds(0.3))
        onFinish()
    }
}

/// A 90° wedge from the centre; its leading edge points right before rotation.
private struct SweepShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: rect.midX, y: rect.midY)
        p.move(to: c)
        p.addArc(center: c, radius: rect.width / 2, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        p.closeSubpath()
        return p
    }
}
