// Licensing & Citation — requirements.md §6.7
// Dataset records: legal constraints, CC licence, citation statement
export const licensingChecks = {
    id: 'licensing',
    name: 'Licensing & Citation',
    description: 'Checks for legal constraints, CC licence, citation statement.',
    appliesTo: ['dataset'],
    profile: 'generic',
    defaultEnabled: true,
    async check(record, _context) {
        if (record.recordType !== 'dataset')
            return [];
        const results = [];
        const legalConstraints = record.constraints.filter(c => c.type === 'legal');
        // --- Legal constraints present ---
        results.push({
            id: 'licensing-constraints',
            name: 'Legal constraints present',
            severity: legalConstraints.length > 0 ? 'pass' : 'warning',
            message: legalConstraints.length > 0
                ? `${legalConstraints.length} legal constraint block(s) found.`
                : 'No legal constraints found.',
            fix: legalConstraints.length > 0 ? undefined : 'Add resourceConstraints/MD_LegalConstraints.'
        });
        if (legalConstraints.length === 0)
            return results;
        // --- Creative Commons licence present ---
        const hasCC = legalConstraints.some(c => {
            const allText = [
                c.referenceTitle ?? '',
                c.referenceLinkage ?? '',
                ...c.useLimitation,
                ...c.otherConstraints
            ].join(' ');
            return /creative\s*commons/i.test(allText) || /creativecommons\.org/i.test(allText);
        });
        results.push({
            id: 'licensing-cc',
            name: 'Creative Commons licence present',
            severity: hasCC ? 'pass' : 'warning',
            message: hasCC
                ? 'Creative Commons licence found.'
                : 'No Creative Commons licence detected in constraints.',
            fix: hasCC ? undefined : 'Add a reference to the Creative Commons licence in MD_LegalConstraints.'
        });
        // --- Citation statement in otherConstraints ---
        const hasCitation = legalConstraints.some(c => c.otherConstraints.some(text => text.length > 50));
        results.push({
            id: 'licensing-citation',
            name: 'Citation statement present',
            severity: hasCitation ? 'pass' : 'warning',
            message: hasCitation
                ? 'Citation statement found in other constraints.'
                : 'No citation statement found in other constraints.',
            fix: hasCitation ? undefined : 'Add a formatted citation statement (APA-style) in mco:otherConstraints.'
        });
        return results;
    }
};
//# sourceMappingURL=licensing-checks.js.map