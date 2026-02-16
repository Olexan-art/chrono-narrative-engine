import { useAdminStore } from "@/stores/adminStore";
import { AdminLogin } from "@/components/AdminLogin";
import { Outlet } from "react-router-dom";

export function AdminGuard() {
    const { isAuthenticated, setPassword, setAuthenticated } = useAdminStore();

    const handleLogin = (pwd: string) => {
        setPassword(pwd);
        setAuthenticated(true);
    };

    if (!isAuthenticated) {
        return <AdminLogin onLogin={handleLogin} />;
    }

    return <Outlet />;
}
