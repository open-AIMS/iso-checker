// Catalogue client — GeoNetwork URL parsing, XML fetch, CSW search
// Implements requirements.md §3

import type { CatalogueConfig } from '../types.js';

// --- URL parsing ---

interface ParsedGeoNetworkUrl {
  baseUrl: string;
  uuid: string | null;
  isSearchUrl: boolean;
  searchTerm: string | null;
  resourceType: string | null;
}

/**
 * Parse a GeoNetwork URL into its components.
 * Handles XML API URLs, catalogue page URLs, and search URLs.
 */
export function parseGeoNetworkUrl(url: string): ParsedGeoNetworkUrl | null {
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const hash = u.hash;

    // Find base URL (up to and including /geonetwork/)
    const gnIdx = pathname.indexOf('/geonetwork');
    if (gnIdx < 0) return null;
    const baseUrl = `${u.origin}${pathname.substring(0, gnIdx)}/geonetwork/`;

    // XML API: /srv/api/records/{uuid}/formatters/xml
    const xmlApiMatch = pathname.match(/\/srv\/api\/records\/([^/]+)\/formatters\/xml/);
    if (xmlApiMatch) {
      return { baseUrl, uuid: xmlApiMatch[1], isSearchUrl: false, searchTerm: null, resourceType: null };
    }

    // Human page: /srv/eng/catalog.search#/metadata/{uuid}
    const metaMatch = hash.match(/\/metadata\/([a-f0-9-]+)/i);
    if (metaMatch) {
      return { baseUrl, uuid: metaMatch[1], isSearchUrl: false, searchTerm: null, resourceType: null };
    }

    // Search URL: catalog.search#/search?any={term}&resourceType=...
    if (hash.includes('/search')) {
      const searchParams = new URLSearchParams(hash.split('?')[1] ?? '');
      return {
        baseUrl,
        uuid: null,
        isSearchUrl: true,
        searchTerm: searchParams.get('any'),
        resourceType: searchParams.get('resourceType')
      };
    }

    // Bare GeoNetwork URL
    return { baseUrl, uuid: null, isSearchUrl: false, searchTerm: null, resourceType: null };
  } catch {
    return null;
  }
}

/**
 * Build the XML API URL for fetching a record.
 */
export function buildXmlApiUrl(baseUrl: string, uuid: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return `${base}srv/api/records/${uuid}/formatters/xml`;
}

/**
 * Build the human-readable catalogue page URL.
 */
export function buildCataloguePageUrl(baseUrl: string, uuid: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return `${base}srv/eng/catalog.search#/metadata/${uuid}`;
}

// --- Rate limiter ---

class RateLimiter {
  private lastRequestTime = 0;
  private delayMs: number;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.delayMs) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

// --- Catalogue client ---

export class CatalogueClient {
  private config: CatalogueConfig;
  private rateLimiter: RateLimiter;

  constructor(config: CatalogueConfig, rateLimitMs: number = 500) {
    this.config = config;
    this.rateLimiter = new RateLimiter(rateLimitMs);
  }

  setRateLimit(ms: number): void {
    this.rateLimiter.setDelay(ms);
  }

