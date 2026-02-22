import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { Shield } from "lucide-react";

export default function DmcaPage() {
  const { language } = useLanguage();

  return (
    <>
      <SEOHead
        title="DMCA — Hronovs"
        description="DMCA copyright policy and takedown procedure for Hronovs."
      />
      <Header />
      <main className="min-h-[calc(100vh-128px)] bg-background text-foreground">
        <div className="container mx-auto max-w-2xl px-4 py-12">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">DMCA</h1>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                {language === "uk" ? "Повідомлення про видалення" : "Takedown Notice"}
              </h2>
              <p>
                {language === "uk"
                  ? "Якщо ви вважаєте, що ваш матеріал, захищений авторським правом, розміщений на цьому ресурсі без належного дозволу, надішліть нам повідомлення про видалення."
                  : "If you believe that copyrighted material has been posted on this site without proper authorization, please submit a takedown notice."}
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                {language === "uk" ? "Контакт для DMCA" : "DMCA Contact"}
              </h2>
              <p>
                {language === "uk"
                  ? "Надішліть повідомлення через форму зворотного зв'язку, вказавши тему «Copyright» та надавши:"
                  : "Send your notice via the contact form with topic «Copyright», providing:"}
              </p>
              <ul className="mt-3 space-y-1 list-disc list-inside">
                <li>{language === "uk" ? "URL матеріалу на нашому сайті" : "URL of the material on our site"}</li>
                <li>{language === "uk" ? "Опис оригінального твору" : "Description of the original copyrighted work"}</li>
                <li>{language === "uk" ? "Ваші контактні дані" : "Your contact information"}</li>
                <li>{language === "uk" ? "Підтвердження добросовісного переконання" : "Statement of good faith belief"}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                {language === "uk" ? "Час обробки" : "Processing Time"}
              </h2>
              <p>
                {language === "uk"
                  ? "Ми розглядаємо законні запити DMCA та видаляємо контент протягом 5 робочих днів."
                  : "We process valid DMCA takedown notices and remove content within 5 business days."}
              </p>
            </section>

            <p className="pt-4 text-xs text-muted-foreground/60">
              {language === "uk"
                ? "Ця сторінка відповідає Закону про авторське право в цифрову епоху (DMCA), 17 U.S.C. § 512."
                : "This page complies with the Digital Millennium Copyright Act, 17 U.S.C. § 512."}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
