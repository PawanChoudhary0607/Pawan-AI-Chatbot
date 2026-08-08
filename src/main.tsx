import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import 'highlight.js/styles/github-dark.css'
import { bootstrapProviders } from '@/providers/bootstrap'
import { AppBootstrap } from '@/components/layout/AppBootstrap'
import { ErrorBoundary } from '@/components/ErrorBoundary'

bootstrapProviders()

const rootElement = document.getElementById('root')!
const root = ReactDOM.createRoot(rootElement)

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppBootstrap />
    </ErrorBoundary>
  </React.StrictMode>
)
