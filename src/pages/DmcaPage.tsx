import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { Shield, FileText, AlertCircle, Clock, Mail, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function DmcaPage() {
  const { language } = useLanguage();
  const isUk = language === "uk";

  return (
    <>
      <SEOHead
        title="DMCA — Hronovs"
        description="DMCA copyright policy and takedown procedure for Hronovs. 17 U.S.C. § 512 compliance."
        canonicalUrl="https://bravennow.com/dmca"
      />
      <Header />
      <main className="min-h-[calc(100vh-128px)] bg-background text-foreground">
        <div className="container mx-auto max-w-3xl px-4 py-12">

          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">DMCA</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-10">
            Digital Millennium Copyright Act — 17 U.S.C. § 512
          </p>

          <div className="space-y-10 text-sm leading-relaxed">

            {/* Section 1 — Policy */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-primary/70" />
                <h2 className="text-base font-semibold text-foreground">
                  {isUk ? "1. Наша політика" : "1. Our Copyright Policy"}
                </h2>
              </div>
              <p className="text-muted-foreground">
                {isUk
                  ? "Hronovs / BraveNow поважає права інтелектуальної власності та дотримується Закону про авторське право в цифрову епоху (DMCA). Ми реагуємо на повідомлення про порушення авторських прав і видаляємо контент, якщо отримали належне повідомлення від власника прав або його уповноваженого представника."
                  : "Hronovs / BraveNow respects intellectual property rights and complies with the Digital Millennium Copyright Act (DMCA). We respond to notices of alleged copyright infringement and remove content upon receipt of a valid notice from the copyright owner or their authorized representative."}
              </p>
            </section>

            {/* Section 2 — What qualifies */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-primary/70" />
                <h2 className="text-base font-semibold text-foreground">
                  {isUk ? "2. Вимоги до повідомлення про видалення" : "2. Takedown Notice Requirements"}
                </h2>
              </div>
              <p className="text-muted-foreground mb-3">
                {isUk
                  ? "Щоб подати дійсне повідомлення DMCA (відповідно до 17 U.S.C. § 512(c)(3)), ваше повідомлення повинно містити:"
                  : "To submit a valid DMCA takedown notice under 17 U.S.C. § 512(c)(3), your notice must include:"}
              </p>
              <ol className="space-y-2 list-none pl-0">
                {[
                  isUk
                    ? "Фізичний або електронний підпис особи, уповноваженої діяти від імені власника виключного права, що нібито порушується."
                    : "A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.",
                  isUk
                    ? "Ідентифікація твору, захищеного авторським правом, право на який нібито порушується (або список таких творів)."
                    : "Identification of the copyrighted work claimed to have been infringed (or a representative list if multiple works).",
                  isUk
                    ? "Ідентифікація матеріалу, що нібито порушує права, або предмет порушення, що підлягає видаленню, та інформація, що дозволяє нам знайти цей матеріал (URL)."
                    : "Identification of the allegedly infringing material and information reasonably sufficient for us to locate it (e.g., URL).",
                  isUk
                    ? "Ваша контактна інформація: ім'я, адреса, номер телефону, адреса електронної пошти."
                    : "Your contact information: name, mailing address, telephone number, and email address.",
                  isUk
                    ? "Заява про те, що ви добросовісно вважаєте, що використання матеріалу не дозволено власником прав, його агентом або законом."
                    : "A statement that you have a good faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.",
                  isUk
                    ? "Заява під страхом покарання за неправдиві свідчення про те, що інформація у вашому повідомленні є точною і що ви уповноважені діяти від імені власника авторського права."
                    : "A statement made under penalty of perjury that the information in your notice is accurate and that you are authorized to act on behalf of the copyright owner.",
                ].map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-mono text-primary/60 text-xs mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Section 3 — How to submit */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-primary/70" />
                <h2 className="text-base font-semibold text-foreground">
                  {isUk ? "3. Як надіслати повідомлення" : "3. How to Submit a Notice"}
                </h2>
              </div>
              <p className="text-muted-foreground mb-3">
                {isUk
                  ? "Надішліть повідомлення через нашу форму зворотного зв'язку, вказавши тему «Copyright»:"
                  : "Send your takedown notice via our contact form, selecting «Copyright» as the topic:"}
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary text-sm font-mono hover:bg-primary/10 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                {isUk ? "Відкрити форму контакту" : "Open Contact Form"}
              </Link>
            </section>

            {/* Section 4 — Counter notice */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                {isUk ? "4. Зустрічне повідомлення (Counter-Notice)" : "4. Counter-Notice Procedure"}
              </h2>
              <p className="text-muted-foreground">
                {isUk
                  ? "Якщо ваш матеріал було видалено помилково або через неправильну ідентифікацію, ви можете надіслати зустрічне повідомлення відповідно до 17 U.S.C. § 512(g)(3). Зустрічне повідомлення повинно містити: вашу ідентифікацію та контакти, ідентифікацію видаленого матеріалу, заяву під страхом покарання та вашу згоду з юрисдикцією."
                  : "If your material was removed due to mistake or misidentification, you may submit a counter-notice under 17 U.S.C. § 512(g)(3). A valid counter-notice must include: your identification and contact info, identification of the removed material, a statement under penalty of perjury that removal was a mistake, and consent to jurisdiction."}
              </p>
            </section>

            {/* Section 5 — Processing time */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-primary/70" />
                <h2 className="text-base font-semibold text-foreground">
                  {isUk ? "5. Строки обробки" : "5. Processing Time"}
                </h2>
              </div>
              <p className="text-muted-foreground">
                {isUk
                  ? "Ми обробляємо дійсні повідомлення DMCA та видаляємо відповідний контент протягом 5 робочих днів. Повторні порушники можуть бути заблоковані відповідно до нашої repeat infringer policy."
                  : "We process valid DMCA takedown notices and remove the relevant content within 5 business days. Repeat infringers may be blocked in accordance with our repeat infringer policy."}
              </p>
            </section>

            {/* Section 6 — Disclaimer */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                {isUk ? "6. Відмова від відповідальності" : "6. Disclaimer"}
              </h2>
              <p className="text-muted-foreground">
                {isUk
                  ? "Hronovs / BraveNow є автоматизованим агрегатором новин. Контент надається з відкритих RSS-джерел і посилається на оригінальні матеріали. Повторна публікація здійснюється виключно в інформаційних цілях відповідно до принципів добросовісного використання (fair use)."
                  : "Hronovs / BraveNow is an automated news aggregator. Content is sourced from public RSS feeds and links back to original materials. Republication is done solely for informational purposes under fair use principles."}
              </p>
            </section>

            <p className="pt-4 text-xs text-muted-foreground/50 border-t border-border/30">
              {isUk
                ? "Ця сторінка відповідає Закону про авторське право в цифрову епоху (Digital Millennium Copyright Act), 17 U.S.C. § 512. Останнє оновлення: лютий 2026."
                : "This page complies with the Digital Millennium Copyright Act, 17 U.S.C. § 512. Last updated: February 2026."}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

