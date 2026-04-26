# ISO 19115-3 Metadata Checker — UI Design

This document defines the user interface layout and interaction design for the metadata checker. It complements `requirements.md` (functional requirements and validation rules) and `Community-guide.md` (the encoding conventions being validated). The tool is desktop-only with a GeoNetwork-aligned visual style: white and pale grey backgrounds, blue accents, light border-radius on panels. Functional appearance — clarity over decoration.

## 1. First-time setup

When no localStorage settings exist, the tool shows a setup screen instead of the main interface. This runs once.

**Content:**
- Tool name and one-paragraph introduction explaining its purpose
- Prompt for the GeoNetwork catalogue base URL, with:
  - Example URLs (e.g. `https://metadata.imas.utas.edu.au/geonetwork/`)
  - Help text: "This is the URL up to and including /geonetwork/. The tool needs access to the CSW endpoint and XML API."
  - Validation feedback if the URL doesn't look like a GeoNetwork instance (e.g. doesn't end in `/geonetwork/`)
- [Test Connection & Save] button that runs the catalogue diagnostic (see `requirements.md` §12.1)
- Connection test results displayed inline (CORS, CSW, record fetch, response time)
- If CORS fails: guidance text suggesting the proxy, with a field for the proxy URL and a [Re-test with proxy] button
- [Continue] button (enabled after successful test) proceeds to the main interface

After first-time setup, the catalogue URL is stored in settings and does not appear in the main workspace.

## 2. Main interface structure

The main interface has three zones stacked vertically:

1. **Header bar** (sticky) — tool name, settings button
2. **Intro + input area** — introduction text, active catalogue indicator, input tabs
3. **Results area** — record report (single record) or batch results (two-column)

### 2.1. Header bar

Fixed at top of viewport. Contains:
- Tool name: "ISO 19115-3 Metadata Checker"
- [Settings] button (right-aligned) — opens the settings panel

### 2.2. Intro and catalogue indicator

Below the header, always visible. Contains:
- One-sentence description: "Check metadata records for persistent identifier encoding (DOI, ORCID, ROR, RAiD) against the Community Practice Guide."
- Link to documentation / Community Guide
- Active catalogue display: "Active catalogue: metadata.imas.utas.edu.au" — not editable here, links to Settings for changes

### 2.3. Input tabs

Three tabs for different input methods. Only one is active at a time.

**Tab: URL**
- Help text: "Paste a GeoNetwork record URL or search URL."
- Single text input field + [Check] button
- Accepted formats listed below the field: "Accepts: XML API URL, catalogue page URL, or search URL"
- If a search URL is pasted, the tool pre-fills the Batch/Search tab and switches to it automatically (see `requirements.md` §3.1)

**Tab: Paste XML**
- Help text: "Paste a single ISO 19115-3 XML record to check a draft or unpublished record that isn't yet in a catalogue."
- Multi-line text area + [Check] button
- No "View in GeoNetwork" link appears in results (no source URL to link to)

**Tab: Batch / Search**
- Help text: "Review multiple records against the Community Practice Guide. List individual UUIDs, or search your catalogue to find records to review."
- Two sub-areas side by side:
  - **Search:** Search term field, resource type dropdown (All/Dataset/Project/Program), [Search] button
  - **UUID list:** Multi-line text area for pasting UUIDs (one per line), [Fetch Records] button
- Below the input: paginated search results table showing Title, Type, UUID columns with checkboxes
  - Pagination controls: [Previous page] / [Next page] buttons, current page indicator (e.g. "Page 1 of 4"), total matched count
  - Pages are fetched on demand from the catalogue — only the current page is loaded at a time
  - Page size is configurable in settings (25, 50, 100, 250, 500; default 25)
- [Select All] / [Deselect All] buttons (apply to visible page), selected count (across all pages), [Run Checks] button
- Note: "Max 500 records per batch. Rate-limited to protect the server."

## 3. Record report

The record report is the core display used for both single-record and batch viewing. Its layout must not be width-sensitive — it appears full-width in single-record mode and in the right panel (narrower) during batch mode.

### 3.1. Record header

