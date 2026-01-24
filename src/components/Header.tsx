import { useState } from "react";
import { BookOpen, Calendar, Clock, Sparkles, Library, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

export function Header() {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 md:gap-3 group">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded overflow-hidden border border-primary/30 group-hover:border-primary transition-all">
            <img src="/favicon.png" alt="SP" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-base md:text-lg tracking-tight text-foreground">
              {t("hero.title")}
            </h1>
            <p className="text-[10px] md:text-xs text-muted-foreground font-mono hidden sm:block">
              {t("header.subtitle")}
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{t("nav.read")}</span>
            </Button>
          </Link>
          <Link to="/volumes">
            <Button variant="ghost" size="sm" className="gap-2">
              <Library className="w-4 h-4" />
              <span>{t("nav.volumes")}</span>
            </Button>
          </Link>
          <Link to="/calendar">
            <Button variant="ghost" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span>{t("nav.calendar")}</span>
            </Button>
          </Link>
          <LanguageSwitcher />
          {/*    <Link to="/admin">
            <Button variant="outline" size="sm" className="gap-2">
              <Clock className="w-4 h-4" />
              <span>{t('nav.admin')}</span>
            </Button>
          </Link>*/}
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
            <Link to="/volumes" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Library className="w-4 h-4" />
                {t("nav.volumes")}
              </Button>
            </Link>
            <Link to="/calendar" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Calendar className="w-4 h-4" />
                {t("nav.calendar")}
              </Button>
            </Link>
            <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-start gap-3 mt-2">
                <Clock className="w-4 h-4" />
                {t("nav.admin")}
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
