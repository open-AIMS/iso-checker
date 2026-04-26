# ISO 19115-3 Metadata Checker — Requirements

## 1. Purpose

A client-side web tool that checks ISO 19115-3 metadata records for completeness and correctness of persistent identifier (PID) encoding, following the conventions in the Community Practice Guide. The primary problem it solves: with many fields to populate across DOI, ORCID, ROR, and RAiD, it is easy to miss identifiers or encode them inconsistently. The tool provides a fast, structured report of what is present, what is missing, and what is incorrectly formed.

This document defines the functional requirements and validation rules. See `ui-design.md` for the user interface layout and interaction design, and `Community-guide.md` for the encoding conventions being validated.

## 2. Target catalogues

The tool supports any GeoNetwork 3.x or 4.x instance that exposes the standard XML API and CSW endpoints. Development and testing targets four catalogues that are most likely to adopt the Community Practice Guide:

- eAtlas GeoNetwork: `https://catalogue.eatlas.org.au/geonetwork/`
- IMAS GeoNetwork: `https://metadata.imas.utas.edu.au/geonetwork/`
- Geoscience Australia GeoNetwork: `https://ecat.ga.gov.au/geonetwork/`
- NCI GeoNetwork: `https://geonetwork.nci.org.au/geonetwork/`

Other GeoNetwork instances should work without modification provided they expose CSW and the XML API.

## 3. Input methods

### 3.1. URL input

User provides a GeoNetwork record URL. The tool accepts two forms:

- **XML API:** `https://{host}/geonetwork/srv/api/records/{uuid}/formatters/xml`
- **Human page:** `https://{host}/geonetwork/srv/eng/catalog.search#/metadata/{uuid}`

The tool extracts the catalogue base URL and UUID, then fetches the XML via `/srv/api/records/{uuid}/formatters/xml`. UUIDs are the standard identifier; some catalogues (e.g. GA) use alternate IDs in human-readable URLs but accept UUIDs in the XML API via redirects.

If the user pastes a GeoNetwork search URL (`catalog.search#/search?any={term}...`), the tool extracts the catalogue base URL, pre-fills the search field with the `any=` term, and applies any `resourceType` filter, transitioning into catalogue search mode (see §3.3).

### 3.2. Pasted XML

User pastes raw ISO 19115-3 XML for a single record into a text area. This supports checking unpublished or draft records.

### 3.3. Batch mode via CSW

Batch mode discovers and processes multiple records from a GeoNetwork catalogue. Input methods:

- **UUID list:** User provides UUIDs (one per line) plus a catalogue base URL. Each record is fetched via the XML API.
- **Catalogue search:** The tool provides a built-in search interface. The user enters a catalogue base URL, a search term, and optionally selects a resource type filter (dataset, project, program). The tool queries CSW GetRecords and displays a preview of matching records — showing the total count and the first page of results with titles — before the user starts the review. This avoids the need to search in GeoNetwork's UI and copy URLs.
- **Search URL shortcut:** If the user pastes a GeoNetwork search URL into the URL input field (§3.1), the tool pre-fills the catalogue search fields and queries CSW automatically.

#### Record preview before processing

After a CSW search, the tool displays the total number of matching records and a paginated listing of record titles, UUIDs, and resource types. The first page is loaded immediately; subsequent pages are fetched on demand when the user clicks [Next page] or [Previous page]. This avoids loading hundreds of records upfront when the user may only need the first page.

The page size is configurable in settings (25, 50, 100, 250, or 500 records per page; default 25). A smaller default keeps the search results compact and reduces vertical space before the [Run Checks] button, which suits the common case of reviewing a small number of records. Larger page sizes are available for bulk analysis workflows.

The user reviews the listing and confirms before the tool begins fetching full records and running validation. This prevents accidental processing of thousands of records. If a search returns zero results, the tool displays "No matching records" rather than an empty table.

The search preview uses `ElementSetName=brief` in the CSW request, which returns `dc:identifier`, `dc:title`, and `dc:type` — the minimum fields needed for the listing. Testing showed `brief` responses are up to 13× smaller than `summary` responses, significantly reducing server load.

#### CSW as the search mechanism

All search and discovery uses the OGC CSW endpoint (`GET /srv/eng/csw`). This was chosen after pre-development testing showed that:

