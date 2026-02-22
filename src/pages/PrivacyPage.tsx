import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { Shield, Cookie, Database, Lock, Users, Mail } from "lucide-react";

export default function PrivacyPage() {
  const { t, language } = useLanguage();

  const lastUpdated = "2025-02-01";

  const sections = [
    {
      icon: Database,
      title: t('privacy.data_collection'),
      text: t('privacy.data_collection_text'),
    },
    {
      icon: Cookie,
      title: t('privacy.cookies'),
      text: t('privacy.cookies_text'),
    },
    {
      icon: Users,
      title: t('privacy.third_party'),
      text: t('privacy.third_party_text'),
    },
    {
      icon: Lock,
      title: t('privacy.data_security'),
      text: t('privacy.data_security_text'),
    },
    {
      icon: Shield,
      title: t('privacy.your_rights'),
      text: t('privacy.your_rights_text'),
    },
    {
      icon: Mail,
      title: t('privacy.contact'),
      text: t('privacy.contact_text'),
    },
  ];

  const pageTitle = language === 'en' 
    ? 'Privacy Policy - Synchronization Point'
    : language === 'pl'
    ? 'Polityka prywatności - Punkt Synchronizacji'
    : 'Політика конфіденційності - Точка Синхронізації';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={pageTitle}
        description={t('privacy.intro')}
        canonicalUrl="https://bravennow.com/privacy"
      />
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('privacy.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('privacy.last_updated')}: {lastUpdated}
          </p>
        </div>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          {t('privacy.intro')}
        </p>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-lg p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <section.icon className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">
                  {section.title}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-11">
                {section.text}
              </p>
            </div>
          ))}
        </div>

      </main>
      <Footer />
    </div>
  );
}
