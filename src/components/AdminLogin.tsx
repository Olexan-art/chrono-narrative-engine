import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { adminAction } from "@/lib/api";

interface AdminLoginProps {
    onLogin: (password: string) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await adminAction('verify', password);
            onLogin(password);
            toast({ title: "Авторизація успішна" });
        } catch (error) {
            toast({
                title: "Помилка",
                description: "Невірний пароль",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md cosmic-card">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 border border-primary/30 flex items-center justify-center mb-4 rounded-full bg-primary/5">
                        <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="chapter-title tracking-wider">АДМІН ПАНЕЛЬ</CardTitle>
                    <CardDescription className="font-mono text-xs text-primary/70">
                        ТОЧКА СИНХРОНІЗАЦІЇ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Пароль доступу</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Введіть ключ доступу"
                                className="font-mono text-center tracking-widest"
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {isLoading ? "Перевірка..." : "Увійти в систему"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
