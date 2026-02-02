import { useState, useEffect } from "react";
import { X, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "gdpr_consent";

export function GDPRConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay to not block initial render
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Cookie className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            We use cookies to improve your experience. By continuing, you agree to our{" "}
            <a href="/privacy" className="text-primary hover:underline">privacy policy</a>.
          </p>
          <button
            onClick={handleDecline}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDecline}
            className="h-7 text-xs px-2"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="h-7 text-xs px-3"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
