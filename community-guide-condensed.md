# Community Practice Guide — Condensed Reference

This is the condensed version of the *Community Practice Guide for Preparing ISO19115-3 Metadata Records for Projects and Datasets* (Flukes et al., 2026). It is written for software developers implementing the ISO 19115-3 Metadata Checker and as a reference for LLMs generating fix suggestions. It covers the encoding conventions, validation rules, and structural expectations that the checker enforces.

All ISO element paths in this document are relative to `mdb:MD_Metadata/mri:identificationInfo/mri:MD_DataIdentification/` unless otherwise noted.

---

## 1. Record types and scope codes

Three record types exist, each identified by `mdb:MD_Metadata/mdb:metadataScope`:

| Record type | Scope code (`mdb:metadataScope`) | Citation identifier | Notes |
|---|---|---|---|
| Dataset | `dataset` | DOI | Contains RAiD as associated resource |
| Project | `fieldSession` | RAiD | Contains team members as responsible parties |
| Program | `series` | RAiD | Top-level funding program |

**Auto-detection fallback:** If `metadataScope` is absent, record type can be inferred from title patterns (see §8).

---

## 2. Record hierarchy

Records are linked via `mdb:MD_Metadata/mdb:parentMetadata/@uuidref="{UUID}"`:
- Dataset → parent Project
- Project → parent Hub/Program
- Program → parent Funding Program

Dataset records also carry a direct link to the project RAiD in `mri:associatedResource` to avoid requiring hierarchy traversal.

---

## 3. PID encoding conventions

All PID identifiers use `mcc:MD_Identifier` with a common pattern:
- `mcc:code`: bare identifier string (no URL prefix) inside a `gcx:Anchor` whose `xlink:href` is the full resolvable URL
- `mcc:codeSpace`: authority domain (e.g. `doi.org`, `ror.org`, `orcid.org`, `raid.org`)
- `mcc:description`: optional human-readable label

### 3.1. DOI (dataset records only)

**Location:** `mri:citation/cit:CI_Citation/cit:identifier/mcc:MD_Identifier`

| Element | Value |
|---|---|
| `mcc:code` (text) | Bare DOI, e.g. `10.25959/BVJ7-D984` |
| `gcx:Anchor/@xlink:href` | `https://doi.org/10.25959/BVJ7-D984` |
| `mcc:codeSpace` | `doi.org` |
| `mcc:description` | `Digital Object Identifier (DOI)` (optional) |

**Validation rules:**
- DOI must be present in `cit:identifier` with `codeSpace` = `doi.org` → error if missing
- Value must be bare string (no `https://doi.org/` prefix) → error
- Anchor href must be `https://doi.org/{DOI}` and match the text value → error if mismatched
- DOI resolves via DataCite API (toggleable) → warning if unresolvable

### 3.2. RAiD

RAiD encoding location differs by record type.

**Project records** — `mri:citation/cit:CI_Citation/cit:identifier/mcc:MD_Identifier`:

| Element | Value |
|---|---|
| `mcc:code` (text) | Bare RAiD, e.g. `10.82210/7fe34398` |
| `gcx:Anchor/@xlink:href` | `https://raid.org/10.82210/7fe34398` |
| `mcc:codeSpace` | `raid.org` |
| `mcc:description` | `Project RAiD` (optional) |

**Dataset records** — `mri:associatedResource/mri:MD_AssociatedResource`:

| Element | Value |
|---|---|
| `mri:associationType` | `dependency` |
| `mri:initiativeType` | `project` |
| `mri:metadataReference/cit:CI_Citation/cit:title` | Full project title |
| `.../cit:identifier/mcc:MD_Identifier` | Same encoding as project RAiD above |

**Validation rules (project records):**
- RAiD present in `cit:identifier` with `codeSpace` = `raid.org` → error if missing
- Value must be bare string → error
- Anchor href matches → error if mismatched

**Validation rules (dataset records):**
- RAiD present in `mri:associatedResource` → error if missing
- `associationType` = `dependency` and `initiativeType` = `project` → error if wrong
- RAiD codeSpace and value encoding correct → error

**Both:** RAiD resolves (toggleable) → warning if unresolvable

### 3.3. ROR (all record types)

ROR must be encoded in **two** locations per organisation due to a GeoNetwork display limitation (GeoNetwork 3/4 cannot display `partyIdentifier`).

**Location 1 — Machine-readable (primary):** `cit:party/cit:CI_Organisation/cit:partyIdentifier/mcc:MD_Identifier`

