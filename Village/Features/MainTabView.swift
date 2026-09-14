import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            TodayView().tabItem { Label("Today", systemImage: "sun.max.fill") }
            ScheduleView().tabItem { Label("Schedule", systemImage: "calendar") }
            ActionsView().tabItem { Label("Actions", systemImage: "bolt.fill") }
            FamilyView().tabItem { Label("Family", systemImage: "figure.2.and.child.holdinghands") }
            VillagePeopleView().tabItem { Label("Village", systemImage: "person.3.fill") }
        }
    }
}
