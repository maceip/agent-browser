/**
 * Effective TLD Extractor
 *
 * Extracts the effective top-level domain from URLs:
 * - forum.aol.com → aol.com
 * - news.bbc.co.uk → bbc.co.uk
 * - www.example.com → example.com
 *
 * Uses a simplified approach based on common patterns.
 * For production, consider using the Public Suffix List.
 */

// Common multi-part TLDs
const MULTI_PART_TLDS = new Set([
  'co.uk', 'co.jp', 'co.nz', 'co.za', 'com.au', 'com.br',
  'com.cn', 'com.mx', 'com.ar', 'co.in', 'co.kr',
  'gov.uk', 'ac.uk', 'org.uk', 'net.uk',
]);

/**
 * Extract effective TLD from a URL or hostname
 *
 * @param urlOrHostname - Full URL or just the hostname
 * @returns Effective TLD (e.g., "aol.com", "bbc.co.uk")
 */
export function extractEffectiveTLD(urlOrHostname: string): string {
  // Extract hostname if full URL provided
  let hostname: string;
  try {
    if (urlOrHostname.includes('://')) {
      hostname = new URL(urlOrHostname).hostname;
    } else {
      hostname = urlOrHostname;
    }
  } catch {
    // If URL parsing fails, treat as hostname
    hostname = urlOrHostname;
  }

  // Remove 'www.' prefix if present
  if (hostname.startsWith('www.')) {
    hostname = hostname.substring(4);
  }

  // Split into parts
  const parts = hostname.split('.');

  // Handle edge cases
  if (parts.length < 2) {
    return hostname; // localhost or single-part domain
  }

  // Check for multi-part TLDs (e.g., co.uk)
  if (parts.length >= 3) {
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (MULTI_PART_TLDS.has(lastTwo)) {
      // Return domain + multi-part TLD (e.g., bbc.co.uk)
      return `${parts[parts.length - 3]}.${lastTwo}`;
    }
  }

  // Default: return last two parts (domain.tld)
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

/**
 * Convert effective TLD to tool name format
 *
 * @param effectiveTLD - Effective TLD (e.g., "aol.com")
 * @returns Tool name (e.g., "page_aol_com")
 */
export function tldToToolName(effectiveTLD: string): string {
  // Replace dots with underscores and prefix with "page_"
  return `page_${effectiveTLD.replace(/\./g, '_')}`;
}

/**
 * Convert tool name back to effective TLD
 *
 * @param toolName - Tool name (e.g., "page_aol_com")
 * @returns Effective TLD (e.g., "aol.com") or null if invalid format
 */
export function toolNameToTLD(toolName: string): string | null {
  if (!toolName.startsWith('page_')) {
    return null;
  }

  // Remove "page_" prefix and replace underscores with dots
  return toolName.substring(5).replace(/_/g, '.');
}
