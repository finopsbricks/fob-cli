/**
 * The catalog: what fob-<tool> family members exist, and where to download them.
 *
 * PATH discovery (dispatch.js) tells us what's *installed*; the catalog tells us
 * what's *available* so `fob` can list not-yet-installed tools and `fob install`
 * can fetch them. The baked-in CATALOG is the offline fallback; at runtime we
 * prefer a live `catalog.json` served next to the binaries, so a newly released
 * tool appears without upgrading `fob` itself.
 *
 * Asset naming matches scripts/build.sh: a tool `email` → binary `fob-email` →
 * asset `fob-email-<os>-<arch>` (`.exe` on Windows), checksums `fob-email-SHA256SUMS`.
 */

export const DEFAULT_BASE_URL = 'https://get.finopsbricks.com';

/** Offline fallback. The live source of truth is <base>/catalog.json in R2. */
export const CATALOG = {
  base_url: DEFAULT_BASE_URL,
  tools: {
    email: { summary: 'send & fetch mailboxes' },
    orc: { summary: 'orchestration stations' },
    stm: { summary: 'statements ingest & query' },
    worker: { summary: 'local worker processes' },
  },
};

/** Download origin: env override > catalog value > default. */
export function baseUrl(catalog = CATALOG) {
  return process.env.FOB_BASE_URL || catalog.base_url || DEFAULT_BASE_URL;
}

/** Resolve this machine to the (os, arch) tokens used in asset names. */
export function platform() {
  const osName = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[process.platform] || null;
  const arch = { arm64: 'arm64', x64: 'x64' }[process.arch] || null;
  return { osName, arch, isWindows: process.platform === 'win32' };
}

/** Binary name for a tool (`email` → `fob-email`). */
export function binName(tool) {
  return `fob-${tool}`;
}

/** Released asset filename for a tool on the given platform. */
export function assetName(tool, plat = platform()) {
  return `${binName(tool)}-${plat.osName}-${plat.arch}${plat.isWindows ? '.exe' : ''}`;
}

/**
 * Fetch the live catalog, falling back to the baked-in one on any failure so
 * `fob` still works offline. The remote file, when present, is authoritative for
 * the tool list (so we never advertise a tool that isn't actually published).
 */
export async function getCatalog() {
  const url = process.env.FOB_CATALOG_URL || `${baseUrl()}/catalog.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = await res.json();
    return {
      base_url: remote.base_url || CATALOG.base_url,
      tools: remote.tools || CATALOG.tools,
    };
  } catch {
    return CATALOG;
  }
}
