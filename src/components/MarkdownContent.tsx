import { useMemo } from "react";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown-like content with proper formatting
 * Supports: headers (#, ##, ###), bold (**text**), italic (*text*), links, lists
 */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={`list-${elements.length}`} className={listType === 'ul' ? "list-disc list-inside space-y-1 mb-4 text-muted-foreground" : "list-decimal list-inside space-y-1 mb-4 text-muted-foreground"}>
            {listItems.map((item, i) => (
              <li key={i}>{parseInlineMarkdown(item)}</li>
            ))}
          </ListTag>
        );
        listItems = [];
        listType = null;
      }
    };

    const parseInlineMarkdown = (text: string): JSX.Element | string => {
      // Handle bold **text** or __text__
      let result: (string | JSX.Element)[] = [];
      let remaining = text;
      let keyCounter = 0;

      // Bold: **text** or __text__
      const boldRegex = /(\*\*|__)(.*?)\1/g;
      // Italic: *text* or _text_ (but not ** or __)
      const italicRegex = /(?<!\*)\*(?!\*)([^*]+)\*(?!\*)|(?<!_)_(?!_)([^_]+)_(?!_)/g;
      // Links: [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

      // Process bold first
      remaining = remaining.replace(boldRegex, (_, __, content) => {
        return `<strong>${content}</strong>`;
      });

      // Process italic
      remaining = remaining.replace(italicRegex, (match, g1, g2) => {
        const content = g1 || g2;
        return `<em>${content}</em>`;
      });

      // Process links
      remaining = remaining.replace(linkRegex, (_, text, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${text}</a>`;
      });

      // Convert to React elements
      if (remaining.includes('<strong>') || remaining.includes('<em>') || remaining.includes('<a ')) {
        const parts = remaining.split(/(<[^>]+>[^<]*<\/[^>]+>)/g);
        return (
          <span>
            {parts.map((part, idx) => {
              if (part.startsWith('<strong>')) {
                const content = part.replace(/<\/?strong>/g, '');
                return <strong key={idx} className="font-semibold text-foreground">{content}</strong>;
              }
              if (part.startsWith('<em>')) {
                const content = part.replace(/<\/?em>/g, '');
                return <em key={idx} className="italic">{content}</em>;
              }
              if (part.startsWith('<a ')) {
                const hrefMatch = part.match(/href="([^"]+)"/);
                const textMatch = part.match(/>([^<]+)</);
                if (hrefMatch && textMatch) {
                  return (
                    <a
                      key={idx}
                      href={hrefMatch[1]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {textMatch[1]}
                    </a>
                  );
                }
              }
              return part;
            })}
          </span>
        );
      }

      return remaining;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        flushList();
        continue;
      }

      // Headers
      if (line.startsWith('####')) {
        flushList();
        const text = line.replace(/^####\s*/, '');
        elements.push(
          <h4 key={`h4-${i}`} className="text-base font-semibold text-foreground mt-4 mb-2">
            {parseInlineMarkdown(text)}
          </h4>
        );
        continue;
      }
      if (line.startsWith('###')) {
        flushList();
        const text = line.replace(/^###\s*/, '');
        elements.push(
          <h3 key={`h3-${i}`} className="text-lg font-semibold text-foreground mt-5 mb-2">
            {parseInlineMarkdown(text)}
          </h3>
        );
        continue;
      }
      if (line.startsWith('##')) {
        flushList();
        const text = line.replace(/^##\s*/, '');
        elements.push(
          <h2 key={`h2-${i}`} className="text-xl font-bold text-foreground mt-6 mb-3 border-b border-border pb-2">
            {parseInlineMarkdown(text)}
          </h2>
        );
        continue;
      }
      if (line.startsWith('#')) {
        flushList();
        const text = line.replace(/^#\s*/, '');
        elements.push(
          <h1 key={`h1-${i}`} className="text-2xl font-bold text-foreground mt-6 mb-4">
            {parseInlineMarkdown(text)}
          </h1>
        );
        continue;
      }

      // Unordered list items
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(line.substring(2));
        continue;
      }

      // Ordered list items
      const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (orderedMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(orderedMatch[2]);
        continue;
      }

      // Horizontal rule
      if (line === '---' || line === '***' || line === '___') {
        flushList();
        elements.push(<hr key={`hr-${i}`} className="my-6 border-border" />);
        continue;
      }

      // Blockquote
      if (line.startsWith('>')) {
        flushList();
        const text = line.replace(/^>\s*/, '');
        elements.push(
          <blockquote key={`bq-${i}`} className="border-l-4 border-primary/30 pl-4 py-2 my-4 text-muted-foreground italic bg-muted/30 rounded-r">
            {parseInlineMarkdown(text)}
          </blockquote>
        );
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${i}`} className="text-muted-foreground leading-relaxed mb-3">
          {parseInlineMarkdown(line)}
        </p>
      );
    }

    flushList();
    return elements;
  }, [content]);

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      {renderedContent}
    </div>
  );
}
