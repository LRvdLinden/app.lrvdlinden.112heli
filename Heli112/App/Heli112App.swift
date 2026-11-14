import SwiftUI

@main
struct Heli112App: App {
    #if os(iOS)
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    #elseif os(macOS)
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    #endif

    @StateObject private var store = LiveStore()
    @StateObject private var router = Router.shared
    @StateObject private var push = PushManager.shared
    @StateObject private var location = LocationManager.shared
    @AppStorage("appearance") private var appearance: AppearanceSetting = .system

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(router)
                .environmentObject(push)
                .environmentObject(location)
                .preferredColorScheme(appearance.colorScheme)
                .tint(Theme.accent)
        }
        #if os(macOS)
        .defaultSize(width: 1180, height: 780)
        #endif
    }
}

struct RootView: View {
    @EnvironmentObject private var store: LiveStore
    @EnvironmentObject private var router: Router
    @EnvironmentObject private var push: PushManager
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("onboarding.done") private var onboardingDone = false
    @State private var showSplash = true

    var body: some View {
        ZStack {
            if onboardingDone {
                MainView()
            } else {
                OnboardingView { onboardingDone = true }
            }
            if showSplash {
                SplashView { withAnimation(.easeOut(duration: 0.35)) { showSplash = false } }
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .reviewPrompt(isCalm: !showSplash && onboardingDone && !router.sheetOpen)
        .onOpenURL { router.open(url: $0) }
        .task { await push.refreshStatus() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { store.start(); Task { await push.refreshStatus() } } else if phase == .background { store.stop() }
        }
    }
}
