import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useUserAuth } from '@/modules/user/contexts/UserAuthContext';

export default function UserAuthGuard() {
    const { isAuthenticated, loading } = useUserAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-white shadow-inner">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
