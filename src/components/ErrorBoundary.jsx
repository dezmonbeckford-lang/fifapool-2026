import { Component } from 'react'

/**
 * Catches any React render errors and shows a tap-to-reload screen
 * instead of a blank white crash.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('App error caught by boundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100dvh', padding: 24, gap: 16,
          background: 'var(--bg)', color: 'var(--text)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>⚽</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 280, margin: 0 }}>
            The app hit an unexpected error. Tap below to reload.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '12px 32px', borderRadius: 12,
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
