# ISO 19115-3 Metadata Checker

A browser-based tool that checks ISO 19115-3 metadata records for completeness and correctness of persistent identifier (PID) encoding, following the conventions in the [Community Practice Guide for Preparing ISO 19115-3 Metadata Records](community-guide.md). You can access the tool from https://open-aims.github.io/iso-checker/index.html.

## The problem

ISO 19115-3 metadata records for datasets, projects and programs can include many persistent identifiers — DOIs, ORCIDs, RORs and RAiDs — each requiring specific encoding conventions. Identifiers must appear in the right XML elements, use bare values (not full URLs) in the code field, carry matching Anchor hrefs, use the correct codeSpace, and in some cases be duplicated in a second location as a workaround for GeoNetwork display limitations. With multiple people and organisations per record, it is easy to miss an identifier, encode one inconsistently, or leave template placeholders in place.

This tool provides a fast, structured report of what is present, what is missing and what is incorrectly formed, so that metadata authors can fix problems before publication, or to check existing records.

## What it checks

The tool validates records against the Community Practice Guide conventions:

- **DOI encoding** — presence, bare value format, Anchor href consistency, DataCite resolution
- **RAiD encoding** — correct location (citation identifier for projects, associated resource for datasets), value format, resolution
- **ROR encoding** — presence in both `partyIdentifier` and `onlineResource`, consistency between the two, organisation name matching against the ROR registry
- **ORCID encoding** — same dual-location checks as ROR, person name matching against the ORCID registry
- **People and organisation structure** — correct nesting of individuals within organisations, name formatting ("Family, Given"), role assignments, point of contact with email
- **Hierarchy and structure** — parent metadata links, metadata scope codes
- **Licensing and citation** — Creative Commons licence, citation statement in other constraints
- **Template placeholders** — detection of unresolved `**` markers from metadata templates
- **NESP MaC conventions** (optional) — title patterns and standard online resources for NESP-funded records

External PID resolution (DOI, ORCID, ROR, RAiD) is enabled by default and can be toggled off in settings. Results are cached locally to avoid repeated API calls.

### Knowledge base

The tool automatically builds a knowledge base of people and organisations as it analyses records. When the same ORCID or ROR appears with different name variations across records, the tool learns these as aliases and can suggest known identifiers for names it recognises in new records.

The knowledge base also tracks people and organisations that have been confirmed as not having an ORCID or ROR. Once flagged, the missing-identifier warning is suppressed for that person or organisation across all future records. Confirmations can be made interactively during review, or by importing a prepared CSV file listing names and their status — useful for pre-populating the knowledge base for a team or catalogue.

The knowledge base is stored in the browser's local storage and can be exported and shared between team members as CSV (for people and organisations separately) or as a full JSON settings export.

## How it works

The tool runs entirely in the browser. It fetches ISO 19115-3 XML records from any GeoNetwork 3.x or 4.x catalogue via the standard XML API (`/srv/api/records/{uuid}/formatters/xml`), parses the XML and runs validation checks against it. No data is sent to any server other than the catalogue being checked and the PID resolution APIs.

Records can be loaded by:

- **Pasting a GeoNetwork URL** — either the XML API URL or the human-readable catalogue page URL. The tool extracts the UUID and fetches the XML.
- **Pasting raw XML** — for checking draft or unpublished records not yet in a catalogue.

The tool auto-detects the record type (Dataset, Project or Program) from the metadata scope code and title pattern, then applies the appropriate set of checks. The record type can be overridden manually.

## Using the tool

### Option 1: GitHub Pages (recommended)

If your GeoNetwork catalogue supports CORS (cross-origin requests), you can use the tool directly at https://open-aims.github.io/iso-checker/index.html, with no installation required. IMAS, Geoscience Australia and NCI GeoNetwork instances support CORS natively.

Simply open the tool, enter your catalogue URL during first-time setup, and paste a record URL to check.

### Option 2: Local with Python proxy

