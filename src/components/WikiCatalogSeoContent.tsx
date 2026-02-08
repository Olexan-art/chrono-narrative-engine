import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Network, Users, Building2, Newspaper, TrendingUp, Globe, Sparkles } from "lucide-react";
import { Helmet } from "react-helmet-async";

export function WikiCatalogSeoContent() {
  const { language } = useLanguage();
  
  // JSON-LD structured data for the catalog page
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": language === 'uk' ? "Каталог персон та організацій" : "Persons and Organizations Catalog",
    "description": language === 'uk' 
      ? "Повний каталог світових персон, корпорацій та організацій з аналітикою новин та візуалізацією зв'язків"
      : "Complete catalog of global personas, corporations and organizations with news analytics and relationship visualization",
    "url": "https://echoes2.com/wiki",
    "inLanguage": language === 'uk' ? "uk-UA" : "en-US",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Echoes",
      "url": "https://echoes2.com"
    },
    "about": [
      {
        "@type": "Thing",
        "name": language === 'uk' ? "Політичні лідери" : "Political Leaders"
      },
      {
        "@type": "Thing", 
        "name": language === 'uk' ? "Міжнародні корпорації" : "International Corporations"
      },
      {
        "@type": "Thing",
        "name": language === 'uk' ? "Глобальні організації" : "Global Organizations"
      }
    ],
    "mainEntity": {
      "@type": "ItemList",
      "name": language === 'uk' ? "Сутності" : "Entities",
      "description": language === 'uk' 
        ? "Перелік ключових персон та організацій світової політики та економіки"
        : "List of key persons and organizations in world politics and economics"
    }
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://echoes2.com/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": language === 'uk' ? "Wiki каталог" : "Wiki Catalog",
        "item": "https://echoes2.com/wiki"
      }
    ]
  };
  
  const content = language === 'uk' ? {
    mainTitle: "Енциклопедія глобальних персон та організацій",
    mainDescription: "Echoes — це унікальна платформа, що систематизує інформацію про ключових гравців світової арени: політиків, бізнесменів, корпорації та міжнародні організації. Ми аналізуємо новини з США, України, Польщі та Індії, щоб виявити приховані зв'язки та взаємодії між впливовими фігурами сучасності.",
    
    sectionsTitle: "Що ви знайдете в каталозі",
    
    personsTitle: "Персони",
    personsDescription: "Детальні профілі політичних лідерів, підприємців, науковців та громадських діячів. Від президентів та прем'єр-міністрів до CEO технологічних гігантів — кожен профіль містить біографію, останні новини та граф зв'язків з іншими персонами.",
    
    corporationsTitle: "Корпорації та компанії",
    corporationsDescription: "Аналітика провідних світових компаній: технологічні гіганти FAANG, оборонні корпорації, фармацевтичні холдинги та енергетичні конгломерати. Відстежуйте їхню присутність у новинах та зв'язки з політичними структурами.",
    
    organizationsTitle: "Міжнародні організації",
    organizationsDescription: "ООН, НАТО, ЄС, МВФ та інші глобальні інституції. Розуміння їхньої ролі у формуванні міжнародної політики через призму щоденних новин та взаємодій з урядами країн.",
    
    connectionsTitle: "Граф пересічень сутностей",
    connectionsDescription: "Наша унікальна технологія візуалізує зв'язки між персонами та організаціями на основі спільних згадок у новинах. Інтерактивний граф показує, хто з ким взаємодіє, які компанії пов'язані з політиками, та як формуються альянси в реальному часі.",
    
    newsTitle: "Новини як джерело даних",
    newsDescription: "Ми обробляємо тисячі новин щодня з авторитетних джерел: Reuters, Associated Press, BBC, Ukrinform, PAP та багатьох інших. Штучний інтелект аналізує контент, виявляє згадки сутностей та будує мережу взаємозв'язків.",
    
    analyticsTitle: "Аналітика та тренди",
    analyticsDescription: "Відстежуйте, які персони та організації найчастіше згадуються в новинах. Наша система рейтингів показує динаміку популярності за останні 72 години, тиждень та місяць.",
    
    conclusionTitle: "Архів людської історії",
    conclusionDescription: "Echoes — це більше ніж новинний агрегатор. Це живий архів сучасної історії, де кожна подія, кожна взаємодія та кожне рішення фіксується та стає частиною глобальної картини. Досліджуйте зв'язки, розумійте контекст, бачте повну картину."
  } : {
    mainTitle: "Encyclopedia of Global Personas and Organizations",
    mainDescription: "Echoes is a unique platform that systematizes information about key players on the world stage: politicians, businesspeople, corporations, and international organizations. We analyze news from the USA, Ukraine, Poland, and India to reveal hidden connections and interactions between influential figures of our time.",
    
    sectionsTitle: "What You'll Find in the Catalog",
    
    personsTitle: "Personas",
    personsDescription: "Detailed profiles of political leaders, entrepreneurs, scientists, and public figures. From presidents and prime ministers to CEOs of tech giants — each profile contains biography, latest news, and a graph of connections with other personas.",
    
    corporationsTitle: "Corporations and Companies",
    corporationsDescription: "Analytics of leading global companies: FAANG tech giants, defense corporations, pharmaceutical holdings, and energy conglomerates. Track their presence in the news and connections with political structures.",
    
    organizationsTitle: "International Organizations",
    organizationsDescription: "UN, NATO, EU, IMF, and other global institutions. Understanding their role in shaping international politics through the lens of daily news and interactions with national governments.",
    
    connectionsTitle: "Entity Intersection Graph",
    connectionsDescription: "Our unique technology visualizes connections between personas and organizations based on co-mentions in news. The interactive graph shows who interacts with whom, which companies are connected to politicians, and how alliances form in real-time.",
    
    newsTitle: "News as Data Source",
    newsDescription: "We process thousands of news items daily from authoritative sources: Reuters, Associated Press, BBC, Ukrinform, PAP, and many others. Artificial intelligence analyzes content, identifies entity mentions, and builds a network of relationships.",
    
    analyticsTitle: "Analytics and Trends",
    analyticsDescription: "Track which personas and organizations are mentioned most frequently in the news. Our rating system shows popularity dynamics over the last 72 hours, week, and month.",
    
    conclusionTitle: "Archive of Human History",
    conclusionDescription: "Echoes is more than a news aggregator. It's a living archive of contemporary history, where every event, every interaction, and every decision is recorded and becomes part of the global picture. Explore connections, understand context, see the complete picture."
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      </Helmet>
      
      <section className="mt-16 pt-12 border-t border-border/50">
        {/* Main Hero */}
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center justify-center gap-3">
            <Sparkles className="w-7 h-7 text-primary" />
            {content.mainTitle}
          </h2>
          <p className="text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {content.mainDescription}
          </p>
        </div>

        {/* Sections Title */}
        <h3 className="text-xl font-semibold text-center mb-8">{content.sectionsTitle}</h3>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Persons */}
          <Card className="bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-blue-500/10">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <h4 className="font-semibold">{content.personsTitle}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {content.personsDescription}
              </p>
            </CardContent>
          </Card>

          {/* Corporations */}
          <Card className="bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10">
                  <Building2 className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="font-semibold">{content.corporationsTitle}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {content.corporationsDescription}
              </p>
            </CardContent>
          </Card>

          {/* Organizations */}
          <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/10">
                  <Globe className="w-5 h-5 text-emerald-500" />
                </div>
                <h4 className="font-semibold">{content.organizationsTitle}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {content.organizationsDescription}
              </p>
            </CardContent>
          </Card>

          {/* Connections Graph */}
          <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-purple-500/10">
                  <Network className="w-5 h-5 text-purple-500" />
                </div>
                <h4 className="font-semibold">{content.connectionsTitle}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {content.connectionsDescription}
              </p>
            </CardContent>
          </Card>

          {/* News Source */}
          <Card className="bg-gradient-to-br from-rose-500/5 to-transparent border-rose-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-rose-500/10">
                  <Newspaper className="w-5 h-5 text-rose-500" />
                </div>
                <h4 className="font-semibold">{content.newsTitle}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {content.newsDescription}
              </p>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card className="bg-gradient-to-br from-cyan-500/5 to-transparent border-cyan-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-cyan-500/10">
                  <TrendingUp className="w-5 h-5 text-cyan-500" />
                </div>
                <h4 className="font-semibold">{content.analyticsTitle}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {content.analyticsDescription}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conclusion */}
        <div className="text-center py-8 px-6 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 border border-primary/10">
          <h3 className="text-xl font-semibold mb-3">{content.conclusionTitle}</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {content.conclusionDescription}
          </p>
        </div>
      </section>
    </>
  );
}
