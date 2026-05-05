// Wraps a save function with AbortController timeout + one automatic retry.
// On Supabase free tier, the first write after idle wakes the DB and may hang.
// Aborting after ~25s, then retrying immediately, succeeds because the DB is now warm.
//
// Usage:
//   await saveWithRetry(async (signal) => {
//     const { error } = await supabase.from('t').insert(row).abortSignal(signal)
//     if (error) throw error
//   }, { onRetry: () => setStatus('Warming up server…') })

export async function saveWithRetry(fn, { timeoutMs = 25000, onRetry } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const result = await fn(controller.signal)
      clearTimeout(tid)
      return result
    } catch (err) {
      clearTimeout(tid)
      if ((err.name === 'AbortError' || err.message?.toLowerCase().includes('abort')) && attempt === 0) {
        onRetry?.()
        continue
      }
      throw err
    }
  }
}