- **Record title** — the title extracted from the metadata record
- **View in GeoNetwork** link — opens the record's catalogue page for editing (only shown when the record came from a URL, not from pasted XML)
- **Record type** — dropdown pre-filled from auto-detection, user can override. Shows "(auto-detected)" label

### 3.2. Summary bar

- Counts: N passed, N warnings, N errors, N info
- [Re-check] — re-downloads the record's XML from GeoNetwork and re-runs all checks (only shown for records loaded from a catalogue URL, not for pasted XML). Supports the workflow of fixing issues in GeoNetwork and verifying the fixes.
- [Copy report] — copies a Markdown-formatted report for the current record to clipboard
- [Copy report + AI context] — copies the report with a condensed encoding-rules context document prepended, suitable for pasting into any LLM for fix suggestions

### 3.3. Check sections

Each validation rule section is a collapsible panel. The section header shows:
- Section name and pass/total count (e.g. "DOI Checks — 2/3 pass")
- Worst severity icon for the section

Below the section header (visible when expanded):
- 1–2 sentence description of what this section checks
- List of individual checks, each showing:
  - Status icon (pass/warning/error/info)
  - Check name
  - For failures: expandable detail box with expected vs found values and fix guidance

**ROR and ORCID sections** group checks by entity (one sub-group per organisation or person found in the record). Each entity sub-group shows:
- Entity name as a sub-heading (e.g. "── Australian Institute of Marine Science ──")
- Encoding checks for that entity
- Name-vs-canonical-name check (if API validation is enabled and the identifier resolved)
- Knowledge base suggestions (v3):
  - If the entity has no identifier but the knowledge base has a suggestion: show the suggested identifier with a [Copy] button and the source record it was learned from
  - If there is a name conflict (same name, multiple identifiers in the knowledge base): show a caution message listing the conflicting identifiers and source records
  - [Confirm: this person/org has no ORCID/ROR] button — suppresses warnings across all records for this entity

**ORCID name matching logic:** The ORCID API returns separate `family-name` and `given-names` fields. The tool synthesises the expected metadata name as `"{family-name}, {given-names}"` and compares it to the record's name. A match on family name is sufficient for a pass; significant divergence (different family name or completely different given name) produces a warning with the suggested name and a [Copy] button.

**Section list** (each with a short description visible when expanded):
- DOI Checks — DOI presence and encoding in citation identifier
- RAiD Checks — RAiD presence in correct location (citation for projects, associated resource for datasets)
- ROR Checks — ROR encoding, consistency, and organisation name matching
- ORCID Checks — ORCID encoding, consistency, and person name matching
- People & Organisation Structure — responsible party structure, name formatting, roles, contacts
- Hierarchy & Structure — parentMetadata and metadataScope
- Licensing & Citation — legal constraints, CC licence, citation statement
- Template Placeholders — unresolved template markers (**) in text fields
- NESP Conventions — NESP MaC title patterns and standard links (disabled by default, optional profile)

## 4. Batch results

When batch checks complete, the layout becomes two-column. The left panel can be hidden to return to full-width.

### 4.1. Left panel

**Batch header** (above the record list):
- Total records checked
- Test-level severity counts: total pass/warning/error across all individual checks
- Record-level severity counts with filter checkboxes:
  ```
  100 records checked
  Tests: ✓ 4560 ⚠ 377 ✗ 117
  Records: [x] ✓ 4 [x] ⚠ 6 [x] ✗ 90
  ```
  Unchecking a record-level checkbox hides records of that severity from the list below. For example, unchecking ✓ hides all-passing records so the user can focus on records that need attention.
- [Copy full report] — copies a Markdown report covering all records

**Record list:**
- Scrollable list of records — each row shows worst severity icon and truncated title
- Active record is highlighted
- Filtered by the severity checkboxes above
- [Hide panel] button — collapses to full-width

### 4.2. Right panel

Displays the full record report (§3) for the selected record.

## 5. Knowledge base update notifications

When the user interacts with knowledge base controls during record review (confirming "no ORCID", or the tool learns an identifier from a new record), a brief dismissible notification appears:
- What changed (e.g. "'Smith, Jane' marked as having no ORCID")
- How many other records in the current batch are affected
- Reminder that re-running the batch via [Run Checks] or using per-record [Re-check] will show updated results

