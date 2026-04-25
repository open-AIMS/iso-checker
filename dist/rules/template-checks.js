// Template Placeholder Detection — requirements.md §6.9
// Scans all text fields for unresolved ** markers
export const templateChecks = {
    id: 'template',
    name: 'Template Placeholders',
    description: 'Detects unresolved template markers (**) in text fields.',
    appliesTo: [],
    profile: 'generic',
    defaultEnabled: true,
    async check(record, _context) {
        const results = [];
        if (record.templatePlaceholders.length === 0) {
            results.push({
                id: 'template-none',
                name: 'No template placeholders',
                severity: 'pass',
                message: 'No unresolved template placeholders found.'
            });
        }
        else {
            for (const ph of record.templatePlaceholders) {
                results.push({
                    id: 'template-placeholder',
                    name: 'Template placeholder detected',
                    severity: 'error',
                    message: `Unresolved template placeholder found.`,
                    found: ph.text.substring(0, 100) + (ph.text.length > 100 ? '...' : ''),
                    fix: `Replace the template text at ${ph.location} with the actual value.`
                });
            }
        }
        // --- Title *Draft* check ---
        if (record.title && /\*Draft\*/i.test(record.title)) {
            results.push({
                id: 'template-draft',
                name: 'Title contains *Draft*',
                severity: 'warning',
                message: 'Title contains "*Draft*". This may be intentional but should be reviewed before publication.',
                found: record.title,
                fix: 'Remove "*Draft*" from the title if the record is ready for publication.'
            });
        }
        return results;
    }
};
//# sourceMappingURL=template-checks.js.map