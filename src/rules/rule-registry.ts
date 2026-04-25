// Rule registry — collects all rule sections, manages profiles and enabled state
// Implements requirements.md §5

import type { RuleSection, ParsedRecord, CheckContext, SectionReport, RecordReport } from '../types.js';
import { doiChecks } from './doi-checks.js';
import { raidChecks } from './raid-checks.js';
import { rorChecks } from './ror-checks.js';
import { orcidChecks } from './orcid-checks.js';
import { peopleChecks } from './people-checks.js';
import { hierarchyChecks } from './hierarchy-checks.js';
import { licensingChecks } from './licensing-checks.js';
import { templateChecks } from './template-checks.js';
import { nespChecks } from './nesp-checks.js';

/** All registered rule sections */
const ALL_SECTIONS: RuleSection[] = [
  doiChecks,
  raidChecks,
  rorChecks,
  orcidChecks,
  peopleChecks,
  hierarchyChecks,
  licensingChecks,
  templateChecks,
  nespChecks,
];

export function getAllSections(): RuleSection[] {
  return [...ALL_SECTIONS];
}

export function getSectionById(id: string): RuleSection | undefined {
  return ALL_SECTIONS.find(s => s.id === id);
}

/**
 * Register a new rule section (for extensibility — new profiles/modules).
 */
export function registerSection(section: RuleSection): void {
  const existing = ALL_SECTIONS.findIndex(s => s.id === section.id);
  if (existing >= 0) {
    ALL_SECTIONS[existing] = section;
  } else {
    ALL_SECTIONS.push(section);
  }
}

/**
 * Run all enabled checks for a record and produce a full report.
 */
export async function analyseRecord(
  record: ParsedRecord,
  context: CheckContext
): Promise<RecordReport> {
  const sections: SectionReport[] = [];

  for (const section of ALL_SECTIONS) {
    // Check if section is enabled
    if (!context.enabledSections.has(section.id)) continue;

    // Check if section applies to this record type
    if (section.appliesTo.length > 0 && !section.appliesTo.includes(record.recordType)) {
      continue;
    }

    const results = await section.check(record, context);
    sections.push({
      sectionId: section.id,
      sectionName: section.name,
      results
    });
  }

  return {
    record,
    sections,
    timestamp: new Date()
  };
}
