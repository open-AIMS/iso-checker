// Settings and storage layer — localStorage-backed
// Implements requirements.md §12

import type { AppSettings, KnowledgeBase, KnowledgeBasePerson, KnowledgeBaseOrg } from '../types.js';
import { getAllSections } from '../rules/rule-registry.js';

const SETTINGS_KEY = 'iso-checker-settings';
const KB_PEOPLE_KEY = 'iso-checker-kb-people';
const KB_ORGS_KEY = 'iso-checker-kb-orgs';

// --- Default settings ---

export function defaultSettings(): AppSettings {
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

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppSettings>;
      return { ...defaultSettings(), ...saved };
    }
  } catch {
    // Corrupted — fall back to defaults
  }
  return defaultSettings();
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full
  }
}

// --- Enabled sections as a Set (for CheckContext) ---

export function enabledSectionsSet(settings: AppSettings): Set<string> {
  return new Set(settings.enabledSections);
}

// --- Full settings export/import ---

export function exportAllSettings(): string {
  const data: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('iso-checker-')) {
      data[key] = localStorage.getItem(key);
    }
  }
  return JSON.stringify(data, null, 2);
}

export function importAllSettings(json: string): void {
  const data = JSON.parse(json) as Record<string, string>;
  // Only import keys that match our prefix
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('iso-checker-')) {
      localStorage.setItem(key, value);
    }
  }
}

// --- Knowledge base (v3 stubs with basic local storage backing) ---

export class LocalKnowledgeBase implements KnowledgeBase {
  private people: KnowledgeBasePerson[] = [];
  private orgs: KnowledgeBaseOrg[] = [];

  constructor() {
    this.load();
  }

  findPerson(name: string): KnowledgeBasePerson | null {
    const lower = name.toLowerCase();
    return this.people.find(p =>
      p.name.toLowerCase() === lower ||
      p.aliases.some(a => a.toLowerCase() === lower)
    ) ?? null;
  }

  findOrg(name: string): KnowledgeBaseOrg | null {
    const lower = name.toLowerCase();
    return this.orgs.find(o =>
      o.name.toLowerCase() === lower ||
      o.aliases.some(a => a.toLowerCase() === lower)
    ) ?? null;
  }

  getAllPeople(): KnowledgeBasePerson[] {
    return [...this.people];
  }

  getAllOrgs(): KnowledgeBaseOrg[] {
    return [...this.orgs];
  }

  addOrUpdatePerson(person: KnowledgeBasePerson): void {
    const idx = this.people.findIndex(p =>
      (p.orcid && p.orcid === person.orcid) ||
      p.name.toLowerCase() === person.name.toLowerCase()
    );
    if (idx >= 0) {
      // Merge aliases
      const existing = this.people[idx];
      const allAliases = new Set([...existing.aliases, ...person.aliases]);
      if (person.name !== existing.name) allAliases.add(existing.name);
      allAliases.delete(person.name);
      this.people[idx] = {
        ...existing,
        ...person,
        aliases: Array.from(allAliases),
        sourceRecords: [...new Set([...existing.sourceRecords, ...person.sourceRecords])]
      };
    } else {
      this.people.push(person);
    }
    this.save();
  }

  addOrUpdateOrg(org: KnowledgeBaseOrg): void {
    const idx = this.orgs.findIndex(o =>
      (o.ror && o.ror === org.ror) ||
      o.name.toLowerCase() === org.name.toLowerCase()
    );
    if (idx >= 0) {
      const existing = this.orgs[idx];
      const allAliases = new Set([...existing.aliases, ...org.aliases]);
      if (org.name !== existing.name) allAliases.add(existing.name);
      allAliases.delete(org.name);
      this.orgs[idx] = {
        ...existing,
        ...org,
        aliases: Array.from(allAliases),
        sourceRecords: [...new Set([...existing.sourceRecords, ...org.sourceRecords])]
      };
    } else {
      this.orgs.push(org);
    }
    this.save();
  }

  removePerson(name: string): void {
    this.people = this.people.filter(p => p.name !== name);
    this.save();
  }

  removeOrg(name: string): void {
    this.orgs = this.orgs.filter(o => o.name !== name);
    this.save();
  }

  clearAll(): void {
    this.people = [];
    this.orgs = [];
    this.save();
  }

  // CSV export/import
  exportPeopleCsv(): string {
    const rows = this.people.map(p =>
      `"${csvEscape(p.name)}","${csvEscape(p.orcid ?? '')}","${p.status}","${csvEscape(p.aliases.join('|'))}"`
    );
    return ['name,orcid,status,aliases', ...rows].join('\n');
  }

  exportOrgsCsv(): string {
    const rows = this.orgs.map(o =>
      `"${csvEscape(o.name)}","${csvEscape(o.ror ?? '')}","${o.status}","${csvEscape(o.aliases.join('|'))}"`
    );
    return ['name,ror,status,aliases', ...rows].join('\n');
  }

  private load(): void {
    try {
      const rawPeople = localStorage.getItem(KB_PEOPLE_KEY);
      if (rawPeople) this.people = JSON.parse(rawPeople);
      const rawOrgs = localStorage.getItem(KB_ORGS_KEY);
      if (rawOrgs) this.orgs = JSON.parse(rawOrgs);
    } catch {
      this.people = [];
      this.orgs = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KB_PEOPLE_KEY, JSON.stringify(this.people));
      localStorage.setItem(KB_ORGS_KEY, JSON.stringify(this.orgs));
    } catch {
      // localStorage full
    }
  }
}

function csvEscape(s: string): string {
  return s.replace(/"/g, '""');
}
