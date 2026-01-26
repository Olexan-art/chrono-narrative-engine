import { memo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, RefreshCw } from "lucide-react";
import { ThreadedCharacterChat } from "@/components/ThreadedCharacterChat";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface CharacterLike {
  characterId: string;
  name: string;
  avatar: string;
}

interface ChatMessage {
  id?: string;
  character: string;
  name: string;
  avatar: string;
  message: string;
  likes?: number;
  characterLikes?: CharacterLike[];
  replyTo?: string;
  threadId?: string;
}

interface NewsDialogueSectionProps {
  chatDialogue: ChatMessage[];
  isAdminAuthenticated: boolean;
  isGenerating: boolean;
  onGenerateDialogue: () => void;
  className?: string;
}

// Validation helper for chat messages
function isValidChatMessage(msg: unknown): msg is ChatMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  return (
    typeof m.character === 'string' &&
    typeof m.name === 'string' &&
    typeof m.avatar === 'string' &&
    typeof m.message === 'string'
  );
}

function validateChatDialogue(dialogue: unknown): ChatMessage[] {
  if (!Array.isArray(dialogue)) return [];
  return dialogue.filter(isValidChatMessage);
}

function NewsDialogueSectionComponent({
  chatDialogue,
  isAdminAuthenticated,
  isGenerating,
  onGenerateDialogue,
  className,
}: NewsDialogueSectionProps) {
  const { t } = useLanguage();

  // Validate and sanitize input
  const validatedDialogue = validateChatDialogue(chatDialogue);
  const hasDialogue = validatedDialogue.length > 0;

  // Memoized click handler to prevent unnecessary re-renders
  const handleGenerate = useCallback(() => {
    if (!isGenerating) {
      onGenerateDialogue();
    }
  }, [isGenerating, onGenerateDialogue]);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            {t('chat.observers')}
          </CardTitle>
          
          {isAdminAuthenticated && hasDialogue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              aria-label={t('news.refresh_dialogue')}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasDialogue ? (
          <ThreadedCharacterChat messages={validatedDialogue} />
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="text-sm">{t('news.no_dialogue')}</p>
            {isAdminAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <MessageCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                {t('news.generate_dialogue')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Memoize to prevent unnecessary re-renders
export const NewsDialogueSection = memo(NewsDialogueSectionComponent);
