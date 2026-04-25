// XML parsing utilities: namespace handling, XPath helpers, schema detection
// Follows rules-design.md §1–§4
const XLINK_NS = 'http://www.w3.org/1999/xlink';
/**
 * Build a namespace resolver from the root element's xmlns declarations.
 * Approach A from rules-design.md §1.
 */
export function buildNamespaceResolver(root) {
    const nsMap = {};
    for (const attr of Array.from(root.attributes)) {
        if (attr.name.startsWith('xmlns:')) {
            nsMap[attr.name.substring(6)] = attr.value;
        }
    }
    // Also capture default namespace
    const defaultNs = root.getAttribute('xmlns');
    if (defaultNs)
        nsMap[''] = defaultNs;
    return {
        lookupNamespaceURI(prefix) {
            return nsMap[prefix ?? ''] ?? null;
        }
    };
}
/**
 * Detect schema from root element namespace.
 * Rules-design.md §2.
 */
export function detectSchema(doc) {
    const root = doc.documentElement;
    if (!root)
        return 'unknown';
    // Check namespace URI of the root element
    const ns = root.namespaceURI ?? '';
    if (ns.includes('19115/-3/mdb') || ns.includes('standards.iso.org/iso/19115/-3')) {
        return 'iso19115-3';
    }
    if (ns.includes('isotc211.org/2005/gmd')) {
        return 'iso19139';
    }
    // Fallback: check xmlns declarations for mdb or gmd prefixes
    for (const attr of Array.from(root.attributes)) {
        if (attr.name.startsWith('xmlns:') && attr.value.includes('19115/-3/mdb')) {
            return 'iso19115-3';
        }
        if (attr.name.startsWith('xmlns:') && attr.value.includes('isotc211.org/2005/gmd')) {
            return 'iso19139';
        }
    }
    return 'unknown';
}
/**
 * Evaluate an XPath expression and return matching nodes.
 */
export function xpathNodes(context, expr, resolver) {
    const doc = context.ownerDocument ?? context;
    const result = doc.evaluate(expr, context, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const nodes = [];
    for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node)
            nodes.push(node);
    }
    return nodes;
}
/**
 * Evaluate an XPath expression and return the first matching element, or null.
 */
export function xpathElement(context, expr, resolver) {
    const nodes = xpathNodes(context, expr, resolver);
    return nodes[0] ?? null;
}
/**
 * Evaluate an XPath expression and return the text content of the first match, or null.
 * Treats gco:nilReason="missing" as null.
 */
export function xpathText(context, expr, resolver) {
    const el = xpathElement(context, expr, resolver);
    if (!el)
        return null;
    // Check for nilReason="missing"
    if (el.getAttribute('gco:nilReason') === 'missing')
        return null;
    const text = el.textContent?.trim() ?? null;
    return text === '' ? null : text;
}
/**
 * Evaluate an XPath and return an attribute value from the first match.
 */
export function xpathAttr(context, expr, attr, resolver) {
    const el = xpathElement(context, expr, resolver);
    if (!el)
        return null;
    return el.getAttribute(attr) ?? null;
}
/**
 * Extract text content from a code element that may be either
 * gcx:Anchor or gco:CharacterString. Returns info about which form was used.
 * Rules-design.md §4.
 */
export function extractCodeValue(codeParent, resolver) {
    // Try mcc:code/* — match any child of mcc:code
    const codeEl = xpathElement(codeParent, 'mcc:code/*', resolver)
        ?? xpathElement(codeParent, 'gmd:code/*', resolver);
    if (!codeEl) {
        return { text: null, isAnchor: false, anchorHref: null };
    }
    const localName = codeEl.localName;
    const text = codeEl.textContent?.trim() || null;
    if (localName === 'Anchor') {
        const href = codeEl.getAttributeNS(XLINK_NS, 'href') ?? codeEl.getAttribute('xlink:href');
        return { text, isAnchor: true, anchorHref: href ?? null };
    }
    return { text, isAnchor: false, anchorHref: null };
}
/**
 * Parse an XML string into a Document.
 */
export function parseXml(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error(`XML parse error: ${parseError.textContent}`);
    }
    return doc;
}
//# sourceMappingURL=xpath-helpers.js.map