Re-analysis is always manual — the user triggers it when ready via the existing [Run Checks] button (for all records) or per-record [Re-check] (for individual records).

## 6. Settings panel

Opens as a slide-in panel from the right edge. The user stays in context with the main interface visible behind.

### 6.1. Catalogues

- List of configured catalogues, each showing: URL, connection status (CORS/CSW/Fetch/response time), proxy URL (if configured)
- Radio button to select the active catalogue
- [+ Add new] to add another catalogue (shows URL field + proxy field + [Test Connection])
- Each catalogue has [Re-test connection] and [Remove] buttons
- Proxy URL is per-catalogue

### 6.2. Rule sections

- Checkbox per section with a 1-line description of what the section checks:
  - DOI Checks — "Validates DOI presence and encoding in citation identifier."
  - RAiD Checks — "Validates RAiD in citation (projects) or associated resource (datasets)."
  - ROR Checks — "Validates ROR in partyIdentifier and onlineResource for organisations."
  - ORCID Checks — "Validates ORCID in partyIdentifier and onlineResource for individuals."
  - People & Organisation Structure — "Checks responsible party structure, name format, roles."
  - Hierarchy & Structure — "Checks for parentMetadata and metadataScope."
  - Licensing & Citation — "Checks for legal constraints, CC licence, citation statement."
  - Template Placeholders — "Detects unresolved template markers (**) in text fields."
  - Optional Element Checks — "Checks for mcc:description on identifier elements. Disabled by default."

### 6.4. External PID validation

- Toggle: "Resolve identifiers via external APIs"
- Description: "Verifies DOIs (DataCite), ORCIDs, RORs, and RAiDs resolve. ROR and ORCID checks also compare names against registry records. Disable if you have limited connectivity or want faster analysis."

### 6.5. Rate limiting

- Dropdown: delay between requests (0.5–2.0 seconds, default 0.5)
- Description: "Protects catalogue servers from overload during batch operations."

### 6.5a. Search results page size

- Dropdown: records per page (25, 50, 100, 250, 500; default 25)
- Description: "Number of records shown per page in catalogue search results. Smaller values keep the search results compact; use larger values when selecting records for bulk analysis."

### 6.6. PID cache

- Display: number of cached identifiers
- [Clear Cache] button
- Description: "Cached API results avoid repeated lookups. Clear to force fresh resolution."

### 6.7. Knowledge base

- Summary: People count (with ORCID / confirmed no ORCID / conflicts), Org count (with ROR / confirmed no ROR)
- [View / Edit] — opens the knowledge base editor (see §7)
- [Clear entire knowledge base] with confirmation
- Description: "Built automatically from analysed records and PID API lookups. Use View/Edit to review, import, export, and delete entries."

### 6.8. Settings import/export

- [Export all as JSON] / [Import JSON]
- Description: "Includes catalogues, rule settings, PID cache, and knowledge base. Share with team members."

## 7. Knowledge base editor

Opened from Settings → Knowledge Base → [View / Edit]. Displayed as a modal or sub-panel.

### 7.1. Design principles

- **No manual data entry.** The knowledge base is populated automatically from analysed records and PID API responses. There is no "Add" button.
- **Editor is for cleanup only.** Users can review what was learned, delete individual entries, or clear all.
- **Designed to be rebuilt cheaply.** If the knowledge base gets polluted by bad records, deleting entries and re-analysing is the expected workflow.

### 7.2. Layout

- Introductory text: "The knowledge base is built automatically from analysed records and PID API lookups. Use this screen to review entries and delete incorrect ones."
- Two tabs: **People** and **Organisations**, each showing entry count
- **Import/Export buttons** below the tabs, context-sensitive to the active tab:
  - [Export CSV] — downloads the current tab's data as CSV
  - [Import CSV] — opens a file picker, then prompts for import mode:
    - **Replace** — clears all existing entries of that type (people or orgs), then imports. Shows a confirmation warning before proceeding.
    - **Merge** — imports row by row. If a name matches an existing entry, the imported row overwrites it.
  - Expandable "CSV format" instructions section (collapsed by default) showing the expected format and a two-row example (see §7.4)