  /**
   * Get the effective fetch URL (using proxy if configured).
   */
  private effectiveUrl(url: string): string {
    if (this.config.proxyUrl) {
      return `${this.config.proxyUrl}?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  /**
   * Fetch a single record's XML by UUID.
   */
  async fetchRecord(uuid: string): Promise<string> {
    await this.rateLimiter.wait();
    const url = buildXmlApiUrl(this.config.url, uuid);
    const resp = await fetch(this.effectiveUrl(url), {
      headers: { 'Accept': 'application/xml' }
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch record ${uuid}: HTTP ${resp.status}`);
    }
    return resp.text();
  }

  /**
   * Search via CSW GetRecords. Returns brief metadata for matching records.
   */
  async searchCsw(params: {
    searchTerm?: string;
    resourceType?: string;
    startPosition?: number;
    maxRecords?: number;
  }): Promise<CswSearchResult> {
    await this.rateLimiter.wait();

    const { searchTerm, resourceType, startPosition = 1, maxRecords = 100 } = params;

    // Build OGC Filter XML
    const filters: string[] = [];
    if (searchTerm) {
      filters.push(`<ogc:PropertyIsLike wildCard="*" singleChar="?" escapeChar="\\">
        <ogc:PropertyName>AnyText</ogc:PropertyName>
        <ogc:Literal>*${escapeXml(searchTerm)}*</ogc:Literal>
      </ogc:PropertyIsLike>`);
    }
    if (resourceType) {
      filters.push(`<ogc:PropertyIsEqualTo>
        <ogc:PropertyName>type</ogc:PropertyName>
        <ogc:Literal>${escapeXml(resourceType)}</ogc:Literal>
      </ogc:PropertyIsEqualTo>`);
    }

    let filterXml = '';
    if (filters.length === 1) {
      filterXml = `<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc">${filters[0]}</ogc:Filter>`;
    } else if (filters.length > 1) {
      filterXml = `<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc"><ogc:And>${filters.join('')}</ogc:And></ogc:Filter>`;
    }

    const constraintXml = filterXml
      ? `<csw:Constraint version="1.1.0">${filterXml}</csw:Constraint>` : '';

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<csw:GetRecords xmlns:csw="http://www.opengis.net/cat/csw/2.0.2"
  service="CSW" version="2.0.2"
  resultType="results"
  startPosition="${startPosition}"
  maxRecords="${maxRecords}">
  <csw:Query typeNames="csw:Record">
    <csw:ElementSetName>brief</csw:ElementSetName>
    ${constraintXml}
  </csw:Query>
</csw:GetRecords>`;

    // Use GET with encoded parameters for cross-origin compatibility
    const cswUrl = this.buildCswGetUrl(searchTerm, resourceType, startPosition, maxRecords);
    const resp = await fetch(this.effectiveUrl(cswUrl), {
      headers: { 'Accept': 'application/xml' }
    });

    if (!resp.ok) {
      throw new Error(`CSW search failed: HTTP ${resp.status}`);
    }

    const text = await resp.text();
    return parseCswResponse(text);
  }

  private buildCswGetUrl(
    searchTerm: string | undefined,
    resourceType: string | undefined,
    startPosition: number,
    maxRecords: number
  ): string {
    const base = this.config.url.endsWith('/') ? this.config.url : this.config.url + '/';
    const cswBase = `${base}srv/eng/csw`;

    // Build OGC Filter
    const filters: string[] = [];
    if (searchTerm) {
      filters.push(`<ogc:PropertyIsLike wildCard="*" singleChar="?" escapeChar="\\"><ogc:PropertyName>AnyText</ogc:PropertyName><ogc:Literal>*${escapeXml(searchTerm)}*</ogc:Literal></ogc:PropertyIsLike>`);
    }
    if (resourceType) {
      filters.push(`<ogc:PropertyIsEqualTo><ogc:PropertyName>type</ogc:PropertyName><ogc:Literal>${escapeXml(resourceType)}</ogc:Literal></ogc:PropertyIsEqualTo>`);
    }

    let constraint = '';
    if (filters.length === 1) {
      constraint = `<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc">${filters[0]}</ogc:Filter>`;
    } else if (filters.length > 1) {
      constraint = `<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc"><ogc:And>${filters.join('')}</ogc:And></ogc:Filter>`;
    }

    const params = new URLSearchParams({
      service: 'CSW',
      version: '2.0.2',
      request: 'GetRecords',
      resultType: 'results',
      ElementSetName: 'brief',
      typeNames: 'csw:Record',
      startPosition: String(startPosition),
      maxRecords: String(maxRecords)
    });

    if (constraint) {
      params.set('constraintLanguage', 'FILTER');
      params.set('constraint_language_version', '1.1.0');
      params.set('constraint', constraint);
    }

    return `${cswBase}?${params.toString()}`;
  }

  /**
   * Test connection to the catalogue.
   * Returns diagnostic info about CORS, CSW availability, and record fetch.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const result: ConnectionTestResult = {
      cors: false,
      csw: false,
      fetch: false,
      responseTimeMs: 0,
      error: null
    };

    const start = Date.now();

    try {
      // Test CSW endpoint
      const base = this.config.url.endsWith('/') ? this.config.url : this.config.url + '/';
      const cswUrl = `${base}srv/eng/csw?service=CSW&version=2.0.2&request=GetCapabilities`;
      const resp = await fetch(this.effectiveUrl(cswUrl), {
        headers: { 'Accept': 'application/xml' }
      });

      result.cors = true;
      result.responseTimeMs = Date.now() - start;

      if (resp.ok) {
        const text = await resp.text();
        // Check for ExceptionReport
        if (text.includes('ExceptionReport')) {
          result.csw = false;
          result.error = 'CSW returned an exception. The endpoint may not support GetCapabilities.';
        } else {
          result.csw = true;
        }
      } else {
        result.error = `CSW returned HTTP ${resp.status}`;
      }
    } catch (e) {
      result.responseTimeMs = Date.now() - start;
      result.error = 'CORS blocked or server unreachable. Try configuring a proxy URL, or check that the server is online.';
    }

    return result;
  }
}

// --- CSW response types ---

export interface CswRecord {
  identifier: string;
  title: string;
  type: string;
}

export interface CswSearchResult {
  totalMatched: number;
  totalReturned: number;
  records: CswRecord[];
  error: string | null;
}

export interface ConnectionTestResult {
  cors: boolean;
  csw: boolean;
  fetch: boolean;
  responseTimeMs: number;
  error: string | null;
}

// --- CSW response parsing ---

function parseCswResponse(xml: string): CswSearchResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  // Check for ExceptionReport
  const exception = doc.querySelector('ExceptionReport');
  if (exception) {
    return {
      totalMatched: 0,
      totalReturned: 0,
      records: [],
      error: `CSW Exception: ${exception.textContent?.trim()}`
    };
  }

  // Find SearchResults element
  const searchResults = doc.querySelector('SearchResults');
  const totalMatched = parseInt(searchResults?.getAttribute('numberOfRecordsMatched') ?? '0', 10);
  const totalReturned = parseInt(searchResults?.getAttribute('numberOfRecordsReturned') ?? '0', 10);

  const records: CswRecord[] = [];
  const briefRecords = doc.querySelectorAll('BriefRecord, SummaryRecord, Record');

  for (const rec of Array.from(briefRecords)) {
    const identifier = rec.querySelector('identifier')?.textContent?.trim() ?? '';
    const title = rec.querySelector('title')?.textContent?.trim() ?? '';
    const type = rec.querySelector('type')?.textContent?.trim() ?? '';

    if (identifier) {
      records.push({ identifier, title, type });
    }
  }

  return { totalMatched, totalReturned, records, error: null };
}

// --- Utilities ---

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