- CSW works across all GeoNetwork versions (3.x and 4.x) using GET requests only.
- The GeoNetwork REST search endpoint (`POST /srv/api/search`) requires CSRF tokens for cross-origin requests and does not exist on GeoNetwork 3.x. It is not suitable for third-party browser applications.
- OGC XML Filters must be used instead of CQL. GeoNetwork's CQL parser passes constraints through Java's `String.format()`, which interprets `%` as a format specifier and causes crashes on many search terms. OGC XML Filters use `*` wildcards and work reliably.

CSW responses use `dc:identifier` for record UUIDs and `numberOfRecordsMatched` for total counts. Pagination uses `startPosition` and `maxRecords` parameters. CSW can return HTTP 200 with an `ows:ExceptionReport` XML body instead of an error status code — response parsing must check for `ExceptionReport` elements regardless of HTTP status.

Resource type filtering uses the OGC Filter property name `type` (e.g. `<ogc:PropertyIsEqualTo><ogc:PropertyName>type</ogc:PropertyName><ogc:Literal>dataset</ogc:Literal></ogc:PropertyIsEqualTo>`). Pre-development testing confirmed that `type` works identically on all four target catalogues, including combined `AnyText + type` filters. No runtime probing of property names is needed.

#### Rate limiting and record caps

To avoid placing excessive load on catalogue servers, the tool rate-limits **all** requests to the catalogue server — including CSW search queries, not just individual record fetches. Pre-development throughput testing showed that rapid CSW requests can destabilise slower servers (IMAS became unreachable during testing). The tool enforces:

- **Rate limit:** Default 0.5 second delay between requests, configurable from 0.5 to 2 seconds in settings.
- **Search results page size:** Configurable in settings (25, 50, 100, 250, 500 records per page; default 25). This controls the `maxRecords` parameter in CSW GetRecords requests for search preview listings. Pages beyond the first are fetched on demand. Testing showed some catalogues fail at `maxRecords=1000`; 500 is the maximum offered.
- **Record cap:** Maximum 500 records per batch run. If a search matches more than 500 records, the user is informed of the total and must narrow their search or process in batches.

#### CORS and proxy fallback

Pre-development CORS testing confirmed that IMAS, GA, and NCI GeoNetwork instances support CORS natively. The eAtlas does not currently support CORS but will be configured to do so; in the interim it is accessible via the Python proxy (see §13).

CORS detection requires a multi-step probe because browsers report CORS blocks and server outages identically (`TypeError: Failed to fetch` with no response object). The tool first attempts the target CSW endpoint, then — if that fails — makes a control request to a known-working catalogue to distinguish "CORS blocked" from "server unreachable". The error message to the user should say "CORS blocked or server unreachable" and suggest both the proxy and checking the server status.

## 4. Record type detection

The community guide defines three kinds of ISO 19115-3 records — Dataset, Project, and Program — each with different required identifiers and conventions. For example, dataset records require a DOI in the citation identifier and a RAiD in an associated resource, while project records require a RAiD in the citation identifier. Many checks are conditional on the record type, so it must be determined before validation runs.

The tool auto-detects the record type using:

1. **`mdb:metadataScope` value** — primary detection. The community guide specifies scope codes: `dataset` for datasets, `fieldSession` for projects, and `series` for programs (see Community Guide §5.7).
2. **Title pattern** — fallback heuristic. Project records follow the pattern `{Program} Project {Code} - {Title} ({Orgs})` and dataset records follow `{Title} ({Program} {Code}, {Orgs})` (see Community Guide §5.3). The tool checks for these patterns if the scope code is absent or ambiguous.
3. **User override** — auto-detection pre-selects the record type in a dropdown, but the user can change it at any time. This is necessary for records that lack a scope code or use non-standard titles.

Record types: **Dataset**, **Project**, **Program**. The set of checks applied differs by type.

## 5. Validation rule architecture

Terminology: **rule** = a single validation check (e.g. "DOI present in citation identifier"). **Rule section** = a group of related rules (e.g. "DOI encoding"). **Rule module** = a source file containing one rule section.

### 5.1. Rule modules

Each rule section (DOI checks, RAiD checks, ROR checks, ORCID checks, People & structure, Hierarchy, Licensing, Template placeholders) is implemented in its own TypeScript source file — one file per section. This is the rule module. The generic checks in sections 6.1–6.9 each correspond to one rule module.

