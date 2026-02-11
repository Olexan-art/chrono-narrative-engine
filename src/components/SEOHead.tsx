import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
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
  schemaType?: 'WebSite' | 'CollectionPage' | 'WebPage' | 'NewsArticle';
  schemaExtra?: Record<string, unknown>;
  additionalSchemas?: Record<string, unknown>[];
}

const BASE_URL = 'https://echoes2.com';

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
  breadcrumbs,
  schemaType,
  schemaExtra,
  additionalSchemas,
}: SEOHeadProps) {
  const { language } = useLanguage();

  const locale = language === 'uk' ? 'uk_UA' : language === 'pl' ? 'pl_PL' : 'en_US';
  const langCode = language === 'uk' ? 'uk-UA' : language === 'pl' ? 'pl-PL' : 'en-US';

  const robotsContent = useMemo(() => {
    if (noIndex) return 'noindex, nofollow';
    if (robots?.length) return robots.join(', ');
    return 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
  }, [noIndex, robots]);

  const resolvedUrl = canonicalUrl || url || '';

  const schemas = useMemo(() => {
    const result: Record<string, unknown>[] = [];

    // Organization
    result.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Synchronization Point',
      alternateName: 'Точка Синхронізації',
      description: 'AI-powered narrative generation system that transforms real-world news into science fiction stories',
      url: BASE_URL,
      logo: `${BASE_URL}/favicon.png`,
      sameAs: [],
      knowsAbout: ['Artificial Intelligence', 'Science Fiction', 'News Analysis', 'Narrative Generation', 'Ukrainian Literature'],
    });

    // Main schema
    const baseSchemaType = type === 'article' ? 'NewsArticle' : 'WebSite';
    const effectiveType = schemaType ?? baseSchemaType;

    const mainSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': effectiveType,
      name: title,
      headline: title,
      description,
      abstract: description,
      inLanguage: langCode,
      author: {
        '@type': 'Organization',
        name: 'Synchronization Point AI',
        url: BASE_URL,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Точка Синхронізації',
        logo: { '@type': 'ImageObject', url: `${BASE_URL}/favicon.png` },
      },
      keywords: keywords.join(', '),
      isAccessibleForFree: true,
      creativeWorkStatus: 'Published',
    };

    if (type === 'article') {
      mainSchema.articleSection = 'Science Fiction';
      mainSchema.genre = ['Science Fiction', 'AI Generated Content', 'News-based Narrative'];
      if (publishedAt) {
        mainSchema.datePublished = publishedAt;
        mainSchema.dateModified = publishedAt;
      }
      if (image) {
        mainSchema.image = { '@type': 'ImageObject', url: image };
        mainSchema.thumbnailUrl = image;
      }
      if (canonicalUrl) {
        mainSchema.mainEntityOfPage = { '@type': 'WebPage', '@id': canonicalUrl };
        mainSchema.url = canonicalUrl;
      }
    } else {
      mainSchema.potentialAction = {
        '@type': 'SearchAction',
        target: `${BASE_URL}/calendar?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      };
    }

    if (schemaExtra) Object.assign(mainSchema, schemaExtra);
    result.push(mainSchema);

    // Breadcrumbs
    if (breadcrumbs?.length) {
      result.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: item.url,
        })),
      });
    }

    if (additionalSchemas?.length) result.push(...additionalSchemas);

    return result;
  }, [title, description, keywords, type, image, canonicalUrl, publishedAt, langCode, schemaType, schemaExtra, breadcrumbs, additionalSchemas]);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <meta name="author" content={author} />
      <meta name="language" content={language} />
      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={robotsContent} />
      <meta name="googlebot-news" content={type === 'article' ? 'index, follow' : robotsContent} />

      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Hreflang */}
      {canonicalUrl && (
        <>
          <link rel="alternate" hrefLang="uk" href={canonicalUrl} />
          <link rel="alternate" hrefLang="en" href={canonicalUrl} />
          <link rel="alternate" hrefLang="pl" href={canonicalUrl} />
          <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
        </>
      )}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={locale} />
      {resolvedUrl && <meta property="og:url" content={resolvedUrl} />}
      {image && <meta property="og:image" content={image} />}
      <meta property="og:site_name" content="Synchronization Point" />

      {/* Twitter */}
      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Article-specific */}
      {type === 'article' && publishedAt && (
        <>
          <meta property="article:published_time" content={publishedAt} />
          <meta property="article:author" content={author} />
        </>
      )}

      {/* LLM/AI meta */}
      <meta name="ai:summary" content={description} />
      <meta name="ai:content_type" content={type === 'article' ? 'narrative_story' : 'website'} />
      <meta name="ai:language" content={language} />
      <meta name="application-name" content="Synchronization Point" />
      <meta name="generator" content="Lovable AI" />

      {/* Dublin Core */}
      <meta name="DC.title" content={title} />
      <meta name="DC.description" content={description} />
      <meta name="DC.language" content={langCode} />
      <meta name="DC.creator" content={author} />
      <meta name="DC.type" content={type === 'article' ? 'Text.Article' : 'Text.Website'} />
      {publishedAt && <meta name="DC.date" content={publishedAt} />}

      {/* JSON-LD */}
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
