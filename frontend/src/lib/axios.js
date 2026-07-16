
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    let token = null;

    const requestUrl = config.url.toLowerCase();
    const currentPath = (window.location.hash ? window.location.hash.replace(/^#/, '') : window.location.pathname).toLowerCase();

    // Determine context based on URL or current page
    const isAdminRequest = requestUrl.includes('/masteradmin') || requestUrl.includes('/admin') || (requestUrl.includes('/procurement') && !requestUrl.includes('/franchise'));
    const isFranchiseRequest = requestUrl.includes('/franchise');
    const isVendorRequest = requestUrl.includes('/vendor');
    const isDeliveryRequest = requestUrl.includes('/delivery');

    const isAdminContext = currentPath.includes('/masteradmin');
    const isFranchiseContext = currentPath.includes('/franchise');
    const isVendorContext = currentPath.includes('/vendor');
    const isDeliveryContext = currentPath.includes('/delivery');

    // Unified path for selection logic
    const path = isAdminRequest || isFranchiseRequest || isVendorRequest || isDeliveryRequest
        ? requestUrl
        : currentPath;

    // Priority 1: Current browser context (Strictly bind tokens to the portal the user is visiting)
    if (currentPath.startsWith('/masteradmin')) {
        token = localStorage.getItem('masterAdminToken');
    } else if (currentPath.startsWith('/vendor')) {
        token = localStorage.getItem('vendorToken');
    } else if (currentPath.startsWith('/franchise')) {
        token = localStorage.getItem('franchiseToken');
    } else if (currentPath.startsWith('/delivery')) {
        token = localStorage.getItem('deliveryToken');
    } else if (currentPath.includes('/procurement')) { // Added procurement context
        token = localStorage.getItem('masterAdminToken'); // Procurement uses admin token
    }

    // Priority 2: Request URL (Fallback for neutral pages or cross-module components on neutral pages)
    if (!token) {
        // Only use cross-module tokens if we AREN'T in a conflicting module context
        if (isAdminRequest) {
            token = localStorage.getItem('masterAdminToken');
        } else if (isVendorRequest) {
            token = localStorage.getItem('vendorToken');
        } else if (isFranchiseRequest) {
            token = localStorage.getItem('franchiseToken');
        } else if (isDeliveryRequest) {
            token = localStorage.getItem('deliveryToken');
        } else {
            token = localStorage.getItem('userToken');
        }
    }

    // EXTRA SECURITY: Never send a Master Admin token to a Vendor-specific dashboard path
    if (token && currentPath.startsWith('/vendor') && token === localStorage.getItem('masterAdminToken') && !isAdminRequest) {
        token = localStorage.getItem('vendorToken');
    }

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const currentPath = (window.location.hash ? window.location.hash.replace(/^#/, '') : window.location.pathname).toLowerCase();
            const requestUrl = String(error.config?.url || '').toLowerCase();

            // Only wipe token if we are actually in that section of the app
            if (currentPath.startsWith('/masteradmin') && !currentPath.includes('/login')) {
                localStorage.removeItem('masterAdminToken');
                localStorage.removeItem('masterAdminData');
                // Optional: redirect to login if session is truly dead
                // window.location.href = '/masteradmin/login';
            } else if (currentPath.startsWith('/franchise')) {
                /**
                 * IMPORTANT:
                 * Do NOT auto-wipe franchise auth on every 401.
                 * A single unrelated 401 (validation, permissions, wrong endpoint, etc.)
                 * would otherwise delete `franchiseToken` and cause refresh → login loops.
                 *
                 * Franchise session validity is enforced by `GET /franchise/me`
                 * in `FranchiseAuthContext`, which will clean up and redirect only
                 * when the token is actually invalid/expired.
                 */
                if (requestUrl.includes('/franchise/me')) {
                    localStorage.removeItem('franchiseToken');
                    localStorage.removeItem('franchiseData');
                }
            } else if (currentPath.startsWith('/vendor')) {
                localStorage.removeItem('vendorToken');
                localStorage.removeItem('vendorData');
            } else if (currentPath.startsWith('/delivery')) {
                // Same principle as franchise: only clear auth when session validation fails.
                // Otherwise any unrelated 401 would wipe auth and cause refresh → login loops.
                if (requestUrl.includes('/delivery/me')) {
                    localStorage.removeItem('deliveryToken');
                    localStorage.removeItem('deliveryData');
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