Community-specific rule sections (e.g. NESP title conventions in section 7) are additional rule modules. Other organisations (eAtlas, IMAS) can add their own checks by contributing a new rule module file.

In the settings UI, users can enable or disable entire rule sections or individual rules within a section. Selections are saved to local storage.

### 5.2. Severity levels

Each check produces one of:

| Severity | Meaning | Colour |
|---|---|---|
| **Pass** | Check satisfied | Green |
| **Error** | Definitely wrong — structural encoding error, inconsistency, or missing required identifier | Red |
| **Warning** | Likely missing but may be legitimately absent — e.g. missing ORCID (person may not have one), missing parentMetadata (standalone dataset) | Orange |
| **Info** | Optional element absent — e.g. missing `mcc:description` on identifiers | Grey/blue |

## 6. Generic checks

### 6.1. DOI checks (dataset records)

- DOI present in `cit:identifier` with `codeSpace` = `doi.org` → error if missing
- DOI value is bare string (no `https://doi.org/` prefix) → error
- `gcx:Anchor` href is `https://doi.org/{DOI}` and matches the value → error if mismatched
- DOI resolves via DataCite API (toggleable) → warning if unresolvable

### 6.2. RAiD checks

**Project records:**
- RAiD present in `cit:identifier` with `codeSpace` = `raid.org` → error if missing
- RAiD value is bare string (no `https://raid.org/` prefix) → error
- Anchor href matches → error if mismatched

**Dataset records:**
- RAiD present in `mri:associatedResource` → error if missing
- `associationType` = `dependency` and `initiativeType` = `project` → error if wrong
- RAiD codeSpace and value encoding correct → error

**Both:** RAiD resolves (toggleable) → warning if unresolvable

### 6.3. ROR checks (all record types)

For each `cit:CI_Organisation`:

- ROR in `cit:partyIdentifier` with `codeSpace` = `ror.org` → warning if missing (org may not have one)
- ROR also in `cit:onlineResource` for GeoNetwork display → warning if missing but partyIdentifier present
- If ROR present in one location but not the other → error (inconsistent encoding)
- ROR value is bare string (no `https://ror.org/` prefix) → error
- Anchor href matches → error if mismatched
- ROR resolves and organisation name matches canonical ROR name (toggleable; requires API validation enabled) → error if name mismatch, warning if unresolvable
- Organisation name is a known alias for a ROR not listed in the record (knowledge base, v3) → warning with suggestion

### 6.4. ORCID checks (all record types)

For each `cit:CI_Individual`:

- ORCID in `cit:partyIdentifier` with `codeSpace` = `orcid.org` → warning if missing (person may not have one)
- ORCID also in `cit:onlineResource` for GeoNetwork display → warning if missing but partyIdentifier present
- If ORCID present in one location but not the other → error (inconsistent encoding)
- ORCID value is bare string → error
- Anchor href matches → error if mismatched
- ORCID resolves (toggleable; requires API validation enabled) → warning if unresolvable
- Person name consistent with ORCID registered name (requires API validation enabled) → warning if family name differs, with suggested canonical form
- Person name is a known alias for an ORCID not listed in the record (knowledge base, v3) → warning with suggestion
- Same name appears with different ORCIDs across records (knowledge base, v3) → warning (conflict)

### 6.5. People and organisation structure

- Each `citedResponsibleParty` contains one organisation and one individual nested as `CI_Organisation/cit:individual/cit:CI_Individual` → error if multiple individuals per block
- Individual without an organisation → warning (rare but valid)
- At least one `principalInvestigator` role in cited responsible parties → warning
- `pointOfContact` present → warning if missing
- `pointOfContact` has email address → error if pointOfContact exists but lacks email
- Names formatted as "Family, Given" (contains comma) → warning if no comma
- No title prefixes (Dr, Prof, Professor, Mr, Mrs, Ms, Miss, Sir, Dame, Rev) → warning

### 6.6. Hierarchy and structure

- `parentMetadata` UUID present → warning (standalone datasets are valid)
- `metadataScope` present → warning

### 6.7. Licensing and citation (dataset records)

- Legal constraints present → warning
- Creative Commons licence or licence URL present → warning
- "Other constraints" contains a citation statement → warning

### 6.8. Optional element checks (toggleable via settings)

- `mcc:description` present on identifier elements → info if missing
- Disabled by default; can be enabled in settings for repositories that use them

### 6.9. Template placeholder detection

