import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, HelpCircle, TrendingUp, History, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminStore } from "@/stores/adminStore";
import { supabase } from "@/integrations/supabase/client";

interface NewsAnalysisData {
  why_it_matters?: string;
  context_background?: string[];
  what_happens_next?: string;
  faq?: Array<{ question: string; answer: string }>;
  generated_at?: string;
}

interface NewsAnalysisBlockProps {
  newsId: string;
  newsTitle: string;
  newsContent: string;
  className?: string;
}

export function NewsAnalysisBlock({ newsId, newsTitle, newsContent, className = "" }: NewsAnalysisBlockProps) {
  const { language } = useLanguage();
  const { isAuthenticated: isAdmin } = useAdminStore();
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState("GLM-4.7"); // Default to ZAI model (always available) 

  // Fetch analysis from database (stored in news_analysis JSONB field)
  const { data: analysisData, isLoading } = useQuery({
    queryKey: ['news-analysis', newsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_rss_items')
        .select('news_analysis')
        .eq('id', newsId)
        .single();

      if (error) throw error;
      return data?.news_analysis as NewsAnalysisData | null;
    },
  });

  // Generate analysis mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await callEdgeFunction<{ success: boolean; analysis: NewsAnalysisData; error?: string }>(
        'generate-news-analysis',
        {
          newsId,
          newsTitle,
          newsContent,
          model: selectedModel,
        }
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to generate analysis');
      }

      return result.analysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-analysis', newsId] });
      toast.success(
        language === 'en' ? 'Analysis generated!' :
        language === 'pl' ? 'Analiza wygenerowana!' :
        'Аналіз згенеровано!'
      );
    },
    onError: (error) => {
      console.error('Error generating analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Full error:', errorMessage);
      
      toast.error(
        language === 'en' ? `Failed to generate analysis: ${errorMessage}` :
        language === 'pl' ? `Nie udało się wygenerować analizy: ${errorMessage}` :
        `Помилка генерації аналізу: ${errorMessage}`,
        { duration: 8000 } // Show longer for debugging
      );
    },
  });

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no analysis and not admin, don't show anything
  if (!analysisData && !isAdmin) {
    return null;
  }

  // Debug info for development
  console.log('[NewsAnalysisBlock]', { 
    hasAnalysis: !!analysisData, 
    isAdmin, 
    newsId 
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Admin generation controls */}
      {isAdmin && !analysisData && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {language === 'en' ? 'Generate Deep Analysis' :
               language === 'pl' ? 'Wygeneruj głęboką analizę' :
               'Згенерувати глибокий аналіз'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {language === 'en' ? 'Generate comprehensive analysis with context, implications, and FAQ' :
               language === 'pl' ? 'Wygeneruj kompleksową analizę z kontekstem, implikacjami i FAQ' :
               'Згенерувати комплексний аналіз з контекстом, наслідками та FAQ'}
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generateMutation.isPending ?
                (language === 'en' ? 'Generating...' : language === 'pl' ? 'Generowanie...' : 'Генерація...') :
                (language === 'en' ? 'Generate Analysis' : language === 'pl' ? 'Wygeneruj analizę' : 'Згенерувати аналіз')
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Display analysis if available */}
      {analysisData && (
        <div className="space-y-6">
          {/* Why it matters */}
          {analysisData.why_it_matters && (
            <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  {language === 'en' ? 'Why It Matters' :
                   language === 'pl' ? 'Dlaczego to ważne' :
                   'Чому це важливо'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {analysisData.why_it_matters}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Context / Background */}
          {analysisData.context_background && analysisData.context_background.length > 0 && (
            <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-500" />
                  {language === 'en' ? 'Context & Background' :
                   language === 'pl' ? 'Kontekst i tło' :
                   'Контекст та передісторія'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysisData.context_background.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* What happens next */}
          {analysisData.what_happens_next && (
            <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-purple-500" />
                  {language === 'en' ? 'What Happens Next' :
                   language === 'pl' ? 'Co dalej' :
                   'Що далі'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {analysisData.what_happens_next}
                </p>
              </CardContent>
            </Card>
          )}

          {/* FAQ */}
          {analysisData.faq && analysisData.faq.length > 0 && (
            <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-green-500" />
                  {language === 'en' ? 'Frequently Asked Questions' :
                   language === 'pl' ? 'Najczęściej zadawane pytania' :
                   'Часті запитання'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisData.faq.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    {idx > 0 && <Separator className="my-3" />}
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5 flex-shrink-0">
                        Q{idx + 1}
                      </Badge>
                      <p className="text-sm font-medium leading-relaxed">{item.question}</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-8">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Admin regenerate button */}
          {isAdmin && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {language === 'en' ? 'Regenerate' :
                 language === 'pl' ? 'Regeneruj' :
                 'Регенерувати'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
