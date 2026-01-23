import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { uk } from "date-fns/locale";
import { Calendar, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Part, Volume, Chapter } from "@/types/database";

interface NarrativeSummaryProps {
  weekParts: Part[];
  monthVolume?: Volume | null;
  monthChapter?: Chapter | null;
}

export function NarrativeSummary({ weekParts, monthVolume, monthChapter }: NarrativeSummaryProps) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Get the first image from week parts as representative
  const weekImage = weekParts.find(p => p.cover_image_url)?.cover_image_url;

  return (
    <div className="space-y-4">
      {/* Week Summary */}
      <Card className="cosmic-card overflow-hidden">
        <div className="relative">
          {weekImage && (
            <div className="absolute inset-0">
              <img 
                src={weekImage} 
                alt="" 
                className="w-full h-full object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card" />
            </div>
          )}
          <CardHeader className="relative pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">ТИЖДЕНЬ</Badge>
            </div>
            <CardTitle className="text-lg">
              {format(weekStart, 'd', { locale: uk })} — {format(weekEnd, 'd MMMM', { locale: uk })}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-sm text-muted-foreground mb-3">
              {weekParts.length > 0 
                ? `${weekParts.length} оповідань цього тижня`
                : 'Ще немає оповідань цього тижня'
              }
            </p>
            {weekParts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {weekParts.slice(0, 5).map(part => (
                  <Link
                    key={part.id}
                    to={`/read/${part.date}`}
                    className="px-2 py-1 text-xs border border-border hover:border-primary/50 rounded transition-colors"
                  >
                    {format(new Date(part.date), 'EEE', { locale: uk })}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Month Summary */}
      <Card className="cosmic-card overflow-hidden">
        <div className="relative">
          {monthVolume?.cover_image_url && (
            <div className="absolute inset-0">
              <img 
                src={monthVolume.cover_image_url} 
                alt="" 
                className="w-full h-full object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card" />
            </div>
          )}
          <CardHeader className="relative pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">МІСЯЦЬ</Badge>
            </div>
            <CardTitle className="text-lg">
              {monthVolume?.title || format(now, 'LLLL yyyy', { locale: uk })}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {monthVolume?.description ? (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {monthVolume.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Загальна картина подій місяця формується
              </p>
            )}
            
            {monthChapter && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground font-mono mb-1">ПОТОЧНА ГЛАВА</p>
                <p className="text-sm">{monthChapter.title}</p>
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
