export function getLogoUrl(domain: string | null | undefined, size = 128): string {
  // Returns a high‑quality logo URL for a given hostname.
  // Primary provider is Clearbit (vector-quality logos).
  if (!domain) {
    return '/favicon.png';
  }

  // strip "www." prefix if present
  const host = domain.replace(/^www\./, '');

  // Clearbit logo API returns high-quality PNG/SVG logos
  return `https://logo.clearbit.com/${host}?size=${size}`;
}

/**
 * Returns Google's high-resolution favicon URL as a fallback.
 * Supports up to 256px, much better than the classic 16px favicon.
 */
export function getFallbackLogoUrl(domain: string | null | undefined, size = 128): string {
  if (!domain) return '/favicon.png';
  const host = domain.replace(/^www\./, '');
  // Google S2 favicon service — high-quality, reliable, supports 16–256px
  const sz = Math.min(256, Math.max(16, size));
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${host}&size=${sz}`;
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