Metadata templates (e.g. the eAtlas default template) pre-fill fields with example values marked by `**` delimiters to indicate they must be replaced before publication. Examples:

- Title: `*Draft* NESP MaC Project **X.X** – **{Project title}**`
- Name: `**Last name, First name**`
- Organisation: `**Match ROR name if possible**`
- Identifier code: `**ROR ID**`, `**ORCID code**`

A field containing text is not necessarily valid if it still contains template markers. The tool scans all text content for the presence of `**` substrings and flags any field that appears to contain unresolved template placeholders.

- Any text field containing `**` → error (template placeholder not replaced)
- Title containing `*Draft*` → warning (record may be intentionally draft, but should be reviewed)

## 7. NESP-specific checks (optional profile)

Disabled by default. When enabled:

- Project title matches pattern: `{Program} Project {Code} - {Title} ({Orgs})` → warning
- Dataset title matches pattern: `{Title} ({Program} {Code}, {Orgs})` → warning
- Standard online resources present in project records → warning:
  - Link to NESP MaC Hub project page
  - Link to DCCEEW NESP website
  - Link to final project report

## 8. External PID validation

API resolution checks are **toggleable** in settings (default: enabled). When disabled, all structural checks still run but resolution and name-matching checks are skipped. When enabled, the tool calls:

- **ROR API** (`https://api.ror.org/v2/organizations/{id}`) — validates ROR, retrieves canonical organisation name for cross-checking against the record's organisation name
- **ORCID public API** (`https://pub.orcid.org/v3.0/{id}/person`) — validates ORCID exists, retrieves `family-name` and `given-names` for name-matching against the record's individual name
- **DataCite API** (`https://api.datacite.org/dois/{doi}`) — validates DOI
- **RAiD** — resolves `https://raid.org/{handle}` — validates RAiD

Results are cached in the PID cache (local storage), keyed by identifier value. The cache stores both the resolution status and any metadata returned (canonical names, registered names). Cache avoids repeated API calls across records and sessions. User can clear the cache in settings.

### 8.1. Name matching from API responses

**ROR name matching:** The ROR API returns a `names` array. The entry with `type: "ror_display"` is the canonical name. The tool compares this to the organisation name in the record using exact string comparison. A mismatch is an error — the Community Guide requires organisation names to exactly match ROR canonical names.

**ORCID name matching:** The ORCID API returns separate `family-name` and `given-names` fields. The tool synthesises the expected metadata name as `"{family-name}, {given-names}"` and compares it to the record's name. A match on family name is sufficient for a pass. Significant divergence (different family name, or completely different given name) produces a warning with the suggested canonical form.

## 9. Report UI

See `ui-design.md` for the complete interface layout, including the record report structure, batch results layout, settings panel, knowledge base editor, and first-time setup flow.

### 9.1. Layout

Checks displayed in a panel organised into sections matching the test architecture. Each check shows:

- Status icon (green pass / orange warning / red error)
- Check name (short label)
- Expandable detail area containing:
  - 1–2 sentence explanation of the rule
  - What was found vs what was expected
  - Guidance on how to fix (embedded in the check code)

Sections can be collapsed. Summary counts at the top: N passed, N warnings, N errors.

ROR and ORCID sections group checks by entity (per organisation or per person). Each entity group shows encoding checks, name-matching results, and knowledge base suggestions where applicable.

### 9.2. Style

Visual style aligned with GeoNetwork: white and pale grey backgrounds, blue accents, light border-radius on panels. Desktop-only layout. No dark mode. Functional appearance — clarity over decoration.

### 9.3. Report export

Two clipboard-copy options on every record report:

- **Copy report** — structured Markdown report (title, UUID, type, date, summary counts, per-section results with expected/found/fix for failures)
- **Copy report + AI context** — prepends a condensed encoding-rules document (maintained as a standalone file in the repository) to the report, followed by a request for fix suggestions. Users paste into any LLM. The tool does not integrate with any specific LLM service.

## 10. Batch summary

### 10.1. Batch header and record filtering

The batch results header shows aggregate counts at two levels: test-level (total pass/warning/error across all individual checks) and record-level (how many records are all-passing, warnings-only, or have errors). Record-level counts double as severity filter checkboxes — unchecking a level hides those records from the list. See `ui-design.md` §4.1 for the layout.

### 10.2. Per-record re-check

