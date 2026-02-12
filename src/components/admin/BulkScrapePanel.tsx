import { Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function BulkScrapePanel() {
  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Масовий парсинг
        </CardTitle>
        <CardDescription>
          Автоматичний збір новин з множини джерел
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <Database className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">Панель в розробці</p>
          <p className="text-sm">
            Функціонал масового парсингу буде додано найближчим часом
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
