# Community Practice Guide for Preparing ISO19115-3 Metadata Records for Project and Datasets


**Project:** Enhancing Discoverability and Impact: Standardising NESP Marine and Coastal Data with Persistent Identifiers\
**Project page:** <https://doi.org/10.3565/pkjc-z984>


**How to cite this document:**

Flukes, E., Lawrey, E., Babicci, S., Johnston, J., Hammerton, Lafond, G., Barlow, M., Martin, J. (2026). Community Practice Guide for Preparing ISO19115-3 Metadata Records for Project and Datasets. IMAS. \[DOI to metadata record on IMAS\]

This is a markdown version of the community guide. This version is currently missing the figures.


# 1. Introduction

This guide explains how persistent identifiers should be represented in ISO 19115-3 metadata records, using the National Environmental Science Program Marine and Coastal (NESP MaC) Hub as a community of practice example.

## 1.1. Audience

This guide is intended for individuals and teams responsible for creating, editing, and managing ISO19115-3 metadata records for research projects and their associated datasets.

## 1.2. Scope and use of this guide

The guide provides practical guidance on where and how to record persistent identifiers within ISO 19115-3 metadata records, with a primary focus on DOI, ROR, ORCID, and RAiD. It also documents the community metadata conventions used within NESP Marine and Coastal (MaC) Hub research program to support consistency, interoperability, and downstream harvesting.

The guidance reflects workflows used by IMAS and eAtlas on behalf of the NESP MaC Hub, and conventions that support integration with Research Data Australia (RDA), including alignment with practices used by the Australian Ocean Data Network (AODN). While these conventions are based on Australian practice, they are broadly applicable to other organisations seeking to implement consistent, standards-aligned metadata workflows. The guide assumes basic familiarity with ISO 19115-3 structure and common metadata management practices.

# 2. Persistent identifiers (concepts and lifecycle)

## 2.1. What are persistent identifiers?

Persistent identifiers (PIDs) are long-lived, resolvable references used to identify and link people, organisations, research activities, and digital objects. They are globally unique and machine-readable, supporting consistent citation, attribution, aggregation, and linking across systems.

The key persistent identifiers covered in this guide are:

| Identifier | Description |
|----|----|
| DOI (Digital Object Identifier) | A persistent identifier for digital objects such as datasets, reports, publications, and software. DOIs support formal citation, long-term access, and reuse tracking. |
| ORCID (Open Researcher and Contributor ID) | A persistent identifier for individual researchers and contributors. ORCID supports unambiguous attribution and links individuals to their contributions across systems. |
| ROR (Research Organization Registry) | A community-managed global registry assigning persistent identifiers to research organisations. ROR supports consistent institutional attribution and machine grouping across systems. |
| RAiD (Research Activity Identifier) | A persistent identifier for research projects and activities. RAiD provides a structured way to link contributors, organisations, outputs, and funding context to a defined research activity. |

## 2.2. Why record PIDs in metadata?

Metadata records describe research datasets and activities and help users discover, understand, access, and re-use data outputs. Recording persistent identifiers in metadata records enables the expression of structured relationships between datasets, people, organisations, and research activities in a machine-readable way.

When recorded consistently, PIDs support unambiguous attribution and linking across systems. For example, a dataset DOI can identify the dataset as a citable output, while ORCID, ROR, and RAiD can link that dataset to its contributors, organisations, and project context. Within the NESP MaC Hub, this helps connect datasets, projects, programs, contributors, and institutions in ways that support downstream aggregation, attribution, and impact tracking.

## 2.3. Credit assignment 

One the key goals of attaching persistent identifiers to projects and datasets is to allow credit to be distributed to people, organisations and funding programs, helping to trace the impact of research. However, it takes more than recording the persistent identifiers to achieve this goal. Uses of the datasets need to be cited using the DOIs and a document crawler is needed to discover these citations. Finally, analysis is needed to trace through the metadata chain to assign credit. This guide focuses on recording the PIDs, not the challenges associated with data citation adoption or the systems needed for credit assignment.

## 2.4. Linking PIDs though ISO metadata

In Australia, the ISO 19115-3 metadata standard is widely used across marine, environmental and government domains. This strutured metadata format supports harvesting into national aggregation services such as Research Data Australia (RDA), forming part of a broader research information ecosystem where datasets, projects, people and organisations are interconnected.

