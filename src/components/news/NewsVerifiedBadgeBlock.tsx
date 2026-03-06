import React from 'react';
import { CheckCircle, Shield, AlertTriangle, Info, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface VerificationData {
  status: 'verified' | 'partially-verified' | 'disputed' | 'unverified';
  confidence?: number; // 0-100
  sources?: string[];
  lastChecked?: string;
  details?: string;
  factCheckers?: string[];
}

interface NewsVerifiedBadgeBlockProps {
  verification?: VerificationData;
  inline?: boolean;
  className?: string;
}

export function NewsVerifiedBadgeBlock({ 
  verification,
  inline = false,
  className = '' 
}: NewsVerifiedBadgeBlockProps) {
  const { language } = useLanguage();

  if (!verification) {
    return null;
  }

  const getStatusIcon = () => {
    switch (verification.status) {
      case 'verified':
        return <CheckCircle className="w-4 h-4" />;
      case 'partially-verified':
        return <Shield className="w-4 h-4" />;
      case 'disputed':
        return <AlertTriangle className="w-4 h-4" />;
      case 'unverified':
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (verification.status) {
      case 'verified':
        return 'default';
      case 'partially-verified':
        return 'secondary';
      case 'disputed':
        return 'destructive';
      case 'unverified':
      default:
        return 'outline';
    }
  };

  const getStatusLabel = () => {
    const labels: Record<string, Record<string, string>> = {
      verified: { en: 'Verified', uk: 'Перевірено', pl: 'Zweryfikowane' },
      'partially-verified': { en: 'Partially Verified', uk: 'Частково перевірено', pl: 'Częściowo zweryfikowane' },
      disputed: { en: 'Disputed', uk: 'Оскаржується', pl: 'Kwestionowane' },
      unverified: { en: 'Unverified', uk: 'Не перевірено', pl: 'Niezweryfikowane' }
    };
    return labels[verification.status]?.[language] || labels[verification.status]?.['en'];
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(
      language === 'uk' ? 'uk-UA' : language === 'pl' ? 'pl-PL' : 'en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }
    );
  };

  if (inline) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`inline-flex items-center ${className}`} data-section="verified-badge">
              <Badge 
                variant={getStatusColor() as any}
                className="gap-1 cursor-help"
              >
                {getStatusIcon()}
                {getStatusLabel()}
                {verification.confidence && (
                  <span className="ml-1 opacity-70">
                    {verification.confidence}%
                  </span>
                )}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2 max-w-xs">
              {verification.details && (
                <p className="text-sm">{verification.details}</p>
              )}
              {verification.lastChecked && (
                <p className="text-xs text-muted-foreground">
                  {language === 'uk' ? 'Перевірено:' : language === 'pl' ? 'Sprawdzone:' : 'Checked:'} {formatDate(verification.lastChecked)}
                </p>
              )}
              {verification.factCheckers && verification.factCheckers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {language === 'uk' ? 'Джерела:' : language === 'pl' ? 'Źródła:' : 'Sources:'} {verification.factCheckers.join(', ')}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getConfidenceColor = () => {
    if (!verification.confidence) return 'bg-gray-500';
    if (verification.confidence >= 80) return 'bg-gradient-to-r from-green-500 to-emerald-600';
    if (verification.confidence >= 60) return 'bg-gradient-to-r from-blue-500 to-cyan-600';
    if (verification.confidence >= 40) return 'bg-gradient-to-r from-yellow-500 to-orange-600';
    return 'bg-gradient-to-r from-red-500 to-rose-600';
  };

  const getCardGradient = () => {
    switch (verification.status) {
      case 'verified':
        return 'from-green-500/10 to-emerald-500/5';
      case 'partially-verified':
        return 'from-purple-500/10 to-violet-500/5';
      case 'disputed':
        return 'from-red-500/10 to-rose-500/5';
      default:
        return 'from-gray-500/10 to-slate-500/5';
    }
  };

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${getCardGradient()} border-2 ${className}`} data-section="verified-badge">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl"></div>
      
      <CardHeader className="pb-3 relative">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-background/50 backdrop-blur">
            <Shield className="w-4 h-4" />
          </div>
          {language === 'uk' ? 'Статус перевірки' : language === 'pl' ? 'Status weryfikacji' : 'Verification Status'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative">
        <div className="space-y-4">
          {/* Status Badge and Confidence Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <Badge 
              variant={getStatusColor() as any}
              className="gap-1.5 py-1.5 px-3 text-sm font-semibold shadow-md"
            >
              {getStatusIcon()}
              {getStatusLabel()}
            </Badge>
            
            {verification.confidence && (
              <div className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg px-4 py-3 shadow-lg">
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {language === 'uk' ? 'Впевненість' : language === 'pl' ? 'Pewność' : 'Confidence'}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {verification.confidence}
                      </span>
                      <span className="text-lg font-semibold text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="w-16 h-16 relative">
                    <svg className="transform -rotate-90 w-16 h-16">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-muted/20"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="url(#confidence-gradient)"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - (verification.confidence / 100))}`}
                        className="transition-all duration-1000 ease-out"
                        strokeLinecap="round"
                      />
                    </svg>
                    <defs>
                      <linearGradient id="confidence-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#9333ea" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </div>
                </div>
              </div>
            )}
          </div>

          {verification.details && (
            <div className="bg-muted/30 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {verification.details}
              </p>
            </div>
          )}

          {verification.sources && verification.sources.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {language === 'uk' ? 'Джерела перевірки:' : language === 'pl' ? 'Źródła weryfikacji:' : 'Verification sources:'}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {verification.sources.map((source, index) => (
                  <li key={index} className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span>{source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {verification.lastChecked && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
              <Info className="w-3 h-3" />
              <span>
                {language === 'uk' ? 'Останнє оновлення:' : language === 'pl' ? 'Ostatnia aktualizacja:' : 'Last updated:'} {formatDate(verification.lastChecked)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}