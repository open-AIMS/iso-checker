# Rules Design — XML Parsing Implementation Guidance

Supplement to `requirements.md` §6 (Generic checks). Documents the correct XPath patterns and structural handling needed to implement each rule section, based on prototype testing against three records from eAtlas (ISO 19115-3), GA (ISO 19115-3), and NCI (ISO 19139).

## 1. Namespace handling

Use **Approach A: document-extracted namespaces**. Read all `xmlns:` declarations from the root element at parse time and build the XPath resolver dynamically. This handles version differences (e.g. `srv/2.0` vs `srv/2.1`) without hardcoding namespace URIs.

Approach B (`local-name()`) works but cannot distinguish ISO 19115-3 from ISO 19139 since both use `MD_Metadata` as the root local name. It is not recommended as the primary approach.

```js
// Build resolver from document root attributes
const nsMap = {};
for (const attr of root.attributes) {
  if (attr.name.startsWith('xmlns:')) nsMap[attr.name.substring(6)] = attr.value;
}
const resolver = (prefix) => nsMap[prefix] || null;
```

## 2. Schema detection (must run first)

Detect schema from the root element namespace URI before running any extraction. All subsequent code paths branch on this result.

| Schema | Root local name | Namespace URI contains |
|---|---|---|
| ISO 19115-3 | `MD_Metadata` | `19115/-3/mdb` |
| ISO 19139 | `MD_Metadata` | `isotc211.org/2005/gmd` |

ISO 19139 can only partly support the Community Guide. It lacks `partyIdentifier`, `associatedResource`, and the nested party structure (`CI_Organisation` containing `CI_Individual`). The tool should detect ISO 19139, run what checks it can, skip inapplicable checks, and report that the record needs conversion to ISO 19115-3.

## 3. XPath strategy: incremental stepping

Do not write single deep-path XPath queries from root to leaf. Instead, step down incrementally. Find `MD_DataIdentification` first, then find `citation/CI_Citation` from that context, then find individual elements within the citation. This makes failures diagnosable (you know which level failed) and keeps each XPath expression short and readable.

```
root → mdb:identificationInfo/mri:MD_DataIdentification  (dataId)
dataId → mri:citation/cit:CI_Citation                     (citation)
citation → cit:identifier/mcc:MD_Identifier               (identifiers)
```

## 4. Text extraction: `gcx:Anchor` (required) vs `gco:CharacterString` (diagnostic)

The Community Guide requires PIDs to be encoded using `gcx:Anchor` elements, with the bare identifier as text content and the resolvable URL as `xlink:href`. This is the only valid encoding for DOI, ROR, ORCID, and RAiD identifiers.

However, many existing records encode PIDs in `gco:CharacterString` (e.g. GA uses `gco:CharacterString` with a full DOI URL). The parser must extract values from both element types so that rules can produce useful diagnostics: "PID found but not encoded per the Community Guide" is more helpful than "PID missing". Use `mcc:code/*` to match either child element type, then check `localName` to determine which form was used. A PID in `gco:CharacterString` is an error (wrong encoding), not a pass.

For Anchors, extract `xlink:href` via `getAttributeNS('http://www.w3.org/1999/xlink', 'href')`.

Treat `gco:nilReason="missing"` on empty elements as absent (null), not as content.

## 5. Scoping: identificationInfo only

ROR, ORCID, and responsible party checks must only search within `identificationInfo` — specifically within `citation` and `pointOfContact`. They must **not** search `mdb:contact` (metadata-level contacts) or `resourceConstraints` (which may contain organisation names in licensing text, e.g. Creative Commons).

Query organisations and individuals by traversing from `citation` and `pointOfContact` separately, not by using `//cit:CI_Organisation` from the document root.

## 6. Extraction paths by rule section

### 6.1. Record identity

| Field | ISO 19115-3 path (from root) | ISO 19139 path (from root) |
|---|---|---|
| UUID | `mdb:metadataIdentifier/mcc:MD_Identifier/mcc:code/gco:CharacterString` | `gmd:fileIdentifier/gco:CharacterString` |
| Scope code | `mdb:metadataScope/mdb:MD_MetadataScope/mdb:resourceScope/mcc:MD_ScopeCode/@codeListValue` | `gmd:hierarchyLevel/gmd:MD_ScopeCode/@codeListValue` |
| Title | `mdb:identificationInfo/mri:MD_DataIdentification/mri:citation/cit:CI_Citation/cit:title/gco:CharacterString` | `gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:title/gco:CharacterString` |
| Parent | `mdb:parentMetadata/@uuidref` | `gmd:parentIdentifier/gco:CharacterString` |

### 6.2. DOI extraction (from citation context)

Step to `CI_Citation` first then query within it.

