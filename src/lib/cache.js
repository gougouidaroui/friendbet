const cache = {};

export function get(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    delete cache[key];
    return null;
  }
  return entry.data;
}

export function set(key, data, ttlMs = 30000) {
  cache[key] = { data, expiry: Date.now() + ttlMs };
}

export function invalidate(key) {
  delete cache[key];
}

export function clear() {
  Object.keys(cache).forEach(k => delete cache[k]);
}
