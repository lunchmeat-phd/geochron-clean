import { promises as fs } from "fs";
import os from "os";
import path from "path";

// Last-good responses are mirrored to disk so a server restart (e.g. pm2 auto-restart on the
// kiosk machine) can fall back to slightly-stale data instead of a blank display while upstream
// feeds are refetched. Best-effort: on a read-only filesystem (some serverless hosts) this
// silently no-ops and the app just behaves as it did before.
//
// Set GEOCHRON_CACHE_DIR to a persistent path to survive OS reboots; the default (OS temp dir)
// survives process restarts but not a full reboot.
const CACHE_DIR = process.env.GEOCHRON_CACHE_DIR || path.join(os.tmpdir(), "geochron-cache");

function cacheFile(key: string): string {
  // Keep keys filesystem-safe.
  const safe = key.replace(/[^a-z0-9_-]/gi, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export async function readDiskCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(cacheFile(key), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeDiskCache<T>(key: string, value: T): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile(key), JSON.stringify(value), "utf8");
  } catch {
    // Best-effort only.
  }
}
