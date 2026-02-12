import { GitMerge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NewsMergePanel() {
  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitMerge className="w-5 h-5" />
          Дедуплікація новин
        </CardTitle>
        <CardDescription>
          Об'єднання дублікатів та схожих новин
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <GitMerge className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">Панель в розробці</p>
          <p className="text-sm">
            Функціонал дедуплікації буде додано найближчим часом
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
