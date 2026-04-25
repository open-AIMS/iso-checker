// ROR Checks — requirements.md §6.3
// All record types: ROR encoding in partyIdentifier and onlineResource per organisation
import { PidResolver } from '../api/pid-resolver.js';
const ROR_URL_PATTERN = /^https?:\/\/ror\.org\/(.+)$/;
export const rorChecks = {
    id: 'ror',
    name: 'ROR Checks',
    description: 'Validates ROR in partyIdentifier and onlineResource for organisations.',
    appliesTo: [],
    profile: 'generic',
    defaultEnabled: true,
    async check(record, context) {
        const results = [];
        const seen = new Set();
        const allParties = [...record.responsibleParties, ...record.pointOfContacts];
        for (const party of allParties) {
            if (!party.organisation)
                continue;
            const org = party.organisation;
            const key = `${org.name}|${party.section}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            const orgResults = await checkOrgRor(org, party, record, context);
            results.push(...orgResults);
        }
        return results;
    }
};
async function checkOrgRor(org, party, record, context) {
    const results = [];
    const entityLabel = org.name ?? '(unnamed organisation)';
    if (record.schema === 'iso19139') {
        // ISO 19139: no partyIdentifier, check onlineResource only
        const rorUrl = org.onlineResources.find(or => or.linkage && ROR_URL_PATTERN.test(or.linkage));
        if (rorUrl) {
            results.push({
                id: 'ror-online-resource',
                name: 'ROR in onlineResource',
                severity: 'pass',
                message: `ROR URL found: ${rorUrl.linkage}`,
                entity: entityLabel
            });
        }
        else {
            results.push({
                id: 'ror-missing',
                name: 'ROR present',
                severity: 'warning',
                message: `No ROR found for "${entityLabel}". ISO 19139 only supports ROR in onlineResource.`,
                entity: entityLabel,
                fix: 'Consider converting to ISO 19115-3 to use partyIdentifier for ROR.'
            });
        }
        return results;
    }
    // ISO 19115-3: check both locations
    const partyIdRor = org.partyIdentifiers.find(id => id.codeSpace?.toLowerCase().includes('ror'));
    const onlineRor = org.onlineResources.find(or => or.linkage && ROR_URL_PATTERN.test(or.linkage));
    const hasPartyId = !!partyIdRor;
    const hasOnline = !!onlineRor;
    if (!hasPartyId && !hasOnline) {
        results.push({
            id: 'ror-missing',
            name: 'ROR present',
            severity: 'warning',
            message: `No ROR found for "${entityLabel}".`,
            entity: entityLabel,
            fix: 'Add ROR in both cit:partyIdentifier and cit:onlineResource.'
        });
        return results;
    }
    // Inconsistency check
    if (hasPartyId && !hasOnline) {
        results.push({
            id: 'ror-consistency',
            name: 'ROR in both locations',
            severity: 'error',
            message: `ROR found in partyIdentifier but missing from onlineResource for "${entityLabel}".`,
            entity: entityLabel,
            fix: 'Add matching ROR URL to cit:onlineResource for GeoNetwork display.'
        });
    }
    else if (!hasPartyId && hasOnline) {
        results.push({
            id: 'ror-consistency',
            name: 'ROR in both locations',
            severity: 'error',
            message: `ROR found in onlineResource but missing from partyIdentifier for "${entityLabel}".`,
            entity: entityLabel,
            fix: 'Add matching ROR to cit:partyIdentifier/mcc:MD_Identifier.'
        });
    }
    else {
        results.push({
            id: 'ror-consistency',
            name: 'ROR in both locations',
            severity: 'pass',
            message: 'ROR present in both partyIdentifier and onlineResource.',
            entity: entityLabel
        });
    }
    // Check partyIdentifier encoding if present
    if (partyIdRor) {
        const code = partyIdRor.code ?? '';
        // Bare string check
        if (code.startsWith('http://') || code.startsWith('https://')) {
            results.push({
                id: 'ror-bare-value',
                name: 'ROR is bare string',
                severity: 'error',
                message: 'ROR value contains a URL prefix.',
                expected: code.replace(ROR_URL_PATTERN, '$1'),
                found: code,
                entity: entityLabel,
                fix: 'Remove URL prefix — use bare ROR ID only.'
            });
        }
        else {
            results.push({
                id: 'ror-bare-value',
                name: 'ROR is bare string',
                severity: 'pass',
                message: 'ROR value is a bare string.',
                entity: entityLabel
            });
        }
        // Anchor check
        if (!partyIdRor.isAnchor) {
            results.push({
                id: 'ror-anchor',
                name: 'ROR uses gcx:Anchor',
                severity: 'error',
                message: 'ROR is encoded as gco:CharacterString instead of gcx:Anchor.',
                entity: entityLabel,
                fix: 'Replace gco:CharacterString with gcx:Anchor and set xlink:href.'
            });
        }
        else {
            const expectedHref = `https://ror.org/${code}`;
            if (partyIdRor.anchorHref !== expectedHref) {
                results.push({
                    id: 'ror-anchor',
                    name: 'ROR Anchor href matches value',
                    severity: 'error',
                    message: 'ROR Anchor href does not match the ROR value.',
                    expected: expectedHref,
                    found: partyIdRor.anchorHref ?? '(none)',
                    entity: entityLabel,
                    fix: `Set xlink:href to "${expectedHref}".`
                });
            }
            else {
                results.push({
                    id: 'ror-anchor',
                    name: 'ROR Anchor href matches value',
                    severity: 'pass',
                    message: 'ROR Anchor href matches value.',
                    entity: entityLabel
                });
            }
        }
        // API validation: resolve and name match
        if (context.apiValidationEnabled && code && !code.startsWith('http')) {
            const resolver = new PidResolver(context.pidCache);
            const result = await resolver.resolveRor(code);
            if (!result.resolved) {
                results.push({
                    id: 'ror-resolves',
                    name: 'ROR resolves',
                    severity: 'warning',
                    message: `ROR "${code}" could not be resolved via ROR API.`,
                    entity: entityLabel,
                    fix: 'Verify the ROR ID is correct.'
                });
            }
            else {
                results.push({
                    id: 'ror-resolves',
                    name: 'ROR resolves',
                    severity: 'pass',
                    message: 'ROR resolves via API.',
                    entity: entityLabel
                });
                // Name matching
                if (result.canonicalName && org.name) {
                    if (result.canonicalName !== org.name) {
                        results.push({
                            id: 'ror-name-match',
                            name: 'Organisation name matches ROR',
                            severity: 'error',
                            message: `Organisation name does not match ROR canonical name.`,
                            expected: result.canonicalName,
                            found: org.name,
                            entity: entityLabel,
                            fix: `Change organisation name to "${result.canonicalName}" (the ROR canonical name).`
                        });
                    }
                    else {
                        results.push({
                            id: 'ror-name-match',
                            name: 'Organisation name matches ROR',
                            severity: 'pass',
                            message: 'Organisation name matches ROR canonical name.',
                            entity: entityLabel
                        });
                    }
                }
            }
        }
    }
    return results;
}
//# sourceMappingURL=ror-checks.js.map