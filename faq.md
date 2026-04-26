# ISO 19115-3 Metadata Checker — Frequently Asked Questions

## Setup and connectivity

### 1. I'm getting a "CORS blocked or server unreachable" error during first-time setup. How do I fix this?

This error appears when the browser cannot make cross-origin requests to the catalogue server. It can mean CORS is not enabled on the server, or the server is genuinely unreachable. The tool tests both possibilities automatically.

If CORS is the issue, you have two options: ask your GeoNetwork administrator to enable CORS headers, or use the included Python proxy. To use the proxy, run `python proxy.py` from the project directory, open `http://localhost:8080` in your browser, and enter the proxy URL when prompted during setup. The proxy forwards requests to the catalogue on your behalf, bypassing the browser's CORS restriction.

IMAS, Geoscience Australia and NCI GeoNetwork instances support CORS natively and should work without a proxy.

**To use the proxy**, you need to clone or download the repository from https://github.com/open-AIMS/iso-checker and have Python 3 installed. The proxy requires only the Python standard library — no packages to install. As well as proxying requests to catalogue servers and PID APIs, the proxy also serves a local copy of the application itself, so you can run the entire tool from `http://localhost:8080` without needing a separate web server or GitHub Pages.

### 2. How do I set up the Python proxy, and what if my catalogue isn't in the allowlist?

Clone or download the repository from https://github.com/open-AIMS/iso-checker, then run `python proxy.py` from the project directory. It starts a local server at `http://localhost:8080` (use `--port` to change this) that both serves the application and proxies requests to catalogue servers. No Python packages are needed beyond the standard library.

The proxy only forwards requests to hosts listed in the `ALLOWED_HOSTS` variable in `proxy.py`. If your catalogue is not listed, open `proxy.py` in a text editor and add the hostname of your GeoNetwork server to the allowlist. The proxy binds to `127.0.0.1` only and is not accessible from other machines.

### 3. Can I use the tool with a GeoNetwork catalogue that isn't one of the four listed?

Yes. The tool works with any GeoNetwork 3.x or 4.x instance that exposes the standard XML API and CSW endpoints. During first-time setup (or in Settings), enter your catalogue's base URL (the URL up to and including `/geonetwork/`). The tool will test the connection and report whether the CSW endpoint, XML API and CORS are working. If CORS is blocked, use the Python proxy.

---

## Input and record loading

### 4. I have a draft metadata record that hasn't been published to GeoNetwork yet. How can I check it?

Use the **Paste XML** tab. Copy the full ISO 19115-3 XML of your draft record and paste it into the text area, then click **Check**. All structural validation checks will run against the pasted XML. The only difference from URL-based checking is that the "View in GeoNetwork" link and **Re-check** button will not appear in the results, since there is no catalogue URL to link back to.

### 5. I pasted a GeoNetwork search URL into the URL field and nothing happened. What URL formats does the tool accept?

The URL tab accepts three formats:

- **XML API URL:** `https://{host}/geonetwork/srv/api/records/{uuid}/formatters/xml`
- **Catalogue page URL:** `https://{host}/geonetwork/srv/eng/catalog.search#/metadata/{uuid}`
- **Search URL:** `https://{host}/geonetwork/srv/eng/catalog.search#/search?any={term}`

If you paste a search URL, the tool should automatically switch to the **Batch / Search** tab and pre-fill the search fields. If this doesn't happen, check that the URL matches the pattern above and includes the catalogue base URL up to `/geonetwork/`. You can also use the Batch / Search tab directly by typing your search term there.

### 6. My record is in ISO 19139 format, not ISO 19115-3. Will the tool still work?

Partially. The tool detects ISO 19139 records automatically and runs the checks that are possible in the older schema. However, ISO 19139 lacks `partyIdentifier` (so ROR/ORCID can only be detected in `onlineResource` URLs), `associatedResource` (so RAiD checks for datasets are skipped), and `gcx:Anchor` support (so PID encoding checks are limited). The tool will report that the record uses the older schema and recommend conversion to ISO 19115-3 using GeoNetwork's built-in conversion tool. Checks that are structurally impossible in ISO 19139 are skipped rather than reported as errors.

---

## Understanding results

### 7. What's the difference between an error, a warning and an info result?

