/**
 * dataCache — simple in-memory stale-while-revalidate cache.
 *
 * Pages call getCached() on mount. If there's a hit, data shows
 * immediately (no spinner). The fetch still runs in the background
 * and updates the view when it finishes.
 *
 * TTL defaults to 60s. Pass a shorter TTL for fast-changing data.
 */

const store = {}

/**
 * Returns cached data if it exists and is still within TTL.
 * Returns null if cache is empty or expired.
 */
export function getCached(key, ttlMs = 60_000) {
  const entry = store[key]
  if (!entry) return null
  if (Date.now() - entry.ts > ttlMs) {
    delete store[key]
    return null
  }
  return entry.data
}

/**
 * Stores data under key with a timestamp.
 */
export function setCached(key, data) {
  store[key] = { data, ts: Date.now() }
}

/**
 * Remove a specific key (e.g. after a write operation).
 */
export function bustCache(key) {
  delete store[key]
}

/**
 * Remove all keys matching a prefix.
 */
export function bustCachePrefix(prefix) {
  Object.keys(store).forEach(k => { if (k.startsWith(prefix)) delete store[k] })
}
