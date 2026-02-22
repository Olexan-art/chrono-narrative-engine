import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Smartphone, Monitor, Apple, Share2, MoreVertical, PlusSquare, Check, ArrowDown } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const Step = ({ number, children }: { number: number; children: React.ReactNode }) => (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-mono text-primary">{number}</span>
      </div>
      <div className="flex-1 pt-1">{children}</div>
    </div>
  );

  const IconBadge = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center justify-center w-6 h-6 bg-muted rounded mx-1">
      {children}
    </span>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={t('install.title')}
        description={t('install.description')}
        url="/install"
      />
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 md:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/30 mb-6">
              <Download className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono text-primary">{t('install.badge')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('install.title')}</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('install.description')}
            </p>
          </div>

          {/* Already installed */}
          {isInstalled && (
            <Card className="mb-8 border-green-500/30 bg-green-500/5">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-500">{t('install.already_installed')}</h3>
                  <p className="text-sm text-muted-foreground">{t('install.already_installed_desc')}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick install button for supported browsers */}
          {deferredPrompt && !isInstalled && (
            <Card className="mb-8 border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-6">
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-semibold">{t('install.quick_install')}</h3>
                  <p className="text-sm text-muted-foreground">{t('install.quick_install_desc')}</p>
                </div>
                <Button onClick={handleInstall} className="gap-2">
                  <Download className="w-4 h-4" />
                  {t('install.install_now')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Platform-specific instructions */}
          <Tabs defaultValue={isIOS ? "ios" : "android"} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ios" className="gap-2">
                <Apple className="w-4 h-4" />
                <span className="hidden sm:inline">iOS</span>
              </TabsTrigger>
              <TabsTrigger value="android" className="gap-2">
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Android</span>
              </TabsTrigger>
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">Desktop</span>
              </TabsTrigger>
            </TabsList>

            {/* iOS Instructions */}
            <TabsContent value="ios">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="w-5 h-5" />
                    {t('install.ios_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground text-sm">{t('install.ios_browser_note')}</p>
                  
                  <div className="space-y-6">
                    <Step number={1}>
                      <p>
                        {t('install.ios_step1')}
                        <IconBadge><Share2 className="w-4 h-4" /></IconBadge>
                      </p>
                    </Step>
                    <Step number={2}>
                      <p>
                        {t('install.ios_step2')}
                        <IconBadge><ArrowDown className="w-4 h-4" /></IconBadge>
                      </p>
                    </Step>
                    <Step number={3}>
                      <p>
                        {t('install.ios_step3')}
                        <IconBadge><PlusSquare className="w-4 h-4" /></IconBadge>
                        <strong> "{t('install.add_to_home')}"</strong>
                      </p>
                    </Step>
                    <Step number={4}>
                      <p>{t('install.ios_step4')}</p>
                    </Step>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Android Instructions */}
            <TabsContent value="android">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    {t('install.android_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground text-sm">{t('install.android_browser_note')}</p>
                  
                  <div className="space-y-6">
                    <Step number={1}>
                      <p>
                        {t('install.android_step1')}
                        <IconBadge><MoreVertical className="w-4 h-4" /></IconBadge>
                      </p>
                    </Step>
                    <Step number={2}>
                      <p>
                        {t('install.android_step2')}
                        <strong> "{t('install.install_app')}"</strong> {t('install.or')} <strong>"{t('install.add_to_home')}"</strong>
                      </p>
                    </Step>
                    <Step number={3}>
                      <p>{t('install.android_step3')}</p>
                    </Step>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">{t('install.android_banner_note')}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Desktop Instructions */}
            <TabsContent value="desktop">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="w-5 h-5" />
                    {t('install.desktop_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground text-sm">{t('install.desktop_browser_note')}</p>
                  
                  <div className="space-y-6">
                    <Step number={1}>
                      <p>{t('install.desktop_step1')}</p>
                    </Step>
                    <Step number={2}>
                      <p>
                        {t('install.desktop_step2')}
                        <IconBadge><Download className="w-4 h-4" /></IconBadge>
                      </p>
                    </Step>
                    <Step number={3}>
                      <p>{t('install.desktop_step3')}</p>
                    </Step>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">{t('install.desktop_alt')}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Benefits */}
          <div className="mt-12 grid sm:grid-cols-3 gap-4">
            {['offline', 'notifications', 'native'].map((benefit) => (
              <Card key={benefit} className="bg-card/50">
                <CardContent className="pt-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-medium mb-1">{t(`install.benefit_${benefit}`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`install.benefit_${benefit}_desc`)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