| Element | Value |
|---|---|
| `mcc:code` (text) | Bare ROR, e.g. `03x57gn41` |
| `gcx:Anchor/@xlink:href` | `https://ror.org/03x57gn41` |
| `mcc:codeSpace` | `ror.org` |

**Location 2 — GeoNetwork display (workaround):** `cit:CI_Organisation/cit:contactInfo/cit:CI_Contact/cit:onlineResource/cit:CI_OnlineResource`

| Element | Value |
|---|---|
| `cit:linkage` | `https://ror.org/03x57gn41` |
| `cit:protocol` | `WWW:LINK-1.0-http--link` |
| `cit:name` | `ROR ID` (optional) |

**Organisation name rule:** The `cit:CI_Organisation/cit:name` value **must exactly match** the canonical name from the ROR registry (the `ror_display` name). Sub-organisation names must not be combined with a parent ROR. Sub-organisations without their own ROR should use the parent's ROR and record the sub-org name in the individual's address delivery point.

**Validation rules:**
- ROR in `partyIdentifier` with `codeSpace` = `ror.org` → warning if missing (org may not have one)
- ROR also in `onlineResource` → warning if missing but `partyIdentifier` present
- Present in one location but not the other → error (inconsistent)
- Value is bare string → error
- Anchor href matches → error if mismatched
- ROR resolves and org name matches canonical ROR name (toggleable) → error if name mismatch, warning if unresolvable

### 3.4. ORCID (all record types)

ORCID must be encoded in **two** locations per individual (same GeoNetwork workaround as ROR).

**Location 1 — Machine-readable:** `cit:CI_Organisation/cit:individual/cit:CI_Individual/cit:partyIdentifier/mcc:MD_Identifier`

| Element | Value |
|---|---|
| `mcc:code` (text) | Bare ORCID, e.g. `0000-0002-3144-3475` |
| `gcx:Anchor/@xlink:href` | `https://orcid.org/0000-0002-3144-3475` |
| `mcc:codeSpace` | `orcid.org` |

**Location 2 — GeoNetwork display:** `cit:CI_Individual/cit:contactInfo/cit:CI_Contact/cit:onlineResource/cit:CI_OnlineResource`

| Element | Value |
|---|---|
| `cit:linkage` | `https://orcid.org/0000-0002-3144-3475` |
| `cit:protocol` | `WWW:LINK-1.0-http--link` |
| `cit:name` | `ORCID` (optional) |

**Validation rules:**
- ORCID in `partyIdentifier` with `codeSpace` = `orcid.org` → warning if missing (person may not have one)
- ORCID also in `onlineResource` → warning if missing but `partyIdentifier` present
- Present in one location but not the other → error (inconsistent)
- Value is bare string → error
- Anchor href matches → error if mismatched
- ORCID resolves (toggleable) → warning if unresolvable
- Person name consistent with ORCID registered name → warning if family name differs

**ORCID name matching:** The ORCID API returns `family-name` and `given-names`. The expected metadata name is `"{family-name}, {given-names}"`. A match on family name is sufficient for a pass.

---

## 4. External PID validation APIs

Toggleable (default: enabled). When disabled, structural checks still run.

| PID | API endpoint | Returns |
|---|---|---|
| ROR | `https://api.ror.org/v2/organizations/{id}` | Canonical name (`.names[]` where `type` = `ror_display`) |
| ORCID | `https://pub.orcid.org/v3.0/{id}/person` | `family-name`, `given-names` |
| DOI | `https://api.datacite.org/dois/{doi}` | Resolution status |
| RAiD | `https://raid.org/{handle}` | Resolution status |

Results are cached in localStorage keyed by identifier value. Cache stores resolution status and any returned metadata (canonical names, registered names).

---

## 5. People and organisation structure

### 5.1. Responsible party structure

Each `cit:citedResponsibleParty` or `mri:pointOfContact` block contains exactly **one** organisation and **one** individual:

```
cit:CI_Responsibility
  └─ cit:role / cit:CI_RoleCode
  └─ cit:party / cit:CI_Organisation
       ├─ cit:name (org name, must match ROR)
       ├─ cit:contactInfo (ROR onlineResource here)
       ├─ cit:partyIdentifier (ROR here)
       └─ cit:individual / cit:CI_Individual
            ├─ cit:name ("Family, Given")
            ├─ cit:contactInfo (ORCID onlineResource, email, address)
            └─ cit:partyIdentifier (ORCID here)
```

If multiple people share an organisation, the organisation element is **repeated** for each individual — not grouped.

