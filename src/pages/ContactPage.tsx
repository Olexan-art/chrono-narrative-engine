import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Lock, Handshake, Megaphone, Wrench, Globe, MessageCircle } from "lucide-react";

const TOPICS = [
  { id: "copyright",    icon: Lock,          en: "Copyright",     uk: "Авторські права" },
  { id: "partnership",  icon: Handshake,     en: "Partnership",   uk: "Партнерство"    },
  { id: "advertising",  icon: Megaphone,     en: "Advertising",   uk: "Реклама"        },
  { id: "technical",    icon: Wrench,        en: "Technical",     uk: "Технічне"       },
  { id: "cooperation",  icon: Globe,         en: "Cooperation",   uk: "Співпраця"      },
  { id: "other",        icon: MessageCircle, en: "Other",         uk: "Інше"           },
];

export default function ContactPage() {
  const { language } = useLanguage();
  const t = (en: string, uk: string) => (language === "uk" ? uk : en);

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bot trap
  const [loading, setLoading]  = useState(false);
  const [success, setSuccess]  = useState(false);
  const [error, setError]      = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot: if filled, it's a bot — silently succeed
    if (honeypot) {
      setSuccess(true);
      return;
    }

    if (!selectedTopic) {
      setError(t("Please select a topic", "Оберіть тему"));
      return;
    }
    if (!message.trim()) {
      setError(t("Message is required", "Повідомлення обов'язкове"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from("contact_submissions")
        .insert({
          topic:             selectedTopic,
          name:              name.trim() || null,
          email:             email.trim() || null,
          message:           message.trim(),
          user_agent:        navigator.userAgent,
          referrer:          document.referrer || null,
          language:          navigator.language,
          screen_resolution: `${screen.width}x${screen.height}`,
          timezone:          Intl.DateTimeFormat().resolvedOptions().timeZone,
          status:            "new",
        });

      if (insertError) throw insertError;

      setSuccess(true);
      // Rate-limit: disable for 60 s
      setCooldown(true);
      cooldownTimer.current = setTimeout(() => setCooldown(false), 60_000);
    } catch (err) {
      setError(t("Failed to send. Please try again.", "Помилка надсилання. Спробуйте ще раз."));
      console.error("Contact submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title={t("Contact Us — Hronovs", "Зворотній зв'язок — Hronovs")}
        description={t(
          "Contact the Hronovs team with any questions, partnership proposals or technical issues.",
          "Зв'яжіться з командою Hronovs з будь-якими питаннями, пропозиціями партнерства або технічними проблемами."
        )}
      />
      <Header />
      <main className="min-h-[calc(100vh-128px)] bg-background text-foreground">
        <div className="container mx-auto max-w-2xl px-4 py-12">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            {t("Contact Us", "Зворотній зв'язок")}
          </h1>
          <p className="mb-8 text-muted-foreground">
            {t(
              "Select a topic and fill in the form — we'll get back to you as soon as possible.",
              "Оберіть тему та заповніть форму — ми зв'яжемося з вами якнайшвидше."
            )}
          </p>

          {success ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-green-500/30 bg-green-500/10 p-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
              <p className="text-lg font-semibold text-green-400">
                {t("Message sent!", "Повідомлення надіслано!")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Thank you for reaching out. We'll reply shortly.",
                  "Дякуємо за звернення. Ми відповімо найближчим часом."
                )}
              </p>
              {!cooldown && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSuccess(false);
                    setSelectedTopic(null);
                    setName("");
                    setEmail("");
                    setMessage("");
                  }}
                >
                  {t("Send another", "Надіслати ще")}
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ── Topic Bricks ── */}
              <div>
                <Label className="mb-3 block text-sm font-medium">
                  {t("Topic *", "Тема *")}
                </Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {TOPICS.map(({ id, icon: Icon, en, uk }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedTopic(id)}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150
                        ${
                          selectedTopic === id
                            ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20"
                            : "border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 text-muted-foreground"
                        }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {language === "uk" ? uk : en}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Name ── */}
              <div>
                <Label htmlFor="contact-name" className="mb-1.5 block text-sm">
                  {t("Name (optional)", "Ім'я (необов'язково)")}
                </Label>
                <Input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Your name", "Ваше ім'я")}
                  autoComplete="name"
                />
              </div>

              {/* ── Email ── */}
              <div>
                <Label htmlFor="contact-email" className="mb-1.5 block text-sm">
                  {t("Email (optional)", "Email (необов'язково)")}
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("you@example.com", "you@example.com")}
                  autoComplete="email"
                />
              </div>

              {/* ── Message ── */}
              <div>
                <Label htmlFor="contact-message" className="mb-1.5 block text-sm">
                  {t("Message *", "Повідомлення *")}
                </Label>
                <Textarea
                  id="contact-message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("Describe your request...", "Опишіть ваш запит...")}
                  required
                  className="resize-y"
                />
              </div>

              {/* ── Honeypot (hidden from humans) ── */}
              <div aria-hidden="true" className="hidden" tabIndex={-1}>
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || cooldown}
                className="w-full gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("Sending...", "Надсилання...")}
                  </>
                ) : (
                  t("Send Message", "Надіслати")
                )}
              </Button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