Each record report includes a [Re-check] button (next to the [Copy report] buttons in the summary bar). Clicking it re-downloads the record's XML from GeoNetwork and re-runs all checks, replacing the previous results. This supports the workflow of fixing issues in GeoNetwork and then verifying the fixes without re-running the entire batch.

The [Re-check] button is only shown for records that came from a catalogue URL. It is not shown for records loaded from pasted XML (which have no source URL to re-fetch).

The existing [Run Checks] button in the batch input area serves as the mechanism for re-analysing all records — the user can re-run the batch at any time.

### 10.3. Warning suppression across records

When a user confirms a warning (e.g. confirms a person has no ORCID), that determination is stored in the knowledge base and applies to all records containing the same person or organisation. To see updated results after knowledge base changes, the user re-runs the batch using the [Run Checks] button or uses per-record [Re-check] for individual records.

## 11. Person/Org knowledge base

The knowledge base is populated automatically from analysed records and PID API responses. There is no manual data entry. It stores associations between names and identifiers, accumulates aliases, and uses canonical names from PID APIs as ground truth.

### 11.1. Data model

**People:**

| Field | Type | Source | Description |
|---|---|---|---|
| name | string | API canonical or most common | Primary name in "Family, Given" format |
| orcid | string or null | Records | Known ORCID |
| registered_name | string or null | ORCID API (cached) | Name from ORCID registry ("Given Family") |
| status | enum | Auto / User | `auto` (learned from records) or `no-orcid` (user confirmed) |
| aliases | string[] | Records | Other name strings seen with the same ORCID |
| source_records | string[] | Records | UUIDs of records this was learned from |

**Organisations:**

| Field | Type | Source | Description |
|---|---|---|---|
| name | string | API canonical or most common | Primary name |
| ror | string or null | Records | Known ROR |
| canonical_name | string or null | ROR API (cached) | Display name from ROR registry |
| status | enum | Auto / User | `auto` (learned from records) or `no-ror` (user confirmed) |
| aliases | string[] | Records | Other name strings seen with the same ROR |
| source_records | string[] | Records | UUIDs of records this was learned from |

### 11.2. How aliases accumulate

Aliases are learned by observation only. When the same identifier (ROR or ORCID) appears with different name strings across records, the variations become aliases. The tool does not guess associations based on fuzzy string matching — a name is only associated with an identifier when both appear together in the same record.

When a PID API canonical name is available, it becomes the primary name. All other name strings for that identifier are aliases. When no canonical name is available (API validation disabled or identifier not yet resolved), the most frequently encountered name string is used as the primary name.

### 11.3. Knowledge base suggestions during review

During record analysis, the knowledge base provides suggestions:

- **Known identifier:** If a name (exact or known alias) matches an entry with a known ORCID/ROR, suggest it with a [Copy] button and the source record it was learned from.
- **Name conflict:** If a name matches multiple entries with different identifiers, show all possibilities with a caution that they may be different people/organisations.
- **No-identifier confirmation:** If a user has confirmed "no ORCID" or "no ROR" for a name, suppress the warning for that entity across all records.

### 11.4. Handling conflicts and bad data

**Same name, different identifiers:** Stored as separate entries, flagged as conflicts in the knowledge base editor and during review.

**Bad data from bad records:** The knowledge base is designed to be cheap to rebuild. Incorrect entries can be deleted individually, or the entire knowledge base can be cleared and rebuilt by re-analysing a batch of known-good records.

### 11.5. Import/export

- CSV import/export for people (`name, orcid, status, aliases`) and organisations (`name, ror, status, aliases`). Aliases are pipe-separated. Import is lossless — exported CSV can be re-imported to restore the knowledge base.
- JSON download/upload of full local storage settings (includes knowledge base, settings, cache) for team sharing.

## 12. Settings

Stored in local storage. Includes:

- **Catalogue management:** Multiple catalogues can be configured, each with its own URL, connection status, and proxy URL. One catalogue is active at a time.
- **Rule sections:** Enable/disable rule sections and individual rules
- **API validation toggle:** Enable/disable external PID resolution (default: enabled). When disabled, structural checks still run but resolution and name-matching checks are skipped.
- **Rate limit:** Delay between requests, configurable from 0.5 to 2 seconds (default 0.5)
- **Search results page size:** Number of records per page in CSW search results (25, 50, 100, 250, 500; default 25)
- **PID cache:** Viewable, clearable. Stores API resolution results including canonical/registered names.
- **Knowledge base:** People and org entries with view/edit, import/export CSV, clear all
- **All settings exportable/importable** as JSON for team sharing

