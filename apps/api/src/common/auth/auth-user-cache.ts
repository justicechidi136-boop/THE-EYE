import type { JwtPayload } from "./jwt";

type CacheEntry = { value: JwtPayload; expiresAt: number };

const DEFAULT_TTL_MS = 30_000;
const MAX_ENTRIES = 10_000;

const cache = new Map<string, CacheEntry>();

function cacheKey(payload: JwtPayload) {
  return `${payload.typ}:${payload.sub}`;
}

function ttlMs() {
  const raw = Number(process.env.AUTH_USER_CACHE_TTL_MS ?? DEFAULT_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS;
}

function evictIfNeeded() {
  if (cache.size <= MAX_ENTRIES) return;
  const oldest = cache.keys().next().value;
  if (oldest) cache.delete(oldest);
}

export function getCachedAuthUser(payload: JwtPayload): JwtPayload | undefined {
  const entry = cache.get(cacheKey(payload));
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(cacheKey(payload));
    return undefined;
  }
  return entry.value;
}

export function setCachedAuthUser(payload: JwtPayload, resolved: JwtPayload) {
  evictIfNeeded();
  cache.set(cacheKey(payload), { value: resolved, expiresAt: Date.now() + ttlMs() });
}

export function clearAuthUserCache() {
  cache.clear();
}
