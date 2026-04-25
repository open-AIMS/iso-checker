// PID resolution APIs and local storage cache
// Implements requirements.md §8 and §4 (External PID validation)

import type { PidCache, PidCacheEntry } from '../types.js';

const CACHE_KEY = 'iso-checker-pid-cache';

// --- PID Cache (localStorage-backed) ---

export class LocalStoragePidCache implements PidCache {
  private entries: Map<string, PidCacheEntry>;

  constructor() {
    this.entries = new Map();
    this.load();
  }

  private cacheKey(type: string, identifier: string): string {
    return `${type}:${identifier}`;
  }

  get(type: string, identifier: string): PidCacheEntry | null {
    return this.entries.get(this.cacheKey(type, identifier)) ?? null;
  }

  set(entry: PidCacheEntry): void {
    this.entries.set(this.cacheKey(entry.type, entry.identifier), entry);
    this.save();
  }

  clear(): void {
    this.entries.clear();
    this.save();
  }

  size(): number {
    return this.entries.size;
  }

  all(): PidCacheEntry[] {
    return Array.from(this.entries.values());
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const arr: PidCacheEntry[] = JSON.parse(raw);
        for (const entry of arr) {
          this.entries.set(this.cacheKey(entry.type, entry.identifier), entry);
        }
      }
    } catch {
      // Corrupted cache — start fresh
      this.entries.clear();
    }
  }

  private save(): void {
    try {
      const arr = Array.from(this.entries.values());
      localStorage.setItem(CACHE_KEY, JSON.stringify(arr));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }
}

// --- PID Resolver ---

export interface RorResult {
  resolved: boolean;
  canonicalName: string | null;
}

export interface OrcidResult {
  resolved: boolean;
  familyName: string | null;
  givenNames: string | null;
}

export interface DoiResult {
  resolved: boolean;
}

export interface RaidResult {
  resolved: boolean;
}

export class PidResolver {
  private cache: PidCache;

  constructor(cache: PidCache) {
    this.cache = cache;
  }

  async resolveRor(rorId: string): Promise<RorResult> {
    const cached = this.cache.get('ror', rorId);
    if (cached) {
      return {
        resolved: cached.resolved,
        canonicalName: (cached.metadata?.canonicalName as string) ?? null
      };
    }

    try {
      const resp = await fetch(`https://api.ror.org/v2/organizations/${rorId}`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!resp.ok) {
        this.cacheResult('ror', rorId, false, {});
        return { resolved: false, canonicalName: null };
      }

      const data = await resp.json();
      // Extract ror_display name from names array
      let canonicalName: string | null = null;
      if (Array.isArray(data.names)) {
        const rorDisplay = data.names.find((n: { types: string[] }) =>
          Array.isArray(n.types) && n.types.includes('ror_display')
        );
        canonicalName = rorDisplay?.value ?? null;
      }

      this.cacheResult('ror', rorId, true, { canonicalName });
      return { resolved: true, canonicalName };
    } catch {
      return { resolved: false, canonicalName: null };
    }
  }

  async resolveOrcid(orcidId: string): Promise<OrcidResult> {
    const cached = this.cache.get('orcid', orcidId);
    if (cached) {
      return {
        resolved: cached.resolved,
        familyName: (cached.metadata?.familyName as string) ?? null,
        givenNames: (cached.metadata?.givenNames as string) ?? null
      };
    }

    try {
      const resp = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/person`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!resp.ok) {
        this.cacheResult('orcid', orcidId, false, {});
        return { resolved: false, familyName: null, givenNames: null };
      }

      const data = await resp.json();
      const familyName = data?.name?.['family-name']?.value ?? null;
      const givenNames = data?.name?.['given-names']?.value ?? null;

      this.cacheResult('orcid', orcidId, true, { familyName, givenNames });
      return { resolved: true, familyName, givenNames };
    } catch {
      return { resolved: false, familyName: null, givenNames: null };
    }
  }

  async resolveDoi(doi: string): Promise<DoiResult> {
    const cached = this.cache.get('doi', doi);
    if (cached) {
      return { resolved: cached.resolved };
    }

    try {
      const resp = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`, {
        headers: { 'Accept': 'application/json' }
      });
      const resolved = resp.ok;
      this.cacheResult('doi', doi, resolved, {});
      return { resolved };
    } catch {
      return { resolved: false };
    }
  }

  async resolveRaid(handle: string): Promise<RaidResult> {
    const cached = this.cache.get('raid', handle);
    if (cached) {
      return { resolved: cached.resolved };
    }

    try {
      // RAiD handles are DOI-based (10.xxxxx prefix), so resolve via DataCite API
      // which supports CORS. Direct fetch to raid.org fails in browsers due to CORS.
      const resp = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(handle)}`, {
        headers: { 'Accept': 'application/json' }
      });
      const resolved = resp.ok;
      this.cacheResult('raid', handle, resolved, {});
      return { resolved };
    } catch {
      return { resolved: false };
    }
  }

  private cacheResult(type: PidCacheEntry['type'], identifier: string, resolved: boolean, metadata: Record<string, unknown>): void {
    this.cache.set({
      type, identifier, resolved, metadata, timestamp: Date.now()
    });
  }
}
