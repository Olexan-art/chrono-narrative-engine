import { BookOpen, Calendar, Clock, Sparkles, Library } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="p-2 bg-primary/10 border border-primary/30 group-hover:border-glow transition-all">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-lg tracking-tight text-foreground">
              Точка Синхронізації
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              AI-АРХІВ ЛЮДСЬКОЇ ІСТОРІЇ
            </p>
          </div>
        </Link>
        
        <nav className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Читати</span>
            </Button>
          </Link>
          <Link to="/volumes">
            <Button variant="ghost" size="sm" className="gap-2">
              <Library className="w-4 h-4" />
              <span className="hidden sm:inline">Томи</span>
            </Button>
          </Link>
          <Link to="/calendar">
            <Button variant="ghost" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Календар</span>
            </Button>
          </Link>
          <Link to="/admin">
            <Button variant="outline" size="sm" className="gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Адмінка</span>
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
