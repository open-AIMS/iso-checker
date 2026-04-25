// ORCID Checks — requirements.md §6.4
// All record types: ORCID encoding in partyIdentifier and onlineResource per individual
import { PidResolver } from '../api/pid-resolver.js';
const ORCID_URL_PATTERN = /^https?:\/\/orcid\.org\/(.+)$/;
export const orcidChecks = {
    id: 'orcid',
    name: 'ORCID Checks',
    description: 'Validates ORCID in partyIdentifier and onlineResource for individuals.',
    appliesTo: [],
    profile: 'generic',
    defaultEnabled: true,
    async check(record, context) {
        const results = [];
        const seen = new Set();
        const allParties = [...record.responsibleParties, ...record.pointOfContacts];
        for (const party of allParties) {
            if (!party.individual)
                continue;
            const ind = party.individual;
            const key = `${ind.name}|${party.section}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            const indResults = await checkIndOrcid(ind, party, record, context);
            results.push(...indResults);
        }
        return results;
    }
};
async function checkIndOrcid(ind, party, record, context) {
    const results = [];
    const entityLabel = ind.name ?? '(unnamed individual)';
    if (record.schema === 'iso19139') {
        const orcidUrl = ind.onlineResources.find(or => or.linkage && ORCID_URL_PATTERN.test(or.linkage));
        if (orcidUrl) {
            results.push({
                id: 'orcid-online-resource',
                name: 'ORCID in onlineResource',
                severity: 'pass',
                message: `ORCID URL found: ${orcidUrl.linkage}`,
                entity: entityLabel
            });
        }
        else {
            results.push({
                id: 'orcid-missing',
                name: 'ORCID present',
                severity: 'warning',
                message: `No ORCID found for "${entityLabel}". ISO 19139 only supports ORCID in onlineResource.`,
                entity: entityLabel
            });
        }
        return results;
    }
    // ISO 19115-3: check both locations
    const partyIdOrcid = ind.partyIdentifiers.find(id => id.codeSpace?.toLowerCase() === 'orcid.org');
    const onlineOrcid = ind.onlineResources.find(or => or.linkage && ORCID_URL_PATTERN.test(or.linkage));
    const hasPartyId = !!partyIdOrcid;
    const hasOnline = !!onlineOrcid;
    if (!hasPartyId && !hasOnline) {
        results.push({
            id: 'orcid-missing',
            name: 'ORCID present',
            severity: 'warning',
            message: `No ORCID found for "${entityLabel}".`,
            entity: entityLabel,
            fix: 'Add ORCID in both cit:partyIdentifier and cit:onlineResource if the person has one.'
        });
        return results;
    }
    // Inconsistency check
    if (hasPartyId && !hasOnline) {
        results.push({
            id: 'orcid-consistency',
            name: 'ORCID in both locations',
            severity: 'error',
            message: `ORCID found in partyIdentifier but missing from onlineResource for "${entityLabel}".`,
            entity: entityLabel,
            fix: 'Add matching ORCID URL to cit:onlineResource for GeoNetwork display.'
        });
    }
    else if (!hasPartyId && hasOnline) {
        results.push({
            id: 'orcid-consistency',
            name: 'ORCID in both locations',
            severity: 'error',
            message: `ORCID found in onlineResource but missing from partyIdentifier for "${entityLabel}".`,
            entity: entityLabel,
            fix: 'Add matching ORCID to cit:partyIdentifier/mcc:MD_Identifier.'
        });
    }
    else {
        results.push({
            id: 'orcid-consistency',
            name: 'ORCID in both locations',
            severity: 'pass',
            message: 'ORCID present in both partyIdentifier and onlineResource.',
            entity: entityLabel
        });
    }
    if (partyIdOrcid) {
        const code = partyIdOrcid.code ?? '';
        // Bare string check
        if (code.startsWith('http://') || code.startsWith('https://')) {
            results.push({
                id: 'orcid-bare-value',
                name: 'ORCID is bare string',
                severity: 'error',
                message: 'ORCID value contains a URL prefix.',
                expected: code.replace(ORCID_URL_PATTERN, '$1'),
                found: code,
                entity: entityLabel,
                fix: 'Remove URL prefix — use bare ORCID only (e.g. 0000-0002-3144-3475).'
            });
        }
        else {
            results.push({
                id: 'orcid-bare-value',
                name: 'ORCID is bare string',
                severity: 'pass',
                message: 'ORCID value is a bare string.',
                entity: entityLabel
            });
        }
        // Anchor check
        if (!partyIdOrcid.isAnchor) {
            results.push({
                id: 'orcid-anchor',
                name: 'ORCID uses gcx:Anchor',
                severity: 'error',
                message: 'ORCID is encoded as gco:CharacterString instead of gcx:Anchor.',
                entity: entityLabel,
                fix: 'Replace gco:CharacterString with gcx:Anchor and set xlink:href.'
            });
        }
        else {
            const expectedHref = `https://orcid.org/${code}`;
            if (partyIdOrcid.anchorHref !== expectedHref) {
                results.push({
                    id: 'orcid-anchor',
                    name: 'ORCID Anchor href matches value',
                    severity: 'error',
                    message: 'ORCID Anchor href does not match the ORCID value.',
                    expected: expectedHref,
                    found: partyIdOrcid.anchorHref ?? '(none)',
                    entity: entityLabel,
                    fix: `Set xlink:href to "${expectedHref}".`
                });
            }
            else {
                results.push({
                    id: 'orcid-anchor',
                    name: 'ORCID Anchor href matches value',
                    severity: 'pass',
                    message: 'ORCID Anchor href matches value.',
                    entity: entityLabel
                });
            }
        }
        // API validation
        if (context.apiValidationEnabled && code && !code.startsWith('http')) {
            const resolver = new PidResolver(context.pidCache);
            const result = await resolver.resolveOrcid(code);
            if (!result.resolved) {
                results.push({
                    id: 'orcid-resolves',
                    name: 'ORCID resolves',
                    severity: 'warning',
                    message: `ORCID "${code}" could not be resolved via ORCID API.`,
                    entity: entityLabel,
                    fix: 'Verify the ORCID is correct.'
                });
            }
            else {
                results.push({
                    id: 'orcid-resolves',
                    name: 'ORCID resolves',
                    severity: 'pass',
                    message: 'ORCID resolves via API.',
                    entity: entityLabel
                });
                // Name matching — family name comparison
                if (result.familyName && ind.name) {
                    const recordName = ind.name;
                    const recordFamilyName = recordName.split(',')[0]?.trim();
                    const synthesised = `${result.familyName}, ${result.givenNames ?? ''}`.trim();
                    if (recordFamilyName?.toLowerCase() !== result.familyName.toLowerCase()) {
                        results.push({
                            id: 'orcid-name-match',
                            name: 'Name consistent with ORCID',
                            severity: 'warning',
                            message: `Record name family name does not match ORCID registered name.`,
                            expected: synthesised,
                            found: recordName,
                            entity: entityLabel,
                            fix: `Consider updating name to "${synthesised}" to match ORCID registry.`
                        });
                    }
                    else {
                        results.push({
                            id: 'orcid-name-match',
                            name: 'Name consistent with ORCID',
                            severity: 'pass',
                            message: `Name is consistent with ORCID registered name (${synthesised}).`,
                            entity: entityLabel
                        });
                    }
                }
            }
        }
    }
    return results;
}
//# sourceMappingURL=orcid-checks.js.map