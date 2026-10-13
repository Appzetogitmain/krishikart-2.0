import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useVendorAuth } from '@/modules/vendor/contexts/VendorAuthContext';
import { Loader2 } from 'lucide-react';

export default function VendorAuthGuard() {
    const { isAuthenticated, loading } = useVendorAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checking your login...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/vendor/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
