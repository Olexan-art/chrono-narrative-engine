import { useState, useEffect } from "react";
import { LocalNewsPanel } from "@/components/admin/LocalNewsPanel";
import { AdminLogin } from "@/components/AdminLogin";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ChevronLeft, Zap } from "lucide-react";
import { useAdminStore } from "@/stores/adminStore";

const LocalNewsPage = () => {
    const { password, setPassword } = useAdminStore();

    if (!password) {
        return <AdminLogin onLogin={setPassword} />;
    }

    return (
        <div className="min-h-screen bg-background text-foreground bg-grid-white/[0.02]">
            <SEOHead title="Локальні Новини та Scoring (Dev)" />
            <Header />

            <main className="container mx-auto px-4 py-8 space-y-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                            Адмінка
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight text-glow flex items-center gap-3">
                            <Zap className="w-8 h-8 text-blue-500" />
                            Локальні Новини та Scoring (Dev)
                        </h1>
                        <p className="text-muted-foreground italic font-mono text-sm max-w-2xl">
                            Модуль для генерації Source Scoring та Deep Analysis новин через локально запущені LLM (Ollama, LM Studio).
                        </p>
                    </div>
                </div>

                <div className="cosmic-card-container">
                    <LocalNewsPanel password={password} />
                </div>
            </main>
        </div>
    );
};

export default LocalNewsPage;