- **Error (red):** Something is definitely wrong — a structural encoding error, an inconsistency between two locations, or a missing required identifier. These need to be fixed.
- **Warning (orange):** Something is likely missing but may be legitimately absent. For example, a person without an ORCID gets a warning because they might not have one. A dataset without `parentMetadata` gets a warning because it might be a standalone dataset.
- **Info (grey/blue):** An optional element is absent. For example, a missing `mcc:description` on an identifier element. These are informational only and do not indicate a problem.

If a warning does not apply to your situation (e.g. a person genuinely has no ORCID), you can suppress it by confirming the status in the tool — see question 22.

### 8. The tool says my DOI is "present but incorrectly encoded" even though it contains the right DOI string. What's wrong?

The Community Practice Guide requires DOIs to be encoded using a `gcx:Anchor` element, with the bare DOI string (e.g. `10.25959/BVJ7-D984`) as the text content and the full URL (e.g. `https://doi.org/10.25959/BVJ7-D984`) as the `xlink:href` attribute. The `codeSpace` must be `doi.org`.

Common problems the tool detects:
- The DOI is in a `gco:CharacterString` instead of a `gcx:Anchor` — this is a frequent pattern in older records.
- The code field contains the full URL (`https://doi.org/...`) instead of the bare DOI string.
- The `codeSpace` is something like `"Digital Object Identifier"` instead of `doi.org`.

The tool reports the DOI as "found" so you know it's there, but flags the encoding as incorrect. Edit the record in GeoNetwork to use the correct Anchor encoding.

### 9. Why does the tool flag my ROR as an error when it's only in one location?

Due to a limitation in GeoNetwork 3 and 4, the ROR must be recorded in **two** locations per organisation:

1. **`partyIdentifier`** — the machine-readable location used by metadata harvesters and crosswalks (e.g. to Research Data Australia).
2. **`onlineResource`** — a workaround to make the ROR visible in GeoNetwork's user interface, which cannot currently display `partyIdentifier`.

If the ROR appears in one location but not the other, the tool reports this as an **error** (inconsistent encoding) because downstream systems may miss the identifier depending on which location they read. If neither location has a ROR, it is reported as a **warning** (the organisation may not have a ROR). The same dual-location requirement applies to ORCIDs.

### 10. The tool says my organisation name doesn't match the ROR canonical name, but I used our usual name. What's wrong?

The Community Practice Guide requires the organisation name in the metadata record to **exactly match** the canonical display name from the ROR registry. The tool resolves the ROR via the ROR API and compares the two strings. Common mismatches include:

- Using an abbreviation (e.g. "AIMS" instead of "Australian Institute of Marine Science")
- Adding extra text (e.g. "Australian Institute of Marine Science (AIMS)")
- Using a sub-organisation or department name with a parent organisation's ROR

To find the canonical name, search for your organisation at https://ror.org and use the exact display name shown there. If you need to record a department or sub-unit, use the parent organisation's ROR and canonical name in `cit:CI_Organisation/cit:name`, and record the department name in the individual's address delivery point field instead.

### 11. The tool says my person's name doesn't match their ORCID registered name, but the name in my record is actually better. How can I resolve this?

The tool compares the name in your metadata record against the name registered in the ORCID registry. A match on family name is sufficient for a pass. If the family name differs significantly, the tool produces a warning and suggests the registered form.

This check is advisory. People sometimes use different name forms in different contexts (e.g. a preferred given name vs. a legal name, or a transliteration variation). If the name in your record is correct for your context and you are confident the ORCID is right, you can note the warning and move on. The important thing is that the ORCID itself is correct — the name comparison is a secondary consistency check to catch cases where the wrong ORCID has been assigned to a person.

If the ORCID registry has a worse version of the name (e.g. incomplete, outdated or incorrectly formatted), the best fix is to ask the person to update their name in the ORCID registry at https://orcid.org. Once updated, clear the PID cache in the tool's settings and re-check — the tool will fetch the new name from the API. There is currently no way to suppress the name-mismatch warning for a specific person without the registry name matching. This could be considered a missing feature — a future enhancement might allow users to confirm that a name mismatch is acceptable, similar to the "confirmed: no ORCID" mechanism.

---

## Fixing specific issues

### 12. My department doesn't have its own ROR. What identifier should I use?

Use the ROR of your parent organisation. For example, if you work in "TropWATER, James Cook University" and TropWATER does not have its own ROR, use the James Cook University ROR (`04gsp2c11`) and set the organisation name to the exact ROR canonical name ("James Cook University"). Record the department or group name in the individual's address delivery point field. Do not combine a sub-organisation name with a parent ROR in the organisation name field — the tool will flag this as a name mismatch.