Individuals without an organisation use `cit:party/cit:CI_Individual` directly (no organisation or ROR).

### 5.2. Roles

| Context | Role | Code |
|---|---|---|
| Project/dataset leader | Principal Investigator | `principalInvestigator` |
| Other team members | Collaborator | `collaborator` |
| Contact person | Point of Contact | `pointOfContact` |

### 5.3. Name formatting

- Format: `Family name, Given name` (e.g. `Lawrey, Eric`)
- No title prefixes: Dr, Prof, Professor, Mr, Mrs, Ms, Miss, Sir, Dame, Rev
- Address details optional; state (full name) and country recommended for individuals
- Email **required** for `pointOfContact` entries

### 5.4. Validation rules

- Each `citedResponsibleParty` has one org + one individual nested as `CI_Organisation/cit:individual/cit:CI_Individual` → error if multiple individuals per block
- Individual without organisation → warning
- At least one `principalInvestigator` in cited responsible parties → warning if none
- `pointOfContact` present → warning if missing
- `pointOfContact` has email → error if present but lacks email
- Name contains comma → warning if no comma (likely wrong format)
- No title prefixes → warning if detected

---

## 6. Licensing and citation (dataset records)

- Legal constraints must be present → warning
- Creative Commons licence (name or URL) present in legal constraints → warning
- Formatted citation statement in "Other constraints" (APA-style data citation) → warning

---

## 7. Template placeholder detection

The eAtlas metadata template uses `**` delimiters to mark fields requiring replacement (e.g. `**Last name, First name**`, `**ROR ID**`).

- Any text field containing `**` → error (unresolved template placeholder)
- Title containing `*Draft*` → warning (may be intentional but should be reviewed)

---

## 8. NESP MaC conventions (optional profile)

These checks are disabled by default and enabled via the "NESP MaC Conventions" rule profile.

### 8.1. Title patterns

**Project records:** `{Program} Project {Code} - {Title} ({Orgs})`
- Example: `NESP MaC Project 3.11 - Multi-fishery collaboration to assess population abundances... (CSIRO, CDU)`

**Dataset records:** `{Title} ({Program} {Code}, {Orgs})`
- Example: `Coral Sea Oceanic Vegetation (NESP MaC 2.3, AIMS)`

### 8.2. Standard online resources (project records)

Project records must include links to:
- NESP MaC Hub project page
- DCCEEW NESP website: `https://www.dcceew.gov.au/science-research/nesp/hub-marine-coastal`
- Final project report

---

## 9. Hierarchy and structure checks

- `parentMetadata` UUID present → warning if missing (standalone datasets are valid)
- `metadataScope` present → warning if missing

---

## Appendix: XML reference fragments

### DOI in dataset citation

```xml
<!-- mri:citation/cit:CI_Citation -->
<cit:identifier>
  <mcc:MD_Identifier>
    <mcc:code>
      <gcx:Anchor xlink:href="https://doi.org/10.25959/BVJ7-D984">10.25959/BVJ7-D984</gcx:Anchor>
    </mcc:code>
    <mcc:codeSpace>
      <gco:CharacterString>doi.org</gco:CharacterString>
    </mcc:codeSpace>
    <mcc:description>
      <gco:CharacterString>Digital Object Identifier (DOI)</gco:CharacterString>
    </mcc:description>
  </mcc:MD_Identifier>
</cit:identifier>
```

### RAiD in project citation

```xml
<!-- mri:citation/cit:CI_Citation -->
<cit:identifier>
  <mcc:MD_Identifier>
    <mcc:code>
      <gcx:Anchor xlink:href="https://raid.org/10.82210/7fe34398">10.82210/7fe34398</gcx:Anchor>
    </mcc:code>
    <mcc:codeSpace>
      <gco:CharacterString>raid.org</gco:CharacterString>
    </mcc:codeSpace>
    <mcc:description>
      <gco:CharacterString>Project RAiD</gco:CharacterString>
    </mcc:description>
  </mcc:MD_Identifier>
</cit:identifier>
```

### RAiD in dataset associated resource

