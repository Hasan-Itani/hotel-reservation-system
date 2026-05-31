export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="text-sm font-bold text-foreground">Hotel System</p>
          <p className="mt-2 text-sm text-muted-foreground">
            A modern hotel booking experience for guests and hotel teams.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-foreground">Guest Services</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse hotels, check availability, book rooms, and manage your reservation.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-foreground">Support</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Booking lookup and payment pages will be connected in the next public phases.
          </p>
        </div>
      </div>
    </footer>
  );
}