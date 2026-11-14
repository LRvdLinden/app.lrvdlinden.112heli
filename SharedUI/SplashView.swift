import SwiftUI

/// Short animated splash: radar sweep and the Zulu flying in. Never waits for the network (max ~2.5 s).
struct SplashView: View {
    var onFinish: () -> Void

    @State private var sweep = false
    @State private var heliIn = false
    @State private var titleIn = false

    var body: some View {
        ZStack {
            Theme.navy.ignoresSafeArea()
            GeometryReader { geo in
                let r = min(geo.size.width, geo.size.height) * 0.42
                ZStack {
                    ForEach([1.0, 0.69, 0.38], id: \.self) { f in
                        Circle().stroke(Theme.radar.opacity(0.45), lineWidth: 2).frame(width: r * 2 * f, height: r * 2 * f)
                    }
                    SweepShape()
                        .fill(AngularGradient(colors: [Theme.radar.opacity(0.0), Theme.radar.opacity(0.45)], center: .center,
                                              startAngle: .degrees(-60), endAngle: .degrees(0)))
                        .frame(width: r * 2, height: r * 2)
                        .rotationEffect(.degrees(sweep ? 360 : 0))
                    Image("HeliWhite")
                        .renderingMode(.template)
                        .resizable()
                        .scaledToFit()
                        .foregroundStyle(.white)
                        .frame(width: r * 1.7)
                        .offset(x: heliIn ? 0 : -geo.size.width, y: -r * 0.1)
                    Text(verbatim: "112Heli")
                        .font(.system(size: max(28, r * 0.2), weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                        .offset(y: r * 0.72)
                        .opacity(titleIn ? 1 : 0)
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
        }
        .accessibilityHidden(true)
        .task {
            withAnimation(.linear(duration: 1.6)) { sweep = true }
            withAnimation(.spring(duration: 0.8, bounce: 0.2)) { heliIn = true }
            withAnimation(.easeOut(duration: 0.4).delay(0.5)) { titleIn = true }
            try? await Task.sleep(for: .seconds(2.2))
            onFinish()
        }
    }
}

/// A 60° wedge from the centre, pointing up.
private struct SweepShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: rect.midX, y: rect.midY)
        p.move(to: c)
        p.addArc(center: c, radius: rect.width / 2, startAngle: .degrees(-150), endAngle: .degrees(-90), clockwise: false)
        p.closeSubpath()
        return p
    }
}
