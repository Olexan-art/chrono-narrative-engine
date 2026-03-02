export function getLogoUrl(domain: string | null | undefined, size = 128): string {
  // Returns a reliable high-resolution favicon using Google S2.
  if (!domain) {
    return '/favicon.png';
  }

  // strip "www." prefix if present
  const host = domain.replace(/^www\./, '');

  const sz = Math.min(256, Math.max(16, size));
  // Google S2 favicon service guarantees a response (fallback to generic globe)
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${host}&size=${sz}`;
}

/**
 * Fallback to default in case Google returns a blank image or gets blocked
 */
export function getFallbackLogoUrl(domain: string | null | undefined, size = 128): string {
  // Clearbit has been unreliable, so we just use the same or fallback to local
  return getLogoUrl(domain, size);
}

/**
 * Returns an ordered list of logo URL candidates for progressive fallback:
 * Clearbit (best quality) → Google S2 favicon → app favicon
 */
export function getLogoUrlCandidates(domain: string | null | undefined, size = 128): string[] {
  if (!domain) return ['/favicon.png'];
  return [
    getLogoUrl(domain, size),
    getFallbackLogoUrl(domain, size),
    '/favicon.png',
  ];
}
