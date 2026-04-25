// UI rendering — builds and manages all DOM elements
// Implements ui-design.md §1–§6
import { getAllSections } from '../rules/rule-registry.js';
import { generateMarkdownReport, generateAiContextReport, copyToClipboard } from './report-export.js';
import { CatalogueClient } from '../catalogue/catalogue-client.js';
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
    <h1>ISO 19115-3 Metadata Checker</h1>
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
export function renderRecordReport(container, report, condensedGuide) {
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
    }
    return row;
}
// --- Settings panel ---
export function renderSettingsPanel(container, settings, onSave, onClose) {
    container.innerHTML = '';
    container.style.display = 'block';
    const panel = el('div', 'settings-content');
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
}
// --- Batch results ---
export function renderBatchSearchResults(container, records, totalMatched) {
    const area = container.querySelector('#batch-results-area');
    area.style.display = 'block';
    const status = area.querySelector('#batch-search-status');
    status.textContent = `Found ${totalMatched} records. Showing first ${records.length}.`;
    const tbody = area.querySelector('#batch-table tbody');
    tbody.innerHTML = '';
    for (const rec of records) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><input type="checkbox" class="batch-checkbox" data-uuid="${escapeHtml(rec.identifier)}" checked /></td>
      <td>${escapeHtml(rec.title)}</td>
      <td>${escapeHtml(rec.type)}</td>
      <td class="uuid-cell">${escapeHtml(rec.identifier)}</td>
    `;
        tbody.appendChild(tr);
    }
    updateBatchCount(area);
    // Select all
    area.querySelector('#batch-select-all')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        area.querySelectorAll('.batch-checkbox').forEach(cb => cb.checked = checked);
        updateBatchCount(area);
    });
    area.querySelectorAll('.batch-checkbox').forEach(cb => {
        cb.addEventListener('change', () => updateBatchCount(area));
    });
}
function updateBatchCount(area) {
    const checked = area.querySelectorAll('.batch-checkbox:checked').length;
    const countEl = area.querySelector('#batch-selected-count');
    if (countEl)
        countEl.textContent = `${checked} selected`;
    const runBtn = area.querySelector('#batch-run');
    if (runBtn)
        runBtn.disabled = checked === 0;
}
export function getSelectedBatchUuids(container) {
    const uuids = [];
    container.querySelectorAll('.batch-checkbox:checked').forEach(cb => {
        const uuid = cb.dataset.uuid;
        if (uuid)
            uuids.push(uuid);
    });
    return uuids;
}
// --- Batch report view ---
export function renderBatchReport(container, reports, condensedGuide, onSelect) {
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
    left.innerHTML = `
    <div class="batch-summary-header">
      <strong>${reports.length} records checked</strong>
      <div class="summary-counts">
        <span class="count-pass">${SEVERITY_ICONS.pass} ${totalCounts.pass}</span>
        <span class="count-warning">${SEVERITY_ICONS.warning} ${totalCounts.warning}</span>
        <span class="count-error">${SEVERITY_ICONS.error} ${totalCounts.error}</span>
      </div>
    </div>
    <div class="batch-record-list"></div>
  `;
    const list = left.querySelector('.batch-record-list');
    for (let i = 0; i < reports.length; i++) {
        const r = reports[i];
        const worst = getWorstSeverityForReport(r);
        const row = el('div', `batch-record-row ${SEVERITY_CLASSES[worst]}`);
        row.innerHTML = `
      <span class="check-icon">${SEVERITY_ICONS[worst]}</span>
      <span class="batch-record-title">${escapeHtml((r.record.title ?? '(untitled)').substring(0, 50))}</span>
    `;
        row.addEventListener('click', () => {
            list.querySelectorAll('.batch-record-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            onSelect(i);
        });
        list.appendChild(row);
    }
    container.appendChild(left);
    container.appendChild(right);
    // Show first report
    if (reports.length > 0) {
        renderRecordReport(right, reports[0], condensedGuide);
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
function showToast(message) {
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