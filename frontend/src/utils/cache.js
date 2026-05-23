const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day — stale is fine, fresh overwrites

export function getCached(key) {
  try {
    const raw = localStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export function setCache(key, data) {
  try {
    localStorage.setItem(`cache:${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // Storage full — silently skip
  }
}

/**
 * Fetch with stale-while-revalidate.
 * - Calls onData(cached) immediately if cache exists.
 * - Always fires the real fetch; calls onData(fresh) when it arrives.
 * - Returns a cleanup noop (for useEffect compatibility).
 */
export function cachedFetch(url, key, onData, onError) {
  const cached = getCached(key);
  if (cached) onData(cached);

  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      setCache(key, data);
      onData(data);
    })
    .catch(onError || console.error);
}
