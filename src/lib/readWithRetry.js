/**
 * readWithRetry — wraps any Supabase read with a timeout + one automatic retry.
 *
 * Usage:
 *   const data = await readWithRetry(signal =>
 *     supabase.from('table').select('*').abortSignal(signal)
 *   )
 *
 * On the first attempt the AbortController fires after `timeoutMs`.
 * The server is warm on the retry, so it almost always succeeds in < 1s.
 */
export async function readWithRetry(fn, { timeoutMs = 8000 } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const result = await fn(controller.signal)
      clearTimeout(tid)
      return result
    } catch (err) {
      clearTimeout(tid)
      const isAbort =
        err?.name === 'AbortError' ||
        err?.message?.toLowerCase().includes('abort') ||
        err?.code === '20' // supabase-js abort code
      if (isAbort && attempt === 0) continue
      throw err
    }
  }
}
