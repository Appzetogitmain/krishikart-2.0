import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useFranchiseAuth } from '@/modules/franchise/contexts/FranchiseAuthContext';

export default function FranchiseAuthGuard() {
    const { isAuthenticated, loading } = useFranchiseAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafd]">
                <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checking your login...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/franchise/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
