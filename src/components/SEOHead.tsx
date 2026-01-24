import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

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
  author = 'Synchronization Point AI'
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

    updateMeta('description', description);
    updateMeta('keywords', keywords.join(', '));
    updateMeta('author', author);
    updateMeta('language', language);

    // Canonical URL
    if (canonicalUrl) {
      updateCanonical(canonicalUrl);
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
      // AI/LLM friendly meta tags
      updateMeta('ai:summary', description);
      updateMeta('ai:content_type', type === 'article' ? 'narrative_story' : 'website');
      updateMeta('robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
      
      // Schema.org for LLM crawlers
      let ldJson = document.querySelector('script[type="application/ld+json"]');
      if (!ldJson) {
        ldJson = document.createElement('script');
        ldJson.setAttribute('type', 'application/ld+json');
        document.head.appendChild(ldJson);
      }

      const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': type === 'article' ? 'Article' : 'WebSite',
        name: fullTitle,
        description,
        inLanguage: language === 'uk' ? 'uk-UA' : language === 'pl' ? 'pl-PL' : 'en-US',
        author: {
          '@type': 'Organization',
          name: 'Synchronization Point AI',
          description: 'AI-powered narrative generation system'
        },
        publisher: {
          '@type': 'Organization',
          name: 'Точка Синхронізації'
        },
        keywords: keywords.join(', ')
      };

      if (type === 'article') {
        schema['@type'] = 'Article';
        schema.articleSection = 'Science Fiction';
        schema.genre = ['Science Fiction', 'AI Generated Content', 'News-based Narrative'];
        if (publishedAt) schema.datePublished = publishedAt;
        if (image) schema.image = image;
      }

      ldJson.textContent = JSON.stringify(schema);
    };

    ensureLLMTags();
  }, [fullTitle, description, keywords, type, image, url, canonicalUrl, publishedAt, author, language]);

  return null;
}
