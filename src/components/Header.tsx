import { useState } from "react";
import { BookOpen, Clock, Menu, X, Globe, Palette, Calendar, Users, Bot, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

import { Logo } from "@/components/Logo";

export function Header() {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-border/40 bg-[#030711]/95 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <Logo className="transition-transform duration-300 group-hover:scale-[1.02]" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
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
          <LanguageSwitcher />
        </nav>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSwitcher />
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-sm">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
            <Link to="/" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <BookOpen className="w-4 h-4" />
                {t("nav.read")}
              </Button>
            </Link>
            <Link to="/news-digest" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Globe className="w-4 h-4" />
                {t("nav.newsdigest")}
              </Button>
            </Link>
            <Link to="/ink-abyss" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Palette className="w-4 h-4" />
                Ink Abyss
              </Button>
            </Link>
            <Link to="/media-calendar" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Calendar className="w-4 h-4" />
                {t('nav.calendar')}
              </Button>
            </Link>
            <Link to="/wiki" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Users className="w-4 h-4" />
                Wiki
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
