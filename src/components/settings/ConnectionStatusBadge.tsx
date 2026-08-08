import type { ProviderValidationState } from '@/state/settingsStore'

interface ConnectionStatusBadgeProps {
  state: ProviderValidationState | undefined
}

const STATUS_META: Record<
  ProviderValidationState['status'],
  { icon: string; label: string; className: string }
> = {
  idle: { icon: '⚪', label: 'Not configured', className: 'text-ink-faint' },
  validating: { icon: '🟡', label: 'Testing…', className: 'text-amber-800 dark:text-amber-400' },
  valid: { icon: '🟢', label: 'Connected', className: 'text-emerald-700 dark:text-emerald-400' },
  invalid: { icon: '🔴', label: 'Invalid key', className: 'text-red-700 dark:text-red-400' },
}

export function ConnectionStatusBadge({ state }: ConnectionStatusBadgeProps) {
  const status = state?.status ?? 'idle'
  const meta = STATUS_META[status]

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${meta.className}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
      {status === 'invalid' && state?.message ? (
        <span className="text-ink-faint">— {state.message}</span>
      ) : null}
    </span>
  )
}
