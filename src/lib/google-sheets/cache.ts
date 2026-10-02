import "server-only";

import type { DatabaseEntry } from "@/lib/mapping/sheets";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheState = {
  expiresAt: number;
  entries: DatabaseEntry[];
};

let cache: CacheState | null = null;

export function getCachedEntries(): DatabaseEntry[] | null {
  if (!cache) return null;

  if (Date.now() >= cache.expiresAt) {
    cache = null;
    return null;
  }

  return cache.entries;
}

export function setCachedEntries(
  entries: DatabaseEntry[],
  ttlMs = DEFAULT_TTL_MS,
): void {
  cache = {
    entries,
    expiresAt: Date.now() + ttlMs,
  };
}

export function clearEntriesCache(): void {
  cache = null;
}
