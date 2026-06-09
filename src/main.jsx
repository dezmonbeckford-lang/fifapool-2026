import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

Sentry.init({
  dsn: 'https://236cc0241719477fbf073d3b96a6dfce@o4511519475630080.ingest.us.sentry.io/4511519488802816',
  integrations: [
    Sentry.replayIntegration({
      // Mask text fields (passwords etc) but keep everything else visible
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // Capture 100% of errors, 10% of normal sessions, 100% of sessions with an error
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // Filter out Supabase internal auth-lock noise — not actionable
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value || ''
    if (msg.includes('lock:sb-') || msg.includes('Lock was stolen')) return null
    return event
  },
  // Don't send errors in local dev
  enabled: import.meta.env.PROD,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
