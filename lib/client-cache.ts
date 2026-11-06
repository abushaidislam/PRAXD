import { PullRequest } from "@/types/pr";

const PR_LIST_CACHE_KEY = "praxd:cached_prs:v1";
const PR_DETAIL_CACHE_PREFIX = "praxd:pr_detail:v1:";
const LIVE_MODE_CACHE_KEY = "praxd:is_live_mode:v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEnvelope<T> {
  data: T;
  timestamp: number;
}

function safeGetItem(key: string, storage?: Storage): string | null {
  try {
    if (typeof window === "undefined") return null;
    const targetStorage = storage || window.localStorage;
    if (!targetStorage) return null;
    return targetStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string, storage?: Storage): void {
  try {
    if (typeof window === "undefined") return;
    const targetStorage = storage || window.localStorage;
    if (!targetStorage) return;
    targetStorage.setItem(key, value);
  } catch {
    // Storage quota might be exceeded or cookies/storage blocked; fail silently
  }
}

/**
 * Retrieves cached pull request list from localStorage.
 * Returns null if not cached or if cache expired.
 */
export function getCachedPullRequests(): PullRequest[] | null {
  const raw = safeGetItem(PR_LIST_CACHE_KEY);
  if (!raw) return null;
  try {
    const envelope: CacheEnvelope<PullRequest[]> = JSON.parse(raw);
    if (!envelope || !Array.isArray(envelope.data) || envelope.data.length === 0) {
      return null;
    }
    if (Date.now() - envelope.timestamp > CACHE_TTL_MS) {
      return null;
    }
    return envelope.data;
  } catch {
    return null;
  }
}

/**
 * Persists pull requests array to localStorage.
 */
export function setCachedPullRequests(prs: PullRequest[]): void {
  if (!prs || !Array.isArray(prs) || prs.length === 0) return;
  const envelope: CacheEnvelope<PullRequest[]> = {
    data: prs,
    timestamp: Date.now(),
  };
  safeSetItem(PR_LIST_CACHE_KEY, JSON.stringify(envelope));
}

/**
 * Retrieves full PR detail (including changed files & diffs) from client cache.
 * Checks sessionStorage first, then localStorage.
 */
export function getCachedPrDetail(prId: string): PullRequest | null {
  if (!prId || typeof window === "undefined") return null;
  const key = `${PR_DETAIL_CACHE_PREFIX}${prId}`;
  const rawSession = safeGetItem(key, window.sessionStorage);
  const raw = rawSession || safeGetItem(key, window.localStorage);
  if (!raw) return null;

  try {
    const envelope: CacheEnvelope<PullRequest> = JSON.parse(raw);
    if (!envelope || !envelope.data || !envelope.data.id) return null;
    // Verify it contains actual files
    if (!Array.isArray(envelope.data.files) || envelope.data.files.length === 0) {
      return null;
    }
    return envelope.data;
  } catch {
    return null;
  }
}

/**
 * Saves full PR detail to client cache (sessionStorage and localStorage).
 */
export function setCachedPrDetail(pr: PullRequest): void {
  if (!pr || !pr.id || typeof window === "undefined") return;
  // Only cache if files are populated
  if (!Array.isArray(pr.files) || pr.files.length === 0) return;

  const envelope: CacheEnvelope<PullRequest> = {
    data: pr,
    timestamp: Date.now(),
  };
  const serialized = JSON.stringify(envelope);
  const key = `${PR_DETAIL_CACHE_PREFIX}${pr.id}`;

  safeSetItem(key, serialized, window.sessionStorage);
  safeSetItem(key, serialized, window.localStorage);
}

/**
 * Reads whether the user previously operated in Live Mode.
 */
export function getCachedLiveMode(): boolean | null {
  const raw = safeGetItem(LIVE_MODE_CACHE_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

/**
 * Persists user's Live Mode preference.
 */
export function setCachedLiveMode(isLive: boolean): void {
  safeSetItem(LIVE_MODE_CACHE_KEY, isLive ? "true" : "false");
}
