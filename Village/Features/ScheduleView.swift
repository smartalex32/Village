import SwiftUI

struct ScheduleView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedDate = Date()
    @State private var showsNewEvent = false

    private var events: [CareEvent] {
        store.snapshot.events.filter { store.householdCalendar.isDate($0.startsAt, inSameDayAs: selectedDate) && $0.status == .scheduled }.sorted { $0.startsAt < $1.startsAt }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                DatePicker("Day", selection: $selectedDate, displayedComponents: .date).datePickerStyle(.graphical).padding(.horizontal)
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if events.isEmpty { EmptyState(symbol: "calendar", title: "Nothing scheduled", message: "Add an event for this day.").padding(.top, 24) }
                        ForEach(events) { EventRow(event: $0) }
                    }.padding(16)
                }
            }
            .background(VillageTheme.canvas)
            .navigationTitle("Schedule")
            .toolbar { ToolbarItem(placement: .primaryAction) { Button { showsNewEvent = true } label: { Label("Add event", systemImage: "plus") } } }
            .sheet(isPresented: $showsNewEvent) { NewEventView(initialDate: selectedDate) }
        }
    }
}

struct NewEventView: View {
    let initialDate: Date
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var childId: UUID?
    @State private var date: Date
    @State private var location = ""
    @State private var needsCaregiver = false

    init(initialDate: Date) { self.initialDate = initialDate; _date = State(initialValue: initialDate) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Event") {
                    TextField("Title", text: $title)
                    Picker("Child", selection: $childId) { Text("Choose a child").tag(nil as UUID?); ForEach(store.activeChildren) { Text($0.firstName).tag($0.id as UUID?) } }
                    DatePicker("Starts", selection: $date)
                    TextField("Location", text: $location)
                    Toggle("Needs a caregiver", isOn: $needsCaregiver)
                }
            }
            .navigationTitle("New event")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Add") { Task { await store.addEvent(.init(childId: childId!, title: title, startsAt: date, location: location, requiresCaregiver: needsCaregiver)); dismiss() } }.disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || childId == nil) }
            }
        }
    }
}
