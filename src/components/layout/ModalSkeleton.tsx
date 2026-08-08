export function ModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className="w-full max-w-lg animate-pulse rounded-2xl border border-border bg-surface-raised p-5 shadow-xl"
        role="status"
        aria-label="Loading"
      >
        <div className="mb-4 h-4 w-32 rounded bg-surface-sunken" />
        <div className="space-y-2">
          <div className="h-9 rounded-lg bg-surface-sunken" />
          <div className="h-24 rounded-lg bg-surface-sunken" />
          <div className="h-9 w-1/2 rounded-lg bg-surface-sunken" />
        </div>
      </div>
    </div>
  )
}