```xml
<!-- mri:MD_DataIdentification -->
<mri:associatedResource>
  <mri:MD_AssociatedResource>
    <mri:associationType>
      <mri:DS_AssociationTypeCode
        codeList="...#DS_AssociationTypeCode"
        codeListValue="dependency" />
    </mri:associationType>
    <mri:initiativeType>
      <mri:DS_InitiativeTypeCode
        codeList="...#DS_InitiativeTypeCode"
        codeListValue="project" />
    </mri:initiativeType>
    <mri:metadataReference>
      <cit:CI_Citation>
        <cit:title>
          <gco:CharacterString>NESP MaC Project 3.17 - Locating Unidentified
            Reef and Habitat Features... (AIMS, UQ)</gco:CharacterString>
        </cit:title>
        <cit:identifier>
          <mcc:MD_Identifier>
            <mcc:code>
              <gcx:Anchor xlink:href="https://raid.org/10.82210/dbdfe884">10.82210/dbdfe884</gcx:Anchor>
            </mcc:code>
            <mcc:codeSpace>
              <gco:CharacterString>raid.org</gco:CharacterString>
            </mcc:codeSpace>
          </mcc:MD_Identifier>
        </cit:identifier>
      </cit:CI_Citation>
    </mri:metadataReference>
  </mri:MD_AssociatedResource>
</mri:associatedResource>
```

### Responsible party with ROR and ORCID

```xml
<!-- mri:citation/cit:CI_Citation -->
<cit:citedResponsibleParty>
  <cit:CI_Responsibility>
    <cit:role>
      <cit:CI_RoleCode codeList="...#CI_RoleCode"
        codeListValue="principalInvestigator"/>
    </cit:role>
    <cit:party>
      <cit:CI_Organisation>
        <cit:name>
          <gco:CharacterString>Australian Institute of Marine Science</gco:CharacterString>
        </cit:name>
        <cit:contactInfo>
          <cit:CI_Contact>
            <cit:address/>
            <cit:onlineResource>
              <cit:CI_OnlineResource>
                <cit:linkage>
                  <gco:CharacterString>https://ror.org/03x57gn41</gco:CharacterString>
                </cit:linkage>
                <cit:protocol>
                  <gco:CharacterString>WWW:LINK-1.0-http--link</gco:CharacterString>
                </cit:protocol>
                <cit:name>
                  <gco:CharacterString>ROR ID</gco:CharacterString>
                </cit:name>
              </cit:CI_OnlineResource>
            </cit:onlineResource>
          </cit:CI_Contact>
        </cit:contactInfo>
        <cit:partyIdentifier>
          <mcc:MD_Identifier>
            <mcc:code>
              <gcx:Anchor xlink:href="https://ror.org/03x57gn41">03x57gn41</gcx:Anchor>
            </mcc:code>
            <mcc:codeSpace>
              <gco:CharacterString>ror.org</gco:CharacterString>
            </mcc:codeSpace>
          </mcc:MD_Identifier>
        </cit:partyIdentifier>
        <cit:individual>
          <cit:CI_Individual>
            <cit:name>
              <gco:CharacterString>Lawrey, Eric</gco:CharacterString>
            </cit:name>
            <cit:contactInfo>
              <cit:CI_Contact>
                <cit:address>
                  <cit:CI_Address>
                    <cit:administrativeArea>
                      <gco:CharacterString>Queensland</gco:CharacterString>
                    </cit:administrativeArea>
                    <cit:country>
                      <gco:CharacterString>Australia</gco:CharacterString>
                    </cit:country>
                    <cit:electronicMailAddress>
                      <gco:CharacterString>e.lawrey@aims.gov.au</gco:CharacterString>
                    </cit:electronicMailAddress>
                  </cit:CI_Address>
                </cit:address>
                <cit:onlineResource>
                  <cit:CI_OnlineResource>
                    <cit:linkage>
                      <gco:CharacterString>https://orcid.org/0000-0002-3144-3475</gco:CharacterString>
                    </cit:linkage>
                    <cit:protocol>
                      <gco:CharacterString>WWW:LINK-1.0-http--link</gco:CharacterString>
                    </cit:protocol>
                    <cit:name>
                      <gco:CharacterString>ORCID</gco:CharacterString>
                    </cit:name>
                  </cit:CI_OnlineResource>
                </cit:onlineResource>
              </cit:CI_Contact>
            </cit:contactInfo>
            <cit:partyIdentifier>
              <mcc:MD_Identifier>
                <mcc:code>
                  <gcx:Anchor xlink:href="https://orcid.org/0000-0002-3144-3475">0000-0002-3144-3475</gcx:Anchor>
                </mcc:code>
                <mcc:codeSpace>
                  <gco:CharacterString>orcid.org</gco:CharacterString>
                </mcc:codeSpace>
              </mcc:MD_Identifier>
            </cit:partyIdentifier>
          </cit:CI_Individual>
        </cit:individual>
      </cit:CI_Organisation>
    </cit:party>
  </cit:CI_Responsibility>
</cit:citedResponsibleParty>
```
