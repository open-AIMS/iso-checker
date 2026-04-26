// Main application entry point — wires UI, parser, rules, and catalogue client
// Implements the core application flow from ui-design.md §9

import type { AppSettings, RecordReport, CheckContext } from './types.js';
import { parseXml } from './xml/xpath-helpers.js';
import { parseRecord } from './xml/record-parser.js';
import { analyseRecord } from './rules/rule-registry.js';
import { LocalStoragePidCache } from './api/pid-resolver.js';
import {
  CatalogueClient, parseGeoNetworkUrl, buildCataloguePageUrl,
  type CswRecord
} from './catalogue/catalogue-client.js';
import { loadSettings, saveSettings, enabledSectionsSet, LocalKnowledgeBase } from './storage/settings.js';
import {
  renderSetupScreen, renderMainInterface, renderRecordReport,
  renderSettingsPanel, renderBatchSearchResults, getSelectedBatchUuids,
  renderBatchReport, registerActionHandler, showToast, type AppController
} from './ui/ui-renderer.js';

// --- Globals ---

let settings: AppSettings;
let pidCache: LocalStoragePidCache;
let knowledgeBase: LocalKnowledgeBase;
let condensedGuide: string = '';
let currentSearchTerm: string = '';
let currentSearchResourceType: string | undefined;

// --- Initialisation ---

async function init(): Promise<void> {
  settings = loadSettings();
  pidCache = new LocalStoragePidCache();
  knowledgeBase = new LocalKnowledgeBase();

  // Register action handler for KB confirmation buttons
  registerActionHandler((actionId, data) => {
    if (actionId === 'confirm-no-orcid' && data.name) {
      knowledgeBase.addOrUpdatePerson({
        name: data.name,
        orcid: null,
        registeredName: null,
        status: 'no-orcid',
        aliases: [],
        sourceRecords: []
      });
      showToast(`"${data.name}" marked as no ORCID. Re-check to update.`);
    } else if (actionId === 'confirm-no-ror' && data.name) {
      knowledgeBase.addOrUpdateOrg({
        name: data.name,
        ror: null,
        canonicalName: null,
        status: 'no-ror',
        aliases: [],
        sourceRecords: []
      });
      showToast(`"${data.name}" marked as no ROR. Re-check to update.`);
    } else if (actionId === 'add-alias-org' && data.alias && data.ror) {
      const existing = knowledgeBase.getAllOrgs().find(o => o.ror === data.ror);
      if (existing) {
        if (!existing.aliases.includes(data.alias)) {
          existing.aliases.push(data.alias);
          knowledgeBase.addOrUpdateOrg(existing);
        }
        showToast(`"${data.alias}" added as alias of "${existing.canonicalName ?? existing.name}". Re-check to update.`);
      }
    } else if (actionId === 'add-alias-person' && data.alias && data.orcid) {
      const existing = knowledgeBase.getAllPeople().find(p => p.orcid === data.orcid);
      if (existing) {
        if (!existing.aliases.includes(data.alias)) {
          existing.aliases.push(data.alias);
          knowledgeBase.addOrUpdatePerson(existing);
        }
        showToast(`"${data.alias}" added as alias of "${existing.registeredName ?? existing.name}". Re-check to update.`);
      }
    }
  });

  // Load condensed guide for AI context export
  try {
    const resp = await fetch('community-guide-condensed.md');
    if (resp.ok) condensedGuide = await resp.text();
  } catch {
    // Not available — AI context will be empty
  }

  const root = document.getElementById('app')!;

  if (!settings.setupComplete) {
    renderSetupScreen(root, (newSettings) => {
      settings = newSettings;
      showMainInterface(root);
    });
  } else {
    showMainInterface(root);
  }
}

