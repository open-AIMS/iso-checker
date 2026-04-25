// NESP MaC Conventions — requirements.md §7
// Optional profile: title patterns and standard online resources

import type { RuleSection, CheckResult, ParsedRecord, CheckContext } from '../types.js';

// Project: "{Program} Project {Code} - {Title} ({Orgs})"
const PROJECT_TITLE_PATTERN = /^.+\s+Project\s+\d+\.\d+\s*[-–]\s+.+\s*\(.+\)$/;

// Dataset: "{Title} ({Program} {Code}, {Orgs})"
const DATASET_TITLE_PATTERN = /^.+\s*\([A-Z][\w\s]+\d+\.\d+,\s*.+\)$/;

export const nespChecks: RuleSection = {
  id: 'nesp',
  name: 'NESP MaC Conventions',
  description: 'NESP MaC title patterns and standard links (optional profile).',
  appliesTo: ['dataset', 'project'],
  profile: 'nesp',
  defaultEnabled: false,

  async check(record: ParsedRecord, _context: CheckContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const title = record.title ?? '';

    if (record.recordType === 'project') {
      results.push({
        id: 'nesp-project-title',
        name: 'Project title pattern',
        severity: PROJECT_TITLE_PATTERN.test(title) ? 'pass' : 'warning',
        message: PROJECT_TITLE_PATTERN.test(title)
          ? 'Project title matches NESP pattern.'
          : 'Project title does not match expected pattern: "{Program} Project {Code} - {Title} ({Orgs})".',
        found: title,
        fix: 'Reformat title to: "NESP MaC Project X.X - Title (Org1, Org2)".'
      });
    }

    if (record.recordType === 'dataset') {
      results.push({
        id: 'nesp-dataset-title',
        name: 'Dataset title pattern',
        severity: DATASET_TITLE_PATTERN.test(title) ? 'pass' : 'warning',
        message: DATASET_TITLE_PATTERN.test(title)
          ? 'Dataset title matches NESP pattern.'
          : 'Dataset title does not match expected pattern: "{Title} ({Program} {Code}, {Orgs})".',
        found: title,
        fix: 'Reformat title to: "Title (NESP MaC X.X, Org1, Org2)".'
      });
    }

    return results;
  }
};