- **Filter toggles**: "Show: All / With ID / Confirmed no ID" — filters the table by status. Active filter is reflected in the visible entry count.
- Search field to filter entries by name or alias substring
- Table with columns:

**People tab:**
| Column | Content |
|--------|---------|
| Name | Primary name (canonical from ORCID API, else most common spelling) |
| ORCID | Identifier or "— (no ORCID)" or "confirmed: no ORCID" |
| Aliases | Comma-separated list of other name strings seen with same ORCID |
| Actions | [Delete] button |

**Organisations tab:**
| Column | Content |
|--------|---------|
| Name | Primary name (canonical from ROR API, else most common spelling) |
| ROR | Identifier or "— (no ROR)" or "confirmed: no ROR" |
| Aliases | Comma-separated list of other name strings seen with same ROR |
| Actions | [Delete] button |

- Conflict rows are marked with a warning icon and explanatory text (e.g. "Possible conflict: same name, different ORCID")
- [Clear all] button per tab, with confirmation

### 7.3. Primary name selection

When multiple name strings share the same identifier, the primary name is set to:
1. The canonical name from the PID API (ROR display name, or ORCID `family-name, given-names`), if available
2. Otherwise, the most frequently encountered name string

### 7.4. CSV format

Import and export use the same format. Import is lossless — exported CSV can be re-imported to restore the knowledge base. The same format supports bulk upload of people without ORCIDs or organisations without RORs from external spreadsheets.

**People:** `name, orcid, status, aliases`
- `name`: Primary name (LastName, FirstName format to match metadata records)
- `orcid`: ORCID string or empty
- `status`: `auto` (learned from analysed records or imported with a known identifier) or `no-orcid` (confirmed this person has no ORCID)
- `aliases`: Pipe-separated list of alternative name strings for the same person, or empty. Use `|` to separate multiple aliases.

Example (shown in the expandable instructions):
```
name,orcid,status,aliases
"Davis, Aaron",0000-0002-8278-9599,auto,
"Bon, Aaron",,no-orcid,
"Lawrey, Eric",0000-0002-1234-5678,auto,Lawrey, E.P.
"Smith, Jane",0000-0001-9876-5432,auto,Smith, J.|Smith, Jane A.
```

**Organisations:** `name, ror, status, aliases`
- `name`: Organisation name (as it appears in metadata records)
- `ror`: ROR ID or empty
- `status`: `auto` (learned from analysed records or imported with a known identifier) or `no-ror` (confirmed this organisation has no ROR)
- `aliases`: Pipe-separated list of alternative name strings for the same organisation, or empty

Example:
```
name,ror,status,aliases
"Australian Institute of Marine Science",03x57gn41,auto,AIMS
"Aerial Architecture",,no-ror,
"James Cook University",04gsp2c11,auto,JCU|TropWATER, James Cook University
```

The `orcid`/`ror` and `aliases` fields may be empty. For a no-identifier import list, only `name` and `status` are required (with empty identifier and aliases columns).

## 8. Markdown report export

Two clipboard-copy options are available on every record report.

### 8.1. Copy report

Generates a structured Markdown report for the current record:

```
# Metadata Check Report
**Record:** {title}
**UUID:** {uuid}
**Type:** {Dataset|Project|Program}
**Checked:** {date}

## Summary
- {N} passed, {N} warnings, {N} errors, {N} info

## {Section name} ({pass}/{total} pass)
- ✓ {check name}
- ✗ **{check name}**
  - Expected: {value}
  - Found: {value}
  - Fix: {guidance}
...
```

### 8.2. Copy report + AI context

Prepends a condensed encoding-rules document to the report. This document is maintained as a standalone file in the project repository — a "skill" version of the Community Guide focused on encoding rules and fix guidance, not the full guide. The combined output is structured as:

1. Context section: encoding conventions for DOI, ORCID, ROR, RAiD in ISO 19115-3
2. The record's error/warning report (as above)
3. A request: "Review the errors and warnings above and suggest specific fixes, including corrected XML where applicable."

Users paste this into any LLM they have access to (ChatGPT, Claude, Gemini, Copilot, local models). The tool does not integrate with any specific LLM service.