If your organisation genuinely does not have a ROR (e.g. a small consultancy), the missing-ROR check will produce a warning. You can suppress this by confirming "this organisation has no ROR" during review, which stores the determination in the knowledge base.

### 13. I have five people from the same organisation. Do I need to repeat the organisation block five times?

Yes. The Community Practice Guide requires each responsible party block (`cit:citedResponsibleParty`) to contain exactly one organisation and one individual. If five people belong to the same organisation, you create five separate responsibility blocks, each repeating the full organisation element (including its ROR) with one individual nested inside.

This feels redundant, but it ensures each person has an explicit role code and a clear one-to-one link to their organisation. It also matches the structure that downstream harvesters and crosswalks (e.g. to Research Data Australia) expect. GeoNetwork's editor supports duplicating responsibility blocks to make this easier.

### 14. The tool warns my person names are "incorrectly formatted". I used normal names like "Jane Smith". What format does it expect?

The Community Practice Guide requires names in **"Family name, Given name"** format — with a comma separating the family name (first) from the given name. For example:

- **Correct:** `Lawrey, Eric`
- **Incorrect:** `Eric Lawrey` or `Lawrey Eric`

The tool checks for the presence of a comma. Names without a comma are flagged as a warning because they are likely in the wrong format. This format is required for consistency and to support export to other metadata formats (e.g. DataCite JSON for DOI records) where family and given names are separate fields.

The tool also warns about title prefixes (Dr, Prof, Mr, Mrs, etc.). Omit titles from the name field — they create ambiguity and are not needed when the person is identified by ORCID.

### 15. I put the RAiD in the citation identifier of my dataset record, but the tool says it's missing. Where should it go?

The location for a RAiD depends on the record type:

- **Project records:** RAiD goes in the **citation identifier** (`cit:identifier` within `CI_Citation`), in the same location as a DOI would go for a dataset.
- **Dataset records:** RAiD goes in an **associated resource** (`mri:associatedResource/mri:MD_AssociatedResource`), with `associationType` = `dependency` and `initiativeType` = `project`. This links the dataset to the project that produced it.

If you put the RAiD in the citation identifier of a dataset record, the tool will not find it in the expected location and will report it as missing. Move the RAiD to an associated resource block and add a DOI in the citation identifier instead.

### 16. The tool reports "template placeholder detected" on fields I thought I had already filled in. How do I find leftover markers?

The tool scans all text content in the record for `**` substrings, which are used in some metadata templates (e.g. the eAtlas template) to mark fields that need to be replaced before publication. Examples include `**Last name, First name**`, `**ROR ID**` and `**ORCID code**`.

The error message will tell you which field contains the placeholder. In GeoNetwork's editor, search for `**` in the relevant field and replace it with the actual value. Pay attention to identifier code fields — a field might look filled in at a glance but still contain the template marker text.

A title containing `*Draft*` is flagged as a warning rather than an error, since some records are intentionally kept in draft status during development.

### 17. The tool says my DOI should be a "bare string". What does that mean?

A "bare string" means the identifier value without any URL prefix. In the `mcc:code` element:

- **Correct:** `10.25959/BVJ7-D984`
- **Incorrect:** `https://doi.org/10.25959/BVJ7-D984`

The full URL goes in the `gcx:Anchor` element's `xlink:href` attribute, not in the text content. In GeoNetwork's editor, find the citation identifier field, ensure the code value contains only the DOI string (starting with `10.`), and set the Anchor link to the full `https://doi.org/...` URL. The same bare-string rule applies to ROR, ORCID and RAiD identifiers.

### 18. The tool says my record is missing `parentMetadata`. Is that always required?

No. The `parentMetadata` check produces a **warning**, not an error. A standalone dataset that is not part of a project or program hierarchy can legitimately lack a parent reference. However, if your dataset was produced under a project (e.g. a NESP MaC project), it should reference the parent project metadata record's UUID in `mdb:parentMetadata/@uuidref`. This supports navigation between related records and enables aggregation in downstream systems like Research Data Australia.

---

## Record type and detection

### 19. The tool auto-detected my record as a "Dataset" but it's actually a project. How do I override this?

The record type dropdown in the report header is pre-filled by auto-detection but can be changed manually. Select the correct type from the dropdown and the tool will re-evaluate the checks.