If your GeoNetwork catalogue does not support CORS (the browser will show a connection error during setup), you can run the tool locally using the included Python proxy. The proxy requires only the Python standard library — no packages to install.

1. Clone or download this repository
2. Start the proxy:
   ```
   python proxy.py
   ```
   This serves the application at `http://localhost:8080` and proxies requests to catalogue servers and PID APIs. The default port is 8080; use `--port` to change it:
   ```
   python proxy.py --port 9000
   ```
3. Open `http://localhost:8080` in your browser
4. During first-time setup, if the direct connection test fails, enter the proxy URL (`http://localhost:8080`) when prompted and re-test

The proxy only forwards requests to an allowlist of known GeoNetwork catalogues and PID API hosts. It binds to `127.0.0.1` only and is not accessible from other machines.

Check / modify the ALLOWED_HOSTS in proxy.py to ensure your server is included.

## Development

### Overview

The tool is a client-side single-page application built with TypeScript and plain HTML/CSS — no UI framework, no bundler. TypeScript is compiled with `tsc` to ES modules in `dist/`, which are loaded directly by the browser via `<script type="module">`. The compiled JavaScript is committed to the repository so that the application can be served directly from GitHub Pages and run locally without a Node.js build step.

### Architecture

The codebase is organised into modules by responsibility:

| Directory | Purpose |
|---|---|
| `src/rules/` | Validation rule modules — one file per rule section (DOI, RAiD, ROR, ORCID, etc.). The `rule-registry.ts` file coordinates rule discovery and execution. |
| `src/xml/` | XML parsing — `record-parser.ts` extracts structured data from ISO 19115-3 (and partially ISO 19139) records. `xpath-helpers.ts` provides namespace-aware XPath utilities. |
| `src/ui/` | UI rendering and report export — DOM manipulation, report formatting, clipboard copy. |
| `src/api/` | External API clients — PID resolution (DataCite, ORCID, ROR, RAiD). |
| `src/catalogue/` | GeoNetwork catalogue client — record fetching, CSW search, CORS detection. |
| `src/storage/` | Local storage management — settings, PID cache. |

Key design decisions:

- **No bundler** — `tsc` only. ES modules loaded natively by the browser.
- **No UI framework** — plain DOM API. Keeps the dependency footprint minimal.
- **One file per rule section** — enables contributors from different organisations to add checks by editing a single file.
- **CSW for search** — OGC CSW with XML Filters (not CQL, not the `/api/search` REST endpoint) for cross-version GeoNetwork compatibility.

### Design documents

- [requirements.md](requirements.md) — functional requirements, validation rules, architecture decisions, version plan
- [ui-design.md](ui-design.md) — interface layout, interaction design, report export format
- [rules-design.md](rules-design.md) — XPath patterns, namespace handling, extraction paths for each rule section
- [community-guide-condensed.md](community-guide-condensed.md) — condensed encoding conventions reference (also used for the "Copy report + AI context" export). This is a condenesed version of the full community guide and is useful for providing LLM coding assistants with context.

### Setting up your environment for development

**Prerequisites:**

- [Node.js](https://nodejs.org/) (for TypeScript compilation)
- Python 3 (for the local proxy/dev server — standard library only, no packages needed)

**Install dependencies:**

```
npm install
```

This installs TypeScript as the sole dev dependency.

**Build:**

```
npm run build
```

Compiles TypeScript from `src/` to JavaScript in `dist/`. Source maps are generated for local debugging but excluded from git via `.gitignore`.


**Run locally:**

```
python proxy.py
```

Then open `http://localhost:8080`. The proxy serves the application files and proxies catalogue requests. No separate web server is needed.

### GitHub Pages deployment

The application is deployed to GitHub Pages directly from the `main` branch at the repository root. The compiled `dist/` directory is committed to the repository so that no CI build step is required. After pushing changes, ensure you have run `npm run build` and committed the updated `dist/` files.

GitHub Pages is configured under the repository's Settings > Pages > "Deploy from a branch" > `main` / `/ (root)`.