## 9. Record analysis flow

This describes the sequence of operations when a record is analysed, showing how PID resolution, knowledge base lookups, and caching interact. All external API calls use the PID cache — if an identifier has been resolved before, the cached result is used with no new API call.

```
Record XML loaded
     │
     ├─ Extract people and organisations from responsible parties
     │
     ├─ For each organisation with a ROR in the record:
     │    ├─ Check ROR encoding (structural checks)
     │    ├─ Resolve ROR via API if not in PID cache → cache result
     │    │  (returns canonical name, stored alongside resolution result)
     │    ├─ Compare record org name ↔ canonical name → error if mismatch
     │    ├─ Update knowledge base: associate org name + ROR + canonical name
     │    └─ Record any new aliases (name strings seen with this ROR
     │       that differ from the canonical name)
     │
     ├─ For each organisation WITHOUT a ROR:
     │    ├─ Look up name in knowledge base (exact match or known alias)
     │    ├─ If known alias for a ROR → suggest ROR + canonical name
     │    ├─ If no exact match → fuzzy search (substring/containment)
     │    │  ├─ If near-match found → suggest with [Add as alias] button
     │    │  └─ If no near-match → standard "no ROR" warning
     │    └─ If confirmed "no ROR" in knowledge base → suppress warning
     │
     ├─ For each person with an ORCID in the record:
     │    ├─ Check ORCID encoding (structural checks)
     │    ├─ Resolve ORCID via API if not in PID cache → cache result
     │    │  (returns family-name + given-names, stored alongside
     │    │   resolution result)
     │    ├─ Synthesise expected name: "{family-name}, {given-names}"
     │    ├─ Compare record name ↔ synthesised name → warn if inconsistent
     │    ├─ Update knowledge base: associate person name + ORCID
     │    │  + registered name
     │    └─ Record any new aliases
     │
     ├─ For each person WITHOUT an ORCID:
     │    ├─ Look up name in knowledge base (exact match or known alias)
     │    ├─ If exact match with one known ORCID → suggest it
     │    ├─ If name matches but multiple ORCIDs → warn about conflict
     │    ├─ If known alias for an ORCID → suggest it (note alias)
     │    ├─ If no exact match → fuzzy search (substring/containment)
     │    │  ├─ If near-match found → suggest with [Add as alias] button
     │    │  └─ If no near-match → standard "no ORCID" warning
     │    └─ If confirmed "no ORCID" in knowledge base → suppress warning
     │
     ├─ Run DOI checks
     ├─ Run RAiD checks
     ├─ Run people & org structure checks
     ├─ Run hierarchy & structure checks
     ├─ Run licensing & citation checks
     ├─ Run template placeholder checks
     └─ Run optional profile checks (NESP, etc.)
```

## 10. Knowledge base alias behaviour

Aliases are learned by observation, not data entry. The rules:

1. **Aliases form when the same identifier appears with different name strings across records.** If Record A has "Australian Institute of Marine Science" with ROR 03x57gn41, and Record B has "Australian Institute of Marine Science (AIMS)" with the same ROR, then "Australian Institute of Marine Science (AIMS)" becomes an alias.

2. **Canonical names are the "truth".** The primary name for a knowledge base entry is always the PID API canonical name when available (ROR display name, ORCID family+given). All other name strings associated with that identifier are aliases.

3. **Near-match as fallback.** When no exact or alias match exists, the tool checks for near-matches using substring/containment matching (one string contains the other, case-insensitive). Near-matches are shown as suggestions with an [Add as alias] button rather than being treated as automatic associations. The user confirms the match before it is stored, preventing false associations. A name is automatically associated with an identifier only when both appear together in the same record.

4. **Alias suggestions are advisory.** When a record contains a name that matches a known alias, the tool suggests the associated identifier. The user decides whether the suggestion applies — it may be a genuine match or a coincidental name overlap.

5. **Conflicts are surfaced, not resolved.** If "Smith, Jane" appears with ORCID A in one record and ORCID B in another, both are stored as separate knowledge base entries. During review, if a record has "Smith, Jane" without an ORCID, both possibilities are shown with a conflict warning.
