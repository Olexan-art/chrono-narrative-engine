import React from 'react';
import { CheckCircle, Shield, AlertTriangle, Info, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';
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

  return (
    <Card className={`${className}`} data-section="verified-badge">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {language === 'uk' ? 'Статус перевірки' : language === 'pl' ? 'Status weryfikacji' : 'Verification Status'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge 
              variant={getStatusColor() as any}
              className="gap-1"
            >
              {getStatusIcon()}
              {getStatusLabel()}
            </Badge>
            {verification.confidence && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {language === 'uk' ? 'Впевненість:' : language === 'pl' ? 'Pewność:' : 'Confidence:'}
                </span>
                <span className="font-medium">{verification.confidence}%</span>
              </div>
            )}
          </div>

          {verification.details && (
            <p className="text-sm text-muted-foreground">
              {verification.details}
            </p>
          )}

          {verification.sources && verification.sources.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">
                {language === 'uk' ? 'Джерела перевірки:' : language === 'pl' ? 'Źródła weryfikacji:' : 'Verification sources:'}
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {verification.sources.map((source, index) => (
                  <li key={index} className="flex items-center gap-1">
                    <X className="w-3 h-3" />
                    {source}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {verification.lastChecked && (
            <p className="text-xs text-muted-foreground">
              {language === 'uk' ? 'Останнє оновлення:' : language === 'pl' ? 'Ostatnia aktualizacja:' : 'Last updated:'} {formatDate(verification.lastChecked)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}