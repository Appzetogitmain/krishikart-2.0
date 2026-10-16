import { Navigate, Outlet, useLocation as useRouterLocation } from 'react-router-dom';
import { useUserAuth } from '@/modules/user/contexts/UserAuthContext';
import { useLocation as useShoppingLocation } from '@/modules/user/contexts/LocationContext';

// Pages that work without a location: the picker itself, and plain information pages
const OPEN_PATHS = ['/location-picker', '/help-support', '/about'];

/**
 * Location comes first: every customer, logged in or guest, needs a shopping location before
 * browsing, because prices and stock come from the nearest franchise to that location. If
 * the app could not get GPS on its own, the customer is sent to the map picker and brought back.
 */
export default function ShoppingLocationGate() {
    const routerLocation = useRouterLocation();
    const { loading: authLoading } = useUserAuth();
    const shopping = useShoppingLocation();

    if (authLoading) return <Outlet />;
    if (OPEN_PATHS.includes(routerLocation.pathname)) return <Outlet />;

    if (!shopping?.isLocationReady) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[11px] font-bold text-slate-500">Finding your location...</p>
            </div>
        );
    }

    if (!shopping.hasFranchisePinned) {
        const returnTo = `${routerLocation.pathname}${routerLocation.search}`;
        return (
            <Navigate
                to={`/location-picker?type=franchise&returnTo=${encodeURIComponent(returnTo)}`}
                replace
            />
        );
    }

    return <Outlet />;
}