**ISO 19115-3:** `cit:identifier/mcc:MD_Identifier`
- Code: `mcc:code/*` (CharacterString or Anchor)
- Code space: `mcc:codeSpace/gco:CharacterString`
- Description: `mcc:description/gco:CharacterString`

Correctly encoded DOI: `codeSpace` = `"doi.org"`, code is bare DOI string (no URL prefix), element is `gcx:Anchor` with `xlink:href` = `https://doi.org/{DOI}`.

Common non-standard encoding (GA pattern): `gco:CharacterString` containing a full URL like `http://dx.doi.org/10.26186/...` with `codeSpace` = `"Digital Object Identifier"`. The parser must still detect this as a DOI (by checking for `10.x` DOI pattern in the text) and report it as present but incorrectly encoded, rather than reporting it as missing.

**ISO 19139:** `gmd:identifier/gmd:MD_Identifier`, code at `gmd:code/gco:CharacterString`. No Anchor support.

### 6.3. RAiD extraction (dataset records, ISO 19115-3 only)

From `MD_DataIdentification`: `mri:associatedResource/mri:MD_AssociatedResource`

For each associated resource:
- Association type: `mri:associationType/mri:DS_AssociationTypeCode/@codeListValue` (expect `"dependency"`)
- Initiative type: `mri:initiativeType/mri:DS_InitiativeTypeCode/@codeListValue` (expect `"project"`)
- Identifier: step into `mri:metadataReference/cit:CI_Citation/cit:identifier/mcc:MD_Identifier`
  - Code: `mcc:code/*`
  - Code space: `mcc:codeSpace/gco:CharacterString` (expect `"raid.org"`)
- Title: `mri:metadataReference/cit:CI_Citation/cit:title/gco:CharacterString`

ISO 19139 does not have `associatedResource`. Skip RAiD checks for ISO 19139.

### 6.4. Responsible parties

**ISO 19115-3** — two nested structures exist:

1. **Organisation with nested individuals** (expected structure):
   ```
   cit:CI_Responsibility
     cit:role/cit:CI_RoleCode/@codeListValue
     cit:party/cit:CI_Organisation
       cit:name/gco:CharacterString
       cit:individual/cit:CI_Individual
         cit:name/gco:CharacterString
         cit:contactInfo/cit:CI_Contact/cit:address/cit:CI_Address/cit:electronicMailAddress/gco:CharacterString
   ```

2. **Standalone individual** (no organisation wrapper, seen in GA record):
   ```
   cit:CI_Responsibility
     cit:party/cit:CI_Individual
       cit:name/gco:CharacterString
   ```

Check for `cit:party/cit:CI_Organisation` first; if absent, check for `cit:party/cit:CI_Individual`. Standalone individuals should produce a warning.

Scoped queries from citation and pointOfContact:
- Citation: `cit:citedResponsibleParty/cit:CI_Responsibility`
- Point of contact: `mri:pointOfContact/cit:CI_Responsibility`

**ISO 19139** — flat sibling structure only (this is the only option in ISO 19139):
```
gmd:CI_ResponsibleParty
  gmd:individualName/gco:CharacterString
  gmd:organisationName/gco:CharacterString
  gmd:role/gmd:CI_RoleCode/@codeListValue
  gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress/gco:CharacterString
```

Scoped queries:
- Citation: `gmd:citedResponsibleParty/gmd:CI_ResponsibleParty`
- Point of contact: `gmd:pointOfContact/gmd:CI_ResponsibleParty`

Note: ISO 19139 records commonly use `gmd:individualName` for team or organisation names (e.g. "CSIRO Coastal Environmental Modelling", "Australian Institute of Marine Science"). The checker should flag these as potential team names when the value looks like an organisation.

### 6.5. ROR extraction (per organisation)

**ISO 19115-3** — two locations to check per `CI_Organisation`:

1. **partyIdentifier** (machine-readable):
   ```
   cit:CI_Organisation/cit:partyIdentifier/mcc:MD_Identifier
     mcc:code/*  (Anchor with xlink:href to https://ror.org/{id})
     mcc:codeSpace/gco:CharacterString  (expect containing "ror" or "ROR")
   ```

2. **onlineResource** (for GeoNetwork display):
   ```
   cit:CI_Organisation/cit:contactInfo/cit:CI_Contact/cit:onlineResource/cit:CI_OnlineResource
     cit:linkage/gco:CharacterString  (URL matching https://ror.org/...)
   ```

Both locations should be populated. If only one is present, report inconsistent encoding (error). If neither, report missing ROR (warning).

Scoped access to organisations:
- From citation: `cit:citedResponsibleParty/cit:CI_Responsibility/cit:party/cit:CI_Organisation`
- From pointOfContact: `mri:pointOfContact/cit:CI_Responsibility/cit:party/cit:CI_Organisation`

