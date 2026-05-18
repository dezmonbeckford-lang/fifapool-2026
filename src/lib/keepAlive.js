/**
 * keepAlive — fires a lightweight ping to Supabase every 4 minutes.
 *
 * Supabase free tier lets the connection pool go cold after ~5 min of silence.
 * This keeps it warm so the first query after navigating to any page is fast.
 *
 * Call startKeepAlive() once in App.jsx on mount.
 */
import { supabase } from './supabase'

let timer = null

export function startKeepAlive() {
  if (timer) return
  ping() // warm up immediately on first load
  timer = setInterval(ping, 4 * 60 * 1000) // every 4 minutes
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
