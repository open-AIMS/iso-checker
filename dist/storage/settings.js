// Settings and storage layer — localStorage-backed
// Implements requirements.md §12
import { getAllSections } from '../rules/rule-registry.js';
const SETTINGS_KEY = 'iso-checker-settings';
const KB_PEOPLE_KEY = 'iso-checker-kb-people';
const KB_ORGS_KEY = 'iso-checker-kb-orgs';
// --- Default settings ---
export function defaultSettings() {
    return {
        catalogues: [],
        activeCatalogueIndex: -1,
        enabledSections: getAllSections().filter(s => s.defaultEnabled).map(s => s.id),
        disabledRules: [],
        apiValidationEnabled: true,
        rateLimitMs: 500,
        searchPageSize: 25,
        setupComplete: false
    };
}
// --- Settings persistence ---
export function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            return { ...defaultSettings(), ...saved };
        }
    }
    catch {
        // Corrupted — fall back to defaults
    }
    return defaultSettings();
}
export function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    catch {
        // localStorage full
    }
}
// --- Enabled sections as a Set (for CheckContext) ---
export function enabledSectionsSet(settings) {
    return new Set(settings.enabledSections);
}
// --- Full settings export/import ---
export function exportAllSettings() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('iso-checker-')) {
            data[key] = localStorage.getItem(key);
        }
    }
    return JSON.stringify(data, null, 2);
}
export function importAllSettings(json) {
    const data = JSON.parse(json);
    // Only import keys that match our prefix
    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('iso-checker-')) {
            localStorage.setItem(key, value);
        }
    }
}
// --- Knowledge base (v3 stubs with basic local storage backing) ---
export class LocalKnowledgeBase {
    constructor() {
        this.people = [];
        this.orgs = [];
        this.load();
    }
    findPerson(name) {
        const lower = name.toLowerCase();
        return this.people.find(p => p.name.toLowerCase() === lower ||
            p.aliases.some(a => a.toLowerCase() === lower)) ?? null;
    }
    findOrg(name) {
        const lower = name.toLowerCase();
        return this.orgs.find(o => o.name.toLowerCase() === lower ||
            o.aliases.some(a => a.toLowerCase() === lower)) ?? null;
    }
    getAllPeople() {
        return [...this.people];
    }
    getAllOrgs() {
        return [...this.orgs];
    }
    addOrUpdatePerson(person) {
        const idx = this.people.findIndex(p => (p.orcid && p.orcid === person.orcid) ||
            p.name.toLowerCase() === person.name.toLowerCase());
        if (idx >= 0) {
            // Merge aliases
            const existing = this.people[idx];
            const allAliases = new Set([...existing.aliases, ...person.aliases]);
            if (person.name !== existing.name)
                allAliases.add(existing.name);
            allAliases.delete(person.name);
            this.people[idx] = {
                ...existing,
                ...person,
                aliases: Array.from(allAliases),
                sourceRecords: [...new Set([...existing.sourceRecords, ...person.sourceRecords])]
            };
        }
        else {
            this.people.push(person);
        }
        this.save();
    }
    addOrUpdateOrg(org) {
        const idx = this.orgs.findIndex(o => (o.ror && o.ror === org.ror) ||
            o.name.toLowerCase() === org.name.toLowerCase());
        if (idx >= 0) {
            const existing = this.orgs[idx];
            const allAliases = new Set([...existing.aliases, ...org.aliases]);
            if (org.name !== existing.name)
                allAliases.add(existing.name);
            allAliases.delete(org.name);
            this.orgs[idx] = {
                ...existing,
                ...org,
                aliases: Array.from(allAliases),
                sourceRecords: [...new Set([...existing.sourceRecords, ...org.sourceRecords])]
            };
        }
        else {
            this.orgs.push(org);
        }
        this.save();
    }
    removePerson(name) {
        this.people = this.people.filter(p => p.name !== name);
        this.save();
    }
    removeOrg(name) {
        this.orgs = this.orgs.filter(o => o.name !== name);
        this.save();
    }
    clearAll() {
        this.people = [];
        this.orgs = [];
        this.save();
    }
    // CSV export/import
    exportPeopleCsv() {
        const rows = this.people.map(p => `"${csvEscape(p.name)}","${csvEscape(p.orcid ?? '')}","${p.status}","${csvEscape(p.aliases.join('|'))}"`);
        return ['name,orcid,status,aliases', ...rows].join('\n');
    }
    exportOrgsCsv() {
        const rows = this.orgs.map(o => `"${csvEscape(o.name)}","${csvEscape(o.ror ?? '')}","${o.status}","${csvEscape(o.aliases.join('|'))}"`);
        return ['name,ror,status,aliases', ...rows].join('\n');
    }
    load() {
        try {
            const rawPeople = localStorage.getItem(KB_PEOPLE_KEY);
            if (rawPeople)
                this.people = JSON.parse(rawPeople);
            const rawOrgs = localStorage.getItem(KB_ORGS_KEY);
            if (rawOrgs)
                this.orgs = JSON.parse(rawOrgs);
        }
        catch {
            this.people = [];
            this.orgs = [];
        }
    }
    save() {
        try {
            localStorage.setItem(KB_PEOPLE_KEY, JSON.stringify(this.people));
            localStorage.setItem(KB_ORGS_KEY, JSON.stringify(this.orgs));
        }
        catch {
            // localStorage full
        }
    }
}
function csvEscape(s) {
    return s.replace(/"/g, '""');
}
//# sourceMappingURL=settings.js.map