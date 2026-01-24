import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

type RobotsDirective = 'index' | 'noindex' | 'follow' | 'nofollow' | 'noarchive' | 'nosnippet' | 'noimageindex';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  type?: 'website' | 'article';
  image?: string;
  url?: string;
  canonicalUrl?: string;
  publishedAt?: string;
  author?: string;
  robots?: RobotsDirective[];
  noIndex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
}

export function SEOHead({
  title = 'Точка Синхронізації',
  description = 'AI-генерована наукова фантастика на основі реальних новин',
  keywords = ['AI', 'science fiction', 'news', 'narrative', 'Ukraine'],
  type = 'website',
  image,
  url,
  canonicalUrl,
  publishedAt,
  author = 'Synchronization Point AI',
  robots,
  noIndex = false,
  breadcrumbs
}: SEOHeadProps) {
  const { language } = useLanguage();

  const fullTitle = title.includes('Точка Синхронізації') 
    ? title 
    : `${title} | Точка Синхронізації`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Update/create meta tags
    const updateMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    // Update/create canonical link
    const updateCanonical = (href: string) => {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.href = href;
    };

    // Update/create hreflang links
    const updateHreflang = (baseUrl: string) => {
      const languages = [
        { code: 'uk', hreflang: 'uk' },
        { code: 'en', hreflang: 'en' },
        { code: 'pl', hreflang: 'pl' },
        { code: 'x-default', hreflang: 'x-default' }
      ];

      // Remove existing hreflang links
      document.querySelectorAll('link[hreflang]').forEach(el => el.remove());

      // Add new hreflang links
      languages.forEach(lang => {
        const link = document.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', lang.hreflang);
        // All language versions share the same URL since language is handled client-side
        link.setAttribute('href', baseUrl);
        document.head.appendChild(link);
      });
    };

    updateMeta('description', description);
    updateMeta('keywords', keywords.join(', '));
    updateMeta('author', author);
    updateMeta('language', language);

    // Canonical URL and hreflang
    if (canonicalUrl) {
      updateCanonical(canonicalUrl);
      updateHreflang(canonicalUrl);
    }

    // OpenGraph
    updateMeta('og:title', fullTitle, true);
    updateMeta('og:description', description, true);
    updateMeta('og:type', type, true);
    if (image) updateMeta('og:image', image, true);
    if (url || canonicalUrl) updateMeta('og:url', canonicalUrl || url || '', true);
    updateMeta('og:locale', language === 'uk' ? 'uk_UA' : language === 'pl' ? 'pl_PL' : 'en_US', true);

    // Twitter
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', description);
    if (image) updateMeta('twitter:image', image);

    // Article specific
    if (type === 'article' && publishedAt) {
      updateMeta('article:published_time', publishedAt, true);
      updateMeta('article:author', author, true);
    }

    // LLM crawler tags
    const ensureLLMTags = () => {
      // AI/LLM friendly meta tags - enhanced for modern crawlers
      updateMeta('ai:summary', description);
      updateMeta('ai:content_type', type === 'article' ? 'narrative_story' : 'website');
      updateMeta('ai:language', language);
      
      // Site identity for LLMs
      updateMeta('application-name', 'Synchronization Point');
      updateMeta('generator', 'Lovable AI');
      
      // Dublin Core metadata (used by some AI systems)
      updateMeta('DC.title', fullTitle);
      updateMeta('DC.description', description);
      updateMeta('DC.language', language === 'uk' ? 'uk-UA' : language === 'pl' ? 'pl-PL' : 'en-US');
      updateMeta('DC.creator', author);
      updateMeta('DC.type', type === 'article' ? 'Text.Article' : 'Text.Website');
      if (publishedAt) updateMeta('DC.date', publishedAt);
      
      // Robots directive - optimized for both traditional and AI crawlers
      let robotsContent: string;
      if (noIndex) {
        robotsContent = 'noindex, nofollow';
      } else if (robots && robots.length > 0) {
        robotsContent = robots.join(', ');
      } else {
        robotsContent = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
      }
      updateMeta('robots', robotsContent);
      updateMeta('googlebot', robotsContent);
      
      // Specific AI bot directives
      updateMeta('googlebot-news', type === 'article' ? 'index, follow' : robotsContent);
      
      // Schema.org JSON-LD - use array for multiple schemas
      const schemas: Record<string, unknown>[] = [];

      // Organization schema (for brand recognition by AI)
      const organizationSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Synchronization Point',
        alternateName: 'Точка Синхронізації',
        description: 'AI-powered narrative generation system that transforms real-world news into science fiction stories',
        url: 'https://chrono-narrative-engine.lovable.app',
        logo: 'https://chrono-narrative-engine.lovable.app/favicon.png',
        sameAs: [],
        knowsAbout: ['Artificial Intelligence', 'Science Fiction', 'News Analysis', 'Narrative Generation', 'Ukrainian Literature']
      };
      schemas.push(organizationSchema);

      // Main content schema - enhanced for LLM understanding
      const mainSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': type === 'article' ? 'NewsArticle' : 'WebSite',
        name: fullTitle,
        headline: fullTitle,
        description,
        abstract: description,
        inLanguage: language === 'uk' ? 'uk-UA' : language === 'pl' ? 'pl-PL' : 'en-US',
        author: {
          '@type': 'Organization',
          name: 'Synchronization Point AI',
          description: 'AI-powered narrative generation system',
          url: 'https://chrono-narrative-engine.lovable.app'
        },
        publisher: {
          '@type': 'Organization',
          name: 'Точка Синхронізації',
          logo: {
            '@type': 'ImageObject',
            url: 'https://chrono-narrative-engine.lovable.app/favicon.png'
          }
        },
        keywords: keywords.join(', '),
        isAccessibleForFree: true,
        creativeWorkStatus: 'Published'
      };

      if (type === 'article') {
        mainSchema['@type'] = 'NewsArticle';
        mainSchema.articleSection = 'Science Fiction';
        mainSchema.genre = ['Science Fiction', 'AI Generated Content', 'News-based Narrative', 'Speculative Fiction'];
        mainSchema.about = {
          '@type': 'Thing',
          name: 'AI-generated narrative based on current events'
        };
        if (publishedAt) {
          mainSchema.datePublished = publishedAt;
          mainSchema.dateModified = publishedAt;
        }
        if (image) {
          mainSchema.image = {
            '@type': 'ImageObject',
            url: image
          };
          mainSchema.thumbnailUrl = image;
        }
        if (canonicalUrl) {
          mainSchema.mainEntityOfPage = {
            '@type': 'WebPage',
            '@id': canonicalUrl
          };
          mainSchema.url = canonicalUrl;
        }
      } else {
        // WebSite schema enhancements
        mainSchema.potentialAction = {
          '@type': 'SearchAction',
          target: 'https://chrono-narrative-engine.lovable.app/calendar?q={search_term_string}',
          'query-input': 'required name=search_term_string'
        };
      }

      schemas.push(mainSchema);

      // BreadcrumbList schema
      if (breadcrumbs && breadcrumbs.length > 0) {
        const breadcrumbSchema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbs.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url
          }))
        };
        schemas.push(breadcrumbSchema);
      }

      // Remove existing and add new JSON-LD
      document.querySelectorAll('script[type="application/ld+json"]').forEach(el => el.remove());
      
      schemas.forEach(schema => {
        const ldJson = document.createElement('script');
        ldJson.setAttribute('type', 'application/ld+json');
        ldJson.textContent = JSON.stringify(schema);
        document.head.appendChild(ldJson);
      });
    };

    ensureLLMTags();
  }, [fullTitle, description, keywords, type, image, url, canonicalUrl, publishedAt, author, language, robots, noIndex, breadcrumbs]);

  return null;
}
