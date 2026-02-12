import { Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ImagesManagementPanel() {
  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Управління зображеннями
        </CardTitle>
        <CardDescription>
          Завантаження та управління зображеннями для новин
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">Панель в розробці</p>
          <p className="text-sm">
            Функціонал управління зображеннями буде додано найближчим часом
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
