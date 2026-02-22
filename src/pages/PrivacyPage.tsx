import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { Shield, Cookie, Database, Lock, Users, Mail, Eye, Clock, Baby, RefreshCw, Server } from "lucide-react";

export default function PrivacyPage() {
  const { language } = useLanguage();
  const isUk = language === "uk";

  const sections = [
    {
      icon: Database,
      title: isUk ? "1. Які дані ми збираємо" : "1. What Data We Collect",
      content: isUk ? (
        <div className="space-y-2">
          <p><strong>Автоматично зібрані дані:</strong></p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>IP-адреса (використовується для geo-blocking та захисту від спаму)</li>
            <li>User-Agent браузера (для аналітики та захисту)</li>
            <li>Сторінки та статті, які ви переглядаєте (анонімно, через visitor_id)</li>
            <li>Дата та час візиту, тривалість сесії</li>
            <li>Реферер (звідки ви прийшли)</li>
            <li>Мова браузера, роздільна здатність екрана, часовий пояс</li>
          </ul>
          <p className="pt-2"><strong>Дані, надані добровільно (форма зворотного зв'язку):</strong></p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Ім'я та email (якщо ви їх надали)</li>
            <li>Текст повідомлення та обрана тема</li>
          </ul>
          <p className="pt-2">Ми <strong>не збираємо</strong> паролі, платіжні дані, точне місцеположення або будь-яку іншу чутливу особисту інформацію поза зазначеним вище.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p><strong>Automatically collected data:</strong></p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>IP address (used for geo-tagging and spam protection)</li>
            <li>Browser User-Agent (for analytics and security)</li>
            <li>Pages and articles viewed (anonymously, via visitor_id)</li>
            <li>Date, time of visit, session duration</li>
            <li>Referrer (where you came from)</li>
            <li>Browser language, screen resolution, timezone</li>
          </ul>
          <p className="pt-2"><strong>Voluntarily provided data (contact form):</strong></p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Name and email address (if provided)</li>
            <li>Message content and selected topic</li>
          </ul>
          <p className="pt-2">We do <strong>not collect</strong> passwords, payment data, precise location, or any other sensitive personal data beyond what is listed above.</p>
        </div>
      ),
    },
    {
      icon: Eye,
      title: isUk ? "2. Як ми використовуємо ваші дані" : "2. How We Use Your Data",
      content: isUk ? (
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Надання контенту та персоналізація мовних налаштувань</li>
          <li>Анонімна аналітика відвідуваності (популярні матеріали, географія читачів)</li>
          <li>Захист від спаму та автоматизованих запитів (rate limiting, bot detection)</li>
          <li>Обробка запитів зворотного зв'язку та DMCA-скарг</li>
          <li>Покращення якості сервісу на основі агрегованих даних</li>
          <li>Дотримання вимог закону та захист наших прав</li>
        </ul>
      ) : (
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Delivering content and personalizing language preferences</li>
          <li>Anonymous traffic analytics (popular content, reader geography)</li>
          <li>Protection against spam and automated requests (rate limiting, bot detection)</li>
          <li>Processing contact form submissions and DMCA notices</li>
          <li>Improving service quality based on aggregated data</li>
          <li>Legal compliance and protection of our rights</li>
        </ul>
      ),
    },
    {
      icon: Cookie,
      title: isUk ? "3. Cookies та локальне сховище" : "3. Cookies & Local Storage",
      content: isUk ? (
        <div className="space-y-2">
          <p>Ми використовуємо такі технології зберігання:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>localStorage (visitor_id)</strong> — анонімний UUID для відстеження переглядів без прив'язки до особи. Зберігається у вашому браузері.</li>
            <li><strong>localStorage (language, consent)</strong> — ваші мовні та GDPR-налаштування.</li>
            <li><strong>Сесійні cookie</strong> — технічні файли для стабільної роботи сайту.</li>
          </ul>
          <p className="pt-2">Ми <strong>не</strong> використовуємо рекламні трекери, Facebook Pixel, Google Ads cookies або інші маркетингові cookie. Ви можете видалити всі локальні дані через налаштування браузера у будь-який момент.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p>We use the following storage technologies:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>localStorage (visitor_id)</strong> — anonymous UUID to track page views without identifying you personally. Stored in your browser.</li>
            <li><strong>localStorage (language, consent)</strong> — your language and GDPR consent preferences.</li>
            <li><strong>Session cookies</strong> — technical cookies for proper site operation.</li>
          </ul>
          <p className="pt-2">We do <strong>not</strong> use advertising trackers, Facebook Pixel, Google Ads cookies, or any marketing cookies. You may delete all local data through your browser settings at any time.</p>
        </div>
      ),
    },
    {
      icon: Server,
      title: isUk ? "4. Треті сторони та партнери" : "4. Third-Party Services",
      content: isUk ? (
        <div className="space-y-2">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Supabase</strong> (база даних, EU та US хостинг) — обробляє та зберігає дані. Умови: supabase.com/privacy</li>
            <li><strong>Netlify / Cloudflare</strong> — CDN та хостинг; обробляють HTTP-запити. Умови: netlify.com/privacy, cloudflare.com/privacypolicy</li>
            <li><strong>OpenAI</strong> — AI-аналіз статей та сутностей (лише контент новин, без особистих даних). Умови: openai.com/privacy</li>
            <li><strong>RSS-джерела</strong> — ми агрегуємо публічний контент з відкритих RSS-каналів. Дані новин не містять особистої інформації читачів.</li>
          </ul>
          <p className="pt-2">Ми не продаємо, не передаємо та не обмінюємо ваші персональні дані з третіми сторонами з комерційних цілей.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Supabase</strong> (database, EU & US hosting) — processes and stores data. Terms: supabase.com/privacy</li>
            <li><strong>Netlify / Cloudflare</strong> — CDN and hosting; handle HTTP requests. Terms: netlify.com/privacy, cloudflare.com/privacypolicy</li>
            <li><strong>OpenAI</strong> — AI analysis of articles and entities (news content only, no personal data). Terms: openai.com/privacy</li>
            <li><strong>RSS sources</strong> — we aggregate public content from open RSS feeds. News data does not contain readers' personal information.</li>
          </ul>
          <p className="pt-2">We do not sell, transfer, or exchange your personal data with third parties for commercial purposes.</p>
        </div>
      ),
    },
    {
      icon: Clock,
      title: isUk ? "5. Зберігання даних" : "5. Data Retention",
      content: isUk ? (
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Дані з форми зворотного зв'язку — до 2 років або до виконання запиту</li>
          <li>Анонімна аналітика переглядів (visitor_id) — до 1 року у нашій БД</li>
          <li>Логи бот-трафіку — до 90 днів</li>
          <li>Технічні логи сервера — до 30 днів</li>
          <li>Ви можете будь-коли запросити видалення ваших даних через форму контакту</li>
        </ul>
      ) : (
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Contact form data — up to 2 years or until the request is resolved</li>
          <li>Anonymous view analytics (visitor_id) — up to 1 year in our database</li>
          <li>Bot-traffic logs — up to 90 days</li>
          <li>Technical server logs — up to 30 days</li>
          <li>You may request deletion of your data at any time via the contact form</li>
        </ul>
      ),
    },
    {
      icon: Users,
      title: isUk ? "6. Ваші права (GDPR / CCPA)" : "6. Your Rights (GDPR / CCPA)",
      content: isUk ? (
        <div className="space-y-2">
          <p>Відповідно до GDPR (ЄС) та CCPA (Каліфорнія) ви маєте право:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Доступу</strong> — отримати копію ваших персональних даних</li>
            <li><strong>Виправлення</strong> — виправити неточні дані</li>
            <li><strong>Видалення ("право бути забутим")</strong> — запросити повне видалення</li>
            <li><strong>Обмеження обробки</strong> — обмежити використання ваших даних</li>
            <li><strong>Переносимості</strong> — отримати дані в машиночитаному форматі</li>
            <li><strong>Заперечення</strong> — відмовитись від певного тиру обробки</li>
            <li><strong>Відкликання згоди</strong> — у будь-який момент, без наслідків</li>
          </ul>
          <p className="pt-2">Для реалізації будь-якого права надішліть запит через <a href="/contact" className="text-primary hover:underline">форму зворотного зв'язку</a>, тема "Technical". Ми відповімо протягом 30 днів.</p>
          <p className="pt-2 text-xs text-muted-foreground/70">За CCPA: ми не продаємо особисту інформацію. Жителі Каліфорнії мають право подати скаргу до California Attorney General.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p>Under GDPR (EU) and CCPA (California) you have the right to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Access</strong> — receive a copy of your personal data</li>
            <li><strong>Rectification</strong> — correct inaccurate data</li>
            <li><strong>Erasure ("right to be forgotten")</strong> — request complete deletion</li>
            <li><strong>Restriction of processing</strong> — limit how your data is used</li>
            <li><strong>Data portability</strong> — receive your data in machine-readable format</li>
            <li><strong>Objection</strong> — opt out of certain types of processing</li>
            <li><strong>Withdrawal of consent</strong> — at any time, without consequence</li>
          </ul>
          <p className="pt-2">To exercise any right, submit a request via the <a href="/contact" className="text-primary hover:underline">contact form</a>, topic "Technical". We will respond within 30 days.</p>
          <p className="pt-2 text-xs text-muted-foreground/70">Under CCPA: we do not sell personal information. California residents may file a complaint with the California Attorney General.</p>
        </div>
      ),
    },
    {
      icon: Lock,
      title: isUk ? "7. Безпека даних" : "7. Data Security",
      content: isUk ? (
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Усі дані передаються виключно через HTTPS (TLS 1.2+)</li>
          <li>База даних захищена RLS (Row-Level Security) Supabase та ізольована від публічного доступу</li>
          <li>API ключі зберігаються у env-variables сервера, а не у фронтенд-коді</li>
          <li>Форми захищені honeypot-полями та обмеженням частоти запитів</li>
          <li>У разі витоку даних ми повідомимо постраждалих відповідно до вимог GDPR (72 години)</li>
        </ul>
      ) : (
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>All data is transmitted exclusively via HTTPS (TLS 1.2+)</li>
          <li>Database protected by Supabase RLS (Row-Level Security) and isolated from public access</li>
          <li>API keys are stored in server-side env variables, not in frontend code</li>
          <li>Forms are protected by honeypot fields and rate limiting</li>
          <li>In case of a data breach, we will notify affected individuals in accordance with GDPR requirements (72 hours)</li>
        </ul>
      ),
    },
    {
      icon: Baby,
      title: isUk ? "8. Діти" : "8. Children's Privacy",
      content: isUk
        ? "Наш сервіс не призначений для осіб молодше 16 років (13 за COPPA). Ми свідомо не збираємо дані дітей. Якщо ви вважаєте, що дитина надала нам особисту інформацію, зв'яжіться з нами для негайного видалення."
        : "Our service is not intended for persons under 16 years of age (13 under COPPA). We do not knowingly collect data from children. If you believe a child has provided us with personal information, please contact us for immediate deletion.",
    },
    {
      icon: RefreshCw,
      title: isUk ? "9. Зміни до цієї політики" : "9. Changes to This Policy",
      content: isUk
        ? "Ми можемо оновлювати цю Політику конфіденційності. Про суттєві зміни ми повідомимо через банер на сайті або через форму зворотного зв'язку (якщо ви залишили email). Продовження використання сайту після публікації змін означає прийняття нової редакції."
        : "We may update this Privacy Policy. Material changes will be communicated via a banner on the site or through the contact form (if you left an email). Continued use of the site after changes are published constitutes acceptance of the updated policy.",
    },
    {
      icon: Mail,
      title: isUk ? "10. Контакт з питань приватності" : "10. Privacy Contact",
      content: isUk ? (
        <div>
          <p>З усіх питань щодо конфіденційності звертайтесь через <a href="/contact" className="text-primary hover:underline">форму зворотного зв'язку</a>, тема «Technical» або «Copyright».</p>
          <p className="mt-2">Відповідальна сторона: <strong>Hronovs / BraveNow</strong></p>
          <p className="mt-1">Ми відповідаємо на запити з питань конфіденційності протягом <strong>30 днів</strong>.</p>
        </div>
      ) : (
        <div>
          <p>For all privacy-related inquiries, contact us via the <a href="/contact" className="text-primary hover:underline">contact form</a>, topic "Technical" or "Copyright".</p>
          <p className="mt-2">Data controller: <strong>Hronovs / BraveNow</strong></p>
          <p className="mt-1">We respond to privacy requests within <strong>30 days</strong>.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={isUk ? "Політика конфіденційності — Hronovs" : "Privacy Policy — Hronovs"}
        description={isUk ? "Як ми збираємо, використовуємо та захищаємо ваші дані. GDPR, CCPA." : "How we collect, use and protect your data. GDPR, CCPA compliant."}
        canonicalUrl="https://bravennow.com/privacy"
      />
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">
              {isUk ? "Політика конфіденційності" : "Privacy Policy"}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {isUk ? "Остання редакція: лютий 2026" : "Last updated: February 2026"}
            {" · "}
            <span className="font-mono">GDPR · CCPA · Ukrainian Law on Personal Data Protection</span>
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            {isUk
              ? "Hronovs / BraveNow — автоматизований агрегатор новин. Ця Політика конфіденційності пояснює, які дані ми збираємо, як ми їх використовуємо та як ми захищаємо вашу приватність відповідно до GDPR (ЄС) 2016/679, Закону України «Про захист персональних даних» та CCPA."
              : "Hronovs / BraveNow is an automated news aggregator. This Privacy Policy explains what data we collect, how we use it, and how we protect your privacy in accordance with GDPR (EU) 2016/679, Ukrainian Law on Personal Data Protection, and CCPA."}
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <section.icon className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed pl-11">
                {typeof section.content === "string" ? <p>{section.content}</p> : section.content}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground/50 text-center border-t border-border/30 pt-6">
          {isUk
            ? "Ця сторінка відповідає Регламенту ЄС 2016/679 (GDPR), Закону України «Про захист персональних даних» (ЗУ №2297-VI), CCPA (California Civil Code §1798.100) та Закону України «Про інформацію»."
            : "This page complies with EU Regulation 2016/679 (GDPR), Ukraine Law on Personal Data Protection (No. 2297-VI), CCPA (California Civil Code §1798.100), and the Ukrainian Law on Information."}
        </p>
      </main>
      <Footer />
    </div>
  );
}
