import XCTest
@testable import Village

final class VillageTests: XCTestCase {
    func testDemoSnapshotHasCoverageGap() {
        let snapshot = DemoData.snapshot
        let gaps = snapshot.events.filter { $0.status == .scheduled && $0.requiresCaregiver && $0.assignedMemberId == nil }
        XCTAssertEqual(gaps.count, 1)
        XCTAssertEqual(gaps.first?.title, "School pickup")
    }

    func testDemoHandoffPreservesChecklistOrder() {
        let items = DemoData.snapshot.handoffs.first?.handoffItems?.sorted { $0.position < $1.position }
        XCTAssertEqual(items?.map(\.label), ["Backpack", "Soccer cleats", "Water bottle"])
        XCTAssertEqual(items?.filter { $0.isReady }.count, 2)
    }

    @MainActor
    func testDemoHelpRequestCreatesOneLinkedEvent() async {
        let store = AppStore()
        store.exploreDemo()
        let type = try! XCTUnwrap(store.snapshot.helpRequestTypes.first)
        let eventCount = store.snapshot.events.count

        await store.createHelpRequest(.init(
            childId: DemoData.emma,
            type: type,
            startsAt: .now.addingTimeInterval(7200),
            location: "School",
            context: "",
            notes: "",
            recipientIds: [DemoData.grandma]
        ))

        XCTAssertEqual(store.snapshot.requests.count, 1)
        XCTAssertEqual(store.snapshot.events.count, eventCount + 1)
        XCTAssertEqual(store.snapshot.requests.first?.eventId, store.snapshot.events.last?.id)
    }
}
