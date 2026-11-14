import SwiftUI

/// "Dit toestel ontbreekt of klopt niet": goes to the 112heli worker and shows up in beheer.
struct ReportView: View {
    var aircraft: Aircraft?

    @Environment(\.dismiss) private var dismiss
    @State private var tekst = ""
    @State private var sending = false
    @State private var sent = false
    @State private var failed = false

    var body: some View {
        Form {
            if let a = aircraft {
                Section("Toestel") {
                    LabeledContent("Naam", value: a.title)
                    if let reg = a.reg { LabeledContent("Registratie", value: reg) }
                    LabeledContent("Soort", value: a.soort.naam)
                }
            }
            Section {
                TextField(aircraft == nil ? "Welk toestel ontbreekt? Naam, registratie of roepnaam" : "Wat klopt er niet?",
                          text: $tekst, axis: .vertical)
                    .lineLimit(4...8)
            } footer: {
                if failed { Text("Versturen is niet gelukt. Probeer het later opnieuw.").foregroundStyle(.red) }
                else { Text("Je melding komt anoniem binnen bij de maker van 112Heli.") }
            }
        }
        .formStyle(.grouped)
        .navigationTitle(aircraft == nil ? "Toestel ontbreekt" : "Toestel klopt niet")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Verstuur") { Task { await send() } }
                    .disabled(tekst.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 || sending)
            }
        }
        .sensoryFeedback(.success, trigger: sent)
        .sensoryFeedback(.error, trigger: failed)
    }

    private func send() async {
        sending = true
        defer { sending = false }
        var body: [String: Any] = [
            "tekst": tekst.trimmingCharacters(in: .whitespacesAndNewlines),
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
        ]
        #if os(macOS)
        body["platform"] = "macos"
        #else
        body["platform"] = "ios"
        #endif
        if let a = aircraft {
            body["hex"] = a.hex; body["naam"] = a.title; body["soort"] = a.soort.rawValue
            if let reg = a.reg { body["reg"] = reg }
        }
        do {
            try await HeliAPI.shared.report(body)
            sent = true
            dismiss()
        } catch {
            failed = true
        }
    }
}
