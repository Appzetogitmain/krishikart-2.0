import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useDeliveryAuth } from '@/modules/delivery/contexts/DeliveryAuthContext';

export default function DeliveryAuthGuard() {
    const { isAuthenticated, loading } = useDeliveryAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-blue-50">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checking your login...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/delivery/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
