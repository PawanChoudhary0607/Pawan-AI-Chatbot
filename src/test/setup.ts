import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// Testing infrastructure + persistence-layer tests (Milestone 2).
// fake-indexeddb provides a real IndexedDB implementation in jsdom so
// DexieStorageProvider can be exercised without a browser.

// jsdom doesn't implement URL.createObjectURL/revokeObjectURL at all (every
// real browser does) — needed for image attachment previews (Milestone 6).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock-preview-url'
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {}
}
