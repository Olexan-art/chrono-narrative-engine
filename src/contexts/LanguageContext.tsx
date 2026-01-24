import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'uk' | 'en' | 'pl';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  uk: {
    // Header
    'nav.read': 'Читати',
    'nav.volumes': 'Томи',
    'nav.calendar': 'Календар',
    'nav.admin': 'Адмінка',
    'header.subtitle': 'КРОТОВИНА ІСТОРІЇ',
    
    // Hero
    'hero.badge': 'AI-ГЕНЕРОВАНА НАУКОВА ФАНТАСТИКА',
    'hero.title': 'Точка Синхронізації',
    'hero.description': 'Книга, що пише сама себе. Архіватор структурує хаос людської історії через призму наукової фантастики.',
    'hero.archive': 'Переглянути архів',
    'hero.latest': 'Читати останнє',
    
    // Structure
    'structure.month': 'МІСЯЦЬ → ТОМ',
    'structure.month.desc': 'Цілісна сюжетна арка глобального вектора людства',
    'structure.week': 'ТИЖДЕНЬ → ГЛАВА',
    'structure.week.desc': 'Синтез подій з монологом Наратора',
    'structure.day': 'ДЕНЬ → ЧАСТИНА',
    'structure.day.desc': 'Яскравий спалах через метафори та прогнози',
    
    // Content
    'latest.title': 'ОСТАННІ ЗАПИСИ',
    'chapters.title': 'ГЛАВИ ТИЖНІВ',
    'tweets.title': 'ВІДГУКИ З МАЙБУТНЬОГО',
    'chat.title': 'РЕАКЦІЯ ПЕРСОНАЖІВ',
    'chat.observers': 'ДІАЛОГ СПОСТЕРІГАЧІВ',
    'tweets.observers': 'РЕАКЦІЇ СПОСТЕРІГАЧІВ',
    'chapter': 'ГЛАВА',
    'week': 'Тиждень',
    'day': 'ДЕНЬ',
    'month': 'МІСЯЦЬ',
    'monologue': 'Монолог',
    'commentary': 'Коментар',
    
    // Footer
    'footer.style': 'З великим натхненням: Рей Бредбері • Артур Кларк • Ніл Гейман',
    
    // News
    'news.sources': 'Джерела новин',
    'news.read': 'Читати оригінал',
    
    // Chapters
    'chapters.count': 'глав',
  },
  en: {
    // Header
    'nav.read': 'Read',
    'nav.volumes': 'Volumes',
    'nav.calendar': 'Calendar',
    'nav.admin': 'Admin',
    'header.subtitle': 'AI ARCHIVE OF HUMAN HISTORY',
    
    // Hero
    'hero.badge': 'AI-GENERATED SCIENCE FICTION',
    'hero.title': 'Synchronization Point',
    'hero.description': 'A book that writes itself. An AI archivist structures the chaos of human history through the lens of science fiction.',
    'hero.archive': 'Browse Archive',
    'hero.latest': 'Read Latest',
    
    // Structure
    'structure.month': 'MONTH → VOLUME',
    'structure.month.desc': 'A complete narrative arc of humanity\'s global vector',
    'structure.week': 'WEEK → CHAPTER',
    'structure.week.desc': 'Synthesis of events with Narrator\'s monologue',
    'structure.day': 'DAY → PART',
    'structure.day.desc': 'A vivid flash through metaphors and forecasts',
    
    // Content
    'latest.title': 'LATEST ENTRIES',
    'chapters.title': 'WEEKLY CHAPTERS',
    'tweets.title': 'ECHOES FROM THE FUTURE',
    'chat.title': 'CHARACTER REACTIONS',
    'chat.observers': 'OBSERVERS DIALOGUE',
    'tweets.observers': 'OBSERVERS REACTIONS',
    'chapter': 'CHAPTER',
    'week': 'Week',
    'day': 'DAY',
    'month': 'MONTH',
    'monologue': 'Monologue',
    'commentary': 'Commentary',
    
    // Footer
    'footer.style': 'Style: Ray Bradbury • Arthur C. Clarke • Neil Gaiman',
    
    // News
    'news.sources': 'News Sources',
    'news.read': 'Read Original',
    
    // Chapters
    'chapters.count': 'chapters',
  },
  pl: {
    // Header
    'nav.read': 'Czytaj',
    'nav.volumes': 'Tomy',
    'nav.calendar': 'Kalendarz',
    'nav.admin': 'Admin',
    'header.subtitle': 'ARCHIWUM AI HISTORII LUDZKOŚCI',
    
    // Hero
    'hero.badge': 'FANTASTYKA NAUKOWA GENEROWANA PRZEZ AI',
    'hero.title': 'Punkt Synchronizacji',
    'hero.description': 'Książka, która pisze się sama. Archiwista AI strukturyzuje chaos ludzkiej historii przez pryzmat fantastyki naukowej.',
    'hero.archive': 'Przeglądaj Archiwum',
    'hero.latest': 'Czytaj Najnowsze',
    
    // Structure
    'structure.month': 'MIESIĄC → TOM',
    'structure.month.desc': 'Kompletny łuk narracyjny globalnego wektora ludzkości',
    'structure.week': 'TYDZIEŃ → ROZDZIAŁ',
    'structure.week.desc': 'Synteza wydarzeń z monologiem Narratora',
    'structure.day': 'DZIEŃ → CZĘŚĆ',
    'structure.day.desc': 'Żywy błysk przez metafory i prognozy',
    
    // Content
    'latest.title': 'NAJNOWSZE WPISY',
    'chapters.title': 'ROZDZIAŁY TYGODNIOWE',
    'tweets.title': 'ECHA Z PRZYSZŁOŚCI',
    'chat.title': 'REAKCJE POSTACI',
    'chat.observers': 'DIALOG OBSERWATORÓW',
    'tweets.observers': 'REAKCJE OBSERWATORÓW',
    'chapter': 'ROZDZIAŁ',
    'week': 'Tydzień',
    'day': 'DZIEŃ',
    'month': 'MIESIĄC',
    'monologue': 'Monolog',
    'commentary': 'Komentarz',
    
    // Footer
    'footer.style': 'Styl: Ray Bradbury • Arthur C. Clarke • Neil Gaiman',
    
    // News
    'news.sources': 'Źródła Wiadomości',
    'news.read': 'Czytaj Oryginał',
    
    // Chapters
    'chapters.count': 'rozdziałów',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sync-point-language');
      if (saved && ['uk', 'en', 'pl'].includes(saved)) {
        return saved as Language;
      }
      // Detect from browser
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'pl') return 'pl';
      if (browserLang === 'en') return 'en';
    }
    return 'uk';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('sync-point-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || translations['uk'][key] || key;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