Persistent identifiers are created and managed in external systems: DOIs by registered minting clients via [DataCite](https://doi.datacite.org), ROR identifiers through the community-curated [Research Organization Registry](https://ror.org/), ORCIDs by individual researchers through the [ORCID](https://orcid.org) registry, and RAiDs by authorised users of the [ARDC RAiD service](https://app.prod.raid.org.au), which acts as the registration agency for Australia and New Zealand.

ISO 19115-3 metadata records do not create these identifiers; rather, they record and reference them in standard metadata elements. This allows datasets to be unambiguously linked to their creators (via ORCID), their organisations (via ROR), and the research activities that produced them (via RAiD), while also providing a persistent citation reference for the dataset itself (via DOI). In practice, this creates a chain of relationships linking datasets, projects, programs, contributors, and institutions. This allows downstream systems to aggregate related outputs, attribute contributions accurately, and track the impact of research activities over time.

In this guide, the ISO metadata record acts as the primary descriptive record for the dataset, project, or program, while the PID provides a persistent and resolvable identifier. Machine tracing of these relationships depends on identifiers being recorded consistently in standard ISO 19115-3 elements. This guide provides conventions for encoding these identifiers so that harvesters and research infrastructure can resolve and link research outputs across national and international systems.

# 3. NESP Marine and Coastal Hub metadata model

## 3.1. Metadata record hierarchy and relationships

This guide uses the data management approach adopted for the NESP MaC Hub research program as an example for structuring ISO19115-3 metadata records and persistent identifiers. The NESP structure consists of a funding program, which contains thematic hubs, each of which contains multiple research projects. These projects may produce one or more datasets and other research outputs. In this model, each of these entities – funding program, hub, project, and dataset – is represented by a separate ISO 19115-3 metadata record.

The hierarchical relationship between these entities is represented using the parentMetadata reference in ISO19115-3. Dataset records reference their parent project record, which references the hub record (NESP MaC), and the hub record references the funding program record (NESP). This creates a chain of linked metadata records that reflects the structure of the research program and allows external systems to follow relationships between datasets and the projects and programs that produced them ([Figure 1](#_Ref222320502)).

![](media/image7.png)

Figure 1. Hierarchical relationship between ISO 19115-3 metadata records representing datasets, projects, research hubs, and funding programs. Each ISO19115-3 record is linked up the chain using the parentMetadata reference. Each ISO19115-3 is cross linked with a matching persistent identifier record – DOIs for datasets and RAiDs for projects, hubs, and programs.

Dataset metadata records are linked to both their parent Project metadata record (via the parentMetadata link) and a direct reference to the project RAiD. This direct link to the project RAiD is included to reduce the need for external systems to traverse the full metadata hierarchy to resolve project relationships. The goal of this hierarchy is to facilitate credit assignment from a DOI record to people, organisations, research activities, and funding programs ([Figure 2](#_Ref227823159)).

![](media/image8.png)

Figure 2. An example PID-enabled traceability pathway within the NESP Marine and Coastal Hub model, showing how a dataset DOI can be linked through ISO 19115-3 metadata to the people, organisation, project, and funding context associated with it. A government policy document that contains DOIs references can be traced through this chain to its associated funding program.

## 3.3. Relationship between ISO metadata and PID records

Within the NESP Mac Hub, ISO 19115-3 metadata records are created and maintained as the primary source of descriptive information about datasets, projects, and research programs. Persistent identifier records, such as DOIs and RAiDs, contain a structured subset of this information to support identification, citation, and linking across systems. Dataset DOIs resolve to a landing page – typically the ISO metadata record – while RAiDs resolve to their own landing page and may link to related resources, including the corresponding ISO project metadata record.

For the NESP MaC Hub, RAiDs are created from the corresponding ISO 19115-3 project metadata records to maintain consistency. DOI and RAiD records are therefore derived from, and aligned with, the corresponding ISO metadata records, while the ISO metadata remains the primary descriptive point of truth.

# 4. Recording persistent identifiers in ISO19115-3

## 4.1. Quick reference: ISO paths and encoding patterns

[Table 1](#_Ref227827308) provides a quick reference to the ISO 19115-3 elements used to record persistent identifiers in this guide. It summarises the relevant section path for each identifier type and highlights key encoding rules and implementation notes. Detailed guidance and examples for each identifier are provided in [Section 4.2](#section).

[TABLE]

Table 1. Quick reference to the ISO 19115-3 elements used to record persistent identifiers in this guide.\
\*All ISO paths begin with mdb:MD_Metadata / mri:identificationInfo / mri:MD_DataIdentification /

## 

## 4.2. Detailed encoding guidance by identifier

The following sections provide detailed guidance on how each persistent identifier should be recorded in ISO 19115-3 metadata records, including the relevant elements, encoding conventions, and implementation notes.

GeoNetwork 3 and 4 do not currently support the display of Party Identifiers within the GeoNetwork interface. For this reason, ROR and ORCID identifiers are also encoded as additional *Online Resources* to support display in GeoNetwork. This is considered a temporary work around solution. Parties harvesting the ISO records for machine readable purposes, such as cross walking to a different metadata standard, should not rely on the *Online Resource* links, but instead use the *Identifier for the Party* links instead.

### 4.2.1. DOI encoding

A DOI is encoded in the **citation identifier** element of the metadata record (see [Appendix A](#appendix-a-xml-for-dois-in-iso-records)).

The DOI represents the formal citation identifier for dataset records ([Figure 3](#_Ref227751529)).

- Use cit:identifier within the mri:citation/cit:CI_Citation element

- Inside mcc:MD_Identifier:

  - Record the DOI as an anchored link:

    - Value: DOI string (e.g. 10.26274/z8b6-zx94, with no <https://doi.org/> prefix)

    - Link: https://doi.org/\[DOI\] - Full link

  &nbsp;

  - Set mcc:codeSpace to doi.org

  - Optional: record a human-readable description in mcc:description (e.g. “Digital Object Identifier (DOI)”)

![](media/image9.png)

Figure 3. Recording a DOI in a dataset record.

### 4.2.2. ROR encoding

When a ROR is recorded, it should be encoded in two locations (see [Appendix B](#_Appendix_B:_Example)):

1.  For crosswalk and machine-readability ([Figure 4](#_Ref222402996))

    - Use cit:partyIdentifier within the cit:party/cit:CI_Organisation element

    - Inside mcc:MD_Identifier:

      - Record the record the ROR ID as an anchored link:

        - Value: ROR string (e.g. 028khat13, with no <https://ror.org/> prefix)

        - Link: [https://ror.org/\[ROR](https://ror.org/%5bROR)\] – Full link to the ROR.

      - Set mcc:codeSpace to ror.org

      - Optional: record a human-readable description in mcc:description (e.g. “ROR ID”)

2.  For display in GeoNetwork ([Figure 5](#_Ref227749036))

    - Add the ROR URL as a cit:onlineResource to the cit:CI_Organisation/cit:contactInfo element

    - Use protocol WWW:LINK-1.0-http—link

    - Optional: record a human-readable description in cit:name (e.g. “ROR ID”)

![A screenshot of a computer Description automatically generated](media/image10.png)

Figure 4. Recording a ROR as a Party Identifier for the Organisation for machine readability. The codeSpace value ror.org identifies the authority for the identifier, indicating the meaning of the identifier, while the anchored link stores the resolvable ROR URL.

![](media/image11.png)

Figure 5. Additionally recording the ROR as an Online Resource for the Organisation to enable display in GeoNetwork.

### 4.2.3. ORCID encoding

When an ORCID is recorded, it should be encoded in two locations (see [Appendix B](#_Appendix_B:_Example)):

1.  For crosswalk and machine-readability ([Figure 6](#_Ref227755650))

    - Use cit:partyIdentifier within the cit:individual/cit:CI_individual element

    - Inside mcc:MD_Identifier:

      - Record the record the ORCID as an anchored link:

        - Value: ORCID string (e.g. 0000-0003-2749-834X, no <https://orcid.org/> prefix)

        - Link: [https://orcid.org/\[ORCID](https://orcid.org/%5bORCID)\] – Full link

      - Set mcc:codeSpace to orcid.org

      - Optional: record a human-readable description in mcc:description (e.g. “ORCID”)

2.  For display in GeoNetwork ([Figure 7](#_Ref227755745))

    - Add the ORCID URL as a cit:onlineResource to the cit:CI_individual/cit:contactInfo element

    - Use protocol WWW:LINK-1.0-http—link

    - Optional: record a human-readable description in cit:name (e.g. “ORCID”)

![](media/image12.emf)

Figure 6. Recording an ORCID as a Party Identifier for the Individual for machine readability. The codeSpace value orcid.org identifies the authority for the identifier, while the anchored link stores the resolvable ORCID URL.

![](media/image13.png)

Figure 7. Additionally recording the ORCID as an Online Resource for the Individual to enable display in GeoNetwork.

### 4.2.4. RAiD encoding

RAiDs are encoded in different locations in ISO19115-3 records depending on whether the metadata record is for a **dataset** or **project** (see [Appendix C](#appendix-c-xml-for-raids-in-iso-records)).

For **project** records, use mri:citation/cit:CI_Citation ([Figure 8](#_Ref227756145)):

- Inside cit:identifier:

  - Record the RAiD as an anchored link:

    - Value: RAiD string (e.g. 10.71676/ea5d7c5f, no <https://raid.org/> prefix)

    - Link: https://raid.org/\[RAiD\]

  - Set mcc:codeSpace to raid.org

  - Optional: record a human-readable description in mcc:description (e.g. “Project RAiD”)

For **dataset** records, use mri:associatedResource/mri:MD_AssociatedResource ([Figure 9](#_Ref227756225)):

- Use mri:associationType AssociationTypeCode = ‘Dependancy’

- Use mri:initiativeType InitiativeTypeCode = ‘Project’

- Inside mri:metadataReference/cit:CI_Citation, record the project title and RAiD:

  - cit:title = full title of RAiD record (human-readable)

  - Inside cit:identifier:

    - Record the RAiD as an anchored link:

      - Value: RAiD string (e.g. 10.71676/ea5d7c5f)

      - Link: https://raid.org/\[RAiD\]

    - Set mcc:codeSpace to raid.org

    - Optional: record a human-readable description in mcc:description (e.g. “Project RAiD”)

![](media/image14.png)

Figure 8. Recording the RAiD for a **project** record as a citation identifier.

![](media/image15.png)

Figure 9. Recording the RAiD for a dataset record as a ‘dependant’ associated resource.

# 5. NESP MaC metadata structure and conventions

## 5.1. Core ISO 19115-3 elements used

The ISO19115-3 metadata standard includes many elements with complex field paths. While the ISO standard provides flexibility in how metadata elements can be used, this community guide establishes agreed conventions within the NESP Marine and Coastal Hub for how key elements should be used to ensure reliable integration with external systems ([Table 2](#_Ref206515926)).

| **Parent metadata** (UUID of project metadata record) |  |  |  |  |
|----|----|----|----|----|
| **Citation** |  |   |   |   |
|   | **Title**: Descriptive title (funder, project code, institution(s)) |  |  |  |
|   | **Citation identifie**r: DOI (dataset) / RAiD (project record) |  |  |  |
|   | **Cited responsible parties** (dataset: authors, project: team members) |  |  |  |
|   |   | **Role**: Principal Investigator (project leader) / Collaborator (other team members) |  |  |
|   |   | **Organisation** |  |  |
|   |   |   | **Organisation name** *(must match ROR name)* |  |
|   |   |   | **Address**: \[Empty\] |  |
|   |   |   | **Online resource**: ROR *(for Geonetwork display)* |  |
|   |   |   | **Identifier for party**: ROR *(for RDA crosswalk)* |  |
|   |   |   | **Individual** |  |
|   |   |   |   | **Name**: Last name, First name *(no title)* |
|   |   |   |   | **Address** *(details for dataset lead, empty for other parties)* |
|   |   |   |   | **Online resource**: ORCID *(for Geonetwork display)* |
|   |   |   |   | **Identifier for party**: ORCID *(for RDA crosswalk)* |
| **Abstract** *(enough detail for discoverability and reuse)* |  |  |  |  |
| **Point of contact** *(usually project leader, same structure as cited responsible parties)* |  |  |  |  |
| **Extent** (polygon or bounding box of data) |  |  |  |  |
|   | **Extent** (polygon or bounding box of data) |  |  |  |
|   | **Temporal extent** (time period: begin and end) |  |  |  |
| **Legal constraints** |  |  |   |   |
|   | **Resource constraints** |  |  |  |
|   |   | **Creative commons** (legal constraint with XML block) |  |  |
|   |   | **Other constraints** (cite data as: APA7 data biography reference) |  |  |
| **Associated resource** (dataset) |  |  |  |  |
|  | **Citation: Title:** Name of the project |  |  |  |
|  | **Citation identifier:** RAID |  |  |  |
| **Distribution / Associated resources** |  |  |  |  |
|  | **Online resources** (links to data download, WMS service, reports, …) |  |  |  |
| **Metadata** |  |   |   |   |
|   | **Hierarchy level - Resource scope**: (‘Dataset’ or ‘Field Session’ for projects) |  |  |  |

Table 2. Overview of the important ISO19115-3 elements covered by this community guide.

## 5.2. Implementing parent-child relationships

Metadata records that form part of a broader program of project hierarchy (e.g. NESP Marine and Coastal Hub) should be linked using a **parent-child** relationships. In this guide, **dataset** records should reference their parent **project** record, while **project** records should reference their parent **hub** or **funding program**. This supports navigation and aggregation across related records in GeoNetwork and downstream systems.

In ISO19115-3, this relationship is implemented using the parentMetadata reference, which stores the UUID of the parent metadata record:

> mdb:MD_Metadata/mdb:parentMetadata uuidref="{UUID of parent record}"

Parent-child links may be used across catalogues, provided the records are harvested into a common aggregation environment. Within the NESP Marine and Coastal Hub, this occurs where IMAS and eAtlas manage separate sets of project records under the same broader program. For example, a program-level metadata record may be created and maintained by IMAS, while eAtlas project records reference the UUID of that IMAS-managed record even though the parent record is not held locally in the eAtlas catalogue. The full parent-child hierarchy is then represented once all records are aggregated in the AODN portal.

## 5.3. Record titles

Record titles should be descriptive and preserve key provenance information, including the relevant funding context, project codes, and lead organisation(s). This helps make records more interpretable when viewed or cited independently of the broader metadata hierarchy.

**Project records**

Project records should include the program abbreviation, project code, descriptive project title, and lead organisation(s). The following syntax is used within the NESP MaC Hub:

> {Program abbreviation} Project {Project code} - {Descriptive title matching the Research Plan} ({abbreviated list of lead organisation(s)})
>
> *NESP MaC Project 3.11 - Multi- fishery collaboration to assess population abundances and post release survival of threatened sawfish in northern Australia, 2023-2026 (CSIRO, CDU)*

**Dataset records**

Dataset record titles should lead with the descriptive dataset title, followed by the program abbreviation, project code, and lead organisation(s) in parentheses. This keeps the subject of the dataset prominent while retaining key provenance information:

> {Descriptive title of the dataset} ({Program abbreviation} {Project code}, {abbreviated list of lead organisation(s)})
>
> *Coral Sea Oceanic Vegetation (NESP MaC 2.3, AIMS)*

## 5.4. People and organisations

The ISO19115-3 standard allows people to be represented in multiple ways. In this community convention, each individual is recorded in a separate responsibility block, i.e. a separate cit:citedResponsibleParty and mri:pointOfContact entry. This allows each individual to be assigned an explicit cit:role code for their involvement with the project or dataset, and preserves a clear one-to-one relationship between individuals and their organisation.

#### Structure

- Each responsibility block should contain one organisation and one individual.

- Individuals should be nested within their organisation using the structure cit:party/cit:CI_Organisation/cit:individual/cit:CI_Individual

- If multiple people belong to the same organisation, the organisation element should be repeated for each individual.

- If a person has no organisation, such as a personal submission, then they should be recorded under cit:party/cit:CI_Individual with no organisation or ROR.

#### Responsible Parties

Responsible Parties define the contributors associated with the resource and form the basis of the dataset or project citation.

For project records:

- All authors of the final project report should be listed as responsible parties. The team list should be verified by the project leaders towards the end of the project to cater team members that are not listed in the project reports.

- Project leaders and co-leaders should use role code principalInvestigator

- Other project personnel should use role code collaborator

For dataset records:

- All authors associated with the development of the dataset should be included. This may be a subset of the project team members.

&nbsp;

- The lead author(s) should use role code principalInvestigator

&nbsp;

- Other contributors should use role code collaborator

#### Points of Contact

Points of Contact identify the person or people responsible for enquiries about the resource.

- Only project leaders or co-leaders, or a person specifically nominated by the project leader (e.g. a data specialist) should be listed as points of contact.

- The role code pointOfContact should be used.

- An email address must be provided for points of contact.

#### Organisation and Individual identifiers

- Each organisation must include its **ROR identifier**, where available (see Section [4.2.2.](#ror-encoding)).

- Each individual should include their **ORCID**, where available (see Section [4.2.3.](#orcid-encoding)).

#### Naming and contact details

- Names should be recorded as *Family name, Given name*, for example *Lawrey, Eric.*

- Titles such as Dr, Prof, or Mr should not be included. Omitting titles allow ISO records to be exported to DataCiteJSON for DOI records and removes ambiguity from changing titles.

- Postal and physical address details should be treated as optional, as they are often difficult to maintain and quickly become outdated. The primary form of contact is through the point of contact email, or through information linked to the authors’ ORCID records.

- State (long form, e.g. Queensland) and country should be included within the cit:CI_Address element **for individuals** to provide geographic context.

#### Maintenance conventions

- Points of contact may be updated over time to reflect current contact arrangements.

- Citation contributors (responsible parties) should not be retrospectively altered once the record is established.

## 5.5. Dataset citation statements & licensing

The citation section of the metadata record contains the information needed to support correct citation. Contributor information recorded in the citation should be complete and accurate, as described in Section [5.4. People and organisations](#people-and-organisations).

In addition to the DOI itself, dataset records should include a formatted citation statement in API style within the *Legal Constraints / Other Constraints* element. This provides users with a clear, ready-to-use citation and helps ensure that the dataset is cited consistently when reused ([Figure 10](#_Ref222399102)).

![A screenshot of a computer Description automatically generated](media/image16.png)

Figure 10. Example of a formatted dataset citation recorded in the Legal Constraints / Other Constraints element of an ISO 19115-3 metadata record. This enables researchers to use a single consistent dataset citation and makes it clear that the dataset should be cited if it is used.

Licensing information should be recorded clearly and consistently in metadata records so that users can understand the conditions of access, use, and reuse associated with the resource. In ISO 19115-3 metadata, this information should be recorded within the *Resource constraints / Legal constraints* elements.

Where a standard licence applies, the metadata should record the licence name and, where possible, a resolvable licence URL. For NESP Marine and Coastal Hub records, the default licence for open datasets is **Creative Commons Attribution 4.0 International (CC BY 4.0)** unless another licence or access condition is required.

## 5.6. Standard online resources (project records)

All NESP Marine and Coastal Hub project metadata records should include a standard set of online resources to support navigation, context, and access to related project information and key outputs. They should be recorded as online resources using names that clearly indicate the type of linked resource.

At a minimum, project records should include links to:

- the project page on NESP Marine and Coastal Hub website.

- the Department of Climate Change, Energy, the Environment and Water NESP website\
  <https://www.dcceew.gov.au/science-research/nesp/hub-marine-coastal>

- the final project report on the NESP MaC Hub website.

## 5.7. Record types and scope codes (dataset, project, program)

In this community convention, the mdb:metadataScope element is used to distinguish between dataset, project, and program records. This scope code determines how records are interpreted and displayed in downstream systems including Research Data Australia, and should therefore be applied consistently.

The following scope codes are used within the NESP MaC Hub:

[TABLE]

## 5.8. Dataset metadata checklist

The following checklist can be used to review dataset metadata records for completeness and consistency before publication.

[TABLE]

# 6. Identifier-specific guidance

This section provides additional guidance for identifier types that require decision-making beyond ISO encoding alone. It supplements the ISO implementation guidance in [Section 4](#recording-persistent-identifiers-in-iso19115-3) and does not repeat identifier-specific conventions already addressed elsewhere in the guide.

## 6.1. Research Organization Registry (ROR)

### 6.1.1. Scope of ROR identifiers

ROR provides persistent identifiers for top-level research organisations, including universities, independent research institutes, government agencies, and major research facilities. In general, it does not assign separate identifiers to internal sub-units such as colleges, departments, schools or labs, unless those units operate as distinct research entities.

### 6.1.2. Organisation names and ROR alignment

Where a ROR exists, it should be used as the organisation identifier in the metadata record. The organisation name recorded in cit:CI_Organisation must exactly match the canonical name in the corresponding ROR record.

A one-to-one relationship must exist between the organisation name and the ROR. A sub-organisation name should not be recorded together with a parent organisation’s ROR, as this can lead to incorrect grouping in downstream systems such as Research Data Australia.

Where no ROR exists, the organisation name should follow recognised naming conventions, using the full formal name rather than acronyms, or the [AODN Organisation Vocabulary](https://vocabs.ardc.edu.au/viewById/28) where required.

#### Example: Recording a sub-organisation

In this example, the cited party is associated with TropWater within James Cook University (JCU). A ROR exists for JCU, but not for TropWATER. Although TropWATER is a significant sub-organisation, it is not treated as a distinct research organisation for ROR purposes.

In this case, the JCU ROR is used to define the responsible organisation, and the organisation name in cit:CI_Organisation/cit:name must exactly match the JCU ROR record ([Figure 11](#_Ref222402988)). The sub-organisation name “TropWATER” can then be recorded in the delivery point of the individual’s address ([Figure 12](#_Ref227759229)).

![A screenshot of a computer Description automatically generated](media/image17.png)

Figure 11. Where a sub-organisation (e.g. TropWATER) does not have its own ROR, the parent organisation’s (JCU) ROR is used. The organisation name in the metadata must exactly match the parent organisation’s ROR record.

![A screenshot of a contact form Description automatically generated](media/image18.png)

Figure 12. The name of a sub-organisation that does not qualify for its own ROR can be recorded in the delivery point of the individual’s address.

### 6.1.3. Determining which ROR to use

Confirm whether the organisation already has a ROR by searching the [ROR registry](https://ror.org/) and checking that the record’s name, website and location match entity being described. Some organisations may change name over time due to restructuring. Where this occurs, the organisation name and ROR recorded in the metadata should reflect the organisation as it existed at the time the metadata record was published.

If the organisation being described is a sub-organisation, a new ROR should only be requested where the sub-unit is genuinely a separate organisation – for example, where it has independent governance, a distinct public identity, its own website, and participates as a distinct research entity. Many university centres and departments will not meet this threshold.

Use the following decision logic when recording an organisation in ISO or RAiD records:

1.  **If the organisation has a ROR**, use that ROR and set the organisation name to exactly match the ROR label ([Figure 11](#_Ref222402988)).

2.  If the organisation does not have a ROR, determine whether it qualifies for its own ROR as a distinct legal or research entity.

3.  If it qualifies, [request a new ROR](https://ror.readme.io/docs/updates) and use that identifier and label.

4.  **If it does not qualify for its own ROR, but the parent organisation has one**, use the parent organisation’s ROR and record the sub-organisation separately in accordance with [Section 6.1.2](#organisation-names-and-ror-alignment) ([Figure 12](#_Ref227759229)).

5.  **If no ROR exists and one cannot be created**, record the organisation name using the naming conventions described in [Section 6.1.2](#organisation-names-and-ror-alignment).

### 6.1.4. Requesting a new ROR

Before requesting a new ROR, first confirm that the organisation is not already listed in the [ROR registry](https://ror.org/search). Check the [ROR scope guidance](https://ror.org/about/faqs/#is-my-organization-in-scope-for-ror) to ensure the entity qualifies as a top-level research entity. If it does, [submit a curation request](https://ror.org/about/faqs/#how-can-i-add-an-organization-to-ror) with supporting evidence for the distinct research entity.

Anyone may propose additions or updates to the ROR registry. Submissions are reviewed by community curators, tracked publicly in GitHub, and incorporated into regular registry releases.

### 6.1.5. Implications for aggregation and machine grouping

Downstream aggregators and discovery systems may group records using ROR identifiers. In Research Data Australia (RDA), harvested records are assigned to [*Party*](https://documentation.ardc.edu.au/cpg/party) records, and the ROR identifier is used for organisation-level grouping.

Research Data Australia assigns the Party name based on the **most recently** harvested record associated with a given ROR. If organisation names vary between records for the same ROR, the Party name in RDA may vary depending on harvest order. If a sub-organisation name is recorded together with a parent organisation’s ROR – for example, “*TropWATER – James Cook University*” with the *James Cook University* ROR — the JCU Party in RDA may be incorrectly labelled as TropWATER. This would falsely imply that all JCU-related outputs belong to TropWATER.

## 6.2. Digital Object Identifiers (DOIs)

### 6.2.1. Scope of DOIs

DOIs provide persistent identifiers for digital objects such as datasets, publications, reports, and software. In this guide, DOIs are used to identify datasets as citable research outputs. A dataset DOI resolves to a persistent landing page, typically the ISO metadata record or an equivalent repository page derived from it, which provides descriptive information and access to the data.

### 6.2.2. Aligning DataCite records with ISO metadata

When minting a DOI for a dataset, the corresponding DataCite record should be populated using information drawn from the ISO metadata record. At a minimum, the DOI record should align with the ISO metadata for the dataset title, creators or contributors, landing page URL, publisher, publication year, and resource type. ORCIDs should be included for contributors where available.

Additional DataCite fields such as rights or licence information, abstract or description, language, keywords, related identifiers, and version information are recommended where relevant, as they improve discovery, context, and reuse.

These values form the DataCite DOI record and are represented both in the DataCite landing page ([Figure 13](#_Ref222398036)) and in machine-readable structured DataCite metadata exports, such as JSON and XML.

![A screenshot of a computer Description automatically generated](media/image19.png)

Figure 13. Example DataCite landing page for a dataset DOI, showing metadata fields populated from the DOI record, including the formal dataset citation.

# Appendix A: XML for DOIs in ISO records

Example XML fragment for a dataset DOI in ISO19115-3.

`mdb:MD_Metadata / mdb:identificationInfo / mri:MD_DataIdentification / mri:citation / cit:CI_Citation:`

```xml
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

# Appendix B: XML for RORs and ORCIDs in ISO records

Example XML fragment corresponding to a ‘Principal investigator’ in ISO19115-3. Email addresses are intentionally excluded for ‘Contributors’. Minimal address information is recorded. The address information is associated with the *individual*, rather than the *organisation*.

`mdb:MD_Metadata / mdb:identificationInfo / mri:MD_DataIdentification / mri:citation / cit:CI_Citation:`

```xml
<cit:citedResponsibleParty>
  <cit:CI_Responsibility>
    <cit:role>
      <cit:CI_RoleCode
        codeList="http://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#CI_RoleCode"
        codeListValue="principalInvestigator" />
    </cit:role>
    <cit:party>
      <cit:CI_Organisation>
        <cit:name>
          <gco:CharacterString>Australian Institute of Marine Science</gco:CharacterString>
        </cit:name>
        <cit:contactInfo>
          <cit:CI_Contact>
            <cit:address />
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

# Appendix C: XML for RAiDs in ISO records

#### RAiD encoded in project metadata record

The project's RAiD is recorded as a cit:identifier element within the project's citation (mri:citation/cit:CI_Citation). It sits alongside other identifiers such as the DOI. The identifier code is the RAiD handle (e.g. 10.82210/a611d299), the code space is raid.org, and the description is "Project RAiD". The code is rendered as a gcx:Anchor element with an xlink:href pointing to the full RAiD URL.

`mdb:MD_Metadata / mdb:identificationInfo / mri:MD_DataIdentification / mri:citation / cit:CI_Citation:`

```xml
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

#### RAiD encoded in dataset metadata record

The project's RAiD is recorded in a dataset metadata record as an mri:associatedResource element within mri:MD_DataIdentification. This is the ISO 19115-3 mechanism for expressing inter-resource relationships. The association type is 'dependency' and the initiative type is 'project', semantically expressing that the dataset depends on a project. The project's title and RAiD identifier are embedded inside a mri:metadataReference/cit:CI_Citation element.

**Note**: GeoNetwork's batch editing API ('gn_add') is schema-aware and automatically inserts the element at the correct position according to the XSD sequence order. There is no need to manually calculate the insertion point.

`mdb:MD_Metadata / mdb:identificationInfo / mri:MD_DataIdentification:`

```xml
<mri:associatedResource>
  <mri:MD_AssociatedResource>
    <mri:associationType>
      <mri:DS_AssociationTypeCode
        codeList="http://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#DS_AssociationTypeCode"
        codeListValue="dependency" />
    </mri:associationType>
    <mri:initiativeType>
      <mri:DS_InitiativeTypeCode
        codeList="http://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#DS_InitiativeTypeCode"
        codeListValue="project" />
    </mri:initiativeType>
    <mri:metadataReference>
      <cit:CI_Citation>
        <cit:title>
          <gco:CharacterString>NESP MaC Project 3.17 - Locating Unidentified Reef and Habitat Features in the Northern Australian Seascape, 2023-2025 (AIMS, UQ)</gco:CharacterString>
        </cit:title>
        <cit:identifier>
          <mcc:MD_Identifier>
            <mcc:code>
              <gcx:Anchor xlink:href="https://raid.org/10.82210/dbdfe884">10.82210/dbdfe884</gcx:Anchor>
            </mcc:code>
            <mcc:codeSpace>
              <gco:CharacterString>raid.org</gco:CharacterString>
            </mcc:codeSpace>
            <mcc:description>
              <gco:CharacterString>Project RAiD</gco:CharacterString>
            </mcc:description>
          </mcc:MD_Identifier>
        </cit:identifier>
      </cit:CI_Citation>
    </mri:metadataReference>
  </mri:MD_AssociatedResource>
</mri:associatedResource>
```
