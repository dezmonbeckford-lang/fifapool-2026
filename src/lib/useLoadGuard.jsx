/**
 * useLoadGuard — auto-shows a retry button if loading takes > stuckMs.
 *
 * Usage:
 *   const { isStuck, guardEl } = useLoadGuard(loading, loadData)
 *   if (loading) return guardEl  // shows spinner, upgrades to retry after stuckMs
 */
import { useState, useEffect, useRef } from 'react'

export function useLoadGuard(loading, retry, { stuckMs = 8000 } = {}) {
  const [isStuck, setIsStuck] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (loading) {
      setIsStuck(false)
      timerRef.current = setTimeout(() => setIsStuck(true), stuckMs)
    } else {
      setIsStuck(false)
      clearTimeout(timerRef.current)
    }
    return () => clearTimeout(timerRef.current)
  }, [loading])

  const guardEl = isStuck ? (
    <div className="page-center">
      <div className="card" style={{ textAlign: 'center', padding: 32, maxWidth: 360 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚽</div>
        <p style={{ color: 'var(--text2)', marginBottom: 8, fontWeight: 600 }}>
          Server is warming up…
        </p>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
          Supabase is waking from sleep. This only happens on the first load.
        </p>
        <button className="btn btn-primary" onClick={() => { setIsStuck(false); retry() }}>
          Retry
        </button>
      </div>
    </div>
  ) : (
    <div className="page-center"><div className="spinner" /></div>
  )

  return { isStuck, guardEl }
}
