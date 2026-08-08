import { useEffect, useState } from 'react'
import App from '@/App'
import { StartupLoadingScreen } from '@/components/layout/StartupLoadingScreen'
import { persistenceService } from '@/storage/persistenceService'
import { useAttachmentStore } from '@/state/attachmentStore'

export function AppBootstrap() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    // persistenceService.init() never throws — a storage failure just
    // means the app starts with empty in-memory state instead of restored
    // data — so there's no error path to handle here.
    void persistenceService.init().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Last-resort safety net: revoke any preview blob URLs still tracked
  // anywhere if the app itself ever tears down. Normal cleanup already
  // happens at the point of attachment removal, send, and conversation
  // deletion — this only catches whatever those miss.
  useEffect(() => {
    return () => {
      useAttachmentStore.getState().revokeAllPreviewUrls()
    }
  }, [])

  if (!ready) return <StartupLoadingScreen />
  return <App />
}
