/**
 * In-process lock so one customer can't run two checkouts at the same time
 * (double taps, retries, two tabs). The API runs as a single PM2 process, so an
 * in-memory set is enough; locks expire after 2 minutes in case a request hangs.
 */
const locks = new Map();
const LOCK_TTL_MS = 2 * 60 * 1000;

export function acquireUserLock(key) {
    const now = Date.now();
    const existing = locks.get(key);
    if (existing && now - existing < LOCK_TTL_MS) return false;
    locks.set(key, now);
    return true;
}

export function releaseUserLock(key) {
    locks.delete(key);
}
