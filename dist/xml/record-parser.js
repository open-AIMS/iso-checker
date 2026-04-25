// ISO 19115-3 / ISO 19139 record parser
// Implements rules-design.md §3 (incremental stepping) and §6 (extraction paths)
import { buildNamespaceResolver, detectSchema, xpathElement, xpathNodes, xpathText, xpathAttr, extractCodeValue } from './xpath-helpers.js';
/**
 * Parse an XML Document into a ParsedRecord.
 */
export function parseRecord(doc, sourceUrl) {
    const root = doc.documentElement;
    const resolver = buildNamespaceResolver(root);
    const schema = detectSchema(doc);
    const uuid = extractUuid(root, schema, resolver);
    const title = extractTitle(root, schema, resolver);
    const scopeCode = extractScopeCode(root, schema, resolver);
    const parentUuid = extractParentUuid(root, schema, resolver);
    const { recordType, recordTypeSource } = detectRecordType(scopeCode, title);
    const citation = extractCitation(root, schema, resolver);
    const associatedResources = schema === 'iso19115-3'
        ? extractAssociatedResources(root, resolver) : [];
    const responsibleParties = extractResponsibleParties(root, schema, resolver, 'citation');
    const pointOfContacts = extractResponsibleParties(root, schema, resolver, 'pointOfContact');
    const constraints = extractConstraints(root, schema, resolver);
    const templatePlaceholders = detectTemplatePlaceholders(doc);
    return {
        schema, uuid, title, scopeCode, parentUuid,
        recordType, recordTypeSource,
        citation, associatedResources,
        responsibleParties, pointOfContacts,
        constraints, templatePlaceholders,
        xmlDoc: doc, nsResolver: resolver,
        sourceUrl
    };
}
// --- Record identity (rules-design §6.1) ---
function extractUuid(root, schema, resolver) {
    if (schema === 'iso19115-3') {
        return xpathText(root, 'mdb:metadataIdentifier/mcc:MD_Identifier/mcc:code/gco:CharacterString', resolver);
    }
    if (schema === 'iso19139') {
        return xpathText(root, 'gmd:fileIdentifier/gco:CharacterString', resolver);
    }
    return null;
}
function extractTitle(root, schema, resolver) {
    if (schema === 'iso19115-3') {
        const dataId = xpathElement(root, 'mdb:identificationInfo/mri:MD_DataIdentification', resolver);
        if (!dataId)
            return null;
        const citation = xpathElement(dataId, 'mri:citation/cit:CI_Citation', resolver);
        if (!citation)
            return null;
        return xpathText(citation, 'cit:title/gco:CharacterString', resolver);
    }
    if (schema === 'iso19139') {
        const dataId = xpathElement(root, 'gmd:identificationInfo/gmd:MD_DataIdentification', resolver);
        if (!dataId)
            return null;
        const citation = xpathElement(dataId, 'gmd:citation/gmd:CI_Citation', resolver);
        if (!citation)
            return null;
        return xpathText(citation, 'gmd:title/gco:CharacterString', resolver);
    }
    return null;
}
function extractScopeCode(root, schema, resolver) {
    if (schema === 'iso19115-3') {
        return xpathAttr(root, 'mdb:metadataScope/mdb:MD_MetadataScope/mdb:resourceScope/mcc:MD_ScopeCode', 'codeListValue', resolver);
    }
    if (schema === 'iso19139') {
        return xpathAttr(root, 'gmd:hierarchyLevel/gmd:MD_ScopeCode', 'codeListValue', resolver);
    }
    return null;
}
function extractParentUuid(root, schema, resolver) {
    if (schema === 'iso19115-3') {
        const parentEl = xpathElement(root, 'mdb:parentMetadata', resolver);
        return parentEl?.getAttribute('uuidref') ?? null;
    }
    if (schema === 'iso19139') {
        return xpathText(root, 'gmd:parentIdentifier/gco:CharacterString', resolver);
    }
    return null;
}
// --- Record type detection (requirements §4) ---
function detectRecordType(scopeCode, title) {
    // Primary: scope code
    if (scopeCode) {
        const code = scopeCode.toLowerCase();
        if (code === 'dataset')
            return { recordType: 'dataset', recordTypeSource: 'scope' };
        if (code === 'fieldsession')
            return { recordType: 'project', recordTypeSource: 'scope' };
        if (code === 'series')
            return { recordType: 'program', recordTypeSource: 'scope' };
    }
    // Fallback: title pattern
    if (title) {
        // Project pattern: "{Program} Project {Code} - {Title} ({Orgs})"
        if (/\bProject\s+\d+\.\d+\s*[-–]/i.test(title)) {
            return { recordType: 'project', recordTypeSource: 'title' };
        }
        // Dataset pattern: "{Title} ({Program} {Code}, {Orgs})"
        if (/\([A-Z]+\s+(?:MaC\s+)?\d+\.\d+,/.test(title)) {
            return { recordType: 'dataset', recordTypeSource: 'title' };
        }
    }
    // Default to dataset
    return { recordType: 'dataset', recordTypeSource: 'scope' };
}
// --- Citation (rules-design §6.2) ---
function extractCitation(root, schema, resolver) {
    let citation = null;
    if (schema === 'iso19115-3') {
        const dataId = xpathElement(root, 'mdb:identificationInfo/mri:MD_DataIdentification', resolver);
        if (dataId)
            citation = xpathElement(dataId, 'mri:citation/cit:CI_Citation', resolver);
    }
    else if (schema === 'iso19139') {
        const dataId = xpathElement(root, 'gmd:identificationInfo/gmd:MD_DataIdentification', resolver);
        if (dataId)
            citation = xpathElement(dataId, 'gmd:citation/gmd:CI_Citation', resolver);
    }
    if (!citation)
        return { identifiers: [] };
    const identifiers = extractIdentifiers(citation, schema, resolver);
    return { identifiers };
}
function extractIdentifiers(citationEl, schema, resolver) {
    // Use descendant axis to handle double-wrapped cit:identifier elements
    // seen in some GeoNetwork records (cit:identifier/cit:identifier/mcc:MD_Identifier)
    const path = schema === 'iso19115-3'
        ? 'cit:identifier//mcc:MD_Identifier'
        : 'gmd:identifier//gmd:MD_Identifier';
    const idNodes = xpathNodes(citationEl, path, resolver);
    return idNodes.map(node => {
        const el = node;
        const codeValue = extractCodeValue(el, resolver);
        const codeSpace = schema === 'iso19115-3'
            ? xpathText(el, 'mcc:codeSpace/gco:CharacterString', resolver)
            : xpathText(el, 'gmd:codeSpace/gco:CharacterString', resolver);
        const description = schema === 'iso19115-3'
            ? xpathText(el, 'mcc:description/gco:CharacterString', resolver)
            : xpathText(el, 'gmd:description/gco:CharacterString', resolver);
        return {
            code: codeValue.text,
            codeSpace,
            description,
            isAnchor: codeValue.isAnchor,
            anchorHref: codeValue.anchorHref,
            rawCode: codeValue.text
        };
    });
}
// --- Associated resources (rules-design §6.3, ISO 19115-3 only) ---
function extractAssociatedResources(root, resolver) {
    const dataId = xpathElement(root, 'mdb:identificationInfo/mri:MD_DataIdentification', resolver);
    if (!dataId)
        return [];
    const arNodes = xpathNodes(dataId, 'mri:associatedResource/mri:MD_AssociatedResource', resolver);
    return arNodes.map(node => {
        const el = node;
        const associationType = xpathAttr(el, 'mri:associationType/mri:DS_AssociationTypeCode', 'codeListValue', resolver);
        const initiativeType = xpathAttr(el, 'mri:initiativeType/mri:DS_InitiativeTypeCode', 'codeListValue', resolver);
        const metaRef = xpathElement(el, 'mri:metadataReference/cit:CI_Citation', resolver);
        const title = metaRef ? xpathText(metaRef, 'cit:title/gco:CharacterString', resolver) : null;
        const identifiers = metaRef ? extractIdentifiers(metaRef, 'iso19115-3', resolver) : [];
        return { associationType, initiativeType, title, identifiers };
    });
}
// --- Responsible parties (rules-design §6.4) ---
function extractResponsibleParties(root, schema, resolver, section) {
    const parties = [];
    if (schema === 'iso19115-3') {
        const dataId = xpathElement(root, 'mdb:identificationInfo/mri:MD_DataIdentification', resolver);
        if (!dataId)
            return [];
        let rpNodes;
        if (section === 'citation') {
            const citation = xpathElement(dataId, 'mri:citation/cit:CI_Citation', resolver);
            if (!citation)
                return [];
            rpNodes = xpathNodes(citation, 'cit:citedResponsibleParty/cit:CI_Responsibility', resolver);
        }
        else {
            rpNodes = xpathNodes(dataId, 'mri:pointOfContact/cit:CI_Responsibility', resolver);
        }
        for (const node of rpNodes) {
            const el = node;
            const role = xpathAttr(el, 'cit:role/cit:CI_RoleCode', 'codeListValue', resolver);
            // Check for organisation with nested individual (expected structure)
            const orgEl = xpathElement(el, 'cit:party/cit:CI_Organisation', resolver);
            if (orgEl) {
                const org = extractOrganisation19115(orgEl, resolver);
                const indEl = xpathElement(orgEl, 'cit:individual/cit:CI_Individual', resolver);
                const individual = indEl ? extractIndividual19115(indEl, resolver) : null;
                parties.push({ role, organisation: org, individual, section });
            }
            else {
                // Standalone individual (no organisation wrapper)
                const indEl = xpathElement(el, 'cit:party/cit:CI_Individual', resolver);
                if (indEl) {
                    const individual = extractIndividual19115(indEl, resolver);
                    parties.push({ role, organisation: null, individual, section });
                }
            }
        }
    }
    else if (schema === 'iso19139') {
        const dataId = xpathElement(root, 'gmd:identificationInfo/gmd:MD_DataIdentification', resolver);
        if (!dataId)
            return [];
        let rpNodes;
        if (section === 'citation') {
            const citation = xpathElement(dataId, 'gmd:citation/gmd:CI_Citation', resolver);
            if (!citation)
                return [];
            rpNodes = xpathNodes(citation, 'gmd:citedResponsibleParty/gmd:CI_ResponsibleParty', resolver);
        }
        else {
            rpNodes = xpathNodes(dataId, 'gmd:pointOfContact/gmd:CI_ResponsibleParty', resolver);
        }
        for (const node of rpNodes) {
            const el = node;
            const role = xpathAttr(el, 'gmd:role/gmd:CI_RoleCode', 'codeListValue', resolver);
            const orgName = xpathText(el, 'gmd:organisationName/gco:CharacterString', resolver);
            const indName = xpathText(el, 'gmd:individualName/gco:CharacterString', resolver);
            const email = xpathText(el, 'gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress/gco:CharacterString', resolver);
            const onlineResources = extractOnlineResources19139(el, resolver);
            const org = orgName
                ? { name: orgName, partyIdentifiers: [], onlineResources } : null;
            const individual = indName
                ? { name: indName, email, partyIdentifiers: [], onlineResources: onlineResources } : null;
            parties.push({ role, organisation: org, individual, section });
        }
    }
    return parties;
}
function extractOrganisation19115(orgEl, resolver) {
    const name = xpathText(orgEl, 'cit:name/gco:CharacterString', resolver);
    const partyIdentifiers = extractPartyIdentifiers(orgEl, resolver);
    const onlineResources = extractOnlineResources19115(orgEl, resolver);
    return { name, partyIdentifiers, onlineResources };
}
function extractIndividual19115(indEl, resolver) {
    const name = xpathText(indEl, 'cit:name/gco:CharacterString', resolver);
    const email = xpathText(indEl, 'cit:contactInfo/cit:CI_Contact/cit:address/cit:CI_Address/cit:electronicMailAddress/gco:CharacterString', resolver);
    const partyIdentifiers = extractPartyIdentifiers(indEl, resolver);
    const onlineResources = extractOnlineResources19115Individual(indEl, resolver);
    const adminArea = xpathText(indEl, 'cit:contactInfo/cit:CI_Contact/cit:address/cit:CI_Address/cit:administrativeArea/gco:CharacterString', resolver);
    const country = xpathText(indEl, 'cit:contactInfo/cit:CI_Contact/cit:address/cit:CI_Address/cit:country/gco:CharacterString', resolver);
    return {
        name, email, partyIdentifiers, onlineResources,
        address: (adminArea || country) ? { administrativeArea: adminArea ?? undefined, country: country ?? undefined } : undefined
    };
}
// --- Party identifiers (rules-design §6.5, §6.6) ---
function extractPartyIdentifiers(el, resolver) {
    const idNodes = xpathNodes(el, 'cit:partyIdentifier/mcc:MD_Identifier', resolver);
    return idNodes.map(node => {
        const idEl = node;
        const codeValue = extractCodeValue(idEl, resolver);
        const codeSpace = xpathText(idEl, 'mcc:codeSpace/gco:CharacterString', resolver);
        const description = xpathText(idEl, 'mcc:description/gco:CharacterString', resolver);
        return {
            code: codeValue.text,
            codeSpace,
            description,
            isAnchor: codeValue.isAnchor,
            anchorHref: codeValue.anchorHref,
            rawCode: codeValue.text
        };
    });
}
// --- Online resources ---
function extractOnlineResources19115(orgEl, resolver) {
    const orNodes = xpathNodes(orgEl, 'cit:contactInfo/cit:CI_Contact/cit:onlineResource/cit:CI_OnlineResource', resolver);
    return orNodes.map(node => {
        const el = node;
        return {
            linkage: xpathText(el, 'cit:linkage/gco:CharacterString', resolver),
            protocol: xpathText(el, 'cit:protocol/gco:CharacterString', resolver),
            name: xpathText(el, 'cit:name/gco:CharacterString', resolver)
        };
    });
}
function extractOnlineResources19115Individual(indEl, resolver) {
    const orNodes = xpathNodes(indEl, 'cit:contactInfo/cit:CI_Contact/cit:onlineResource/cit:CI_OnlineResource', resolver);
    return orNodes.map(node => {
        const el = node;
        return {
            linkage: xpathText(el, 'cit:linkage/gco:CharacterString', resolver),
            protocol: xpathText(el, 'cit:protocol/gco:CharacterString', resolver),
            name: xpathText(el, 'cit:name/gco:CharacterString', resolver)
        };
    });
}
function extractOnlineResources19139(rpEl, resolver) {
    const orNodes = xpathNodes(rpEl, 'gmd:contactInfo/gmd:CI_Contact/gmd:onlineResource/gmd:CI_OnlineResource', resolver);
    return orNodes.map(node => {
        const el = node;
        return {
            linkage: xpathText(el, 'gmd:linkage/gmd:URL', resolver) ?? xpathText(el, 'gmd:linkage/gco:CharacterString', resolver),
            protocol: xpathText(el, 'gmd:protocol/gco:CharacterString', resolver),
            name: xpathText(el, 'gmd:name/gco:CharacterString', resolver)
        };
    });
}
// --- Constraints (rules-design §6.7) ---
function extractConstraints(root, schema, resolver) {
    const constraints = [];
    let dataId = null;
    if (schema === 'iso19115-3') {
        dataId = xpathElement(root, 'mdb:identificationInfo/mri:MD_DataIdentification', resolver);
    }
    else if (schema === 'iso19139') {
        dataId = xpathElement(root, 'gmd:identificationInfo/gmd:MD_DataIdentification', resolver);
    }
    if (!dataId)
        return [];
    if (schema === 'iso19115-3') {
        const constraintNodes = xpathNodes(dataId, 'mri:resourceConstraints/*', resolver);
        for (const node of constraintNodes) {
            const el = node;
            const localName = el.localName;
            if (localName === 'MD_LegalConstraints') {
                const otherConstraints = [];
                const otherNodes = xpathNodes(el, 'mco:otherConstraints/gco:CharacterString', resolver);
                for (const n of otherNodes) {
                    const text = n.textContent?.trim();
                    if (text)
                        otherConstraints.push(text);
                }
                const refTitle = xpathText(el, 'mco:reference/cit:CI_Citation/cit:title/gco:CharacterString', resolver);
                const refLinkage = xpathText(el, 'mco:reference/cit:CI_Citation/cit:onlineResource/cit:CI_OnlineResource/cit:linkage/gco:CharacterString', resolver);
                constraints.push({
                    type: 'legal',
                    useLimitation: [],
                    otherConstraints,
                    referenceTitle: refTitle,
                    referenceLinkage: refLinkage
                });
            }
        }
    }
    else if (schema === 'iso19139') {
        const constraintNodes = xpathNodes(dataId, 'gmd:resourceConstraints/*', resolver);
        for (const node of constraintNodes) {
            const el = node;
            const localName = el.localName;
            if (localName === 'MD_LegalConstraints') {
                const useLimitation = [];
                const ulNodes = xpathNodes(el, 'gmd:useLimitation/gco:CharacterString', resolver);
                for (const n of ulNodes) {
                    const text = n.textContent?.trim();
                    if (text)
                        useLimitation.push(text);
                }
                const otherConstraints = [];
                const otherNodes = xpathNodes(el, 'gmd:otherConstraints/gco:CharacterString', resolver);
                for (const n of otherNodes) {
                    const text = n.textContent?.trim();
                    if (text)
                        otherConstraints.push(text);
                }
                constraints.push({
                    type: 'legal',
                    useLimitation,
                    otherConstraints,
                    referenceTitle: null,
                    referenceLinkage: null
                });
            }
        }
    }
    return constraints;
}
// --- Template placeholder detection (rules-design §6.8) ---
function detectTemplatePlaceholders(doc) {
    const placeholders = [];
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        const text = node.textContent ?? '';
        if (text.includes('**')) {
            // Build a simple location from parent chain
            const location = buildLocationPath(node);
            placeholders.push({ text: text.trim(), location });
        }
    }
    return placeholders;
}
function buildLocationPath(node) {
    const parts = [];
    let current = node.parentNode;
    let depth = 0;
    while (current && current.nodeType === Node.ELEMENT_NODE && depth < 5) {
        const el = current;
        const prefix = el.prefix ? `${el.prefix}:` : '';
        parts.unshift(`${prefix}${el.localName}`);
        current = current.parentNode;
        depth++;
    }
    return parts.join('/');
}
//# sourceMappingURL=record-parser.js.map