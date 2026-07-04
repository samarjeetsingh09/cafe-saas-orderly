/**
 * Friendly full-screen states for the customer app. Never mentions
 * subscriptions or billing (Security doc 5.5).
 */
export function MenuUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary">
        <span className="block h-8 w-8 rounded-full border-2 border-primary/50" />
      </span>
      <h1 className="text-xl font-bold text-primary">This menu is temporarily unavailable</h1>
      <p className="text-muted">Please ask the staff for assistance.</p>
    </main>
  );
}

export function InvalidTable() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <h1 className="text-xl font-bold text-primary">This QR code didn&apos;t work</h1>
      <p className="text-muted">
        Please scan the QR code on your table again, or ask the staff for help.
      </p>
    </main>
  );
}
