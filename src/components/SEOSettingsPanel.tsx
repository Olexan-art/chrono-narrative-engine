import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tantml:parameter>
import { 
  Settings, Save, RefreshCw, Globe, FileText, Image, Tag, 
  ExternalLink, CheckCircle, AlertCircle, Copy, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SEOSettings {
  // Основні налаштування
  site_title: string;
  site_title_en: string;
  site_title_pl: string;
  site_description: string;
  site_description_en: string;
  site_description_pl: string;
  site_keywords: string;
  site_author: string;
  site_url: string;
  
  // Open Graph
  og_title: string;
  og_description: string;
  og_image: string;
  og_type: string;
  og_site_name: string;
  
  // Twitter Cards
  twitter_card: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  twitter_site: string;
  twitter_creator: string;
  
  // Schema.org
  schema_organization_name: string;
  schema_organization_description: string;
  schema_organization_logo: string;
  schema_organization_url: string;
  
  // Robots & Indexing
  robots_default: string;
  googlebot_default: string;
  canonical_base_url: string;
  
  // Додаткові
  favicon_url: string;
  apple_touch_icon_url: string;
  theme_color: string;
  msapplication_tile_color: string;
}

const DEFAULT_SETTINGS: SEOSettings = {
  site_title: "Точка Синхронізації",
  site_title_en: "Synchronization Point",
  site_title_pl: "Punkt Synchronizacji",
  site_description: "AI-генерована наукова фантастика на основі реальних новин. Архів людської історії через призму спекулятивної прози.",
  site_description_en: "AI-powered narrative archive that transforms real-world news into science fiction stories. A living chronicle of human history through speculative fiction.",
  site_description_pl: "Archiwum narracyjne oparte na AI, które przekształca rzeczywiste wiadomości w opowieści science fiction. Żywa kronika ludzkiej historii poprzez fikcję spekulatywną.",
  site_keywords: "AI, science fiction, news, narrative, Ukraine, artificial intelligence, sci-fi, storytelling, автоматична генерація, наукова фантастика",
  site_author: "Synchronization Point AI",
  site_url: "https://bravennow.com",
  
  og_title: "Synchronization Point - Smart News, Real News",
  og_description: "AI-powered narrative generation system that transforms real-world news into science fiction stories",
  og_image: "https://bravennow.com/og-image.png",
  og_type: "website",
  og_site_name: "Synchronization Point",
  
  twitter_card: "summary_large_image",
  twitter_title: "Synchronization Point",
  twitter_description: "AI-powered narrative archive transforming news into science fiction",
  twitter_image: "https://bravennow.com/twitter-image.png",
  twitter_site: "@synchronization_point",
  twitter_creator: "@synchronization_point",
  
  schema_organization_name: "Synchronization Point",
  schema_organization_description: "AI-powered narrative generation system that transforms real-world news into science fiction stories",
  schema_organization_logo: "https://bravennow.com/favicon.png",
  schema_organization_url: "https://bravennow.com",
  
  robots_default: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
  googlebot_default: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
  canonical_base_url: "https://bravennow.com",
  
  favicon_url: "https://bravennow.com/favicon.ico",
  apple_touch_icon_url: "https://bravennow.com/apple-touch-icon.png",
  theme_color: "#00d9ff",
  msapplication_tile_color: "#00d9ff",
};

export function SEOSettingsPanel({ password }: { password: string }) {
  const [settings, setSettings] = useState<SEOSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  // Load settings from database or localStorage
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ['seo-settings'],
    queryFn: async () => {
      // Try to load from localStorage first
      const stored = localStorage.getItem('seo_settings');
      if (stored) {
        return JSON.parse(stored) as SEOSettings;
      }
      return DEFAULT_SETTINGS;
    },
  });

  // Update settings when loaded
  useState(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem('seo_settings', JSON.stringify(settings));
      
      toast.success("SEO налаштування збережено!");
      queryClient.invalidateQueries({ queryKey: ['seo-settings'] });
    } catch (error) {
      console.error('Error saving SEO settings:', error);
      toast.error("Помилка при збереженні налаштувань");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.info("Налаштування скинуто до значень за замовчуванням");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопійовано в буфер обміну`);
  };

  const previewMeta = () => {
    const preview = `
<title>${settings.site_title}</title>
<meta name="description" content="${settings.site_description}" />
<meta name="keywords" content="${settings.site_keywords}" />
<meta name="author" content="${settings.site_author}" />
<meta name="robots" content="${settings.robots_default}" />

<!-- Open Graph -->
<meta property="og:title" content="${settings.og_title}" />
<meta property="og:description" content="${settings.og_description}" />
<meta property="og:image" content="${settings.og_image}" />
<meta property="og:type" content="${settings.og_type}" />
<meta property="og:site_name" content="${settings.og_site_name}" />
<meta property="og:url" content="${settings.site_url}" />

<!-- Twitter -->
<meta name="twitter:card" content="${settings.twitter_card}" />
<meta name="twitter:title" content="${settings.twitter_title}" />
<meta name="twitter:description" content="${settings.twitter_description}" />
<meta name="twitter:image" content="${settings.twitter_image}" />
<meta name="twitter:site" content="${settings.twitter_site}" />
<meta name="twitter:creator" content="${settings.twitter_creator}" />
    `.trim();
    
    copyToClipboard(preview, "Meta tags preview");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            SEO Налаштування
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              SEO Налаштування
            </CardTitle>
            <CardDescription>
              Налаштування мета-тегів, Open Graph, Twitter Cards та інших SEO параметрів
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={previewMeta}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Зберегти
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">Основні</TabsTrigger>
            <TabsTrigger value="opengraph">Open Graph</TabsTrigger>
            <TabsTrigger value="twitter">Twitter</TabsTrigger>
            <TabsTrigger value="schema">Schema.org</TabsTrigger>
            <TabsTrigger value="advanced">Додаткові</TabsTrigger>
          </TabsList>

          {/* Основні налаштування */}
          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site_title">Назва сайту (UK)</Label>
                  <Input
                    id="site_title"
                    value={settings.site_title}
                    onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
                    placeholder="Точка Синхронізації"
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.site_title.length} символів
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site_title_en">Назва сайту (EN)</Label>
                  <Input
                    id="site_title_en"
                    value={settings.site_title_en}
                    onChange={(e) => setSettings({ ...settings, site_title_en: e.target.value })}
                    placeholder="Synchronization Point"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site_title_pl">Назва сайту (PL)</Label>
                  <Input
                    id="site_title_pl"
                    value={settings.site_title_pl}
                    onChange={(e) => setSettings({ ...settings, site_title_pl: e.target.value })}
                    placeholder="Punkt Synchronizacji"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="site_description">Опис сайту (UK)</Label>
                <Textarea
                  id="site_description"
                  value={settings.site_description}
                  onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
                  placeholder="AI-генерована наукова фантастика..."
                  rows={3}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {settings.site_description.length} символів
                  </span>
                  {settings.site_description.length >= 120 && settings.site_description.length <= 160 ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Оптимально
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Рекомендовано 120-160
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_description_en">Опис сайту (EN)</Label>
                <Textarea
                  id="site_description_en"
                  value={settings.site_description_en}
                  onChange={(e) => setSettings({ ...settings, site_description_en: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_description_pl">Опис сайту (PL)</Label>
                <Textarea
                  id="site_description_pl"
                  value={settings.site_description_pl}
                  onChange={(e) => setSettings({ ...settings, site_description_pl: e.target.value })}
                  rows={3}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site_keywords">Ключові слова</Label>
                  <Textarea
                    id="site_keywords"
                    value={settings.site_keywords}
                    onChange={(e) => setSettings({ ...settings, site_keywords: e.target.value })}
                    placeholder="AI, science fiction, news..."
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Розділяйте комами
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site_author">Автор</Label>
                  <Input
                    id="site_author"
                    value={settings.site_author}
                    onChange={(e) => setSettings({ ...settings, site_author: e.target.value })}
                    placeholder="Synchronization Point AI"
                  />
                  <Label htmlFor="site_url" className="mt-4">URL сайту</Label>
                  <Input
                    id="site_url"
                    value={settings.site_url}
                    onChange={(e) => setSettings({ ...settings, site_url: e.target.value })}
                    placeholder="https://bravennow.com"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Open Graph */}
          <TabsContent value="opengraph" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="og_title">OG Title</Label>
                  <Input
                    id="og_title"
                    value={settings.og_title}
                    onChange={(e) => setSettings({ ...settings, og_title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="og_type">OG Type</Label>
                  <Input
                    id="og_type"
                    value={settings.og_type}
                    onChange={(e) => setSettings({ ...settings, og_type: e.target.value })}
                    placeholder="website"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="og_description">OG Description</Label>
                <Textarea
                  id="og_description"
                  value={settings.og_description}
                  onChange={(e) => setSettings({ ...settings, og_description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="og_image">OG Image URL</Label>
                  <Input
                    id="og_image"
                    value={settings.og_image}
                    onChange={(e) => setSettings({ ...settings, og_image: e.target.value })}
                    placeholder="https://bravennow.com/og-image.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    Рекомендовано: 1200x630px
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="og_site_name">OG Site Name</Label>
                  <Input
                    id="og_site_name"
                    value={settings.og_site_name}
                    onChange={(e) => setSettings({ ...settings, og_site_name: e.target.value })}
                  />
                </div>
              </div>

              {settings.og_image && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border rounded-lg p-4 bg-muted/20">
                    <img 
                      src={settings.og_image} 
                      alt="OG Preview" 
                      className="w-full max-w-md rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Twitter Cards */}
          <TabsContent value="twitter" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="twitter_card">Card Type</Label>
                  <Input
                    id="twitter_card"
                    value={settings.twitter_card}
                    onChange={(e) => setSettings({ ...settings, twitter_card: e.target.value })}
                    placeholder="summary_large_image"
                  />
                  <p className="text-xs text-muted-foreground">
                    summary, summary_large_image, app, player
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter_site">Twitter Site</Label>
                  <Input
                    id="twitter_site"
                    value={settings.twitter_site}
                    onChange={(e) => setSettings({ ...settings, twitter_site: e.target.value })}
                    placeholder="@synchronization_point"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter_title">Twitter Title</Label>
                <Input
                  id="twitter_title"
                  value={settings.twitter_title}
                  onChange={(e) => setSettings({ ...settings, twitter_title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter_description">Twitter Description</Label>
                <Textarea
                  id="twitter_description"
                  value={settings.twitter_description}
                  onChange={(e) => setSettings({ ...settings, twitter_description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="twitter_image">Twitter Image URL</Label>
                  <Input
                    id="twitter_image"
                    value={settings.twitter_image}
                    onChange={(e) => setSettings({ ...settings, twitter_image: e.target.value })}
                    placeholder="https://bravennow.com/twitter-image.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    Рекомендовано: 1200x675px
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter_creator">Twitter Creator</Label>
                  <Input
                    id="twitter_creator"
                    value={settings.twitter_creator}
                    onChange={(e) => setSettings({ ...settings, twitter_creator: e.target.value })}
                    placeholder="@synchronization_point"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Schema.org */}
          <TabsContent value="schema" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="schema_organization_name">Organization Name</Label>
                <Input
                  id="schema_organization_name"
                  value={settings.schema_organization_name}
                  onChange={(e) => setSettings({ ...settings, schema_organization_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="schema_organization_description">Organization Description</Label>
                <Textarea
                  id="schema_organization_description"
                  value={settings.schema_organization_description}
                  onChange={(e) => setSettings({ ...settings, schema_organization_description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schema_organization_logo">Logo URL</Label>
                  <Input
                    id="schema_organization_logo"
                    value={settings.schema_organization_logo}
                    onChange={(e) => setSettings({ ...settings, schema_organization_logo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schema_organization_url">Organization URL</Label>
                  <Input
                    id="schema_organization_url"
                    value={settings.schema_organization_url}
                    onChange={(e) => setSettings({ ...settings, schema_organization_url: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Додаткові */}
          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="robots_default">Robots Meta (default)</Label>
                <Input
                  id="robots_default"
                  value={settings.robots_default}
                  onChange={(e) => setSettings({ ...settings, robots_default: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  index, follow, noindex, nofollow, max-snippet:-1, max-image-preview:large
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googlebot_default">Googlebot Meta (default)</Label>
                <Input
                  id="googlebot_default"
                  value={settings.googlebot_default}
                  onChange={(e) => setSettings({ ...settings, googlebot_default: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="canonical_base_url">Canonical Base URL</Label>
                <Input
                  id="canonical_base_url"
                  value={settings.canonical_base_url}
                  onChange={(e) => setSettings({ ...settings, canonical_base_url: e.target.value })}
                  placeholder="https://bravennow.com"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="favicon_url">Favicon URL</Label>
                  <Input
                    id="favicon_url"
                    value={settings.favicon_url}
                    onChange={(e) => setSettings({ ...settings, favicon_url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apple_touch_icon_url">Apple Touch Icon URL</Label>
                  <Input
                    id="apple_touch_icon_url"
                    value={settings.apple_touch_icon_url}
                    onChange={(e) => setSettings({ ...settings, apple_touch_icon_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme_color">Theme Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="theme_color"
                      value={settings.theme_color}
                      onChange={(e) => setSettings({ ...settings, theme_color: e.target.value })}
                      placeholder="#00d9ff"
                    />
                    <input
                      type="color"
                      value={settings.theme_color}
                      onChange={(e) => setSettings({ ...settings, theme_color: e.target.value })}
                      className="w-12 h-10 rounded border"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="msapplication_tile_color">MS Tile Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="msapplication_tile_color"
                      value={settings.msapplication_tile_color}
                      onChange={(e) => setSettings({ ...settings, msapplication_tile_color: e.target.value })}
                      placeholder="#00d9ff"
                    />
                    <input
                      type="color"
                      value={settings.msapplication_tile_color}
                      onChange={(e) => setSettings({ ...settings, msapplication_tile_color: e.target.value })}
                      className="w-12 h-10 rounded border"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