### 12.1. Catalogue connection diagnostic (v1)

When a user first uses a GeoNetwork catalogue, the tool runs a lightweight connection diagnostic and stores the results per-catalogue. This adapts the tool's behaviour to server-specific capabilities. The diagnostic checks:

1. **CORS:** Can the browser reach the CSW endpoint directly? If not, prompt for proxy setup.
2. **CSW basic:** Does `GetRecords` with `maxRecords=1` return a valid response?
3. **Record listing fields:** Do `brief` responses include `dc:identifier`, `dc:title`, `dc:type`?
4. **Record fetch:** Can a single record be fetched via `/srv/api/records/{uuid}/formatters/xml`?
5. **Performance baseline:** Measure response time for 1 CSW request and 1 record fetch to suggest appropriate rate limits.

Results inform the tool's behaviour (e.g. warn if record titles are missing from listings, suggest slower rate limits for slow catalogues). The user can re-run the diagnostic from settings.

## 13. Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Client-side only (browser) | Simple deployment on GitHub Pages, no server |
| Language | TypeScript | Static type checking, catches errors at build time |
| Build | `tsc` only, ES modules loaded via `<script type="module">` | Minimal tooling, no bundler, no Vite |
| Dependencies | Absolute minimum, each must be justified | Minimise supply chain risk |
| UI framework | None — plain HTML, CSS, DOM API | Simplicity, zero UI dependencies |
| CSS | Hand-written, GeoNetwork-aligned palette | Functional, familiar to target users |
| Testing | Lightweight CLI-compatible test runner, example XML fixtures | Confidence, regression prevention, contributor safety |
| Rule modularity | One source file per rule section (6.1–6.9, 7, plus future community sections) | Enables multi-org collaboration; contributors edit one file |
| Storage | Browser localStorage | No accounts, no backend, portable via JSON export |
| Hosting | GitHub Pages | Free, simple, accessible |
| Search API | CSW GetRecords with OGC XML Filters (not CQL, not `/api/search`) | Works across GN 3.x/4.x, GET-only, no CSRF, avoids CQL format string bug |
| CSW output | Dublin Core for search/listing; full ISO XML via per-record fetch | ISO output schemas (`mds/2.0`, `mdb/2.0`) not reliably supported across catalogues |
| CORS fallback | Optional local Python proxy (`proxy.py`, stdlib only) | Covers catalogues without CORS; no install beyond Python |
| Data format | XML throughout; JSON only if no XML alternative exists | Consistency; all validation rules reference XML paths |

## 14. CORS proxy

An optional local Python proxy (`proxy.py`) allows the tool to work with GeoNetwork instances that do not support CORS. It uses only the Python standard library — no packages to install.

### 14.1. Proxy interface

The proxy listens on `http://localhost:8080` (port configurable via `--port`). All requests use a single endpoint:

```
GET  http://localhost:8080/proxy?url=<URL-encoded target>
POST http://localhost:8080/proxy?url=<URL-encoded target>
```

For CSW POST requests, the proxy forwards the request body and `Content-Type` / `Accept` headers to the target. It adds `Access-Control-Allow-Origin: *` and related CORS headers to every response. CORS preflight (`OPTIONS`) is handled with a `204 No Content` response.

The tool constructs proxy URLs by URL-encoding the full target URL into the `url` query parameter. For example, to proxy a CSW request to `https://catalogue.eatlas.org.au/geonetwork/srv/eng/csw`, the tool fetches:
```
http://localhost:8080/proxy?url=https%3A%2F%2Fcatalogue.eatlas.org.au%2Fgeonetwork%2Fsrv%2Feng%2Fcsw
```

### 14.2. Security controls

The proxy is for local development only. It enforces:

- **Host allowlist:** Only forwards requests to known GeoNetwork and PID API hosts. Requests to other hosts are rejected with `403`. The allowlist includes the four target catalogues (eAtlas, IMAS, GA, NCI) and PID API hosts (api.ror.org, pub.orcid.org, api.datacite.org, raid.org).
- **HTTPS enforcement:** Target URLs must use `https` (or `http` for local testing).
- **Response size cap:** Responses larger than 10 MB are truncated.
- **Binding:** Listens on `127.0.0.1` only — not accessible from other machines.