Auto-detection uses the `metadataScope` code first (`dataset`, `fieldSession` for projects, `series` for programs), then falls back to title pattern matching. If your record lacks a `metadataScope` code and doesn't follow the expected title pattern, auto-detection may guess wrong. Adding the correct scope code in GeoNetwork will fix this permanently.

### 20. What scope code should I use for a project record?

Use `fieldSession`. This is the ISO 19115-3 scope code adopted by the Community Practice Guide for project records. While the name is not intuitive for research projects, it is the established convention within the NESP MaC community and is recognised by downstream harvesters. Dataset records use `dataset` and program records use `series`.

Set this in GeoNetwork under the metadata scope (Resource scope) field.

---

## Batch mode and workflow

### 21. How do I check multiple records from a specific project in one batch?

Use the **Batch / Search** tab. You have two options:

- **Search:** Enter a search term (e.g. the project name or code) and optionally filter by resource type (Dataset, Project, Program). Click **Search** to query the catalogue. The tool shows a paginated list of matching records with checkboxes. Select the records you want to check (or use **Select All**), then click **Run Checks**.
- **UUID list:** If you already know the record UUIDs, paste them into the UUID list area (one per line) and click **Fetch Records**.

Batch mode is capped at 500 records per run and requests are rate-limited (default 0.5 seconds between requests) to protect the catalogue server. You can adjust the rate limit and page size in Settings.

### 22. When I search for "NESP" or "NESP 3.17" I get the same number of results. Is the search broken?

This is a limitation of how GeoNetwork's CSW search works, not a bug in the tool. The tool uses OGC CSW with XML Filters for searching, which performs keyword matching using `*` wildcards rather than phrase searching. A search for `NESP 3.17` is treated as a search for records containing both `NESP` and `3.17` as separate terms, but in practice CSW's `AnyText` filter often behaves more like an OR or full-text search depending on the GeoNetwork version and its underlying search engine (Lucene or Elasticsearch). This means adding more words may not narrow results the way you expect.

To get more targeted results, use the **resource type** filter dropdown (Dataset, Project, Program) to narrow by record type. You can also paste specific record UUIDs into the UUID list if you know exactly which records you want to check. The search is primarily intended for broad discovery — once you see the results list, use the checkboxes to select only the records you want to analyse.

### 23. The batch check is very slow. Is something wrong?

This is expected behaviour. The tool rate-limits all requests to the catalogue server to avoid overloading it — the default delay is 0.5 seconds between requests. For a batch of 50 records, this means at least 25 seconds just for fetching XML, plus additional time for PID resolution API calls (DOI, ORCID, ROR, RAiD) if external validation is enabled.

To speed things up:
- **Reduce the rate limit** in Settings (minimum 0.5s). Only do this if you know your catalogue can handle faster requests.
- **Disable external PID validation** in Settings if you only need structural checks. This skips all API calls to DataCite, ORCID, ROR and RAiD, which significantly reduces processing time.
- **Use a smaller batch.** If you selected hundreds of records, try narrowing to just the ones you need.

Note that PID resolution results are cached locally, so re-checking the same records will be faster the second time — only the XML fetch is repeated, not the API calls.

### 24. I fixed some errors in GeoNetwork. Do I need to re-run the entire batch?

No. Each record in the batch results has a **Re-check** button in its summary bar. Click it to re-download that record's XML from GeoNetwork and re-run all checks, replacing the previous results. This lets you verify fixes one record at a time without re-processing the whole batch.

If you want to re-check all records, click the **Run Checks** button in the batch input area to re-run the entire batch.

---

## Knowledge base

### 25. A person genuinely has no ORCID. How do I suppress the warning permanently?

When reviewing a record, the ORCID checks section for each person without an ORCID will include a **Confirm: this person has no ORCID** button. Clicking it stores that determination in the knowledge base. From that point on, the missing-ORCID warning is suppressed for that person across all records — current and future.

The same mechanism works for organisations without a ROR. To undo a confirmation, go to **Settings > Knowledge Base > View / Edit**, find the entry and delete it.

### 26. Can I pre-populate the knowledge base with our team's ORCIDs and RORs from a spreadsheet?

Yes. Go to **Settings > Knowledge Base > View / Edit**, then use the **Import CSV** button on the relevant tab (People or Organisations). The CSV format is:

