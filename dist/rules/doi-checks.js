// DOI Checks — requirements.md §6.1
// Dataset records: DOI present and correctly encoded in citation identifier
import { PidResolver } from '../api/pid-resolver.js';
const DOI_PATTERN = /^10\.\d{4,}/;
export const doiChecks = {
    id: 'doi',
    name: 'DOI Checks',
    description: 'Validates DOI presence and encoding in citation identifier.',
    appliesTo: ['dataset'],
    profile: 'generic',
    defaultEnabled: true,
    async check(record, context) {
        const results = [];
        if (record.recordType !== 'dataset')
            return results;
        // Find DOI identifier: codeSpace = "doi.org" or contains DOI pattern
        const doiId = record.citation.identifiers.find(id => id.codeSpace?.toLowerCase() === 'doi.org');
        // Also check for DOI encoded in non-standard way (e.g. GA pattern)
        const altDoi = !doiId ? record.citation.identifiers.find(id => {
            const code = id.code ?? id.rawCode ?? '';
            return DOI_PATTERN.test(code) || DOI_PATTERN.test(code.replace(/^https?:\/\/(dx\.)?doi\.org\//, ''));
        }) : null;
        // --- Rule: DOI present ---
        if (!doiId && !altDoi) {
            results.push({
                id: 'doi-present',
                name: 'DOI present in citation',
                severity: 'error',
                message: 'No DOI found in citation identifiers.',
                expected: 'cit:identifier with codeSpace "doi.org"',
                found: 'None',
                fix: 'Add a cit:identifier/mcc:MD_Identifier with mcc:codeSpace "doi.org" and the DOI in a gcx:Anchor.'
            });
            return results;
        }
        if (altDoi && !doiId) {
            // DOI found but not with correct codeSpace
            const bareCode = extractBareDoi(altDoi.code ?? altDoi.rawCode ?? '');
            results.push({
                id: 'doi-present',
                name: 'DOI present in citation',
                severity: 'error',
                message: `DOI found ("${bareCode}") but codeSpace is "${altDoi.codeSpace}" instead of "doi.org".`,
                expected: 'codeSpace = "doi.org"',
                found: `codeSpace = "${altDoi.codeSpace}"`,
                fix: 'Set mcc:codeSpace to "doi.org" and encode the DOI using gcx:Anchor.'
            });
            return results;
        }
        // DOI identifier found via codeSpace
        const id = doiId;
        results.push({
            id: 'doi-present',
            name: 'DOI present in citation',
            severity: 'pass',
            message: `DOI found: ${id.code}`,
            link: `https://doi.org/${id.code}`
        });
        // --- Rule: bare string (no URL prefix) ---
        const code = id.code ?? '';
        if (code.startsWith('http://') || code.startsWith('https://')) {
            const bare = extractBareDoi(code);
            results.push({
                id: 'doi-bare-value',
                name: 'DOI is bare string',
                severity: 'error',
                message: 'DOI value contains a URL prefix. Must be bare DOI string.',
                expected: bare,
                found: code,
                fix: `Change mcc:code text to "${bare}" (no URL prefix).`
            });
        }
        else if (DOI_PATTERN.test(code)) {
            results.push({
                id: 'doi-bare-value',
                name: 'DOI is bare string',
                severity: 'pass',
                message: 'DOI value is a bare string.'
            });
        }
        else {
            results.push({
                id: 'doi-bare-value',
                name: 'DOI is bare string',
                severity: 'error',
                message: `DOI value does not look like a valid DOI.`,
                found: code,
                fix: 'DOI should be in the form "10.XXXX/suffix".'
            });
        }
        // --- Rule: Anchor encoding ---
        if (!id.isAnchor) {
            results.push({
                id: 'doi-anchor',
                name: 'DOI uses gcx:Anchor',
                severity: 'error',
                message: 'DOI is encoded as gco:CharacterString instead of gcx:Anchor.',
                expected: 'gcx:Anchor with xlink:href',
                found: 'gco:CharacterString',
                fix: 'Replace gco:CharacterString with gcx:Anchor and set xlink:href to "https://doi.org/{DOI}".'
            });
        }
        else {
            // Check href matches
            const expectedHref = `https://doi.org/${code}`;
            if (id.anchorHref !== expectedHref) {
                results.push({
                    id: 'doi-anchor',
                    name: 'DOI Anchor href matches value',
                    severity: 'error',
                    message: 'DOI Anchor href does not match the DOI value.',
                    expected: expectedHref,
                    found: id.anchorHref ?? '(none)',
                    fix: `Set xlink:href to "${expectedHref}".`
                });
            }
            else {
                results.push({
                    id: 'doi-anchor',
                    name: 'DOI Anchor href matches value',
                    severity: 'pass',
                    message: 'DOI Anchor href matches value.'
                });
            }
        }
        // --- Rule: DOI resolves (toggleable) ---
        if (context.apiValidationEnabled) {
            const resolver = new PidResolver(context.pidCache);
            const result = await resolver.resolveDoi(code);
            results.push({
                id: 'doi-resolves',
                name: 'DOI resolves',
                severity: result.resolved ? 'pass' : 'warning',
                message: result.resolved
                    ? `DOI resolves via DataCite.`
                    : `DOI "${code}" could not be resolved via DataCite API.`,
                link: `https://doi.org/${code}`,
                fix: result.resolved ? undefined : 'Verify the DOI is registered. It may not yet be published.'
            });
        }
        return results;
    }
};
function extractBareDoi(value) {
    return value.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}
//# sourceMappingURL=doi-checks.js.map