import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, RefreshCw } from "lucide-react";
import { ThreadedCharacterChat } from "@/components/ThreadedCharacterChat";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id?: string;
  character: string;
  name: string;
  avatar: string;
  message: string;
  likes?: number;
  characterLikes?: Array<{
    characterId: string;
    name: string;
    avatar: string;
  }>;
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

export function NewsDialogueSection({
  chatDialogue,
  isAdminAuthenticated,
  isGenerating,
  onGenerateDialogue,
  className,
}: NewsDialogueSectionProps) {
  const { t } = useLanguage();

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            {t('chat.observers')}
          </CardTitle>
          
          {isAdminAuthenticated && chatDialogue.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGenerateDialogue}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {chatDialogue.length > 0 ? (
          <ThreadedCharacterChat messages={chatDialogue} />
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('news.no_dialogue')}</p>
            {isAdminAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onGenerateDialogue}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4 mr-2" />
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
