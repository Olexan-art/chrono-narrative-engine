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
    'hero.badge': 'SMART NEWS',
    'hero.title': 'Точка Синхронізації',
    'hero.description': 'Книга, що пише сама себе. Архіватор структурує хаос людської історії через призму новин, генеруючи щоденні історії з реальних подій.',
    'hero.archive': 'Переглянути архів',
    'hero.latest': 'Читати останнє',
    'hero.allUsNews': 'Усі новини USA',
    
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
    'flash_news': 'FLASH NEWS',
    'hot_meat': 'Гаряче м\'ясо',
    'monologue': 'Монолог',
    'commentary': 'Коментар',
    
    // Footer
    'footer.style': 'З великим натхненням: Рей Бредбері • Артур Кларк • Ніл Гейман',
    
    // News
    'news.sources': 'Джерела новин',
    'news.read': 'Читати оригінал',
    
    // Chapters
    'chapters.count': 'глав',
    
    // Calendar
    'calendar.title': 'КАЛЕНДАР',
    'calendar.view_full': 'Переглянути повний календар',
    'calendar.latest_chapter': 'ОСТАННЯ ГЛАВА',
    'calendar.read_chapter': 'Читати главу',
    
    // Narrative Chart
    'narrative.title': 'НАРАТИВНА СТРУКТУРА',
    'narrative.elements': 'елементів',
    'narrative.source': 'Джерело',
    'narrative.structure': 'Структура',
    'narrative.purpose': 'Мета',
    'narrative.plot': 'Сюжет',
    'narrative.special': 'Особливість',

    // Volumes Page
    'volumes.title': 'Томи',
    'volumes.description': 'Архів усіх томів хроніки з статистикою переглядів',
    'volumes.empty': 'Томів поки немає',
    'volumes.volume': 'Том',
    'volumes.views': 'Переглядів',
    'volumes.unique': 'Унікальних',
    'volumes.view_chapters': 'Переглянути глави →',
    
    // Calendar Page
    'calendar.stories_on_date': 'оповідань на цю дату',
    'calendar.published': 'ОПУБЛІКОВАНО',
    'calendar.scheduled': 'ЗАПЛАНОВАНО',
    'calendar.draft': 'ЧЕРНЕТКА',
    'calendar.view': 'Переглянути',
    'calendar.edit': 'Редагувати',
    'calendar.no_parts': 'Частин для цього дня ще не створено',
    'calendar.go_to_generation': 'Перейти до генерації',
    
    // Month names
    'month.1': 'Січень',
    'month.2': 'Лютий',
    'month.3': 'Березень',
    'month.4': 'Квітень',
    'month.5': 'Травень',
    'month.6': 'Червень',
    'month.7': 'Липень',
    'month.8': 'Серпень',
    'month.9': 'Вересень',
    'month.10': 'Жовтень',
    'month.11': 'Листопад',
    'month.12': 'Грудень',
    
    // Common
    'common.stories': 'оповідань',

    // News Digest
    'newsdigest.title': 'Кротовиина Новин',
    'newsdigest.badge': 'RSS НОВИНИ',
    'newsdigest.description': 'Актуальні новини з усього світу по країнам та категоріям',
    'newsdigest.empty': 'Новин поки немає',
    'newsdigest.empty_desc': 'RSS канали ще не налаштовані або новини не завантажені',
    'nav.newsdigest': 'Кротовиина',

    // RSS News
    'rss_news.latest': 'ОСТАННІ НОВИНИ',
    'rss_news.view_all': 'Всі новини',
    'news.not_found': 'Новину не знайдено',
    'news.back_to_digest': 'Повернутись до новин',
    'news.read_original': 'Читати оригінал',
    'news.generate_dialogue': 'Генерувати діалог',
    'news.regenerate_dialogue': 'Перегенерувати діалог',
    'news.dialogue_generated': 'Діалог згенеровано',
    'news.no_dialogue': 'Коментарів персонажів ще немає',
    'news.generate_dialogue_hint': 'Натисніть кнопку вище, щоб згенерувати реакцію персонажів',
    'news.create_story': 'Створити історію',
    'news.create_story_desc': 'Згенерувати художню історію на основі цієї новини',
    'news.generate_story': 'Генерувати історію',
    'news.source_info': 'Джерело',
    'news.feed': 'Канал',
    'news.category': 'Категорія',
    'news.fetched': 'Завантажено',
    'news.retell': 'Переказати новину',
    'news.retell_desc': 'ШІ розширить та переформулює новину',
    'news.retelling': 'Переказую...',
    'news.retold': 'Новину переказано',
    'news.select_model': 'Обрати модель',

    // Install Page
    'install.badge': 'ВСТАНОВИТИ ЗАСТОСУНОК',
    'install.title': 'Встановити Точку Синхронізації',
    'install.description': 'Встановіть застосунок на свій пристрій для швидкого доступу, офлайн читання та найкращого досвіду.',
    'install.already_installed': 'Застосунок встановлено!',
    'install.already_installed_desc': 'Ви вже використовуєте встановлену версію застосунку.',
    'install.quick_install': 'Швидке встановлення',
    'install.quick_install_desc': 'Ваш браузер підтримує пряме встановлення.',
    'install.install_now': 'Встановити зараз',
    'install.ios_title': 'Встановлення на iPhone/iPad',
    'install.ios_browser_note': 'Використовуйте Safari для встановлення на iOS.',
    'install.ios_step1': 'Натисніть кнопку "Поділитись"',
    'install.ios_step2': 'Прокрутіть вниз у меню',
    'install.ios_step3': 'Натисніть',
    'install.ios_step4': 'Підтвердіть натиснувши "Додати" у верхньому правому куті.',
    'install.add_to_home': 'На Початковий екран',
    'install.android_title': 'Встановлення на Android',
    'install.android_browser_note': 'Використовуйте Chrome або інший сумісний браузер.',
    'install.android_step1': 'Натисніть меню (три крапки)',
    'install.android_step2': 'Оберіть',
    'install.android_step3': 'Підтвердіть встановлення у діалоговому вікні.',
    'install.install_app': 'Встановити застосунок',
    'install.or': 'або',
    'install.android_banner_note': 'Деякі браузери показують банер встановлення автоматично внизу екрану.',
    'install.desktop_title': 'Встановлення на комп\'ютер',
    'install.desktop_browser_note': 'Підтримується Chrome, Edge та інші Chromium-браузери.',
    'install.desktop_step1': 'Знайдіть іконку встановлення в адресному рядку браузера.',
    'install.desktop_step2': 'Натисніть іконку встановлення',
    'install.desktop_step3': 'Підтвердіть встановлення у діалоговому вікні.',
    'install.desktop_alt': 'Також можна використати меню браузера → "Встановити застосунок" або "Створити ярлик".',
    'install.benefit_offline': 'Офлайн доступ',
    'install.benefit_offline_desc': 'Читайте оповіді без інтернету.',
    'install.benefit_notifications': 'Сповіщення',
    'install.benefit_notifications_desc': 'Отримуйте оновлення про нові записи.',
    'install.benefit_native': 'Нативний досвід',
    'install.benefit_native_desc': 'Працює як звичайний застосунок.',

    // GDPR
    'gdpr.message': 'Ми використовуємо cookies для покращення вашого досвіду. Продовжуючи, ви погоджуєтесь з нашою',
    'gdpr.privacy_link': 'політикою конфіденційності',
    'gdpr.accept': 'Прийняти',
    'gdpr.decline': 'Відхилити',

    // Privacy Policy
    'privacy.title': 'Політика конфіденційності',
    'privacy.last_updated': 'Останнє оновлення',
    'privacy.intro': 'Ця політика конфіденційності описує, як Точка Синхронізації збирає, використовує та захищає вашу інформацію.',
    'privacy.data_collection': 'Збір даних',
    'privacy.data_collection_text': 'Ми збираємо мінімальну кількість даних для забезпечення роботи сервісу: аналітику відвідувань, налаштування мови та cookie-згоду.',
    'privacy.cookies': 'Cookies',
    'privacy.cookies_text': 'Ми використовуємо cookies для аналітики (Google Analytics), збереження мовних налаштувань та покращення користувацького досвіду.',
    'privacy.third_party': 'Сторонні сервіси',
    'privacy.third_party_text': 'Ми використовуємо Google Analytics для аналізу трафіку. Ці сервіси мають власні політики конфіденційності.',
    'privacy.data_security': 'Безпека даних',
    'privacy.data_security_text': 'Ми вживаємо заходів для захисту вашої інформації, але жоден метод передачі через інтернет не є на 100% безпечним.',
    'privacy.your_rights': 'Ваші права',
    'privacy.your_rights_text': 'Ви маєте право відмовитись від cookies через банер згоди або налаштування браузера.',
    'privacy.contact': 'Контакт',
    'privacy.contact_text': 'Якщо у вас є питання щодо цієї політики, зверніться до нас через сайт.',
  },
  en: {
    // Header
    'nav.read': 'Read',
    'nav.volumes': 'Volumes',
    'nav.calendar': 'Calendar',
    'nav.admin': 'Admin',
    'header.subtitle': 'ARCHIVE OF HUMAN HISTORY',
    
    // Hero
    'hero.badge': 'SMART NEWS',
    'hero.title': 'Synchronization Point',
    'hero.description': 'A book that writes itself. An archivist structures the chaos of human history through the lens of news, generating daily stories from real-world news.',
    'hero.archive': 'Browse Archive',
    'hero.latest': 'Read Latest',
    'hero.allUsNews': 'All USA News',
    
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
    'flash_news': 'FLASH NEWS',
    'hot_meat': 'Hot meat',
    'monologue': 'Monologue',
    'commentary': 'Commentary',
    
    // Footer
    'footer.style': 'Style: Ray Bradbury • Arthur C. Clarke • Neil Gaiman',
    
    // News
    'news.sources': 'News Sources',
    'news.read': 'Read Original',
    
    // Chapters
    'chapters.count': 'chapters',
    
    // Calendar
    'calendar.title': 'CALENDAR',
    'calendar.view_full': 'View Full Calendar',
    'calendar.latest_chapter': 'LATEST CHAPTER',
    'calendar.read_chapter': 'Read Chapter',
    
    // Narrative Chart
    'narrative.title': 'NARRATIVE STRUCTURE',
    'narrative.elements': 'elements',
    'narrative.source': 'Source',
    'narrative.structure': 'Structure',
    'narrative.purpose': 'Purpose',
    'narrative.plot': 'Plot',
    'narrative.special': 'Special',

    // Volumes Page
    'volumes.title': 'Volumes',
    'volumes.description': 'Archive of all chronicle volumes with view statistics',
    'volumes.empty': 'No volumes yet',
    'volumes.volume': 'Volume',
    'volumes.views': 'Views',
    'volumes.unique': 'Unique',
    'volumes.view_chapters': 'View chapters →',
    
    // Calendar Page
    'calendar.stories_on_date': 'stories on this date',
    'calendar.published': 'PUBLISHED',
    'calendar.scheduled': 'SCHEDULED',
    'calendar.draft': 'DRAFT',
    'calendar.view': 'View',
    'calendar.edit': 'Edit',
    'calendar.no_parts': 'No parts created for this day yet',
    'calendar.go_to_generation': 'Go to generation',
    
    // Month names
    'month.1': 'January',
    'month.2': 'February',
    'month.3': 'March',
    'month.4': 'April',
    'month.5': 'May',
    'month.6': 'June',
    'month.7': 'July',
    'month.8': 'August',
    'month.9': 'September',
    'month.10': 'October',
    'month.11': 'November',
    'month.12': 'December',
    
    // Common
    'common.stories': 'stories',

    // News Digest
    'newsdigest.title': 'News Digest',
    'newsdigest.badge': 'RSS NEWS',
    'newsdigest.description': 'Current news from around the world by country and category',
    'newsdigest.empty': 'No news yet',
    'newsdigest.empty_desc': 'RSS feeds are not configured or news has not been loaded',
    'nav.newsdigest': 'News Digest',

    // RSS News
    'rss_news.latest': 'LATEST NEWS',
    'rss_news.view_all': 'View all news',
    'news.not_found': 'News not found',
    'news.back_to_digest': 'Back to news',
    'news.read_original': 'Read original',
    'news.generate_dialogue': 'Generate dialogue',
    'news.regenerate_dialogue': 'Regenerate dialogue',
    'news.dialogue_generated': 'Dialogue generated',
    'news.no_dialogue': 'No character comments yet',
    'news.generate_dialogue_hint': 'Click the button above to generate character reactions',
    'news.create_story': 'Create story',
    'news.create_story_desc': 'Generate a fictional story based on this news',
    'news.generate_story': 'Generate story',
    'news.source_info': 'Source',
    'news.feed': 'Feed',
    'news.category': 'Category',
    'news.fetched': 'Fetched',
    'news.retell': 'Retell news',
    'news.retell_desc': 'AI will expand and rephrase the news',
    'news.retelling': 'Retelling...',
    'news.retold': 'News retold',
    'news.select_model': 'Select model',

    // Install Page
    'install.badge': 'INSTALL APP',
    'install.title': 'Install Synchronization Point',
    'install.description': 'Install the app on your device for quick access, offline reading, and the best experience.',
    'install.already_installed': 'App is installed!',
    'install.already_installed_desc': 'You are already using the installed version of the app.',
    'install.quick_install': 'Quick Install',
    'install.quick_install_desc': 'Your browser supports direct installation.',
    'install.install_now': 'Install Now',
    'install.ios_title': 'Install on iPhone/iPad',
    'install.ios_browser_note': 'Use Safari to install on iOS.',
    'install.ios_step1': 'Tap the "Share" button',
    'install.ios_step2': 'Scroll down in the menu',
    'install.ios_step3': 'Tap',
    'install.ios_step4': 'Confirm by tapping "Add" in the top right corner.',
    'install.add_to_home': 'Add to Home Screen',
    'install.android_title': 'Install on Android',
    'install.android_browser_note': 'Use Chrome or another compatible browser.',
    'install.android_step1': 'Tap the menu (three dots)',
    'install.android_step2': 'Select',
    'install.android_step3': 'Confirm the installation in the dialog.',
    'install.install_app': 'Install app',
    'install.or': 'or',
    'install.android_banner_note': 'Some browsers show an install banner automatically at the bottom of the screen.',
    'install.desktop_title': 'Install on Desktop',
    'install.desktop_browser_note': 'Supported in Chrome, Edge, and other Chromium browsers.',
    'install.desktop_step1': 'Look for the install icon in the browser address bar.',
    'install.desktop_step2': 'Click the install icon',
    'install.desktop_step3': 'Confirm the installation in the dialog.',
    'install.desktop_alt': 'You can also use browser menu → "Install app" or "Create shortcut".',
    'install.benefit_offline': 'Offline Access',
    'install.benefit_offline_desc': 'Read stories without internet.',
    'install.benefit_notifications': 'Notifications',
    'install.benefit_notifications_desc': 'Get updates about new entries.',
    'install.benefit_native': 'Native Experience',
    'install.benefit_native_desc': 'Works like a regular app.',

    // GDPR
    'gdpr.message': 'We use cookies to improve your experience. By continuing, you agree to our',
    'gdpr.privacy_link': 'privacy policy',
    'gdpr.accept': 'Accept',
    'gdpr.decline': 'Decline',

    // Privacy Policy
    'privacy.title': 'Privacy Policy',
    'privacy.last_updated': 'Last updated',
    'privacy.intro': 'This privacy policy describes how Synchronization Point collects, uses, and protects your information.',
    'privacy.data_collection': 'Data Collection',
    'privacy.data_collection_text': 'We collect minimal data to provide our service: visit analytics, language preferences, and cookie consent.',
    'privacy.cookies': 'Cookies',
    'privacy.cookies_text': 'We use cookies for analytics (Google Analytics), storing language settings, and improving user experience.',
    'privacy.third_party': 'Third-Party Services',
    'privacy.third_party_text': 'We use Google Analytics to analyze traffic. These services have their own privacy policies.',
    'privacy.data_security': 'Data Security',
    'privacy.data_security_text': 'We take measures to protect your information, but no method of transmission over the internet is 100% secure.',
    'privacy.your_rights': 'Your Rights',
    'privacy.your_rights_text': 'You have the right to decline cookies through the consent banner or browser settings.',
    'privacy.contact': 'Contact',
    'privacy.contact_text': 'If you have questions about this policy, contact us through the website.',
  },
  pl: {
    // Header
    'nav.read': 'Czytaj',
    'nav.volumes': 'Tomy',
    'nav.calendar': 'Kalendarz',
    'nav.admin': 'Admin',
    'header.subtitle': 'ARCHIVE OF HUMAN HISTORY',
    
    // Hero
    'hero.badge': 'SMART NEWS',
    'hero.title': 'Punkt Synchronizacji',
    'hero.description': 'Książka, która pisze się sama. Archiwista strukturyzuje chaos ludzkiej historii przez pryzmat wiadomości, generując codzienne opowiadania z prawdziwych wiadomości.',
    'hero.archive': 'Przeglądaj Archiwum',
    'hero.latest': 'Czytaj Najnowsze',
    'hero.allUsNews': 'Wszystkie wiadomości USA',
    
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
    'flash_news': 'FLASH NEWS',
    'hot_meat': 'Gorące mięso',
    'monologue': 'Monolog',
    'commentary': 'Komentarz',
    
    // Footer
    'footer.style': 'Styl: Ray Bradbury • Arthur C. Clarke • Neil Gaiman',
    
    // News
    'news.sources': 'Źródła Wiadomości',
    'news.read': 'Czytaj Oryginał',
    
    // Chapters
    'chapters.count': 'rozdziałów',
    
    // Calendar
    'calendar.title': 'KALENDARZ',
    'calendar.view_full': 'Wyświetl pełny kalendarz',
    'calendar.latest_chapter': 'OSTATNI ROZDZIAŁ',
    'calendar.read_chapter': 'Czytaj rozdział',
    
    // Narrative Chart
    'narrative.title': 'STRUKTURA NARRACYJNA',
    'narrative.elements': 'elementów',
    'narrative.source': 'Źródło',
    'narrative.structure': 'Struktura',
    'narrative.purpose': 'Cel',
    'narrative.plot': 'Fabuła',
    'narrative.special': 'Specjalność',

    // Volumes Page
    'volumes.title': 'Tomy',
    'volumes.description': 'Archiwum wszystkich tomów kroniki ze statystykami wyświetleń',
    'volumes.empty': 'Brak tomów',
    'volumes.volume': 'Tom',
    'volumes.views': 'Wyświetleń',
    'volumes.unique': 'Unikalnych',
    'volumes.view_chapters': 'Zobacz rozdziały →',
    
    // Calendar Page
    'calendar.stories_on_date': 'opowieści na ten dzień',
    'calendar.published': 'OPUBLIKOWANO',
    'calendar.scheduled': 'ZAPLANOWANO',
    'calendar.draft': 'SZKIC',
    'calendar.view': 'Zobacz',
    'calendar.edit': 'Edytuj',
    'calendar.no_parts': 'Nie utworzono jeszcze części na ten dzień',
    'calendar.go_to_generation': 'Przejdź do generowania',
    
    // Month names
    'month.1': 'Styczeń',
    'month.2': 'Luty',
    'month.3': 'Marzec',
    'month.4': 'Kwiecień',
    'month.5': 'Maj',
    'month.6': 'Czerwiec',
    'month.7': 'Lipiec',
    'month.8': 'Sierpień',
    'month.9': 'Wrzesień',
    'month.10': 'Październik',
    'month.11': 'Listopad',
    'month.12': 'Grudzień',
    
    // Common
    'common.stories': 'opowieści',

    // News Digest
    'newsdigest.title': 'Przegląd Wiadomości',
    'newsdigest.badge': 'WIADOMOŚCI RSS',
    'newsdigest.description': 'Aktualne wiadomości z całego świata według krajów i kategorii',
    'newsdigest.empty': 'Brak wiadomości',
    'newsdigest.empty_desc': 'Kanały RSS nie są skonfigurowane lub wiadomości nie zostały załadowane',
    'nav.newsdigest': 'Wiadomości',

    // RSS News
    'rss_news.latest': 'NAJNOWSZE WIADOMOŚCI',
    'rss_news.view_all': 'Wszystkie wiadomości',
    'news.not_found': 'Wiadomość nie znaleziona',
    'news.back_to_digest': 'Powrót do wiadomości',
    'news.read_original': 'Czytaj oryginał',
    'news.generate_dialogue': 'Generuj dialog',
    'news.regenerate_dialogue': 'Regeneruj dialog',
    'news.dialogue_generated': 'Dialog wygenerowany',
    'news.no_dialogue': 'Brak komentarzy postaci',
    'news.generate_dialogue_hint': 'Kliknij przycisk powyżej, aby wygenerować reakcje postaci',
    'news.create_story': 'Utwórz opowieść',
    'news.create_story_desc': 'Wygeneruj fikcyjną opowieść na podstawie tej wiadomości',
    'news.generate_story': 'Generuj opowieść',
    'news.source_info': 'Źródło',
    'news.feed': 'Kanał',
    'news.category': 'Kategoria',
    'news.fetched': 'Pobrano',
    'news.retell': 'Opowiedz ponownie',
    'news.retell_desc': 'AI rozszerzy i przeformułuje wiadomość',
    'news.retelling': 'Opowiadanie...',
    'news.retold': 'Wiadomość opowiedziana',
    'news.select_model': 'Wybierz model',

    // Install Page
    'install.badge': 'ZAINSTALUJ APLIKACJĘ',
    'install.title': 'Zainstaluj Punkt Synchronizacji',
    'install.description': 'Zainstaluj aplikację na swoim urządzeniu, aby uzyskać szybki dostęp, czytać offline i cieszyć się najlepszym doświadczeniem.',
    'install.already_installed': 'Aplikacja zainstalowana!',
    'install.already_installed_desc': 'Już korzystasz z zainstalowanej wersji aplikacji.',
    'install.quick_install': 'Szybka instalacja',
    'install.quick_install_desc': 'Twoja przeglądarka obsługuje bezpośrednią instalację.',
    'install.install_now': 'Zainstaluj teraz',
    'install.ios_title': 'Instalacja na iPhone/iPad',
    'install.ios_browser_note': 'Użyj Safari do instalacji na iOS.',
    'install.ios_step1': 'Dotknij przycisku "Udostępnij"',
    'install.ios_step2': 'Przewiń w dół menu',
    'install.ios_step3': 'Dotknij',
    'install.ios_step4': 'Potwierdź, dotykając "Dodaj" w prawym górnym rogu.',
    'install.add_to_home': 'Dodaj do ekranu głównego',
    'install.android_title': 'Instalacja na Androidzie',
    'install.android_browser_note': 'Użyj Chrome lub innej kompatybilnej przeglądarki.',
    'install.android_step1': 'Dotknij menu (trzy kropki)',
    'install.android_step2': 'Wybierz',
    'install.android_step3': 'Potwierdź instalację w oknie dialogowym.',
    'install.install_app': 'Zainstaluj aplikację',
    'install.or': 'lub',
    'install.android_banner_note': 'Niektóre przeglądarki automatycznie wyświetlają baner instalacji na dole ekranu.',
    'install.desktop_title': 'Instalacja na komputerze',
    'install.desktop_browser_note': 'Obsługiwane w Chrome, Edge i innych przeglądarkach Chromium.',
    'install.desktop_step1': 'Poszukaj ikony instalacji w pasku adresu przeglądarki.',
    'install.desktop_step2': 'Kliknij ikonę instalacji',
    'install.desktop_step3': 'Potwierdź instalację w oknie dialogowym.',
    'install.desktop_alt': 'Możesz też użyć menu przeglądarki → "Zainstaluj aplikację" lub "Utwórz skrót".',
    'install.benefit_offline': 'Dostęp offline',
    'install.benefit_offline_desc': 'Czytaj opowieści bez internetu.',
    'install.benefit_notifications': 'Powiadomienia',
    'install.benefit_notifications_desc': 'Otrzymuj aktualizacje o nowych wpisach.',
    'install.benefit_native': 'Natywne doświadczenie',
    'install.benefit_native_desc': 'Działa jak zwykła aplikacja.',

    // GDPR
    'gdpr.message': 'Używamy plików cookie, aby poprawić Twoje doświadczenie. Kontynuując, zgadzasz się z naszą',
    'gdpr.privacy_link': 'polityką prywatności',
    'gdpr.accept': 'Akceptuję',
    'gdpr.decline': 'Odrzuć',

    // Privacy Policy
    'privacy.title': 'Polityka prywatności',
    'privacy.last_updated': 'Ostatnia aktualizacja',
    'privacy.intro': 'Ta polityka prywatności opisuje, jak Punkt Synchronizacji zbiera, wykorzystuje i chroni Twoje informacje.',
    'privacy.data_collection': 'Zbieranie danych',
    'privacy.data_collection_text': 'Zbieramy minimalne dane do świadczenia usługi: analitykę odwiedzin, preferencje językowe i zgodę na cookies.',
    'privacy.cookies': 'Cookies',
    'privacy.cookies_text': 'Używamy plików cookie do analityki (Google Analytics), przechowywania ustawień językowych i poprawy doświadczenia użytkownika.',
    'privacy.third_party': 'Usługi stron trzecich',
    'privacy.third_party_text': 'Używamy Google Analytics do analizy ruchu. Te usługi mają własne polityki prywatności.',
    'privacy.data_security': 'Bezpieczeństwo danych',
    'privacy.data_security_text': 'Podejmujemy środki w celu ochrony Twoich informacji, ale żadna metoda transmisji przez internet nie jest w 100% bezpieczna.',
    'privacy.your_rights': 'Twoje prawa',
    'privacy.your_rights_text': 'Masz prawo odmówić cookies poprzez baner zgody lub ustawienia przeglądarki.',
    'privacy.contact': 'Kontakt',
    'privacy.contact_text': 'Jeśli masz pytania dotyczące tej polityki, skontaktuj się z nami przez stronę.',
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
      // Detect from browser — default to English if no match
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'uk') return 'uk';
      if (browserLang === 'pl') return 'pl';
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('sync-point-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
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
