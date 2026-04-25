// RAiD Checks — requirements.md §6.2
// Project records: RAiD in citation identifier
// Dataset records: RAiD in associated resource

import type { RuleSection, CheckResult, ParsedRecord, CheckContext, ParsedIdentifier } from '../types.js';
import { PidResolver } from '../api/pid-resolver.js';

export const raidChecks: RuleSection = {
  id: 'raid',
  name: 'RAiD Checks',
  description: 'Validates RAiD in citation (projects) or associated resource (datasets).',
  appliesTo: ['dataset', 'project'],
  profile: 'generic',
  defaultEnabled: true,

  async check(record: ParsedRecord, context: CheckContext): Promise<CheckResult[]> {
    if (record.schema === 'iso19139') {
      return [{
        id: 'raid-schema',
        name: 'RAiD checks (ISO 19139)',
        severity: 'info',
        message: 'RAiD checks require ISO 19115-3. This record uses ISO 19139 which lacks associatedResource.'
      }];
    }

    if (record.recordType === 'project') {
      return checkProjectRaid(record, context);
    }
    if (record.recordType === 'dataset') {
      return checkDatasetRaid(record, context);
    }
    return [];
  }
};

async function checkProjectRaid(record: ParsedRecord, context: CheckContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const raidId = record.citation.identifiers.find(id =>
    id.codeSpace?.toLowerCase() === 'raid.org'
  );

  if (!raidId) {
    results.push({
      id: 'raid-present',
      name: 'RAiD present in citation',
      severity: 'error',
      message: 'No RAiD found in citation identifiers for this project record.',
      expected: 'cit:identifier with codeSpace "raid.org"',
      found: 'None',
      fix: 'Add a cit:identifier/mcc:MD_Identifier with mcc:codeSpace "raid.org" and the RAiD in a gcx:Anchor.'
    });
    return results;
  }

  results.push({
    id: 'raid-present',
    name: 'RAiD present in citation',
    severity: 'pass',
    message: `RAiD found: ${raidId.code}`,
    link: `https://raid.org/${raidId.code}`
  });

  results.push(...checkRaidEncoding(raidId, 'raid', context));

  if (context.apiValidationEnabled && raidId.code) {
    const resolver = new PidResolver(context.pidCache);
    const result = await resolver.resolveRaid(raidId.code);
    results.push({
      id: 'raid-resolves',
      name: 'RAiD resolves',
      severity: result.resolved ? 'pass' : 'warning',
      message: result.resolved ? 'RAiD resolves.' : `RAiD "${raidId.code}" could not be resolved.`,
      link: `https://raid.org/${raidId.code}`,
      fix: result.resolved ? undefined : 'Verify the RAiD handle is registered.'
    });
  }

  return results;
}

async function checkDatasetRaid(record: ParsedRecord, context: CheckContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Find associated resource with RAiD
  const raidResource = record.associatedResources.find(ar =>
    ar.identifiers.some(id => id.codeSpace?.toLowerCase() === 'raid.org')
  );

  if (!raidResource) {
    results.push({
      id: 'raid-present',
      name: 'RAiD present in associated resource',
      severity: 'error',
      message: 'No RAiD found in associated resources for this dataset record.',
      expected: 'mri:associatedResource with codeSpace "raid.org"',
      found: 'None',
      fix: 'Add an mri:associatedResource block with the project RAiD, associationType="dependency", initiativeType="project".'
    });
    return results;
  }

  const raidCode = raidResource.identifiers.find(id => id.codeSpace?.toLowerCase() === 'raid.org')?.code;
  results.push({
    id: 'raid-present',
    name: 'RAiD present in associated resource',
    severity: 'pass',
    message: `RAiD found in associated resource: ${raidCode}`,
    link: raidCode ? `https://raid.org/${raidCode}` : undefined
  });

  // Check associationType
  if (raidResource.associationType !== 'dependency') {
    results.push({
      id: 'raid-association-type',
      name: 'Association type is "dependency"',
      severity: 'error',
      message: `Association type should be "dependency".`,
      expected: 'dependency',
      found: raidResource.associationType ?? '(none)',
      fix: 'Set mri:associationType codeListValue to "dependency".'
    });
  } else {
    results.push({
      id: 'raid-association-type',
      name: 'Association type is "dependency"',
      severity: 'pass',
      message: 'Association type is "dependency".'
    });
  }

  // Check initiativeType
  if (raidResource.initiativeType !== 'project') {
    results.push({
      id: 'raid-initiative-type',
      name: 'Initiative type is "project"',
      severity: 'error',
      message: `Initiative type should be "project".`,
      expected: 'project',
      found: raidResource.initiativeType ?? '(none)',
      fix: 'Set mri:initiativeType codeListValue to "project".'
    });
  } else {
    results.push({
      id: 'raid-initiative-type',
      name: 'Initiative type is "project"',
      severity: 'pass',
      message: 'Initiative type is "project".'
    });
  }

  // Check RAiD encoding
  const raidId = raidResource.identifiers.find(id => id.codeSpace?.toLowerCase() === 'raid.org');
  if (raidId) {
    results.push(...checkRaidEncoding(raidId, 'raid-ar', context));

    if (context.apiValidationEnabled && raidId.code) {
      const resolver = new PidResolver(context.pidCache);
      const result = await resolver.resolveRaid(raidId.code);
      results.push({
        id: 'raid-resolves',
        name: 'RAiD resolves',
        severity: result.resolved ? 'pass' : 'warning',
        message: result.resolved ? 'RAiD resolves.' : `RAiD "${raidId.code}" could not be resolved.`,
        link: `https://raid.org/${raidId.code}`,
        fix: result.resolved ? undefined : 'Verify the RAiD handle is registered.'
      });
    }
  }

  return results;
}

function checkRaidEncoding(id: ParsedIdentifier, prefix: string, _context: CheckContext): CheckResult[] {
  const results: CheckResult[] = [];
  const code = id.code ?? '';

  // Bare string check
  if (code.startsWith('http://') || code.startsWith('https://')) {
    const bare = code.replace(/^https?:\/\/raid\.org\//, '');
    results.push({
      id: `${prefix}-bare-value`,
      name: 'RAiD is bare string',
      severity: 'error',
      message: 'RAiD value contains a URL prefix.',
      expected: bare,
      found: code,
      fix: `Change mcc:code text to "${bare}" (no URL prefix).`
    });
  } else {
    results.push({
      id: `${prefix}-bare-value`,
      name: 'RAiD is bare string',
      severity: 'pass',
      message: 'RAiD value is a bare string.'
    });
  }

  // Anchor check
  if (!id.isAnchor) {
    results.push({
      id: `${prefix}-anchor`,
      name: 'RAiD uses gcx:Anchor',
      severity: 'error',
      message: 'RAiD is encoded as gco:CharacterString instead of gcx:Anchor.',
      fix: 'Replace gco:CharacterString with gcx:Anchor and set xlink:href to "https://raid.org/{RAiD}".'
    });
  } else {
    const expectedHref = `https://raid.org/${code}`;
    if (id.anchorHref !== expectedHref) {
      results.push({
        id: `${prefix}-anchor`,
        name: 'RAiD Anchor href matches value',
        severity: 'error',
        message: 'RAiD Anchor href does not match the RAiD value.',
        expected: expectedHref,
        found: id.anchorHref ?? '(none)',
        fix: `Set xlink:href to "${expectedHref}".`
      });
    } else {
      results.push({
        id: `${prefix}-anchor`,
        name: 'RAiD Anchor href matches value',
        severity: 'pass',
        message: 'RAiD Anchor href matches value.'
      });
    }
  }

  return results;
}
