import { useRef, useState, type ComponentPropsWithoutRef } from 'react'

export function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = preRef.current?.textContent ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied by the browser; fail silently rather
      // than surface a confusing error for a non-critical convenience action.
    }
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 hidden rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-muted transition hover:text-ink group-hover:block"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={preRef} {...props}>
        {children}
      </pre>
    </div>
  )
}
