/**
 * keepAlive — fires a lightweight ping to Supabase every 3 minutes.
 *
 * Supabase free tier lets the connection pool go cold after ~5 min of silence.
 * Pinging every 3 minutes keeps it consistently warm so page loads are fast.
 *
 * Call startKeepAlive() once in App.jsx on mount.
 */
import { supabase } from './supabase'

let timer = null

export function startKeepAlive() {
  if (timer) return
  ping() // warm up immediately on first load
  timer = setInterval(ping, 3 * 60 * 1000) // every 3 minutes
}

export function stopKeepAlive() {
  if (timer) { clearInterval(timer); timer = null }
}

async function ping() {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 5000)
    await supabase.from('settings').select('id').limit(1).abortSignal(controller.signal)
  } catch { /* silent — just keeping the connection warm */ }
}