**People:** `name, orcid, status, aliases`
```
name,orcid,status,aliases
"Davis, Aaron",0000-0002-8278-9599,auto,
"Bon, Aaron",,no-orcid,
"Lawrey, Eric",0000-0002-1234-5678,auto,"Lawrey, E.P."
```

**Organisations:** `name, ror, status, aliases`
```
name,ror,status,aliases
"Australian Institute of Marine Science",03x57gn41,auto,AIMS
"Aerial Architecture",,no-ror,
```

- `status` is `auto` (known identifier) or `no-orcid`/`no-ror` (confirmed absent).
- `aliases` are pipe-separated (`|`) if there are multiple.
- For a simple list of people without ORCIDs, you only need `name` and `status` columns (leave `orcid` and `aliases` empty).

When importing, choose **Replace** to clear existing entries first, or **Merge** to add to / update existing entries.

### 27. The knowledge base is suggesting a wrong ORCID for someone in my record. How do I fix it?

The knowledge base learns associations between names and identifiers from the records it analyses. If a record contains an incorrect ORCID for a person, the knowledge base will learn that wrong association and may suggest it for the same name in other records.

To fix this:
1. Correct the ORCID in the source record in GeoNetwork.
2. Go to **Settings > Knowledge Base > View / Edit** and find the person on the People tab.
3. **Delete** the incorrect entry.
4. Re-check the corrected record — the tool will learn the correct association.

If multiple entries are wrong, you can clear the entire knowledge base (**Settings > Knowledge Base > Clear entire knowledge base**) and re-run your batch to re-learn associations from the current state of the records. However, be aware that clearing the knowledge base will also lose any manual confirmations you have made (e.g. people marked as "no ORCID" or organisations marked as "no ROR"). If you have invested effort in manual tagging, **export the knowledge base as CSV first** so you can re-import those confirmations after rebuilding. Alternatively, delete only the specific incorrect entries rather than clearing everything.

### 28. I've set up the tool and built a knowledge base. How do I share my settings with my team?

Go to **Settings** and click **Export all as JSON**. This exports everything: catalogue connections, rule settings, PID cache and the full knowledge base. Send the JSON file to your colleague — they can import it via **Settings > Import JSON**.

For sharing just the knowledge base (people and organisations), use the CSV export instead: go to **Settings > Knowledge Base > View / Edit** and use the **Export CSV** button on each tab (People and Organisations). CSV files are easier to review and edit in a spreadsheet before sharing, and can be imported independently of other settings.

---

## Privacy and data handling

### 29. Is my data sent to any server? Where does the tool store everything?

The tool runs entirely in your browser. No data is sent to any server other than:

- **Your GeoNetwork catalogue** — to fetch record XML and run CSW searches.
- **PID resolution APIs** — DataCite (for DOIs), ORCID (public API), ROR and RAiD, to validate that identifiers resolve and to retrieve canonical names. These are read-only public API calls.

If you use the **Paste XML** tab, the pasted XML never leaves your browser — it is parsed and checked locally.

All tool data (settings, knowledge base, PID cache) is stored in your browser's **localStorage**. It is not synced to any cloud service. Clearing your browser data or switching browsers will reset everything.

**Warning:** Browser localStorage is not permanent storage. Some browsers may clear localStorage during major upgrades, when storage limits are reached, or as part of privacy features. If you have invested effort in manually tagging people and organisations (e.g. confirming "no ORCID" or "no ROR" status), this work could be lost without warning. It is strongly recommended that you regularly back up your data using the **Export all as JSON** button in Settings, or export the knowledge base as CSV via **Settings > Knowledge Base > View / Edit**. These exports can be re-imported to restore your data if localStorage is cleared.

---

## Report export and AI assistance

### 30. What does "Copy report + AI context" do, and how do I use it?

The **Copy report + AI context** button copies two things to your clipboard:

1. A condensed version of the encoding conventions from the Community Practice Guide — the rules for how DOI, ORCID, ROR and RAiD should be encoded in ISO 19115-3.
2. The error and warning report for the current record.
3. A prompt asking for specific fix suggestions, including corrected XML where applicable.

Paste the entire clipboard contents into any LLM you have access to (ChatGPT, Claude, Gemini, Copilot, etc.). The LLM will have enough context about the encoding conventions to suggest concrete XML fixes for each issue in your record. The tool does not connect to any LLM service directly — you choose which one to use.

The plain **Copy report** button copies just the report without the encoding context, which is useful for sharing results with colleagues or for your own records.
