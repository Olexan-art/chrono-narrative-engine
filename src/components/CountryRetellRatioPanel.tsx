import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Percent } from "lucide-react";
import { toast } from "sonner";

interface Country {
  id: string;
  code: string;
  name: string;
  flag: string;
  retell_ratio: number;
}

const RATIO_OPTIONS = [
  { value: 100, label: '100% (всі новини)' },
  { value: 80, label: '80%' },
  { value: 50, label: '50%' },
  { value: 20, label: '20%' },
  { value: 10, label: '10%' },
];

export function CountryRetellRatioPanel() {
  const queryClient = useQueryClient();

  const { data: countries = [], isLoading } = useQuery({
    queryKey: ['countries-retell-ratio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_countries')
        .select('id, code, name, flag, retell_ratio')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as Country[];
    },
  });

  const updateRatioMutation = useMutation({
    mutationFn: async ({ countryId, ratio }: { countryId: string; ratio: number }) => {
      const { error } = await supabase
        .from('news_countries')
        .update({ retell_ratio: ratio })
        .eq('id', countryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries-retell-ratio'] });
      queryClient.invalidateQueries({ queryKey: ['sitemap-countries'] });
      toast.success('Налаштування оновлено');
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cosmic-card border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          Авто-переказ по країнам
        </CardTitle>
        <CardDescription>
          Відсоток новин для автоматичного переказу при додаванні з RSS (окремо для кожної країни)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {countries.map((country) => (
            <div 
              key={country.id} 
              className="flex items-center justify-between p-4 border border-border/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{country.flag}</span>
                <div>
                  <div className="font-medium text-sm">{country.name}</div>
                  <Badge variant="outline" className="text-xs mt-1">
                    {country.code}
                  </Badge>
                </div>
              </div>
              <Select
                value={country.retell_ratio.toString()}
                onValueChange={(value) => updateRatioMutation.mutate({ 
                  countryId: country.id, 
                  ratio: parseInt(value, 10) 
                })}
                disabled={updateRatioMutation.isPending}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATIO_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      <div className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          💡 100% = всі нові новини будуть автоматично перекладені з діалогами та твітами. 
          20% = тільки кожна 5-та новина.
        </p>
      </CardContent>
    </Card>
  );
}
