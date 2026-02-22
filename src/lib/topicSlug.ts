/**
 * Utility functions for topic/category URL slugs.
 * Topics are stored as plain strings (e.g. "Технології", "World Politics").
 * We encode them for the URL and decode them back in the page component.
 */

/** Convert a topic string to a URL-safe slug segment */
export function topicToSlug(topic: string): string {
  return encodeURIComponent(topic);
}

/** Parse a route param back to the original topic string */
export function slugToTopic(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/** Build the path for a topic page */
export function topicPath(topic: string): string {
  return `/topics/${topicToSlug(topic)}`;
}
