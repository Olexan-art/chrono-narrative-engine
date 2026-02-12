import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ViralityPanel() {
  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Віральність
        </CardTitle>
        <CardDescription>
          Аналіз популярності та поширення новин
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">Панель в розробці</p>
          <p className="text-sm">
            Аналітика віральності буде додана найближчим часом
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