**ISO 19139** — `partyIdentifier` does not exist. ROR can only appear in `onlineResource`:
```
gmd:CI_ResponsibleParty/gmd:contactInfo/gmd:CI_Contact/gmd:onlineResource/gmd:CI_OnlineResource/gmd:linkage/gmd:URL
```
Detect ROR by URL pattern matching (`https://ror.org/...`). There is no `codeSpace` to identify these.

### 6.6. ORCID extraction (per individual)

**ISO 19115-3** — same two-location pattern as ROR but on `CI_Individual`:

1. **partyIdentifier**:
   ```
   cit:CI_Individual/cit:partyIdentifier/mcc:MD_Identifier
     mcc:code/*  (Anchor with xlink:href to https://orcid.org/{id})
     mcc:codeSpace/gco:CharacterString  (expect "orcid.org")
   ```

2. **onlineResource**:
   ```
   cit:CI_Individual/cit:contactInfo/cit:CI_Contact/cit:onlineResource/cit:CI_OnlineResource
     cit:linkage/gco:CharacterString  (URL matching https://orcid.org/...)
   ```

Individuals may be nested inside `CI_Organisation` or standalone under `cit:party`. Query with `//cit:CI_Individual` scoped within each citedResponsibleParty or pointOfContact block to find both cases.

**ISO 19139** — `partyIdentifier` does not exist. ORCID would only appear as a URL in `onlineResource`, but this is uncommon. Check by URL pattern; skip if none found.

### 6.7. Licensing and constraints

**ISO 19115-3** — from `MD_DataIdentification`: `mri:resourceConstraints/*`

Each constraint block may be `MD_LegalConstraints` or `MD_SecurityConstraints` (check `localName`). For legal constraints:
- CC licence: `mco:reference/cit:CI_Citation/cit:title/gco:CharacterString` (check for "Creative Commons")
- CC URL: `mco:reference/cit:CI_Citation/cit:onlineResource/cit:CI_OnlineResource/cit:linkage/gco:CharacterString` (check for `creativecommons.org`)
- Citation statement: `mco:otherConstraints/gco:CharacterString`

**ISO 19139** — same parent path but different structure: `gmd:resourceConstraints/*`
- CC licence: `gmd:useLimitation/gco:CharacterString` (check text for "Creative Commons")
- Constraints text: `gmd:otherConstraints/gco:CharacterString` (may contain citation statement)
- Note: NCI record has multiple `MD_LegalConstraints` blocks with different content; iterate all.

### 6.8. Template placeholder detection

Walk all text nodes in the document using a TreeWalker (`NodeFilter.SHOW_TEXT`). Flag any text containing `**` as an unresolved template placeholder (error). Check the title specifically for `*Draft*` (warning).

This check is schema-independent — it scans all text content regardless of element structure.

### 6.9. Hierarchy links

**ISO 19115-3:**
- Parent: `mdb:parentMetadata/@uuidref` (attribute on the element, not text content)
- Associated resources: `mri:associatedResource/mri:MD_AssociatedResource` (same path as RAiD; may contain non-RAiD associations)

**ISO 19139:**
- Parent: `gmd:parentIdentifier/gco:CharacterString` (text content, not attribute)
- No `associatedResource` equivalent in ISO 19139.

## 7. ISO 19139 support summary

ISO 19139 records can be partially checked. The following table indicates what is available:

| Rule | ISO 19115-3 | ISO 19139 | Notes |
|---|---|---|---|
| Schema detection | Full | Full | |
| Record identity | Full | Full | Different element names |
| DOI | Full | Partial | No Anchor, no structured codeSpace |
| RAiD | Full | **Skipped** | No associatedResource |
| Responsible parties | Full | Full | Flat structure only (valid for 19139) |
| ROR | Full (2 locations) | Partial (URL only) | No partyIdentifier in 19139 |
| ORCID | Full (2 locations) | Partial (URL only) | Rarely present in 19139 records |
| Licensing | Full | Full | Different element paths |
| Template placeholders | Full | Full | Schema-independent |
| Hierarchy | Full | Partial | No associatedResource |

For ISO 19139 records, the tool should report clearly that the record uses the older schema and recommend conversion to ISO 19115-3 via GeoNetwork's built-in conversion. Checks that are structurally impossible in ISO 19139 (e.g. checking for `partyIdentifier`) should be skipped rather than reported as errors.

## 8. De-duplication

The same organisation or individual may appear in both `citation` and `pointOfContact`. Track by `name + section` to avoid duplicate test entries within the same section, but allow the same name to appear under different sections (citation vs pointOfContact) since both locations should be checked independently. The NCI record has 6 cited parties and 13 points of contact with significant overlap.
