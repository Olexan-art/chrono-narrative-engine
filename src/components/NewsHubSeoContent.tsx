import { Globe, Newspaper, BarChart3, Flag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function NewsHubSeoContent() {
  return (
    <section className="mt-16 pt-12 border-t border-border/30">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
          Smart News Hub
        </h2>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          World News Digest: The Pulse of Reality
        </p>
      </div>

      {/* Main Description */}
      <div className="max-w-4xl mx-auto mb-12">
        <Card className="cosmic-card overflow-hidden bg-gradient-to-br from-card/50 to-background border-primary/10">
          <CardContent className="p-6 md:p-8">
            <p className="text-base md:text-lg leading-relaxed text-foreground/90 mb-6">
              Welcome to the news section of <span className="text-primary font-semibold">Synchronization Point</span> — a place where the history of the present is recorded. We collect and structure the most important events from four key regions of the world, creating the foundation for a unique Archive of Human History.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Newspaper className="w-4 h-4 text-primary" />
              <span>Real facts and structured updates for the Archive of Human History</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* What You'll Find */}
      <div className="mb-12">
        <h3 className="text-xl md:text-2xl font-bold mb-6 text-center">
          What will you find in our digest?
        </h3>
        <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          Our platform offers more than just a standard news feed. It is a starting point where the chaos of the real world is transformed into structured, accessible data.
        </p>
      </div>

      {/* Two Column Features */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Global Coverage */}
        <Card className="cosmic-card group hover:border-primary/30 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-lg font-bold">🌍 Global Coverage</h4>
            </div>
            <p className="text-muted-foreground mb-4">
              We focus on events that shape the geopolitical and cultural landscape in the following regions:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-xl">🇺🇸</span>
                <div>
                  <span className="font-semibold text-foreground">USA:</span>
                  <span className="text-muted-foreground"> Politics, technological breakthroughs, and events impacting the entire world.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">🇺🇦</span>
                <div>
                  <span className="font-semibold text-foreground">Ukraine:</span>
                  <span className="text-muted-foreground"> Current events, frontline updates, and societal changes.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">🇵🇱</span>
                <div>
                  <span className="font-semibold text-foreground">Poland:</span>
                  <span className="text-muted-foreground"> News from the European neighborhood and significant regional shifts.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">🇮🇳</span>
                <div>
                  <span className="font-semibold text-foreground">India:</span>
                  <span className="text-muted-foreground"> Insights into events from one of Asia's most dynamic economies.</span>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Structured Archive */}
        <Card className="cosmic-card group hover:border-primary/30 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-lg font-bold">📊 Structured Archive</h4>
            </div>
            <p className="text-muted-foreground mb-6">
              Keep track of the timeline of events with our user-friendly navigation. Our system organizes the flow of information, allowing you to easily browse news by country and category.
            </p>
            <div className="mt-auto pt-4 border-t border-border/50">
              <p className="text-sm text-primary font-medium italic">
                Stay informed on events that will become history tomorrow.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
