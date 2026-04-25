// Hierarchy & Structure — requirements.md §6.6
// Checks for parentMetadata and metadataScope
export const hierarchyChecks = {
    id: 'hierarchy',
    name: 'Hierarchy & Structure',
    description: 'Checks for parentMetadata and metadataScope.',
    appliesTo: [],
    profile: 'generic',
    defaultEnabled: true,
    async check(record, _context) {
        const results = [];
        // --- parentMetadata ---
        results.push({
            id: 'hierarchy-parent',
            name: 'Parent metadata present',
            severity: record.parentUuid ? 'pass' : 'warning',
            message: record.parentUuid
                ? `Parent metadata UUID: ${record.parentUuid}`
                : 'No parentMetadata UUID found. Standalone records are valid but should be linked if part of a hierarchy.',
            fix: record.parentUuid ? undefined : 'Add mdb:parentMetadata with a uuidref to the parent record.'
        });
        // --- metadataScope ---
        results.push({
            id: 'hierarchy-scope',
            name: 'Metadata scope present',
            severity: record.scopeCode ? 'pass' : 'warning',
            message: record.scopeCode
                ? `Metadata scope: ${record.scopeCode}`
                : 'No metadataScope found. Scope helps identify the record type (dataset, fieldSession, series).',
            fix: record.scopeCode ? undefined : 'Add mdb:metadataScope with the appropriate MD_ScopeCode.'
        });
        return results;
    }
};
//# sourceMappingURL=hierarchy-checks.js.map