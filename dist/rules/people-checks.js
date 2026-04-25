// People & Organisation Structure — requirements.md §6.5
// Checks responsible party structure, name formatting, roles, contacts
const TITLE_PREFIXES = /^(Dr|Prof|Professor|Mr|Mrs|Ms|Miss|Sir|Dame|Rev)\.?\s+/i;
export const peopleChecks = {
    id: 'people',
    name: 'People & Organisation Structure',
    description: 'Checks responsible party structure, name format, roles.',
    appliesTo: [],
    profile: 'generic',
    defaultEnabled: true,
    async check(record, _context) {
        const results = [];
        const allCitation = record.responsibleParties;
        const allPoC = record.pointOfContacts;
        const allParties = [...allCitation, ...allPoC];
        // --- Structure checks on citation parties ---
        for (const party of allCitation) {
            // Individual without organisation
            if (party.individual && !party.organisation) {
                results.push({
                    id: 'people-ind-no-org',
                    name: 'Individual has organisation',
                    severity: 'warning',
                    message: `"${party.individual.name}" appears without an organisation wrapper.`,
                    entity: party.individual.name ?? undefined,
                    fix: 'Nest the individual inside a CI_Organisation element.'
                });
            }
        }
        // --- At least one principal investigator ---
        const hasPi = allCitation.some(p => p.role === 'principalInvestigator');
        results.push({
            id: 'people-pi-present',
            name: 'Principal Investigator present',
            severity: hasPi ? 'pass' : 'warning',
            message: hasPi
                ? 'At least one Principal Investigator found in cited responsible parties.'
                : 'No Principal Investigator found in cited responsible parties.',
            fix: hasPi ? undefined : 'Add a citedResponsibleParty with role "principalInvestigator".'
        });
        // --- Point of contact present ---
        const hasPoc = allPoC.length > 0;
        results.push({
            id: 'people-poc-present',
            name: 'Point of Contact present',
            severity: hasPoc ? 'pass' : 'warning',
            message: hasPoc
                ? 'Point of Contact found.'
                : 'No Point of Contact found.',
            fix: hasPoc ? undefined : 'Add an mri:pointOfContact block.'
        });
        // --- Point of contact has email ---
        for (const poc of allPoC) {
            if (poc.individual) {
                if (!poc.individual.email) {
                    results.push({
                        id: 'people-poc-email',
                        name: 'Point of Contact has email',
                        severity: 'error',
                        message: `Point of Contact "${poc.individual.name}" does not have an email address.`,
                        entity: poc.individual.name ?? undefined,
                        fix: 'Add an electronicMailAddress to the Point of Contact.'
                    });
                }
                else {
                    results.push({
                        id: 'people-poc-email',
                        name: 'Point of Contact has email',
                        severity: 'pass',
                        message: `Point of Contact "${poc.individual.name}" has email.`,
                        entity: poc.individual.name ?? undefined
                    });
                }
            }
        }
        // --- Name formatting checks ---
        const seen = new Set();
        for (const party of allParties) {
            if (!party.individual?.name)
                continue;
            const name = party.individual.name;
            if (seen.has(name))
                continue;
            seen.add(name);
            // Contains comma check
            if (!name.includes(',')) {
                results.push({
                    id: 'people-name-comma',
                    name: 'Name format "Family, Given"',
                    severity: 'warning',
                    message: `Name "${name}" does not contain a comma. Expected "Family name, Given name" format.`,
                    entity: name,
                    fix: 'Reformat as "Family name, Given name" (e.g. "Smith, Jane").'
                });
            }
            // Title prefix check
            const titleMatch = name.match(TITLE_PREFIXES);
            if (titleMatch) {
                results.push({
                    id: 'people-name-title',
                    name: 'No title prefix in name',
                    severity: 'warning',
                    message: `Name "${name}" contains title prefix "${titleMatch[1]}". Titles should be omitted.`,
                    entity: name,
                    fix: `Remove "${titleMatch[1]}" from the name.`
                });
            }
        }
        return results;
    }
};
//# sourceMappingURL=people-checks.js.map