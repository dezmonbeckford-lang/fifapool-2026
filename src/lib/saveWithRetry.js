// Wraps a save function with AbortController timeout + one automatic retry.
// On Supabase free tier, the first write after idle wakes the DB and may hang.
// Aborting after ~25s, then retrying immediately, succeeds because the DB is now warm.
//
// Retries on: timeout (AbortError), fetch failures (TypeError: Failed to fetch),
// and transient network errors — so a delete+insert pair is safe to retry.
//
// Usage:
//   await saveWithRetry(async (signal) => {
//     const { error } = await supabase.from('t').insert(row).abortSignal(signal)
//     if (error) throw error
//   }, { onRetry: () => setStatus('Warming up server…') })

function isRetryable(err) {
  if (!err) return false
  if (err.name === 'AbortError') return true
  const msg = (err.message || '').toLowerCase()
  if (msg.includes('abort')) return true
  if (msg.includes('failed to fetch')) return true
  if (msg.includes('networkerror')) return true
  if (msg.includes('network request failed')) return true
  return false
}

export async function saveWithRetry(fn, { timeoutMs = 25000, onRetry } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()

    // Promise.race guarantees the timeout fires even on iOS/mobile where
    // AbortController.abort() doesn't always cancel a hanging fetch.
    let timeoutReject
    const timeoutPromise = new Promise((_, reject) => {
      timeoutReject = reject
      setTimeout(() => {
        controller.abort()
        reject(Object.assign(new Error('Save timed out'), { name: 'AbortError' }))
      }, timeoutMs)
    })

    try {
      const result = await Promise.race([fn(controller.signal), timeoutPromise])
      timeoutReject = null
      return result
    } catch (err) {
      timeoutReject = null
      if (isRetryable(err) && attempt === 0) {
        onRetry?.()
        continue
      }
      throw err
    }
  }
}
