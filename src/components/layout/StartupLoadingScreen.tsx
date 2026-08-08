export function StartupLoadingScreen() {
  return (
    <div
      className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-surface"
      role="status"
      aria-label="Loading Pawan AI Chatbot"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      <p className="text-sm text-ink-faint">Loading your conversations…</p>
    </div>
  )
}