### 14.3. Error forwarding

HTTP errors from the target server are forwarded to the browser with their original status code and body, plus CORS headers. Network errors or timeouts produce a `502` response with a JSON error message: `{"error": "Proxy error: ..."}`.

### 14.4. Static file serving

The proxy serves all static files from its working directory on any path that is not `/proxy`. A request for `/` returns `index.html`. This allows the proxy to be the only process needed during development — it serves the application files and proxies catalogue requests. No separate web server is required.

When the tool is deployed on GitHub Pages, the proxy is not needed for catalogues that support CORS.

### 14.5. Usage

```
python proxy.py              # default port 8080
python proxy.py --port 9000  # custom port
```

The proxy URL (`http://localhost:8080`) is stored per-catalogue in the tool's settings. `proxy.py` is included in the repository root.

## 15. Version plan

### v1 — Single record checker

- First-time setup: catalogue URL configuration with connection diagnostic
- URL input with auto-conversion (GeoNetwork XML, human, and search URLs)
- Pasted XML input
- Record type auto-detection with user override
- All generic checks (sections 6.1–6.9), excluding knowledge base suggestions and name-matching
- NESP optional checks (section 7)
- External PID validation with local storage cache (toggleable) — resolution and basic name checks
- Report panel with pass/warn/error and expandable explanations
- Report export (Markdown copy, Markdown + AI context copy)
- CORS detection with proxy fallback guidance
- Settings: rule sections, API toggle, rate limit, PID cache, catalogue management
- Implement proxy.py

### v2 — Batch mode and multi-record workflow

- Batch mode via CSW GetRecords (search URL parsing, UUID list, manual search)
- Rate limiting (default 0.5 sec delay, configurable 0.5–2 sec) and record cap (default 500)
- Paginated search results with configurable page size (25–500, default 25) and on-demand page loading
- Record preview and selection before processing
- Two-column batch results layout with record list and per-record detail
- Batch header with test-level and record-level severity counts
- Record-level severity filter checkboxes (hide all-passing, warnings-only, or error records from list)
- Per-record [Re-check] button to re-download and re-analyse individual records after edits in GeoNetwork

### v3 — Knowledge base and identity management

- Person/Org knowledge base, populated automatically from analysed records and PID API responses
- Alias accumulation (names associated with same identifier across records)
- Knowledge base suggestions during review (suggested ORCIDs, RORs, canonical names with copy buttons)
- Warning suppression ("this person has no ORCID" / "this org has no ROR")
- Name-matching checks: organisation name vs ROR canonical name, person name vs ORCID registered name
- Conflict detection (same name, different identifiers)
- Knowledge base editor (view, delete, clear all — no manual data entry)
- CSV import/export for knowledge base
- Full settings JSON import/export for team sharing

### Pre-development (complete)

Two rounds of pre-development testing against eAtlas, IMAS, GA, and NCI are complete. Key findings:

**Round 1 — CORS and API suitability:**
- IMAS, GA, and NCI support CORS natively. eAtlas does not (CORS will be enabled on the server).
- CSW GetRecords works across all four catalogues and all GeoNetwork versions.
- The `/api/search` POST endpoint is unsuitable (CSRF in GN4, absent in GN3).
- CQL is unreliable (format string bug). OGC XML Filters are the standard.
- All external PID APIs (ROR, ORCID, DataCite) support CORS natively.
- A Python proxy (stdlib only) covers catalogues without CORS.

**Round 2 — CSW pagination, throughput, and filtering (see `csw-test/`):**
- Pagination via `startPosition` works correctly on all catalogues.
- Server throughput varies widely (NCI: ~13 req/sec, IMAS: ~1 req/sec). Rapid requests can destabilise slower servers — IMAS became unreachable during testing.
- All type filter property names (`type`, `apiso:Type`, `dc:type`, `csw:Type`) work identically; `type` adopted as the standard.
- `ElementSetName=brief` is sufficient for search listings (`dc:identifier`, `dc:title`, `dc:type`) and up to 13× smaller than `summary`.
- ISO output schemas via CSW (`mds/2.0`, `mdb/2.0`) are not reliably supported — per-record XML fetch is required.
- CORS detection requires a multi-step probe; `TypeError: Failed to fetch` is indistinguishable from server outage.
- Catalogues fail at `maxRecords=1000`; 100 is a safe default page size.
