export function Placeholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold text-primary">{title}</h1>
      <p className="text-muted">Built in {milestone} — placeholder route.</p>
    </main>
  );
}
