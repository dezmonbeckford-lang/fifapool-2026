/**
 * readWithRetry — wraps any Supabase read with a timeout + one automatic retry.
 *
 * IMPORTANT: Supabase-js v2 does NOT throw on abort — it returns
 * { data: null, error: { name: 'AbortError' } }. This function
 * handles both the thrown and returned error cases.
 *
 * Usage:
 *   const { data } = await readWithRetry(signal =>
 *     supabase.from('table').select('*').abortSignal(signal)
 *   )
 */
export async function readWithRetry(fn, { timeoutMs = 12000 } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()

    // Promise.race guarantees the timeout fires even on iOS/mobile where
    // AbortController.abort() doesn't always cancel a hanging fetch.
    const timeoutPromise = new Promise(resolve =>
      setTimeout(() => {
        controller.abort()
        resolve({ data: null, error: { name: 'AbortError', message: 'timeout', code: '20' } })
      }, timeoutMs)
    )

    try {
      const result = await Promise.race([fn(controller.signal), timeoutPromise])

      // Supabase returns { data: null, error } instead of throwing on abort
      if (result?.error) {
        const msg = (result.error.message || result.error.details || '').toLowerCase()
        const isAbort =
          result.error.name === 'AbortError' ||
          msg.includes('abort') ||
          msg.includes('cancel') ||
          msg.includes('fetch') ||
          msg.includes('timeout') ||
          result.error.code === '20'
        if (isAbort && attempt === 0) continue // warm up and retry
        // Non-abort Supabase error — return as-is, let caller handle
      }

      return result
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      const isAbort =
        err?.name === 'AbortError' ||
        msg.includes('abort') ||
        msg.includes('cancel') ||
        msg.includes('timeout') ||
        err?.code === '20'
      if (isAbort && attempt === 0) continue
      throw err
    }
  }
  // Both attempts timed out — return empty so page can still render
  return { data: null, error: { message: 'Request timed out after retry' } }
}
