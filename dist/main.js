// Main application entry point — wires UI, parser, rules, and catalogue client
// Implements the core application flow from ui-design.md §9
import { parseXml } from './xml/xpath-helpers.js';
import { parseRecord } from './xml/record-parser.js';
import { analyseRecord } from './rules/rule-registry.js';
import { LocalStoragePidCache } from './api/pid-resolver.js';
import { CatalogueClient, parseGeoNetworkUrl, buildCataloguePageUrl } from './catalogue/catalogue-client.js';
import { loadSettings, saveSettings, enabledSectionsSet, LocalKnowledgeBase } from './storage/settings.js';
import { renderSetupScreen, renderMainInterface, renderRecordReport, renderSettingsPanel, renderBatchSearchResults, getSelectedBatchUuids, renderBatchReport } from './ui/ui-renderer.js';
// --- Globals ---
let settings;
let pidCache;
let knowledgeBase;
let condensedGuide = '';
// --- Initialisation ---
async function init() {
    settings = loadSettings();
    pidCache = new LocalStoragePidCache();
    knowledgeBase = new LocalKnowledgeBase();
    // Load condensed guide for AI context export
    try {
        const resp = await fetch('community-guide-condensed.md');
        if (resp.ok)
            condensedGuide = await resp.text();
    }
    catch {
        // Not available — AI context will be empty
    }
    const root = document.getElementById('app');
    if (!settings.setupComplete) {
        renderSetupScreen(root, (newSettings) => {
            settings = newSettings;
            showMainInterface(root);
        });
    }
    else {
        showMainInterface(root);
    }
}
function showMainInterface(root) {
    const controller = {
        getActiveCatalogue() {
            if (settings.activeCatalogueIndex >= 0 && settings.catalogues[settings.activeCatalogueIndex]) {
                return settings.catalogues[settings.activeCatalogueIndex];
            }
            return null;
        },
        async checkUrl(url) {
            if (!url)
                return;
            const resultsArea = document.getElementById('results-area');
            resultsArea.innerHTML = '<p class="loading">Loading record...</p>';
            try {
                const parsed = parseGeoNetworkUrl(url);
                if (!parsed) {
                    resultsArea.innerHTML = '<p class="error-msg">Could not parse GeoNetwork URL.</p>';
                    return;
                }
                // Search URL — redirect to batch tab
                if (parsed.isSearchUrl) {
                    const searchInput = document.getElementById('batch-search-term');
                    const typeSelect = document.getElementById('batch-resource-type');
                    if (searchInput && parsed.searchTerm)
                        searchInput.value = parsed.searchTerm;
                    if (typeSelect && parsed.resourceType)
                        typeSelect.value = parsed.resourceType;
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
            }
            catch (e) {
                resultsArea.innerHTML = `<p class="error-msg">Error: ${escapeHtml(String(e))}</p>`;
            }
        },
        async checkXml(xml) {
            if (!xml.trim())
                return;
            const resultsArea = document.getElementById('results-area');
            resultsArea.innerHTML = '<p class="loading">Analysing record...</p>';
            try {
                const doc = parseXml(xml);
                const record = parseRecord(doc);
                const context = buildCheckContext();
                const report = await analyseRecord(record, context);
                renderRecordReport(resultsArea, report, condensedGuide);
            }
            catch (e) {
                resultsArea.innerHTML = `<p class="error-msg">Error: ${escapeHtml(String(e))}</p>`;
            }
        },
        async searchBatch(term, resourceType) {
            const cat = controller.getActiveCatalogue();
            if (!cat) {
                alert('No catalogue configured. Open Settings to add one.');
                return;
            }
            const resultsArea = document.getElementById('results-area');
            const batchArea = document.getElementById('batch-results-area');
            const statusEl = document.getElementById('batch-search-status');
            batchArea.style.display = 'block';
            statusEl.textContent = 'Searching...';
            try {
                const client = new CatalogueClient(cat, settings.rateLimitMs);
                const result = await client.searchCsw({
                    searchTerm: term || undefined,
                    resourceType,
                    maxRecords: 100
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
                renderBatchSearchResults(document.querySelector('.input-area'), result.records, result.totalMatched);
                // Wire up Run Checks
                const runBtn = document.getElementById('batch-run');
                runBtn.onclick = () => {
                    const uuids = getSelectedBatchUuids(document.querySelector('.input-area'));
                    controller.fetchBatchUuids(uuids);
                };
            }
            catch (e) {
                statusEl.textContent = `Error: ${String(e)}`;
            }
        },
        async fetchBatchUuids(uuids) {
            if (uuids.length === 0)
                return;
            if (uuids.length > 500) {
                alert(`Maximum 500 records per batch. You selected ${uuids.length}.`);
                return;
            }
            const cat = controller.getActiveCatalogue();
            if (!cat) {
                alert('No catalogue configured.');
                return;
            }
            const resultsArea = document.getElementById('results-area');
            resultsArea.innerHTML = `<p class="loading">Fetching and analysing ${uuids.length} records...</p>`;
            const client = new CatalogueClient(cat, settings.rateLimitMs);
            const context = buildCheckContext();
            const reports = [];
            let done = 0;
            for (const uuid of uuids) {
                try {
                    const xmlText = await client.fetchRecord(uuid);
                    const doc = parseXml(xmlText);
                    const sourceUrl = buildCataloguePageUrl(cat.url, uuid);
                    const record = parseRecord(doc, sourceUrl);
                    const report = await analyseRecord(record, context);
                    reports.push(report);
                }
                catch (e) {
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
            renderBatchReport(resultsArea, reports, condensedGuide, (index) => {
                const rightPanel = resultsArea.querySelector('.batch-right-panel');
                if (rightPanel)
                    renderRecordReport(rightPanel, reports[index], condensedGuide);
            });
        },
        toggleSettings() {
            const panel = document.getElementById('settings-panel');
            if (panel.style.display === 'none' || !panel.style.display) {
                renderSettingsPanel(panel, settings, (newSettings) => {
                    settings = newSettings;
                    saveSettings(settings);
                }, () => {
                    panel.style.display = 'none';
                });
            }
            else {
                panel.style.display = 'none';
            }
        }
    };
    renderMainInterface(root, controller);
}
function buildCheckContext() {
    return {
        apiValidationEnabled: settings.apiValidationEnabled,
        pidCache,
        knowledgeBase,
        enabledSections: enabledSectionsSet(settings)
    };
}
function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}
// --- Start ---
document.addEventListener('DOMContentLoaded', init);
//# sourceMappingURL=main.js.map