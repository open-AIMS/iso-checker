// Report export — Markdown report and AI context export
// Implements ui-design.md §8

import type { RecordReport, SectionReport, CheckResult, Severity } from '../types.js';

const SEVERITY_ICONS: Record<Severity, string> = {
  pass: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ'
};

/**
 * Generate a Markdown report for a single record.
 * @param issuesOnly If true, only include sections/checks with errors or warnings.
 */
export function generateMarkdownReport(report: RecordReport, issuesOnly = false): string {
  const { record, sections, timestamp } = report;
  const counts = countSeverities(sections);

  const lines: string[] = [
    '# Metadata Check Report',
    '',
    `**Record:** ${record.title ?? '(untitled)'}`,
    `**UUID:** ${record.uuid ?? '(unknown)'}`,
    `**Type:** ${capitalize(record.recordType)}`,
    `**Schema:** ${record.schema}`,
    `**Checked:** ${timestamp.toISOString().split('T')[0]}`,
    '',
    '## Summary',
    `- ${counts.pass} passed, ${counts.warning} warnings, ${counts.error} errors, ${counts.info} info`,
    ''
  ];

  for (const section of sections) {
    const sectionResults = issuesOnly
      ? section.results.filter(r => r.severity === 'error' || r.severity === 'warning')
      : section.results;

    if (issuesOnly && sectionResults.length === 0) continue;

    const sPass = section.results.filter(r => r.severity === 'pass').length;
    const sTotal = section.results.length;
    lines.push(`## ${section.sectionName} (${sPass}/${sTotal} pass)`);
    lines.push('');

    for (const result of sectionResults) {
      const icon = SEVERITY_ICONS[result.severity];
      const prefix = result.entity ? `[${result.entity}] ` : '';
      const linkSuffix = result.link ? ` ([link](${result.link}))` : '';

      if (result.severity === 'pass') {
        lines.push(`- ${icon} ${prefix}${result.name}`);
      } else {
        lines.push(`- ${icon} **${prefix}${result.name}**${linkSuffix}`);
        if (result.expected) lines.push(`  - Expected: ${result.expected}`);
        if (result.found) lines.push(`  - Found: ${result.found}`);
        if (result.fix) lines.push(`  - Fix: ${result.fix}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a report with AI context prepended.
 * The condensed community guide is loaded from the repository file.
 */
export function generateAiContextReport(report: RecordReport, condensedGuide: string, issuesOnly = false): string {
  const markdownReport = generateMarkdownReport(report, issuesOnly);

  return [
    '# Encoding Conventions Context',
    '',
    condensedGuide,
    '',
    '---',
    '',
    markdownReport,
    '',
    '---',
    '',
    'Review the errors and warnings above and suggest specific fixes, including corrected XML where applicable.'
  ].join('\n');
}

/**
 * Generate a batch summary report covering multiple records.
 */
export function generateBatchReport(reports: RecordReport[]): string {
  const lines: string[] = [
    '# Batch Metadata Check Report',
    '',
    `**Records checked:** ${reports.length}`,
    `**Date:** ${new Date().toISOString().split('T')[0]}`,
    ''
  ];

  // Aggregate counts
  const totals = { pass: 0, warning: 0, error: 0, info: 0 };
  for (const report of reports) {
    const counts = countSeverities(report.sections);
    totals.pass += counts.pass;
    totals.warning += counts.warning;
    totals.error += counts.error;
    totals.info += counts.info;
  }

  lines.push('## Aggregate Summary');
  lines.push(`- ${totals.pass} passed, ${totals.warning} warnings, ${totals.error} errors, ${totals.info} info`);
  lines.push('');

  // Per-record summary
  lines.push('## Per-Record Summary');
  lines.push('');
  lines.push('| Record | Type | Errors | Warnings | Pass |');
  lines.push('|--------|------|--------|----------|------|');

  for (const report of reports) {
    const counts = countSeverities(report.sections);
    const title = (report.record.title ?? '(untitled)').substring(0, 60);
    lines.push(`| ${title} | ${capitalize(report.record.recordType)} | ${counts.error} | ${counts.warning} | ${counts.pass} |`);
  }

  lines.push('');

  // Individual reports
  for (const report of reports) {
    lines.push('---');
    lines.push('');
    lines.push(generateMarkdownReport(report));
  }

  return lines.join('\n');
}

function countSeverities(sections: SectionReport[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { pass: 0, error: 0, warning: 0, info: 0 };
  for (const section of sections) {
    for (const result of section.results) {
      counts[result.severity]++;
    }
  }
  return counts;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
