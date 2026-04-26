// UI rendering — builds and manages all DOM elements
// Implements ui-design.md §1–§6
import { getAllSections } from '../rules/rule-registry.js';
import { generateMarkdownReport, generateAiContextReport, copyToClipboard } from './report-export.js';
import { CatalogueClient } from '../catalogue/catalogue-client.js';
import { APP_VERSION } from '../version.js';
import { loadSettings, saveSettings } from '../storage/settings.js';
const SEVERITY_CLASSES = {
    pass: 'severity-pass',
    error: 'severity-error',
    warning: 'severity-warning',
    info: 'severity-info'
};
const SEVERITY_ICONS = {
    pass: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
};
let registeredActionHandler = null;
export function registerActionHandler(handler) {
    registeredActionHandler = handler;
}
// --- Setup screen ---
export function renderSetupScreen(container, onComplete) {
    container.innerHTML = '';
    container.className = 'setup-screen';
    const card = el('div', 'setup-card');
    card.innerHTML = `
    <h1>ISO 19115-3 Metadata Checker</h1>
    <p>Check metadata records for persistent identifier encoding (DOI, ORCID, ROR, RAiD)
    against the Community Practice Guide.</p>
    <p>To get started, enter your GeoNetwork catalogue URL below.</p>

    <label for="setup-url">Catalogue base URL</label>
    <input type="url" id="setup-url" placeholder="https://metadata.imas.utas.edu.au/geonetwork/"
           class="input-field" />
    <p class="help-text">The URL up to and including /geonetwork/. The tool needs access to the CSW endpoint and XML API.</p>
    <p class="help-text">Examples: https://metadata.imas.utas.edu.au/geonetwork/ &nbsp;|&nbsp; https://ecat.ga.gov.au/geonetwork/</p>

    <div id="setup-proxy-section" style="display:none">
      <label for="setup-proxy">Proxy URL (optional)</label>
      <input type="url" id="setup-proxy" placeholder="http://localhost:8080/proxy" class="input-field" />
      <p class="help-text">If the catalogue blocks cross-origin requests, enter a CORS proxy URL here.</p>
    </div>

    <div class="setup-buttons">
      <button id="setup-test" class="btn btn-primary">Test Connection &amp; Save</button>
      <button id="setup-skip" class="btn btn-secondary">Skip for now (paste XML only)</button>
    </div>

    <div id="setup-status" class="connection-status" style="display:none"></div>

    <button id="setup-continue" class="btn btn-primary" style="display:none" disabled>Continue</button>
  `;
    container.appendChild(card);
    const urlInput = card.querySelector('#setup-url');
    const proxyInput = card.querySelector('#setup-proxy');
    const proxySection = card.querySelector('#setup-proxy-section');
    const testBtn = card.querySelector('#setup-test');
    const skipBtn = card.querySelector('#setup-skip');
    const statusDiv = card.querySelector('#setup-status');
    const continueBtn = card.querySelector('#setup-continue');
    testBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url)
            return;
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<p>Testing connection...</p>';
        const client = new CatalogueClient({ url, proxyUrl: proxyInput.value.trim() || null }, 500);
        const result = await client.testConnection();
        renderConnectionStatus(statusDiv, result);
        if (result.cors && result.csw) {
            continueBtn.style.display = 'block';
            continueBtn.disabled = false;
        }
        else {
            proxySection.style.display = 'block';
        }
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection & Save';
    });
    skipBtn.addEventListener('click', () => {
        const settings = loadSettings();
        settings.setupComplete = true;
        saveSettings(settings);
        onComplete(settings);
    });
    continueBtn.addEventListener('click', () => {
        const settings = loadSettings();
        settings.catalogues = [{
                url: urlInput.value.trim(),
                proxyUrl: proxyInput.value.trim() || null
            }];
        settings.activeCatalogueIndex = 0;
        settings.setupComplete = true;
        saveSettings(settings);
        onComplete(settings);
    });
}
// --- Main interface ---
export function renderMainInterface(container, app) {
    container.innerHTML = '';
    container.className = 'main-interface';
    // Header
    const header = el('header', 'header-bar');
    header.innerHTML = `
    <h1>ISO 19115-3 Metadata Checker <span class="header-version">v${APP_VERSION}</span></h1>
    <nav class="header-links">
      <a href="https://github.com/open-AIMS/iso-checker/blob/main/faq.md" target="_blank" rel="noopener">FAQ</a>
      <a href="https://github.com/open-AIMS/iso-checker/blob/main/community-guide.md" target="_blank" rel="noopener">Community Guide</a>
    </nav>
    <button id="settings-btn" class="btn btn-icon" title="Settings">⚙ Settings</button>
  `;
    container.appendChild(header);
    // Intro + catalogue indicator
    const intro = el('div', 'intro-section');
    const activeCat = app.getActiveCatalogue();
    intro.innerHTML = `
    <p>Check metadata records for persistent identifier encoding (DOI, ORCID, ROR, RAiD) against the Community Practice Guide.</p>
    <p class="catalogue-indicator">Active catalogue: <strong>${activeCat ? new URL(activeCat.url).hostname : 'None configured'}</strong>
    ${activeCat ? '' : ' — <a href="#" id="open-settings">configure in Settings</a>'}
    </p>
  `;
    container.appendChild(intro);
    // Input tabs
    const inputArea = el('div', 'input-area');
    inputArea.innerHTML = `
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="url">URL</button>
      <button class="tab-btn" data-tab="xml">Paste XML</button>
      <button class="tab-btn" data-tab="batch">Batch / Search</button>
    </div>

    <div class="tab-panel active" id="tab-url">
      <p class="help-text">Paste a GeoNetwork record URL or search URL.</p>
      <div class="input-row">
        <input type="url" id="url-input" class="input-field" placeholder="https://catalogue.example.org/geonetwork/srv/eng/catalog.search#/metadata/..." />
        <button id="url-check" class="btn btn-primary">Check</button>
      </div>
      <p class="help-text small">Accepts: XML API URL, catalogue page URL, or search URL</p>
    </div>

    <div class="tab-panel" id="tab-xml">
      <p class="help-text">Paste a single ISO 19115-3 XML record to check a draft or unpublished record.</p>
      <textarea id="xml-input" class="xml-textarea" rows="8" placeholder="<?xml version=&quot;1.0&quot; ..."></textarea>
      <button id="xml-check" class="btn btn-primary">Check</button>
    </div>

    <div class="tab-panel" id="tab-batch">
      <p class="help-text">Review multiple records. Search your catalogue or list UUIDs.</p>
      <div class="batch-inputs">
        <div class="batch-search">
          <h3>Search</h3>
          <input type="text" id="batch-search-term" class="input-field" placeholder="Search term" />
          <select id="batch-resource-type" class="input-field">
            <option value="">All types</option>
            <option value="dataset">Dataset</option>
            <option value="fieldSession">Project</option>
            <option value="series">Program</option>
          </select>
          <button id="batch-search-btn" class="btn btn-primary">Search</button>
        </div>
        <div class="batch-uuids">
          <h3>UUID List</h3>
          <textarea id="batch-uuid-input" class="uuid-textarea" rows="4" placeholder="One UUID per line"></textarea>
          <button id="batch-uuid-btn" class="btn btn-primary">Fetch Records</button>
        </div>
      </div>
      <div id="batch-results-area" style="display:none">
        <div id="batch-search-status"></div>
        <table id="batch-table" class="batch-table">
          <thead><tr><th><input type="checkbox" id="batch-select-all" /></th><th>Title</th><th>Type</th><th>UUID</th></tr></thead>
          <tbody></tbody>
        </table>
        <div id="batch-pagination" class="batch-pagination" style="display:none">
          <button id="batch-page-prev" class="btn btn-small" disabled>← Previous</button>
          <span id="batch-page-info"></span>
          <button id="batch-page-next" class="btn btn-small" disabled>Next →</button>
        </div>
        <div class="batch-actions">
          <span id="batch-selected-count">0 selected</span>
          <button id="batch-run" class="btn btn-primary" disabled>Run Checks</button>
        </div>
        <p class="help-text small">Max 500 records per batch. Rate-limited to protect the server.</p>
      </div>
    </div>
  `;
    container.appendChild(inputArea);
    // Results area
    const resultsArea = el('div', 'results-area');
    resultsArea.id = 'results-area';
    container.appendChild(resultsArea);
    // Settings panel (hidden)
    const settingsPanel = el('div', 'settings-panel');
    settingsPanel.id = 'settings-panel';
    settingsPanel.style.display = 'none';
    container.appendChild(settingsPanel);
    // Wire up tab switching
    const tabBtns = inputArea.querySelectorAll('.tab-btn');
    const tabPanels = inputArea.querySelectorAll('.tab-panel');
    for (const btn of Array.from(tabBtns)) {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            inputArea.querySelector(`#tab-${tab}`)?.classList.add('active');
        });
    }
    // Wire up URL check
    const urlCheckBtn = container.querySelector('#url-check');
    const urlInput = container.querySelector('#url-input');
    urlCheckBtn.addEventListener('click', () => app.checkUrl(urlInput.value.trim()));
    // Wire up XML check
    const xmlCheckBtn = container.querySelector('#xml-check');
    const xmlInput = container.querySelector('#xml-input');
    xmlCheckBtn.addEventListener('click', () => app.checkXml(xmlInput.value));
    // Wire up batch search
    const batchSearchBtn = container.querySelector('#batch-search-btn');
    batchSearchBtn.addEventListener('click', () => {
        const term = container.querySelector('#batch-search-term').value;
        const type = container.querySelector('#batch-resource-type').value;
        app.searchBatch(term, type || undefined);
    });
    // Wire up batch UUID
    const batchUuidBtn = container.querySelector('#batch-uuid-btn');
    batchUuidBtn.addEventListener('click', () => {
        const text = container.querySelector('#batch-uuid-input').value;
        const uuids = text.split('\n').map(s => s.trim()).filter(Boolean);
        app.fetchBatchUuids(uuids);
    });
    // Wire up settings
    container.querySelector('#settings-btn')?.addEventListener('click', () => app.toggleSettings());
    container.querySelector('#open-settings')?.addEventListener('click', (e) => {
        e.preventDefault();
        app.toggleSettings();
    });
}
// --- Record report rendering ---
export function renderRecordReport(container, report, condensedGuide, onRecheck) {
    container.innerHTML = '';
    // Record header
    const header = el('div', 'record-header');
    const title = report.record.title ?? '(untitled)';
    const viewLink = report.record.sourceUrl
        ? `<a href="${report.record.sourceUrl}" target="_blank" class="view-link">View in GeoNetwork ↗</a>`
        : '';
    header.innerHTML = `
    <h2 class="record-title">${escapeHtml(title)}</h2>
    ${viewLink}
    <div class="record-meta">
      <span class="record-type-badge">${capitalize(report.record.recordType)}</span>
      <span class="record-schema">${report.record.schema}</span>
      ${report.record.uuid ? `<span class="record-uuid">${report.record.uuid}</span>` : ''}
    </div>
  `;
    container.appendChild(header);
    // Summary bar
    const counts = countSeverities(report.sections);
    const summaryBar = el('div', 'summary-bar');
    summaryBar.innerHTML = `
    <div class="summary-counts">
      <span class="count-pass">${SEVERITY_ICONS.pass} ${counts.pass} passed</span>
      <span class="count-warning">${SEVERITY_ICONS.warning} ${counts.warning} warnings</span>
      <span class="count-error">${SEVERITY_ICONS.error} ${counts.error} errors</span>
      <span class="count-info">${SEVERITY_ICONS.info} ${counts.info} info</span>
    </div>
    <div class="summary-actions">
      ${report.record.sourceUrl && onRecheck ? '<button class="btn btn-small btn-recheck">Re-check</button>' : ''}
      <div class="copy-dropdown">
        <button class="btn btn-small btn-copy-main">Copy report ▾</button>
        <div class="copy-dropdown-menu" style="display:none">
          <button class="copy-option" data-mode="issues">Errors &amp; warnings only</button>
          <button class="copy-option" data-mode="full">Full report (all checks)</button>
          <hr />
          <button class="copy-option" data-mode="ai-issues">Errors &amp; warnings + AI context</button>
          <button class="copy-option" data-mode="ai-full">Full report + AI context</button>
        </div>
      </div>
    </div>
  `;
    container.appendChild(summaryBar);
    // Copy dropdown handlers
    const copyBtn = summaryBar.querySelector('.btn-copy-main');
    const copyMenu = summaryBar.querySelector('.copy-dropdown-menu');
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyMenu.style.display = copyMenu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => { copyMenu.style.display = 'none'; });
    copyMenu.addEventListener('click', async (e) => {
        const target = e.target.closest('.copy-option');
        if (!target)
            return;
        const mode = target.dataset.mode;
        let text = '';
        switch (mode) {
            case 'issues':
                text = generateMarkdownReport(report, true);
                break;
            case 'full':
                text = generateMarkdownReport(report, false);
                break;
            case 'ai-issues':
                text = generateAiContextReport(report, condensedGuide, true);
                break;
            case 'ai-full':
                text = generateAiContextReport(report, condensedGuide, false);
                break;
        }
        await copyToClipboard(text);
        copyMenu.style.display = 'none';
        showToast('Report copied to clipboard');
    });
    // Re-check button handler
    if (report.record.sourceUrl && onRecheck) {
        const recheckBtn = summaryBar.querySelector('.btn-recheck');
        recheckBtn.addEventListener('click', async () => {
            recheckBtn.disabled = true;
            recheckBtn.textContent = 'Checking\u2026';
            try {
                await onRecheck();
            }
            catch (e) {
                console.error('Re-check failed:', e);
                showToast('Re-check failed');
                recheckBtn.disabled = false;
                recheckBtn.textContent = 'Re-check';
            }
        });
    }
    // Schema warning for ISO 19139
    if (report.record.schema === 'iso19139') {
        const warning = el('div', 'schema-warning');
        warning.innerHTML = `
      <p><strong>⚠ ISO 19139 record.</strong> This record uses the older ISO 19139 schema.
      Some checks (RAiD, partyIdentifier for ROR/ORCID) are not available.
      Consider converting to ISO 19115-3 via GeoNetwork's built-in conversion tool.</p>
    `;
        container.appendChild(warning);
    }
    // Check sections
    for (const section of report.sections) {
        container.appendChild(renderSection(section));
    }
}
function renderSection(section) {
    const passCount = section.results.filter(r => r.severity === 'pass').length;
    const total = section.results.length;
    const worstSeverity = getWorstSeverity(section.results);
    const sectionEl = el('div', 'check-section');
    const headerEl = el('div', 'section-header');
    headerEl.classList.add(SEVERITY_CLASSES[worstSeverity]);
    headerEl.innerHTML = `
    <span class="section-icon">${SEVERITY_ICONS[worstSeverity]}</span>
    <span class="section-name">${escapeHtml(section.sectionName)}</span>
    <span class="section-count">${passCount}/${total} pass</span>
    <span class="section-toggle">▼</span>
  `;
    const bodyEl = el('div', 'section-body');
    // Group by entity if present
    const entityGroups = groupByEntity(section.results);
    if (entityGroups.size > 1 || (entityGroups.size === 1 && !entityGroups.has(''))) {
        for (const [entity, results] of entityGroups) {
            if (entity) {
                const allPass = results.every(r => r.severity === 'pass');
                const worstEntity = getWorstSeverity(results);
                const entityGroup = el('div', 'entity-group');
                const entityHeader = el('div', `entity-header ${allPass ? 'entity-all-pass' : ''}`);
                entityHeader.innerHTML = `
          <span class="entity-name">── ${escapeHtml(entity)} ${SEVERITY_ICONS[worstEntity]} ──</span>
          <span class="entity-toggle">${allPass ? '▶' : '▼'}</span>
        `;
                entityHeader.style.cursor = 'pointer';
                const entityBody = el('div', 'entity-body');
                entityBody.style.display = allPass ? 'none' : 'block';
                const passingCount = results.filter(r => r.severity === 'pass').length;
                const nonPassingCount = results.length - passingCount;
                for (const result of results) {
                    const checkEl = renderCheckResult(result);
                    if (result.severity === 'pass' && nonPassingCount > 0) {
                        checkEl.classList.add('passing-check-hidden');
                        checkEl.style.display = 'none';
                    }
                    entityBody.appendChild(checkEl);
                }
                // "Show N passing" toggle when there are hidden passing checks
                if (passingCount > 0 && nonPassingCount > 0) {
                    const toggle = el('div', 'show-passing-toggle');
                    toggle.textContent = `Show ${passingCount} passing check${passingCount > 1 ? 's' : ''}`;
                    toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const showing = toggle.classList.toggle('expanded');
                        entityBody.querySelectorAll('.passing-check-hidden').forEach(ch => ch.style.display = showing ? '' : 'none');
                        toggle.textContent = showing
                            ? `Hide ${passingCount} passing check${passingCount > 1 ? 's' : ''}`
                            : `Show ${passingCount} passing check${passingCount > 1 ? 's' : ''}`;
                    });
                    entityBody.appendChild(toggle);
                }
                entityHeader.addEventListener('click', () => {
                    const visible = entityBody.style.display !== 'none';
                    entityBody.style.display = visible ? 'none' : 'block';
                    entityHeader.querySelector('.entity-toggle').textContent = visible ? '▶' : '▼';
                });
                entityGroup.appendChild(entityHeader);
                entityGroup.appendChild(entityBody);
                bodyEl.appendChild(entityGroup);
            }
            else {
                for (const result of results) {
                    bodyEl.appendChild(renderCheckResult(result));
                }
            }
        }
    }
    else {
        for (const result of section.results) {
            bodyEl.appendChild(renderCheckResult(result));
        }
    }
    sectionEl.appendChild(headerEl);
    sectionEl.appendChild(bodyEl);
    // Collapse/expand
    let expanded = worstSeverity !== 'pass';
    bodyEl.style.display = expanded ? 'block' : 'none';
    headerEl.querySelector('.section-toggle').textContent = expanded ? '▲' : '▼';
    headerEl.addEventListener('click', () => {
        expanded = !expanded;
        bodyEl.style.display = expanded ? 'block' : 'none';
        headerEl.querySelector('.section-toggle').textContent = expanded ? '▲' : '▼';
    });
    return sectionEl;
}
function renderCheckResult(result) {
    const row = el('div', `check-result ${SEVERITY_CLASSES[result.severity]}`);
    let detailHtml = '';
    if (result.severity !== 'pass') {
        const parts = [];
        if (result.expected)
            parts.push(`<div class="detail-row"><strong>Expected:</strong> ${escapeHtml(result.expected)}</div>`);
        if (result.found)
            parts.push(`<div class="detail-row"><strong>Found:</strong> ${escapeHtml(result.found)}</div>`);
        if (result.fix)
            parts.push(`<div class="detail-row"><strong>Fix:</strong> ${escapeHtml(result.fix)}</div>`);
        if (result.suggestion)
            parts.push(`<div class="detail-row suggestion-row"><strong>Suggested:</strong> <code class="suggestion-value">${escapeHtml(result.suggestion)}</code> <button class="btn btn-copy" data-copy="${escapeHtml(result.suggestion)}" title="Copy to clipboard">Copy</button></div>`);
        if (result.actions?.length) {
            const actionBtns = result.actions.map((a, i) => `<button class="btn btn-action" data-action-index="${i}">${escapeHtml(a.label)}</button>`).join(' ');
            parts.push(`<div class="detail-row action-row">${actionBtns}</div>`);
        }
        if (parts.length > 0) {
            detailHtml = `<div class="check-detail">${parts.join('')}</div>`;
        }
    }
    const linkHtml = result.link
        ? ` <a href="${escapeHtml(result.link)}" target="_blank" rel="noopener" class="check-link" title="Open in new tab">🔗</a>`
        : '';
    row.innerHTML = `
    <span class="check-icon">${SEVERITY_ICONS[result.severity]}</span>
    <div class="check-content">
      <span class="check-name">${escapeHtml(result.name)}</span>
      <span class="check-message">${linkifyPids(escapeHtml(result.message))}${linkHtml}</span>
      ${detailHtml}
    </div>
  `;
    // Expand/collapse detail
    const detail = row.querySelector('.check-detail');
    if (detail) {
        detail.style.display = 'none';
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
        });
        // Copy button handler
        const copyBtn = detail.querySelector('.btn-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = copyBtn.getAttribute('data-copy') ?? '';
                navigator.clipboard.writeText(value).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                });
            });
        }
        // Action button handlers
        const actionBtns = detail.querySelectorAll('.btn-action');
        for (const btn of Array.from(actionBtns)) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.actionIndex, 10);
                const action = result.actions?.[idx];
                if (action && registeredActionHandler) {
                    registeredActionHandler(action.actionId, action.data);
                }
            });
        }
    }
    return row;
}
// --- Settings panel ---
export function renderSettingsPanel(container, settings, knowledgeBase, onSave, onClose) {
    container.innerHTML = '';
    container.style.display = 'block';
    const panel = el('div', 'settings-content');
    function kbSummaryHtml() {
        const people = knowledgeBase.getAllPeople();
        const orgs = knowledgeBase.getAllOrgs();
        const pWithOrcid = people.filter(p => p.orcid).length;
        const pNoOrcid = people.filter(p => p.status === 'no-orcid').length;
        const oWithRor = orgs.filter(o => o.ror).length;
        const oNoRor = orgs.filter(o => o.status === 'no-ror').length;
        return `People: <strong>${people.length}</strong> (${pWithOrcid} with ORCID, ${pNoOrcid} confirmed no ORCID) · Organisations: <strong>${orgs.length}</strong> (${oWithRor} with ROR, ${oNoRor} confirmed no ROR)`;
    }
    panel.innerHTML = `
    <div class="settings-header">
      <h2>Settings</h2>
      <button class="btn btn-icon settings-close">✕</button>
    </div>

    <section class="settings-section">
      <h3>Catalogues</h3>
      <div id="settings-catalogues"></div>
      <button class="btn btn-small" id="settings-add-catalogue">+ Add new</button>
    </section>

    <section class="settings-section">
      <h3>Rule Sections</h3>
      <div id="settings-sections"></div>
    </section>

    <section class="settings-section">
      <h3>External PID Validation</h3>
      <label class="toggle-label">
        <input type="checkbox" id="settings-api-toggle" ${settings.apiValidationEnabled ? 'checked' : ''} />
        Resolve identifiers via external APIs
      </label>
      <p class="help-text">Verifies DOIs, ORCIDs, RORs, and RAiDs resolve. Disable for faster analysis or limited connectivity.</p>
    </section>

    <section class="settings-section">
      <h3>Search Results Page Size</h3>
      <select id="settings-page-size" class="input-field">
        <option value="25" ${settings.searchPageSize === 25 ? 'selected' : ''}>25</option>
        <option value="50" ${settings.searchPageSize === 50 ? 'selected' : ''}>50</option>
        <option value="100" ${settings.searchPageSize === 100 ? 'selected' : ''}>100</option>
        <option value="250" ${settings.searchPageSize === 250 ? 'selected' : ''}>250</option>
        <option value="500" ${settings.searchPageSize === 500 ? 'selected' : ''}>500</option>
      </select>
      <p class="help-text">Number of records returned per CSW search page.</p>
    </section>

    <section class="settings-section">
      <h3>Rate Limiting</h3>
      <select id="settings-rate-limit" class="input-field">
        <option value="500" ${settings.rateLimitMs === 500 ? 'selected' : ''}>0.5 seconds</option>
        <option value="1000" ${settings.rateLimitMs === 1000 ? 'selected' : ''}>1.0 seconds</option>
        <option value="1500" ${settings.rateLimitMs === 1500 ? 'selected' : ''}>1.5 seconds</option>
        <option value="2000" ${settings.rateLimitMs === 2000 ? 'selected' : ''}>2.0 seconds</option>
      </select>
      <p class="help-text">Delay between requests. Protects catalogue servers from overload.</p>
    </section>

    <section class="settings-section">
      <h3>Knowledge Base</h3>
      <p class="help-text kb-summary">${kbSummaryHtml()}</p>
      <p class="help-text">Built automatically from analysed records and PID API lookups. Use View/Edit to review entries and delete incorrect ones.</p>
      <div class="settings-btn-row">
        <button class="btn btn-small" id="kb-view-edit">View / Edit</button>
        <button class="btn btn-small btn-danger" id="kb-clear-all">Clear entire knowledge base</button>
      </div>
    </section>

    <section class="settings-section">
      <h3>Settings Import/Export</h3>
      <button class="btn btn-small" id="settings-export">Export all as JSON</button>
      <button class="btn btn-small" id="settings-import">Import JSON</button>
    </section>
  `;
    container.appendChild(panel);
    // Save function — defined early so catalogue code can use it
    const saveCurrentSettings = () => {
        settings.enabledSections = [];
        panel.querySelectorAll('[data-section]').forEach(el => {
            if (el.checked) {
                settings.enabledSections.push(el.dataset.section);
            }
        });
        settings.apiValidationEnabled = panel.querySelector('#settings-api-toggle').checked;
        settings.rateLimitMs = parseInt(panel.querySelector('#settings-rate-limit').value, 10);
        settings.searchPageSize = parseInt(panel.querySelector('#settings-page-size').value, 10);
        onSave(settings);
    };
    // Render existing catalogues
    const cataloguesDiv = panel.querySelector('#settings-catalogues');
    renderCatalogueList(cataloguesDiv, settings, saveCurrentSettings);
    // Wire up Add Catalogue button
    panel.querySelector('#settings-add-catalogue')?.addEventListener('click', () => {
        const addSection = panel.querySelector('#settings-add-catalogue-form');
        if (addSection) {
            addSection.remove();
            return;
        }
        const form = document.createElement('div');
        form.id = 'settings-add-catalogue-form';
        form.className = 'catalogue-add-form';
        form.innerHTML = `
      <label>Catalogue base URL</label>
      <input type="url" class="input-field" id="new-cat-url" placeholder="https://metadata.imas.utas.edu.au/geonetwork/" />
      <label>Proxy URL (optional)</label>
      <input type="url" class="input-field" id="new-cat-proxy" placeholder="http://localhost:8080/proxy" />
      <div class="catalogue-add-actions">
        <button class="btn btn-primary btn-small" id="new-cat-test">Test Connection & Add</button>
        <button class="btn btn-small" id="new-cat-cancel">Cancel</button>
      </div>
      <div id="new-cat-status" class="connection-status" style="display:none"></div>
    `;
        const addBtn = panel.querySelector('#settings-add-catalogue');
        addBtn.parentNode.insertBefore(form, addBtn.nextSibling);
        form.querySelector('#new-cat-cancel')?.addEventListener('click', () => form.remove());
        form.querySelector('#new-cat-test')?.addEventListener('click', async () => {
            const url = form.querySelector('#new-cat-url').value.trim();
            if (!url)
                return;
            const proxyUrl = form.querySelector('#new-cat-proxy').value.trim() || null;
            const statusEl = form.querySelector('#new-cat-status');
            statusEl.style.display = 'block';
            statusEl.innerHTML = '<p>Testing connection...</p>';
            const client = new CatalogueClient({ url, proxyUrl }, settings.rateLimitMs);
            const result = await client.testConnection();
            renderConnectionStatus(statusEl, result);
            if (result.cors && result.csw) {
                settings.catalogues.push({ url, proxyUrl });
                if (settings.activeCatalogueIndex < 0)
                    settings.activeCatalogueIndex = 0;
                saveCurrentSettings();
                renderCatalogueList(cataloguesDiv, settings, saveCurrentSettings);
                form.remove();
            }
        });
    });
    // Render sections
    const sectionsDiv = panel.querySelector('#settings-sections');
    for (const section of getAllSections()) {
        const wrapper = document.createElement('div');
        wrapper.className = 'settings-toggle-item';
        const label = document.createElement('label');
        label.className = 'toggle-label';
        const checked = settings.enabledSections.includes(section.id);
        label.innerHTML = `<input type="checkbox" data-section="${section.id}" ${checked ? 'checked' : ''} /> ${section.name}`;
        wrapper.appendChild(label);
        const desc = document.createElement('p');
        desc.className = 'help-text settings-item-desc';
        desc.textContent = section.description;
        wrapper.appendChild(desc);
        sectionsDiv.appendChild(wrapper);
    }
    // Close handler
    panel.querySelector('.settings-close')?.addEventListener('click', () => {
        container.style.display = 'none';
        onClose();
    });
    panel.addEventListener('change', saveCurrentSettings);
    // Export
    panel.querySelector('#settings-export')?.addEventListener('click', async () => {
        const { exportAllSettings } = await import('../storage/settings.js');
        const json = exportAllSettings();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'iso-checker-settings.json';
        a.click();
        URL.revokeObjectURL(url);
    });
    // Import
    panel.querySelector('#settings-import')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file)
                return;
            const text = await file.text();
            const { importAllSettings } = await import('../storage/settings.js');
            importAllSettings(text);
            location.reload();
        };
        input.click();
    });
    // KB: View / Edit
    panel.querySelector('#kb-view-edit')?.addEventListener('click', () => {
        renderKnowledgeBaseEditor(container, knowledgeBase, () => {
            // Refresh summary counts when editor closes
            const summary = panel.querySelector('.kb-summary');
            if (summary)
                summary.innerHTML = kbSummaryHtml();
        });
    });
    // KB: Clear all
    panel.querySelector('#kb-clear-all')?.addEventListener('click', () => {
        if (!confirm('Clear the entire knowledge base? This cannot be undone.'))
            return;
        knowledgeBase.clearAll();
        const summary = panel.querySelector('.kb-summary');
        if (summary)
            summary.innerHTML = kbSummaryHtml();
        showToast('Knowledge base cleared.');
    });
}
// --- Knowledge base editor ---
function renderKnowledgeBaseEditor(container, kb, onClose) {
    const overlay = el('div', 'kb-editor-overlay');
    const modal = el('div', 'kb-editor-modal');
    let activeTab = 'people';
    let activeStatusFilter = 'all';
    const csvFormatPeople = `<strong>Format: name, orcid, status, aliases</strong>
<pre class="kb-csv-fields">name     — LastName, FirstName (to match metadata records)
orcid    — ORCID string or empty
status   — "auto" (learned from records or imported with a
             known identifier) or "no-orcid" (confirmed: no ORCID)
aliases  — Pipe-separated alternative names, or empty</pre>
<strong>Example:</strong>
<pre>name,orcid,status,aliases
"Davis, Aaron",0000-0002-8278-9599,auto,
"Bon, Aaron",,no-orcid,
"Lawrey, Eric",0000-0002-1234-5678,auto,Lawrey, E.P.
"Smith, Jane",0000-0001-9876-5432,auto,Smith, J.|Smith, Jane A.</pre>`;
    const csvFormatOrgs = `<strong>Format: name, ror, status, aliases</strong>
<pre class="kb-csv-fields">name     — Organisation name (as it appears in metadata records)
ror      — ROR ID or empty
status   — "auto" (learned from records or imported with a
             known identifier) or "no-ror" (confirmed: no ROR)
aliases  — Pipe-separated alternative names, or empty</pre>
<strong>Example:</strong>
<pre>name,ror,status,aliases
"Australian Institute of Marine Science",03x57gn41,auto,AIMS
"Aerial Architecture",,no-ror,
"James Cook University",04gsp2c11,auto,JCU|TropWATER, James Cook University</pre>`;
    modal.innerHTML = `
    <div class="kb-editor-header">
      <h2>Knowledge Base</h2>
      <button class="btn btn-icon kb-editor-close">✕</button>
    </div>
    <p class="help-text">Built automatically from analysed records and PID API lookups. Use this screen to review entries and delete incorrect ones.</p>
    <div class="kb-editor-tabs">
      <button class="kb-tab-btn active" data-kb-tab="people">People (<span class="kb-people-count">${kb.getAllPeople().length}</span>)</button>
      <button class="kb-tab-btn" data-kb-tab="orgs">Organisations (<span class="kb-orgs-count">${kb.getAllOrgs().length}</span>)</button>
    </div>
    <div class="kb-editor-toolbar">
      <button class="btn btn-small" id="kb-export-csv">Export CSV</button>
      <button class="btn btn-small" id="kb-import-csv">Import CSV</button>
      <div class="kb-import-mode" style="display:none">
        <span class="kb-import-prompt"></span>
        <button class="btn btn-small" id="kb-import-replace">Replace</button>
        <button class="btn btn-small" id="kb-import-merge">Merge</button>
        <button class="btn btn-small" id="kb-import-cancel">Cancel</button>
      </div>
      <details class="kb-csv-format">
        <summary>CSV format</summary>
        <div class="kb-csv-format-content">${csvFormatPeople}</div>
      </details>
    </div>
    <div class="kb-status-filters">
      <button class="kb-status-btn active" data-status-filter="all">All</button>
      <button class="kb-status-btn" data-status-filter="with-id">With ID</button>
      <button class="kb-status-btn" data-status-filter="no-id">Confirmed no ID</button>
      <span class="kb-visible-count"></span>
    </div>
    <div class="kb-editor-filter">
      <input type="text" class="input-field kb-filter-input" placeholder="Filter by name or alias…" />
    </div>
    <div class="kb-tab-panel active" id="kb-panel-people"></div>
    <div class="kb-tab-panel" id="kb-panel-orgs"></div>
  `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    // Close
    const closeEditor = () => {
        overlay.remove();
        onClose();
    };
    modal.querySelector('.kb-editor-close')?.addEventListener('click', closeEditor);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay)
            closeEditor();
    });
    // Tabs
    const tabBtns = modal.querySelectorAll('.kb-tab-btn');
    const panels = modal.querySelectorAll('.kb-tab-panel');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.kbTab;
            activeTab = tabId;
            modal.querySelector(`#kb-panel-${tabId}`)?.classList.add('active');
            // Update CSV format instructions
            const formatContent = modal.querySelector('.kb-csv-format-content');
            formatContent.innerHTML = activeTab === 'people' ? csvFormatPeople : csvFormatOrgs;
            // Reset filters when switching tabs
            modal.querySelector('.kb-filter-input').value = '';
            activeStatusFilter = 'all';
            modal.querySelectorAll('.kb-status-btn').forEach(b => b.classList.remove('active'));
            modal.querySelector('.kb-status-btn[data-status-filter="all"]')?.classList.add('active');
            applyFilters();
        });
    });
    // Render tables
    const peoplePanel = modal.querySelector('#kb-panel-people');
    const orgsPanel = modal.querySelector('#kb-panel-orgs');
    function renderPeopleTable() {
        const people = kb.getAllPeople();
        peoplePanel.innerHTML = '';
        if (people.length === 0) {
            peoplePanel.innerHTML = '<p class="help-text">No people in knowledge base.</p>';
            return;
        }
        const table = el('table', 'kb-table');
        table.innerHTML = `
      <thead><tr>
        <th>Name</th><th>ORCID</th><th>Aliases</th><th></th>
      </tr></thead>
      <tbody></tbody>
    `;
        const tbody = table.querySelector('tbody');
        for (const p of people) {
            const tr = document.createElement('tr');
            tr.dataset.searchText = [p.name, ...p.aliases].join(' ').toLowerCase();
            tr.dataset.status = p.orcid ? 'with-id' : (p.status === 'no-orcid' ? 'no-id' : 'auto-no-id');
            const orcidCell = p.status === 'no-orcid'
                ? '<span class="kb-confirmed">confirmed: no ORCID</span>'
                : p.orcid
                    ? `<a href="https://orcid.org/${escapeHtml(p.orcid)}" target="_blank" rel="noopener">${escapeHtml(p.orcid)}</a>`
                    : '—';
            tr.innerHTML = `
        <td>${escapeHtml(p.name)}${p.registeredName && p.registeredName !== p.name ? ` <span class="kb-canonical">(${escapeHtml(p.registeredName)})</span>` : ''}</td>
        <td>${orcidCell}</td>
        <td class="kb-aliases">${p.aliases.length ? escapeHtml(p.aliases.join(', ')) : '—'}</td>
        <td><button class="btn btn-small btn-danger kb-delete-btn">Delete</button></td>
      `;
            tr.querySelector('.kb-delete-btn')?.addEventListener('click', () => {
                kb.removePerson(p.name);
                renderPeopleTable();
                updateCounts();
                applyFilters();
            });
            tbody.appendChild(tr);
        }
        peoplePanel.appendChild(table);
    }
    function renderOrgsTable() {
        const orgs = kb.getAllOrgs();
        orgsPanel.innerHTML = '';
        if (orgs.length === 0) {
            orgsPanel.innerHTML = '<p class="help-text">No organisations in knowledge base.</p>';
            return;
        }
        const table = el('table', 'kb-table');
        table.innerHTML = `
      <thead><tr>
        <th>Name</th><th>ROR</th><th>Aliases</th><th></th>
      </tr></thead>
      <tbody></tbody>
    `;
        const tbody = table.querySelector('tbody');
        for (const o of orgs) {
            const tr = document.createElement('tr');
            tr.dataset.searchText = [o.name, ...o.aliases].join(' ').toLowerCase();
            tr.dataset.status = o.ror ? 'with-id' : (o.status === 'no-ror' ? 'no-id' : 'auto-no-id');
            const rorCell = o.status === 'no-ror'
                ? '<span class="kb-confirmed">confirmed: no ROR</span>'
                : o.ror
                    ? `<a href="https://ror.org/${escapeHtml(o.ror)}" target="_blank" rel="noopener">${escapeHtml(o.ror)}</a>`
                    : '—';
            tr.innerHTML = `
        <td>${escapeHtml(o.name)}${o.canonicalName && o.canonicalName !== o.name ? ` <span class="kb-canonical">(${escapeHtml(o.canonicalName)})</span>` : ''}</td>
        <td>${rorCell}</td>
        <td class="kb-aliases">${o.aliases.length ? escapeHtml(o.aliases.join(', ')) : '—'}</td>
        <td><button class="btn btn-small btn-danger kb-delete-btn">Delete</button></td>
      `;
            tr.querySelector('.kb-delete-btn')?.addEventListener('click', () => {
                kb.removeOrg(o.name);
                renderOrgsTable();
                updateCounts();
                applyFilters();
            });
            tbody.appendChild(tr);
        }
        orgsPanel.appendChild(table);
    }
    function updateCounts() {
        const pCount = modal.querySelector('.kb-people-count');
        const oCount = modal.querySelector('.kb-orgs-count');
        if (pCount)
            pCount.textContent = String(kb.getAllPeople().length);
        if (oCount)
            oCount.textContent = String(kb.getAllOrgs().length);
    }
    function applyFilters() {
        const searchTerm = modal.querySelector('.kb-filter-input').value.toLowerCase();
        const activePanel = activeTab === 'people' ? peoplePanel : orgsPanel;
        const rows = activePanel.querySelectorAll('.kb-table tbody tr');
        let visible = 0;
        let total = 0;
        rows.forEach(tr => {
            total++;
            const text = tr.dataset.searchText ?? '';
            const status = tr.dataset.status ?? '';
            const matchesSearch = !searchTerm || text.includes(searchTerm);
            const matchesStatus = activeStatusFilter === 'all' ||
                (activeStatusFilter === 'with-id' && status === 'with-id') ||
                (activeStatusFilter === 'no-id' && status === 'no-id');
            const show = matchesSearch && matchesStatus;
            tr.style.display = show ? '' : 'none';
            if (show)
                visible++;
        });
        const countEl = modal.querySelector('.kb-visible-count');
        if (countEl) {
            countEl.textContent = visible < total ? `Showing ${visible} of ${total}` : '';
        }
    }
    // Filter input
    modal.querySelector('.kb-filter-input')?.addEventListener('input', () => {
        applyFilters();
    });
    // Status filter toggles
    modal.querySelectorAll('.kb-status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.kb-status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeStatusFilter = btn.dataset.statusFilter;
            applyFilters();
        });
    });
    // Export CSV — exports only visible (filtered) rows
    modal.querySelector('#kb-export-csv')?.addEventListener('click', () => {
        const activePanel = activeTab === 'people' ? peoplePanel : orgsPanel;
        const visibleRows = activePanel.querySelectorAll('.kb-table tbody tr');
        const items = [];
        const allPeople = activeTab === 'people' ? kb.getAllPeople() : [];
        const allOrgs = activeTab === 'orgs' ? kb.getAllOrgs() : [];
        let idx = 0;
        visibleRows.forEach(tr => {
            if (tr.style.display !== 'none') {
                if (activeTab === 'people' && allPeople[idx]) {
                    const p = allPeople[idx];
                    items.push(`"${csvEscapeField(p.name)}","${csvEscapeField(p.orcid ?? '')}","${p.status}","${csvEscapeField(p.aliases.join('|'))}"`);
                }
                else if (activeTab === 'orgs' && allOrgs[idx]) {
                    const o = allOrgs[idx];
                    items.push(`"${csvEscapeField(o.name)}","${csvEscapeField(o.ror ?? '')}","${o.status}","${csvEscapeField(o.aliases.join('|'))}"`);
                }
            }
            idx++;
        });
        const header = activeTab === 'people' ? 'name,orcid,status,aliases' : 'name,ror,status,aliases';
        const csv = [header, ...items].join('\n');
        const filename = activeTab === 'people' ? 'kb-people.csv' : 'kb-orgs.csv';
        downloadFile(filename, csv, 'text/csv');
    });
    // Import CSV — file picker then mode selection
    let pendingImportText = null;
    const importModeDiv = modal.querySelector('.kb-import-mode');
    const importPrompt = modal.querySelector('.kb-import-prompt');
    modal.querySelector('#kb-import-csv')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file)
                return;
            const text = await file.text();
            // Stage 6: Validate header matches active tab
            const firstLine = text.split(/\r?\n/)[0]?.toLowerCase() ?? '';
            if (activeTab === 'people' && firstLine.includes('ror') && !firstLine.includes('orcid')) {
                showToast('This looks like an organisations CSV. Switch to the Organisations tab to import it.');
                return;
            }
            if (activeTab === 'orgs' && firstLine.includes('orcid') && !firstLine.includes('ror')) {
                showToast('This looks like a people CSV. Switch to the People tab to import it.');
                return;
            }
            pendingImportText = text;
            const typeName = activeTab === 'people' ? 'people' : 'organisations';
            importPrompt.textContent = `Import mode for ${typeName}:`;
            importModeDiv.style.display = 'flex';
        };
        input.click();
    });
    modal.querySelector('#kb-import-replace')?.addEventListener('click', () => {
        if (!pendingImportText)
            return;
        const typeName = activeTab === 'people' ? 'people' : 'organisations';
        if (!confirm(`This will clear all existing ${typeName} and replace them with the imported file. Continue?`))
            return;
        if (activeTab === 'people')
            kb.clearPeople();
        else
            kb.clearOrgs();
        const count = importKbCsv(kb, pendingImportText, activeTab);
        finishImport(count);
    });
    modal.querySelector('#kb-import-merge')?.addEventListener('click', () => {
        if (!pendingImportText)
            return;
        const count = importKbCsv(kb, pendingImportText, activeTab);
        finishImport(count);
    });
    modal.querySelector('#kb-import-cancel')?.addEventListener('click', () => {
        pendingImportText = null;
        importModeDiv.style.display = 'none';
    });
    function finishImport(count) {
        pendingImportText = null;
        importModeDiv.style.display = 'none';
        if (activeTab === 'people')
            renderPeopleTable();
        else
            renderOrgsTable();
        updateCounts();
        applyFilters();
        showToast(`Imported ${count} entries.`);
    }
    renderPeopleTable();
    renderOrgsTable();
    applyFilters();
}
// --- KB CSV import helper ---
function importKbCsv(kb, text, type) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2)
        return 0;
    // Skip header row — use type parameter instead of auto-detecting
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        if (fields.length < 1)
            continue;
        const name = fields[0];
        const identifier = (fields.length > 1 ? fields[1] : '') || null;
        const statusRaw = fields.length > 2 ? fields[2] : 'auto';
        const aliases = (fields.length > 3 && fields[3]) ? fields[3].split('|').filter(a => a.trim()) : [];
        if (!name)
            continue;
        if (type === 'people') {
            kb.addOrUpdatePerson({
                name,
                orcid: identifier,
                registeredName: null,
                status: statusRaw === 'no-orcid' ? 'no-orcid' : 'auto',
                aliases,
                sourceRecords: []
            });
        }
        else {
            kb.addOrUpdateOrg({
                name,
                ror: identifier,
                canonicalName: null,
                status: statusRaw === 'no-ror' ? 'no-ror' : 'auto',
                aliases,
                sourceRecords: []
            });
        }
        count++;
    }
    return count;
}
/** Parse a single CSV line respecting quoted fields */
function parseCsvLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                current += ch;
            }
        }
        else {
            if (ch === '"') {
                inQuotes = true;
            }
            else if (ch === ',') {
                fields.push(current);
                current = '';
            }
            else {
                current += ch;
            }
        }
    }
    fields.push(current);
    return fields;
}
// --- File download helper ---
function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
// --- Batch results ---
// Cross-page selected UUIDs — maintained across pagination
let batchSelectedUuids = new Set();
export function renderBatchSearchResults(container, records, totalMatched, startPosition, pageSize, onPageChange) {
    const area = container.querySelector('#batch-results-area');
    area.style.display = 'block';
    const currentPage = Math.floor((startPosition - 1) / pageSize) + 1;
    const totalPages = Math.ceil(totalMatched / pageSize);
    const rangeStart = startPosition;
    const rangeEnd = Math.min(startPosition + records.length - 1, totalMatched);
    const status = area.querySelector('#batch-search-status');
    status.textContent = `Found ${totalMatched} records. Showing ${rangeStart}–${rangeEnd}.`;
    // On first page, auto-select all visible records
    if (startPosition === 1) {
        batchSelectedUuids = new Set(records.map(r => r.identifier));
    }
    else {
        // New page records default to selected
        for (const rec of records) {
            batchSelectedUuids.add(rec.identifier);
        }
    }
    const tbody = area.querySelector('#batch-table tbody');
    tbody.innerHTML = '';
    for (const rec of records) {
        const isChecked = batchSelectedUuids.has(rec.identifier);
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><input type="checkbox" class="batch-checkbox" data-uuid="${escapeHtml(rec.identifier)}" ${isChecked ? 'checked' : ''} /></td>
      <td>${escapeHtml(rec.title)}</td>
      <td>${escapeHtml(rec.type)}</td>
      <td class="uuid-cell">${escapeHtml(rec.identifier)}</td>
    `;
        tbody.appendChild(tr);
    }
    // Pagination controls
    const paginationEl = area.querySelector('#batch-pagination');
    if (totalPages > 1) {
        paginationEl.style.display = 'flex';
        const prevBtn = area.querySelector('#batch-page-prev');
        const nextBtn = area.querySelector('#batch-page-next');
        const pageInfo = area.querySelector('#batch-page-info');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
        // Clone and replace to remove old listeners
        const newPrev = prevBtn.cloneNode(true);
        const newNext = nextBtn.cloneNode(true);
        prevBtn.replaceWith(newPrev);
        nextBtn.replaceWith(newNext);
        newPrev.addEventListener('click', () => {
            syncPageSelections(area);
            onPageChange(startPosition - pageSize);
        });
        newNext.addEventListener('click', () => {
            syncPageSelections(area);
            onPageChange(startPosition + pageSize);
        });
    }
    else {
        paginationEl.style.display = 'none';
    }
    updateBatchCount(area);
    // Select all (current page only)
    const selectAllCb = area.querySelector('#batch-select-all');
    const newSelectAll = selectAllCb.cloneNode(true);
    selectAllCb.replaceWith(newSelectAll);
    newSelectAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        area.querySelectorAll('.batch-checkbox').forEach(cb => {
            cb.checked = checked;
            const uuid = cb.dataset.uuid;
            if (checked)
                batchSelectedUuids.add(uuid);
            else
                batchSelectedUuids.delete(uuid);
        });
        updateBatchCount(area);
    });
    area.querySelectorAll('.batch-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const checkbox = cb;
            const uuid = cb.dataset.uuid;
            if (checkbox.checked)
                batchSelectedUuids.add(uuid);
            else
                batchSelectedUuids.delete(uuid);
            updateBatchCount(area);
        });
    });
}
/** Sync current page checkbox state into the cross-page selection set */
function syncPageSelections(area) {
    area.querySelectorAll('.batch-checkbox').forEach(cb => {
        const uuid = cb.dataset.uuid;
        if (cb.checked)
            batchSelectedUuids.add(uuid);
        else
            batchSelectedUuids.delete(uuid);
    });
}
function updateBatchCount(area) {
    const countEl = area.querySelector('#batch-selected-count');
    if (countEl)
        countEl.textContent = `${batchSelectedUuids.size} selected`;
    const runBtn = area.querySelector('#batch-run');
    if (runBtn)
        runBtn.disabled = batchSelectedUuids.size === 0;
}
export function getSelectedBatchUuids(_container) {
    return Array.from(batchSelectedUuids);
}
// --- Batch report view ---
export function renderBatchReport(container, reports, condensedGuide, onRecheck) {
    container.innerHTML = '';
    container.className = 'batch-layout';
    // Left panel
    const left = el('div', 'batch-left-panel');
    const right = el('div', 'batch-right-panel');
    const totalCounts = { pass: 0, warning: 0, error: 0, info: 0 };
    for (const r of reports) {
        const c = countSeverities(r.sections);
        totalCounts.pass += c.pass;
        totalCounts.warning += c.warning;
        totalCounts.error += c.error;
        totalCounts.info += c.info;
    }
    // Record-level severity counts (worst severity per record)
    const recordCounts = { pass: 0, warning: 0, error: 0 };
    const reportSeverities = [];
    for (const r of reports) {
        const worst = getWorstSeverityForReport(r);
        const category = worst === 'error' ? 'error' : worst === 'warning' ? 'warning' : 'pass';
        reportSeverities.push(category);
        recordCounts[category]++;
    }
    left.innerHTML = `
    <div class="batch-summary-header">
      <strong>${reports.length} records checked</strong>
      <div class="summary-counts">
        Tests: <span class="count-pass">${SEVERITY_ICONS.pass} ${totalCounts.pass}</span>
        <span class="count-warning">${SEVERITY_ICONS.warning} ${totalCounts.warning}</span>
        <span class="count-error">${SEVERITY_ICONS.error} ${totalCounts.error}</span>
      </div>
      <div class="record-filter-counts">
        Records:
        <label class="filter-checkbox"><input type="checkbox" data-filter="pass" checked /> <span class="count-pass">${SEVERITY_ICONS.pass} ${recordCounts.pass}</span></label>
        <label class="filter-checkbox"><input type="checkbox" data-filter="warning" checked /> <span class="count-warning">${SEVERITY_ICONS.warning} ${recordCounts.warning}</span></label>
        <label class="filter-checkbox"><input type="checkbox" data-filter="error" checked /> <span class="count-error">${SEVERITY_ICONS.error} ${recordCounts.error}</span></label>
      </div>
    </div>
    <div class="batch-record-list"></div>
  `;
    const list = left.querySelector('.batch-record-list');
    for (let i = 0; i < reports.length; i++) {
        const r = reports[i];
        const worst = getWorstSeverityForReport(r);
        const filterCategory = reportSeverities[i];
        const row = el('div', `batch-record-row ${SEVERITY_CLASSES[worst]}`);
        row.dataset.index = String(i);
        row.dataset.severity = filterCategory;
        row.innerHTML = `
      <span class="check-icon">${SEVERITY_ICONS[worst]}</span>
      <span class="batch-record-title">${escapeHtml((r.record.title ?? '(untitled)').substring(0, 50))}</span>
    `;
        row.addEventListener('click', () => {
            list.querySelectorAll('.batch-record-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            renderSelectedRecord(i);
        });
        list.appendChild(row);
    }
    // Render the selected record in the right panel, with recheck support
    let selectedIndex = 0;
    function renderSelectedRecord(index) {
        selectedIndex = index;
        const recheckCb = onRecheck ? async () => {
            await onRecheck(index);
            refreshBatchUi(index);
            renderSelectedRecord(index);
        } : undefined;
        renderRecordReport(right, reports[index], condensedGuide, recheckCb);
    }
    // Update left panel after a recheck
    function refreshBatchUi(index) {
        // Recalculate the row severity
        const newWorst = getWorstSeverityForReport(reports[index]);
        const newCategory = newWorst === 'error' ? 'error' : newWorst === 'warning' ? 'warning' : 'pass';
        reportSeverities[index] = newCategory;
        const row = list.querySelector(`[data-index="${index}"]`);
        if (row) {
            row.className = `batch-record-row ${SEVERITY_CLASSES[newWorst]} active`;
            row.dataset.severity = newCategory;
            row.querySelector('.check-icon').textContent = SEVERITY_ICONS[newWorst];
        }
        // Recalculate all counts from reports
        const newTotalCounts = { pass: 0, warning: 0, error: 0, info: 0 };
        for (const r of reports) {
            const c = countSeverities(r.sections);
            newTotalCounts.pass += c.pass;
            newTotalCounts.warning += c.warning;
            newTotalCounts.error += c.error;
            newTotalCounts.info += c.info;
        }
        const newRecordCounts = { pass: 0, warning: 0, error: 0 };
        for (let j = 0; j < reports.length; j++) {
            const w = getWorstSeverityForReport(reports[j]);
            const cat = w === 'error' ? 'error' : w === 'warning' ? 'warning' : 'pass';
            reportSeverities[j] = cat;
            newRecordCounts[cat]++;
        }
        // Update header counts
        const header = left.querySelector('.batch-summary-header');
        const testCounts = header.querySelector('.summary-counts');
        testCounts.innerHTML = `
      Tests: <span class="count-pass">${SEVERITY_ICONS.pass} ${newTotalCounts.pass}</span>
      <span class="count-warning">${SEVERITY_ICONS.warning} ${newTotalCounts.warning}</span>
      <span class="count-error">${SEVERITY_ICONS.error} ${newTotalCounts.error}</span>
    `;
        // Update record filter count labels (preserve checkbox state)
        const filterLabels = header.querySelectorAll('.filter-checkbox');
        filterLabels.forEach(label => {
            const cb = label.querySelector('input');
            const filter = cb.dataset.filter;
            const span = label.querySelector('span');
            span.className = `count-${filter}`;
            span.textContent = `${SEVERITY_ICONS[filter]} ${newRecordCounts[filter]}`;
        });
    }
    // Filter checkboxes — toggle record visibility by severity
    const filterCheckboxes = left.querySelectorAll('.record-filter-counts input[type="checkbox"]');
    filterCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const visibleSeverities = new Set();
            filterCheckboxes.forEach(fcb => {
                if (fcb.checked)
                    visibleSeverities.add(fcb.dataset.filter);
            });
            let activeHidden = false;
            const rows = list.querySelectorAll('.batch-record-row');
            rows.forEach(row => {
                const show = visibleSeverities.has(row.dataset.severity);
                row.style.display = show ? '' : 'none';
                if (!show && row.classList.contains('active')) {
                    activeHidden = true;
                    row.classList.remove('active');
                }
            });
            // If the active record was hidden, select the first visible record
            if (activeHidden) {
                for (const row of Array.from(rows)) {
                    if (row.style.display !== 'none') {
                        row.classList.add('active');
                        renderSelectedRecord(parseInt(row.dataset.index, 10));
                        break;
                    }
                }
            }
        });
    });
    container.appendChild(left);
    container.appendChild(right);
    // Show first report
    if (reports.length > 0) {
        renderSelectedRecord(0);
        list.querySelector('.batch-record-row')?.classList.add('active');
    }
}
// --- Catalogue list in settings ---
function renderCatalogueList(container, settings, onSave) {
    container.innerHTML = '';
    if (settings.catalogues.length === 0) {
        container.innerHTML = '<p class="help-text">No catalogues configured.</p>';
        return;
    }
    for (let i = 0; i < settings.catalogues.length; i++) {
        const cat = settings.catalogues[i];
        const isActive = i === settings.activeCatalogueIndex;
        const row = el('div', `catalogue-row ${isActive ? 'active' : ''}`);
        row.innerHTML = `
      <label class="toggle-label">
        <input type="radio" name="active-catalogue" value="${i}" ${isActive ? 'checked' : ''} />
        <span class="catalogue-url">${escapeHtml(new URL(cat.url).hostname)}</span>
      </label>
      ${cat.proxyUrl ? `<span class="help-text">Proxy: ${escapeHtml(cat.proxyUrl)}</span>` : ''}
      <button class="btn btn-small catalogue-remove" data-index="${i}">Remove</button>
    `;
        container.appendChild(row);
    }
    // Active selection
    container.querySelectorAll('input[name="active-catalogue"]').forEach(radio => {
        radio.addEventListener('change', () => {
            settings.activeCatalogueIndex = parseInt(radio.value, 10);
            onSave();
        });
    });
    // Remove
    container.querySelectorAll('.catalogue-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            settings.catalogues.splice(idx, 1);
            if (settings.activeCatalogueIndex >= settings.catalogues.length) {
                settings.activeCatalogueIndex = settings.catalogues.length - 1;
            }
            onSave();
            renderCatalogueList(container, settings, onSave);
        });
    });
}
// --- Connection status ---
function renderConnectionStatus(container, result) {
    container.innerHTML = `
    <div class="connection-row ${result.cors ? 'pass' : 'fail'}">CORS: ${result.cors ? 'OK' : 'Blocked'}</div>
    <div class="connection-row ${result.csw ? 'pass' : 'fail'}">CSW: ${result.csw ? 'Available' : 'Unavailable'}</div>
    <div class="connection-row">Response time: ${result.responseTimeMs}ms</div>
    ${result.error ? `<div class="connection-row fail">${escapeHtml(result.error)}</div>` : ''}
  `;
}
// --- Toast notification ---
export function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing)
        existing.remove();
    const toast = el('div', 'toast');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
// --- Helpers ---
function el(tag, className) {
    const e = document.createElement(tag);
    if (className)
        e.className = className;
    return e;
}
function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}
function csvEscapeField(s) {
    return s.replace(/"/g, '""');
}
/**
 * Turn bare PID strings in already-escaped message text into clickable links.
 * Matches DOI (10.xxxxx/...), ORCID (0000-...), ROR (0xxxxxxxx), and RAiD (10.xxxxx/...) patterns.
 */
function linkifyPids(escapedHtml) {
    // DOI / RAiD pattern: 10.NNNNN/suffix (DOIs and RAiDs both use this form)
    escapedHtml = escapedHtml.replace(/\b(10\.\d{4,}\/[^\s"<>&]+)/g, (match) => {
        // RAiD handles use 10.82210 prefix
        const isRaid = match.startsWith('10.82210/');
        const baseUrl = isRaid ? 'https://raid.org/' : 'https://doi.org/';
        return `<a href="${baseUrl}${match}" target="_blank" rel="noopener" class="pid-link">${match}</a>`;
    });
    // ORCID pattern: 0000-0000-0000-0000
    escapedHtml = escapedHtml.replace(/\b(\d{4}-\d{4}-\d{4}-\d{3}[\dX])\b/g, '<a href="https://orcid.org/$1" target="_blank" rel="noopener" class="pid-link">$1</a>');
    // ROR pattern: bare ROR ID (7-9 alphanumeric) after "ROR" mention — too ambiguous to auto-link without context
    return escapedHtml;
}
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function countSeverities(sections) {
    const counts = { pass: 0, error: 0, warning: 0, info: 0 };
    for (const s of sections) {
        for (const r of s.results)
            counts[r.severity]++;
    }
    return counts;
}
function getWorstSeverity(results) {
    if (results.some(r => r.severity === 'error'))
        return 'error';
    if (results.some(r => r.severity === 'warning'))
        return 'warning';
    if (results.some(r => r.severity === 'info'))
        return 'info';
    return 'pass';
}
function getWorstSeverityForReport(report) {
    const all = report.sections.flatMap(s => s.results);
    return getWorstSeverity(all);
}
function groupByEntity(results) {
    const groups = new Map();
    for (const r of results) {
        const key = r.entity ?? '';
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(r);
    }
    return groups;
}
//# sourceMappingURL=ui-renderer.js.map