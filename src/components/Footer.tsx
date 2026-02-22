import { Link } from "react-router-dom";
import { BookOpen, Globe, Palette, Calendar, Users, Hash, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { Logo } from "@/components/Logo";

export function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-[#030711]/95 backdrop-blur-md transition-colors duration-300">
      <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <Logo className="transition-transform duration-300 group-hover:scale-[1.02]" />
        </Link>

        <nav className="flex flex-wrap items-center gap-2 justify-center">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{t("nav.read")}</span>
            </Button>
          </Link>
          <Link to="/news-digest">
            <Button variant="ghost" size="sm" className="gap-2">
              <Globe className="w-4 h-4" />
              <span>{t("nav.newsdigest")}</span>
            </Button>
          </Link>
          <Link to="/ink-abyss">
            <Button variant="ghost" size="sm" className="gap-2">
              <Palette className="w-4 h-4" />
              <span>Ink Abyss</span>
            </Button>
          </Link>
          <Link to="/media-calendar">
            <Button variant="ghost" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span>{t('nav.calendar')}</span>
            </Button>
          </Link>
          <Link to="/wiki">
            <Button variant="ghost" size="sm" className="gap-2">
              <Users className="w-4 h-4" />
              <span>Wiki</span>
            </Button>
          </Link>
          <Link to="/topics">
            <Button variant="ghost" size="sm" className="gap-2">
              <Hash className="w-4 h-4" />
              <span>Topics</span>
            </Button>
          </Link>
          <Link to="/contact">
            <Button variant="ghost" size="sm" className="gap-2">
              <Mail className="w-4 h-4" />
              <span>{t('nav.contact')}</span>
            </Button>
          </Link>
        </nav>

        <div className="mt-2 md:mt-0">
          <LanguageSwitcher />
        </div>
      </div>
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground font-mono py-2">
        {t('footer.style')} © {year}
      </div>
    </footer>
  );
}
