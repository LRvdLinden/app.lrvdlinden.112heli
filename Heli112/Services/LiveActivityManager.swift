#if os(iOS)
import ActivityKit
import Foundation

/// Follows one aircraft on the lock screen. The worker sends the updates (push token per activity).
@MainActor
final class LiveActivityManager: ObservableObject {
    static let shared = LiveActivityManager()

    @Published private(set) var followingHex: String?

    private init() {
        followingHex = Activity<HeliActivityAttributes>.activities.first?.attributes.hex
    }

    var isAvailable: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    func isFollowing(_ hex: String) -> Bool { followingHex == hex }

    func toggle(_ aircraft: Aircraft) {
        if isFollowing(aircraft.hex) { stop() } else { start(aircraft) }
    }

    func start(_ aircraft: Aircraft) {
        stop()
        let content = ActivityContent(state: HeliActivityAttributes.ContentState(aircraft: aircraft),
                                      staleDate: Date().addingTimeInterval(15 * 60))
        do {
            let activity = try Activity.request(attributes: HeliActivityAttributes(hex: aircraft.hex), content: content, pushType: .token)
            followingHex = aircraft.hex
            Task {
                for await data in activity.pushTokenUpdates {
                    let token = data.map { String(format: "%02x", $0) }.joined()
                    try? await HeliAPI.shared.registerActivity(token: token, hex: aircraft.hex, environment: HeliAPI.pushEnvironment)
                }
            }
            Task { @MainActor in
                for await state in activity.activityStateUpdates where state == .ended || state == .dismissed {
                    if self.followingHex == aircraft.hex { self.followingHex = nil }
                }
            }
        } catch {
            followingHex = nil
        }
    }

    func stop() {
        for activity in Activity<HeliActivityAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        followingHex = nil
    }
}
#endif
