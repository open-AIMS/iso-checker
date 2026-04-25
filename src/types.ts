// Core types for the ISO 19115-3 Metadata Checker

// --- Record types ---

export type RecordType = 'dataset' | 'project' | 'program';

export type SchemaType = 'iso19115-3' | 'iso19139' | 'unknown';

// --- Severity levels ---

export type Severity = 'pass' | 'error' | 'warning' | 'info';

// --- Check result ---

export interface CheckResult {
  id: string;
  name: string;
  severity: Severity;
  message: string;
  expected?: string;
  found?: string;
  fix?: string;
  /** Entity name for grouping (org name, person name) */
  entity?: string;
  /** URL to link the primary identifier value for quick verification */
  link?: string;
}

// --- Rule section ---

export interface RuleSection {
  id: string;
  name: string;
  description: string;
  /** Which record types this section applies to. Empty = all. */
  appliesTo: RecordType[];
  /** Profile this section belongs to */
  profile: string;
  /** Whether enabled by default */
  defaultEnabled: boolean;
  /** Run checks against a parsed record */
  check(record: ParsedRecord, context: CheckContext): Promise<CheckResult[]>;
}

// --- Parsed record (output of XML parsing) ---

export interface ParsedRecord {
  schema: SchemaType;
  uuid: string | null;
  title: string | null;
  scopeCode: string | null;
  parentUuid: string | null;
  recordType: RecordType;
  recordTypeSource: 'scope' | 'title' | 'override';
  citation: ParsedCitation;
  associatedResources: ParsedAssociatedResource[];
  responsibleParties: ParsedResponsibleParty[];
  pointOfContacts: ParsedResponsibleParty[];
  constraints: ParsedConstraint[];
  templatePlaceholders: TemplatePlaceholder[];
  /** The raw XML document for additional queries */
  xmlDoc: Document;
  /** Namespace resolver */
  nsResolver: XPathNSResolver;
  /** Source URL if fetched from a catalogue */
  sourceUrl?: string;
}

// --- Citation ---

export interface ParsedCitation {
  identifiers: ParsedIdentifier[];
}

// --- Identifier ---

export interface ParsedIdentifier {
  code: string | null;
  codeSpace: string | null;
  description: string | null;
  /** Whether the code uses gcx:Anchor */
  isAnchor: boolean;
  /** The xlink:href from Anchor */
  anchorHref: string | null;
  /** Raw text including any URL prefix */
  rawCode: string | null;
}

// --- Associated resource ---

export interface ParsedAssociatedResource {
  associationType: string | null;
  initiativeType: string | null;
  title: string | null;
  identifiers: ParsedIdentifier[];
}

// --- Responsible party ---

export interface ParsedResponsibleParty {
  role: string | null;
  organisation: ParsedOrganisation | null;
  individual: ParsedIndividual | null;
  /** Whether this is from citation or pointOfContact */
  section: 'citation' | 'pointOfContact';
}

// --- Organisation ---

export interface ParsedOrganisation {
  name: string | null;
  partyIdentifiers: ParsedIdentifier[];
  onlineResources: ParsedOnlineResource[];
}

// --- Individual ---

export interface ParsedIndividual {
  name: string | null;
  email: string | null;
  partyIdentifiers: ParsedIdentifier[];
  onlineResources: ParsedOnlineResource[];
  address?: {
    administrativeArea?: string;
    country?: string;
  };
}

// --- Online resource ---

export interface ParsedOnlineResource {
  linkage: string | null;
  protocol: string | null;
  name: string | null;
}

// --- Constraint ---

export interface ParsedConstraint {
  type: 'legal' | 'security' | 'other';
  useLimitation: string[];
  otherConstraints: string[];
  /** CC licence info from reference */
  referenceTitle: string | null;
  referenceLinkage: string | null;
}

// --- Template placeholder ---

export interface TemplatePlaceholder {
  text: string;
  /** XPath-like location for display */
  location: string;
}

// --- Check context (available to rules at check time) ---

export interface CheckContext {
  /** Whether API validation is enabled */
  apiValidationEnabled: boolean;
  /** PID cache for lookups */
  pidCache: PidCache;
  /** Knowledge base (v3, stubs for now) */
  knowledgeBase: KnowledgeBase;
  /** Enabled rule section IDs */
  enabledSections: Set<string>;
}

// --- PID cache ---

export interface PidCacheEntry {
  identifier: string;
  type: 'doi' | 'orcid' | 'ror' | 'raid';
  resolved: boolean;
  /** Cached API metadata */
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface PidCache {
  get(type: string, identifier: string): PidCacheEntry | null;
  set(entry: PidCacheEntry): void;
  clear(): void;
  size(): number;
  all(): PidCacheEntry[];
}

// --- Knowledge base (v3 stubs) ---

export interface KnowledgeBasePerson {
  name: string;
  orcid: string | null;
  registeredName: string | null;
  status: 'auto' | 'no-orcid';
  aliases: string[];
  sourceRecords: string[];
}

export interface KnowledgeBaseOrg {
  name: string;
  ror: string | null;
  canonicalName: string | null;
  status: 'auto' | 'no-ror';
  aliases: string[];
  sourceRecords: string[];
}

export interface KnowledgeBase {
  findPerson(name: string): KnowledgeBasePerson | null;
  findOrg(name: string): KnowledgeBaseOrg | null;
  // v3: full CRUD operations
}

// --- Settings ---

export interface CatalogueConfig {
  url: string;
  proxyUrl: string | null;
  label?: string;
}

export interface AppSettings {
  catalogues: CatalogueConfig[];
  activeCatalogueIndex: number;
  enabledSections: string[];
  disabledRules: string[];
  apiValidationEnabled: boolean;
  rateLimitMs: number;
  setupComplete: boolean;
}

// --- Report ---

export interface SectionReport {
  sectionId: string;
  sectionName: string;
  results: CheckResult[];
}

export interface RecordReport {
  record: ParsedRecord;
  sections: SectionReport[];
  timestamp: Date;
}
