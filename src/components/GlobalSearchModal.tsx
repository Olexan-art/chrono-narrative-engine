import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Search, Hash, Globe, Users, Loader2, ArrowRight, X
} from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { topicPath } from '@/lib/topicSlug';
import { useDebounce } from '@/hooks/useDebounce';

interface GlobalSearchModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GlobalSearchModal({ isOpen, onOpenChange }: GlobalSearchModalProps) {
    const { language, t } = useLanguage();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedQuery = useDebounce(searchQuery, 300);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    // Handle keyboard shortcut (Ctrl+K or Cmd+K)
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onOpenChange(true);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [onOpenChange]);

    // 1. Fetch News
    const { data: newsResults, isLoading: isLoadingNews } = useQuery({
        queryKey: ['global-search-news', debouncedQuery, language],
        queryFn: async () => {
            if (!debouncedQuery.trim()) return [];
            const isEn = language === 'en';
            const titleField = isEn ? 'title_en' : 'title';

            const { data, error } = await supabase
                .from('news_rss_items')
                .select(`id, slug, ${titleField}, image_url, published_at`)
                .ilike(titleField, `%${debouncedQuery}%`)
                .order('published_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            return data || [];
        },
        enabled: isOpen && debouncedQuery.trim().length > 1,
    });

    // 2. Fetch Wiki Entities
    const { data: wikiResults, isLoading: isLoadingWiki } = useQuery({
        queryKey: ['global-search-wiki', debouncedQuery, language],
        queryFn: async () => {
            if (!debouncedQuery.trim()) return [];
            const isEn = language === 'en';
            const nameField = isEn ? 'name_en' : 'name';

            const { data, error } = await supabase
                .from('wiki_entities')
                .select(`id, slug, ${nameField}, image_url, entity_type, search_count`)
                .ilike(nameField, `%${debouncedQuery}%`)
                .order('search_count', { ascending: false })
                .limit(5);

            if (error) throw error;
            return data || [];
        },
        enabled: isOpen && debouncedQuery.trim().length > 1,
    });

    // 3. Fetch Topics
    // We fetch a larger pool of recent themes and filter them client-side
    const { data: topicsPool } = useQuery({
        queryKey: ['global-search-topics-pool'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('news_rss_items')
                .select('themes')
                .not('themes', 'is', null)
                .order('published_at', { ascending: false })
                .limit(2000);

            if (error) throw error;

            const uniqueThemes = new Set<string>();
            data?.forEach(item => {
                item.themes?.forEach((t: string) => {
                    if (t) uniqueThemes.add(t);
                });
            });
            return Array.from(uniqueThemes);
        },
        enabled: isOpen,
        staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    });

    const topicsResults = useMemo(() => {
        if (!debouncedQuery.trim() || !topicsPool) return [];
        const q = debouncedQuery.toLowerCase();
        return topicsPool.filter(t => t.toLowerCase().includes(q)).slice(0, 5);
    }, [debouncedQuery, topicsPool]);

    const isLoading = isLoadingNews || isLoadingWiki;
    const hasResults = (newsResults?.length || 0) > 0 || (wikiResults?.length || 0) > 0 || topicsResults.length > 0;
    const showResults = debouncedQuery.trim().length > 1;

    const handleNavigate = (path: string) => {
        onOpenChange(false);
        navigate(path);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-md border border-border/50 shadow-2xl">
                <DialogHeader className="p-4 border-b border-white/5 relative">
                    <DialogTitle className="sr-only">Search</DialogTitle>
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={language === 'en' ? 'Search news, entities, topics...' : 'Пошук новин, сутностей, тем...'}
                            className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-10 text-base"
                            autoFocus
                        />
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] overflow-y-auto">
                    {!showResults ? (
                        <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                            <Search className="w-12 h-12 opacity-20 mb-2" />
                            <p className="text-sm">
                                {language === 'en'
                                    ? 'Start typing to search across the entire platform'
                                    : 'Почніть вводити текст для пошуку по всій платформі'}
                            </p>
                        </div>
                    ) : !hasResults && !isLoading ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <p>{language === 'en' ? 'No results found.' : 'Нічого не знайдено.'}</p>
                        </div>
                    ) : (
                        <div className="p-2 flex flex-col gap-4">

                            {/* Topics Section */}
                            {topicsResults.length > 0 && (
                                <div className="px-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5 px-2">
                                        <Hash className="w-3.5 h-3.5" />
                                        {language === 'en' ? 'Topics' : 'Теми'}
                                    </h3>
                                    <div className="flex flex-col gap-1">
                                        {topicsResults.map(topic => (
                                            <button
                                                key={topic}
                                                onClick={() => handleNavigate(topicPath(topic))}
                                                className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-white/5 group transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                                                        <Hash className="w-4 h-4 text-foreground/60" />
                                                    </div>
                                                    <span className="text-sm font-medium">{topic}</span>
                                                </div>
                                                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Wiki Entities Section */}
                            {wikiResults && wikiResults.length > 0 && (
                                <div className="px-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5 px-2">
                                        <Users className="w-3.5 h-3.5" />
                                        {language === 'en' ? 'Wiki Entities' : 'Вікі Сутності'}
                                    </h3>
                                    <div className="flex flex-col gap-1">
                                        {wikiResults.map(entityRaw => {
                                            const entity = entityRaw as any;
                                            const name = language === 'en' ? (entity.name_en || entity.name) : entity.name;
                                            return (
                                                <button
                                                    key={entity.id}
                                                    onClick={() => handleNavigate(`/wiki/${entity.slug || entity.id}`)}
                                                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-white/5 group transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {entity.image_url ? (
                                                            <img src={entity.image_url} alt={name} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                                                                <Users className="w-4 h-4 text-foreground/60" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="text-sm font-medium leading-none mb-1">{name}</div>
                                                            <div className="text-xs text-muted-foreground capitalize">{entity.entity_type}</div>
                                                        </div>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* News Section */}
                            {newsResults && newsResults.length > 0 && (
                                <div className="px-2 pb-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5 px-2">
                                        <Globe className="w-3.5 h-3.5" />
                                        {language === 'en' ? 'News Articles' : 'Новини'}
                                    </h3>
                                    <div className="flex flex-col gap-1">
                                        {newsResults.map(newsRaw => {
                                            const news = newsRaw as any;
                                            const title = language === 'en' ? (news.title_en || news.title) : news.title;
                                            return (
                                                <button
                                                    key={news.id}
                                                    onClick={() => handleNavigate(`/news/${news.slug || news.id}`)}
                                                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-white/5 group transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {news.image_url ? (
                                                            <img src={news.image_url} alt={title} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                                                                <Globe className="w-5 h-5 text-foreground/60" />
                                                            </div>
                                                        )}
                                                        <div className="text-sm font-medium line-clamp-2 pr-4">{title}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </ScrollArea>
                <div className="p-3 border-t border-white/5 text-xs text-center text-muted-foreground/60 flex items-center justify-center gap-2">
                    <span>{language === 'en' ? 'Navigate with ↑↓ arrows' : 'Навігація стрілками ↑↓'}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">Esc to close</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
