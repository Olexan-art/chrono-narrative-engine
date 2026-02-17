import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Network,
  Users,
  Building2,
  Newspaper,
  TrendingUp,
  Globe,
  Sparkles,
} from "lucide-react";

type SeoCopy = {
  mainTitle: string;
  mainDescription: string;
  sectionsTitle: string;
  personsTitle: string;
  personsDescription: string;
  corporationsTitle: string;
  corporationsDescription: string;
  organizationsTitle: string;
  organizationsDescription: string;
  connectionsTitle: string;
  connectionsDescription: string;
  newsTitle: string;
  newsDescription: string;
  analyticsTitle: string;
  analyticsDescription: string;
  conclusionTitle: string;
  conclusionDescription: string;
};

export function WikiCatalogSeoContent() {
  const { language } = useLanguage();

  const content: SeoCopy =
    language === "uk"
      ? {
        mainTitle: "Енциклопедія глобальних персон та організацій",
        mainDescription:
          "Echoes — це унікальна платформа, що систематизує інформацію про ключових гравців світової арени: політиків, бізнесменів, корпорації та міжнародні організації. Ми аналізуємо новини з США та України, щоб виявити зв'язки та взаємодії між впливовими фігурами сучасності.",

        sectionsTitle: "Що ви знайдете в каталозі",

        personsTitle: "Персони",
        personsDescription:
          "Профілі політичних лідерів, підприємців, науковців та громадських діячів. Кожен профіль містить короткий опис, динаміку згадок у новинах та перехід до повної сторінки сутності.",

        corporationsTitle: "Корпорації та компанії",
        corporationsDescription:
          "Аналітика провідних світових компаній: технології, енергетика, фінанси, оборона. Сторінки компаній показують, у яких новинах вони фігурують і з якими персонами перетинаються.",

        organizationsTitle: "Міжнародні організації",
        organizationsDescription:
          "ООН, НАТО, ЄС, МВФ та інші інституції — у контексті новин та взаємодій з урядами й компаніями. Це допомагає швидше зрозуміти роль організацій у подіях.",

        connectionsTitle: "Зв'язки між сутностями",
        connectionsDescription:
          "Мережа зв'язків формується на основі спільних згадок у новинах. Так можна побачити, які персони, корпорації та організації найчастіше опиняються в одному інформаційному контексті.",

        newsTitle: "Новини як джерело даних",
        newsDescription:
          "Ми агрегуємо новини з різних джерел і пов'язуємо їх із сутностями: людьми, компаніями, організаціями. Це перетворює стрічку новин у структуровану карту подій.",

        analyticsTitle: "Тренди та згадки",
        analyticsDescription:
          "Рейтинги й тренди показують, хто і що в центрі уваги зараз. Каталог допомагає швидко перейти від новини до персони/компанії і назад — з контекстом.",

        conclusionTitle: "Контекст замість шуму",
        conclusionDescription:
          "Каталог сутностей — це інструмент, який з'єднує новини, персони та корпорації в одну систему. Досліджуйте взаємозв'язки, порівнюйте згадки й розумійте, як події складаються в загальну картину.",
      }
      : {
        mainTitle: "Encyclopedia of Global Personas and Organizations",
        mainDescription:
          "Echoes is a platform that organizes key actors on the world stage: people, corporations and international organizations. We analyze news from the USA and Ukraine to surface connections and recurring interactions between influential entities.",

        sectionsTitle: "What you'll find in the catalog",

        personsTitle: "People",
        personsDescription:
          "Profiles of political leaders, entrepreneurs, scientists and public figures. Each page connects the person to the latest stories and related entities for quick context.",

        corporationsTitle: "Corporations & companies",
        corporationsDescription:
          "Coverage and analytics for major companies across tech, energy, finance and defense. See how companies appear in the news and which people and institutions they intersect with.",

        organizationsTitle: "International organizations",
        organizationsDescription:
          "UN, NATO, EU, IMF and other institutions — tracked through daily coverage and their interactions with governments and corporations.",

        connectionsTitle: "Entity connections",
        connectionsDescription:
          "Connections are inferred from co-mentions in news. This helps you understand which people, companies and organizations repeatedly share the same information context.",

        newsTitle: "News as a data source",
        newsDescription:
          "We aggregate news and link stories to entities: people, corporations and organizations. This turns the feed into a structured map of events and actors.",

        analyticsTitle: "Trends & mentions",
        analyticsDescription:
          "Trending signals highlight who and what is getting attention. The catalog lets you move from a story to an entity page — and back — without losing context.",

        conclusionTitle: "Context over noise",
        conclusionDescription:
          "The entity catalog connects news, people and corporations into one navigable system. Explore relationships, compare mentions and understand how events fit together.",
      };

  const cards = [
    { title: content.personsTitle, description: content.personsDescription, Icon: Users },
    {
      title: content.corporationsTitle,
      description: content.corporationsDescription,
      Icon: Building2,
    },
    {
      title: content.organizationsTitle,
      description: content.organizationsDescription,
      Icon: Globe,
    },
    {
      title: content.connectionsTitle,
      description: content.connectionsDescription,
      Icon: Network,
    },
    { title: content.newsTitle, description: content.newsDescription, Icon: Newspaper },
    {
      title: content.analyticsTitle,
      description: content.analyticsDescription,
      Icon: TrendingUp,
    },
  ] as const;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: content.mainTitle,
    description: content.mainDescription,
    url: 'https://bravennow.com/wiki',
    isPartOf: { '@type': 'WebSite', name: 'Echoes', url: 'https://bravennow.com' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: language === 'uk' ? 'Головна' : 'Home', item: 'https://bravennow.com/' },
        { '@type': 'ListItem', position: 2, name: content.mainTitle, item: 'https://bravennow.com/wiki' },
      ],
    },
    about: [
      { '@type': 'Thing', name: content.personsTitle, description: content.personsDescription },
      { '@type': 'Thing', name: content.corporationsTitle, description: content.corporationsDescription },
      { '@type': 'Thing', name: content.organizationsTitle, description: content.organizationsDescription },
    ],
  };

  return (
    <section className="mt-16 pt-12 border-t border-border/50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="text-center mb-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center justify-center gap-3">
          <Sparkles className="w-7 h-7 text-primary" />
          {content.mainTitle}
        </h2>
        <p className="text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          {content.mainDescription}
        </p>
      </div>

      <h3 className="text-xl font-semibold text-center mb-8">{content.sectionsTitle}</h3>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {cards.map(({ title, description, Icon }) => (
          <Card key={title} className="bg-muted/30 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold">{title}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center py-8 px-6 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 border border-primary/10">
        <h3 className="text-xl font-semibold mb-3">{content.conclusionTitle}</h3>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {content.conclusionDescription}
        </p>
      </div>
    </section>
  );
}
