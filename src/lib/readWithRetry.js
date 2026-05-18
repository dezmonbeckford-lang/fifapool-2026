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
export async function readWithRetry(fn, { timeoutMs = 7000 } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const result = await fn(controller.signal)
      clearTimeout(tid)

      // Supabase returns { data: null, error } instead of throwing on abort
      if (result?.error) {
        const msg = (result.error.message || result.error.details || '').toLowerCase()
        const isAbort =
          result.error.name === 'AbortError' ||
          msg.includes('abort') ||
          msg.includes('cancel') ||
          msg.includes('fetch') ||
          result.error.code === '20'
        if (isAbort && attempt === 0) continue // warm up and retry
        // Non-abort Supabase error — return as-is, let caller handle
      }

      return result
    } catch (err) {
      clearTimeout(tid)
      const msg = (err?.message || '').toLowerCase()
      const isAbort =
        err?.name === 'AbortError' ||
        msg.includes('abort') ||
        msg.includes('cancel') ||
        err?.code === '20'
      if (isAbort && attempt === 0) continue
      throw err
    }
  }
  // Both attempts timed out — return empty so page can still render
  return { data: null, error: { message: 'Request timed out after retry' } }
}
