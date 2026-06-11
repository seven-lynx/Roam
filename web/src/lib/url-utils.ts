/**
 * Shared URL utility functions for domain extraction and favicon URLs.
 * Used across TopSites, SavedUrlsManager, CollectionsManager, and collection pages.
 */

/**
 * Extract a clean domain from a URL string.
 * Strips protocol and www. prefix.
 * Returns the original string if parsing fails.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Get a Google favicon URL for a given domain.
 * Returns an empty string if the domain is empty.
 */
export function getFaviconUrl(domain: string, size = 32): string {
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}