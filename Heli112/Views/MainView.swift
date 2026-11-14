import SwiftUI

struct MainView: View {
    @EnvironmentObject private var store: LiveStore
    @EnvironmentObject private var router: Router

    var body: some View {
        TabView(selection: $router.tab) {
            MapScreen()
                .tabItem { Label("Kaart", systemImage: "map") }
                .tag(Router.Tab.kaart)
            NavigationStack { AircraftListView() }
                .tabItem { Label("Toestellen", systemImage: "airplane") }
                .tag(Router.Tab.toestellen)
            NavigationStack { HistoryView() }
                .tabItem { Label("Historie", systemImage: "clock.arrow.circlepath") }
                .tag(Router.Tab.historie)
            NavigationStack { SettingsView() }
                .tabItem { Label("Instellingen", systemImage: "gearshape") }
                .tag(Router.Tab.instellingen)
        }
        .onAppear { store.start() }
    }
}
