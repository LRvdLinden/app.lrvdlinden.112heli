import SwiftUI

/// "Wat wil je zien": helicopters, aeroplanes and offline aircraft. Same choices on the map, in the list and on Apple TV.
struct FilterToggles: View {
    @EnvironmentObject private var store: LiveStore

    var body: some View {
        Toggle(isOn: $store.toonHelis) { Label("Helikopters", systemImage: "fanblades") }
        Toggle(isOn: $store.toonVliegtuigen) { Label("Vliegtuigen", systemImage: "airplane") }
        Toggle(isOn: $store.hideOffline) { Label("Offline toestellen verbergen", systemImage: "eye.slash") }
    }
}

#if !os(tvOS)
/// The filter button: a menu with the three choices; filled when something is hidden.
struct FilterMenu: View {
    @EnvironmentObject private var store: LiveStore

    var body: some View {
        Menu {
            FilterToggles()
        } label: {
            Image(systemName: store.filterActief ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                .foregroundStyle(store.filterActief ? Theme.accent : .primary)
        }
        .accessibilityLabel("Filter")
        .sensoryFeedback(.selection, trigger: store.filterActief)
    }
}
#endif
