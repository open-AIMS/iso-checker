// PID resolution APIs and local storage cache
// Implements requirements.md §8 and §4 (External PID validation)
const CACHE_KEY = 'iso-checker-pid-cache';
// --- PID Cache (localStorage-backed) ---
export class LocalStoragePidCache {
    constructor() {
        this.entries = new Map();
        this.load();
    }
    cacheKey(type, identifier) {
        return `${type}:${identifier}`;
    }
    get(type, identifier) {
        return this.entries.get(this.cacheKey(type, identifier)) ?? null;
    }
    set(entry) {
        this.entries.set(this.cacheKey(entry.type, entry.identifier), entry);
        this.save();
    }
    clear() {
        this.entries.clear();
        this.save();
    }
    size() {
        return this.entries.size;
    }
    all() {
        return Array.from(this.entries.values());
    }
    load() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                for (const entry of arr) {
                    this.entries.set(this.cacheKey(entry.type, entry.identifier), entry);
                }
            }
        }
        catch {
            // Corrupted cache — start fresh
            this.entries.clear();
        }
    }
    save() {
        try {
            const arr = Array.from(this.entries.values());
            localStorage.setItem(CACHE_KEY, JSON.stringify(arr));
        }
        catch {
            // localStorage full or unavailable — silently fail
        }
    }
}
export class PidResolver {
    constructor(cache) {
        this.cache = cache;
    }
    async resolveRor(rorId) {
        const cached = this.cache.get('ror', rorId);
        if (cached) {
            return {
                resolved: cached.resolved,
                canonicalName: cached.metadata?.canonicalName ?? null
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
            let canonicalName = null;
            if (Array.isArray(data.names)) {
                const rorDisplay = data.names.find((n) => Array.isArray(n.types) && n.types.includes('ror_display'));
                canonicalName = rorDisplay?.value ?? null;
            }
            this.cacheResult('ror', rorId, true, { canonicalName });
            return { resolved: true, canonicalName };
        }
        catch {
            return { resolved: false, canonicalName: null };
        }
    }
    async resolveOrcid(orcidId) {
        const cached = this.cache.get('orcid', orcidId);
        if (cached) {
            return {
                resolved: cached.resolved,
                familyName: cached.metadata?.familyName ?? null,
                givenNames: cached.metadata?.givenNames ?? null
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
        }
        catch {
            return { resolved: false, familyName: null, givenNames: null };
        }
    }
    async resolveDoi(doi) {
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
        }
        catch {
            return { resolved: false };
        }
    }
    async resolveRaid(handle) {
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
        }
        catch {
            return { resolved: false };
        }
    }
    cacheResult(type, identifier, resolved, metadata) {
        this.cache.set({
            type, identifier, resolved, metadata, timestamp: Date.now()
        });
    }
}
//# sourceMappingURL=pid-resolver.js.map