function showMainInterface(root: HTMLElement): void {
  const controller: AppController = {
    getActiveCatalogue() {
      if (settings.activeCatalogueIndex >= 0 && settings.catalogues[settings.activeCatalogueIndex]) {
        return settings.catalogues[settings.activeCatalogueIndex];
      }
      return null;
    },

    async checkUrl(url: string) {
      if (!url) return;
      const resultsArea = document.getElementById('results-area')!;
      resultsArea.innerHTML = '<p class="loading">Loading record...</p>';

      try {
        const parsed = parseGeoNetworkUrl(url);
        if (!parsed) {
          resultsArea.innerHTML = '<p class="error-msg">Could not parse GeoNetwork URL.</p>';
          return;
        }

        // Search URL — redirect to batch tab
        if (parsed.isSearchUrl) {
          const searchInput = document.getElementById('batch-search-term') as HTMLInputElement;
          const typeSelect = document.getElementById('batch-resource-type') as HTMLSelectElement;
          if (searchInput && parsed.searchTerm) searchInput.value = parsed.searchTerm;
          if (typeSelect && parsed.resourceType) typeSelect.value = parsed.resourceType;
          // Switch to batch tab
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
          document.querySelector('[data-tab="batch"]')?.classList.add('active');
          document.getElementById('tab-batch')?.classList.add('active');
          if (parsed.searchTerm) {
            controller.searchBatch(parsed.searchTerm, parsed.resourceType ?? undefined);
          }
          return;
        }

        if (!parsed.uuid) {
          resultsArea.innerHTML = '<p class="error-msg">No UUID found in URL.</p>';
          return;
        }

        // Use catalogue from URL if different from active
        const catConfig = {
          url: parsed.baseUrl,
          proxyUrl: controller.getActiveCatalogue()?.proxyUrl ?? null
        };
        const client = new CatalogueClient(catConfig, settings.rateLimitMs);

        const xmlText = await client.fetchRecord(parsed.uuid);
        const doc = parseXml(xmlText);
        const sourceUrl = buildCataloguePageUrl(parsed.baseUrl, parsed.uuid);
        const record = parseRecord(doc, sourceUrl);

        const context = buildCheckContext();
        const report = await analyseRecord(record, context);

        renderRecordReport(resultsArea, report, condensedGuide);
      } catch (e) {
        resultsArea.innerHTML = `<p class="error-msg">Error: ${escapeHtml(String(e))}</p>`;
      }
    },

    async checkXml(xml: string) {
      if (!xml.trim()) return;
      const resultsArea = document.getElementById('results-area')!;
      resultsArea.innerHTML = '<p class="loading">Analysing record...</p>';

      try {
        const doc = parseXml(xml);
        const record = parseRecord(doc);
        const context = buildCheckContext();
        const report = await analyseRecord(record, context);
        renderRecordReport(resultsArea, report, condensedGuide);
      } catch (e) {
        resultsArea.innerHTML = `<p class="error-msg">Error: ${escapeHtml(String(e))}</p>`;
      }
    },

    async searchBatch(term: string, resourceType?: string) {
      // Store search state for pagination
      currentSearchTerm = term;
      currentSearchResourceType = resourceType;

      await controller.searchBatchPage(1);
    },

    async searchBatchPage(startPosition: number) {
      const cat = controller.getActiveCatalogue();
      if (!cat) {
        alert('No catalogue configured. Open Settings to add one.');
        return;
      }

      const batchArea = document.getElementById('batch-results-area')!;
      const statusEl = document.getElementById('batch-search-status')!;
      batchArea.style.display = 'block';
      statusEl.textContent = 'Searching...';

      try {
        const pageSize = settings.searchPageSize;
        const client = new CatalogueClient(cat, settings.rateLimitMs);
        const result = await client.searchCsw({
          searchTerm: currentSearchTerm || undefined,
          resourceType: currentSearchResourceType,
          startPosition,
          maxRecords: pageSize
        });

        if (result.error) {
          statusEl.textContent = `Search error: ${result.error}`;
          return;
        }

        if (result.records.length === 0) {
          statusEl.textContent = 'No matching records.';
          return;
        }

        if (result.totalMatched > 500) {
          statusEl.textContent = `Found ${result.totalMatched} records — maximum is 500. Please narrow your search.`;
        }

        renderBatchSearchResults(
          document.querySelector('.input-area')!,
          result.records,
          result.totalMatched,
          startPosition,
          pageSize,
          (newStart: number) => controller.searchBatchPage(newStart)
        );

        // Wire up Run Checks
        const runBtn = document.getElementById('batch-run') as HTMLButtonElement;
        runBtn.onclick = () => {
          const uuids = getSelectedBatchUuids(document.querySelector('.input-area')!);
          controller.fetchBatchUuids(uuids);
        };
      } catch (e) {
        statusEl.textContent = `Error: ${String(e)}`;
      }
    },

    async fetchBatchUuids(uuids: string[]) {
      if (uuids.length === 0) return;
      if (uuids.length > 500) {
        alert(`Maximum 500 records per batch. You selected ${uuids.length}.`);
        return;
      }

      const cat = controller.getActiveCatalogue();
      if (!cat) {
        alert('No catalogue configured.');
        return;
      }

      const resultsArea = document.getElementById('results-area')!;
      resultsArea.innerHTML = `<p class="loading">Fetching and analysing ${uuids.length} records...</p>`;

      const client = new CatalogueClient(cat, settings.rateLimitMs);
      const context = buildCheckContext();
      const reports: RecordReport[] = [];
      let done = 0;

      for (const uuid of uuids) {
        try {
          const xmlText = await client.fetchRecord(uuid);
          const doc = parseXml(xmlText);
          const sourceUrl = buildCataloguePageUrl(cat.url, uuid);
          const record = parseRecord(doc, sourceUrl);
          const report = await analyseRecord(record, context);
          reports.push(report);
        } catch (e) {
          // Create a minimal error report
          console.error(`Failed to process ${uuid}:`, e);
        }
        done++;
        resultsArea.innerHTML = `<p class="loading">Analysing records... ${done}/${uuids.length}</p>`;
      }

      if (reports.length === 0) {
        resultsArea.innerHTML = '<p class="error-msg">No records could be processed.</p>';
        return;
      }

      renderBatchReport(resultsArea, reports, condensedGuide, async (index) => {
        const uuid = reports[index].record.uuid;
        if (!uuid) return;
        const xmlText = await client.fetchRecord(uuid);
        const doc = parseXml(xmlText);
        const sourceUrl = buildCataloguePageUrl(cat.url, uuid);
        const record = parseRecord(doc, sourceUrl);
        const report = await analyseRecord(record, buildCheckContext());
        reports[index] = report;
      });
    },

    toggleSettings() {
      const panel = document.getElementById('settings-panel')!;
      if (panel.style.display === 'none' || !panel.style.display) {
        renderSettingsPanel(panel, settings, knowledgeBase, (newSettings) => {
          settings = newSettings;
          saveSettings(settings);
        }, () => {
          panel.style.display = 'none';
        });
      } else {
        panel.style.display = 'none';
      }
    }
  };

  renderMainInterface(root, controller);
}

function buildCheckContext(): CheckContext {
  return {
    apiValidationEnabled: settings.apiValidationEnabled,
    pidCache,
    knowledgeBase,
    enabledSections: enabledSectionsSet(settings)
  };
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// --- Start ---

document.addEventListener('DOMContentLoaded', init);
