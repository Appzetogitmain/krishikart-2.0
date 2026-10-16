import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getCurrentLocation, getGeolocationPermissionState, reverseGeocode, reverseGeocodeWithComponents } from '@/lib/geo';

const LocationContext = createContext();

// Moving further than this from the saved shopping location switches to the new spot
const GPS_MOVE_THRESHOLD_KM = 1;

/** Straight-line distance in km between two { lat, lng } points (haversine). */
function distanceKm(a, b) {
    const lat1 = Number(a?.lat), lng1 = Number(a?.lng), lat2 = Number(b?.lat), lng2 = Number(b?.lng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const isPermissionDeniedError = (message = '') => {
    const normalizedMessage = String(message).toLowerCase();
    return normalizedMessage.includes('denied') || normalizedMessage.includes('permission');
};

/**
 * LocationProvider now tracks TWO independent locations:
 * - franchiseLocation: used on Home to find nearest franchise / serviceability
 * - deliveryLocation: precise drop address used during checkout
 *
 * For backwards compatibility:
 * - location/address refer to franchise* values.
 */
export function LocationProvider({ children }) {
    // Nearest-franchise level location (used across browsing)
    const [franchiseLocation, setFranchiseLocation] = useState(null);
    const [franchiseAddress, setFranchiseAddress] = useState(null);
    const [hasFranchisePinned, setHasFranchisePinned] = useState(false);

    // Delivery drop location (accurate pin from map)
    const [deliveryLocation, setDeliveryLocation] = useState(null);
    const [deliveryAddress, setDeliveryAddress] = useState(null);
    const [deliveryAddressComponents, setDeliveryAddressComponents] = useState(null);
    const [hasDeliveryPinned, setHasDeliveryPinned] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // True once the start-up check (saved location, then live GPS) has finished, so screens
    // that need a location don't act on the empty state while GPS is still being looked up
    const [isLocationReady, setIsLocationReady] = useState(false);

    // Background GPS re-check against the saved location. Only a real move (more than
    // GPS_MOVE_THRESHOLD_KM) replaces it, so normal GPS drift doesn't reload the catalogue.
    const refreshFromGps = async (saved) => {
        try {
            if ((await getGeolocationPermissionState()) === 'denied') return;
            const loc = await getCurrentLocation();
            if (distanceKm(saved, loc) > GPS_MOVE_THRESHOLD_KM) {
                await setPinnedFranchiseLocation({ lat: loc.lat, lng: loc.lng });
            }
        } catch {
            // GPS unavailable: keep the saved location
        }
    };

    // On mount: always try live GPS first, fall back to localStorage only if GPS fails/denied
    useEffect(() => {
        const init = async () => {
            // Clear the "declined" flag so the location popup can show again on next visit
            localStorage.removeItem('kk_location_declined');

            // Always load delivery location from localStorage (user explicitly pinned it)
            const savedDelLoc = localStorage.getItem('kk_delivery_location');
            const savedDelAddr = localStorage.getItem('kk_delivery_address');
            const savedDelComp = localStorage.getItem('kk_delivery_address_components');
            const savedDelPinned = localStorage.getItem('kk_delivery_location_pinned');
            if (savedDelLoc) setDeliveryLocation(JSON.parse(savedDelLoc));
            if (savedDelAddr) setDeliveryAddress(savedDelAddr);
            if (savedDelComp) setDeliveryAddressComponents(JSON.parse(savedDelComp));
            if (savedDelPinned === 'true') setHasDeliveryPinned(true);

            // For franchise/browsing location: 
            // 1. Try localStorage first (Sticky location)
            const savedFrLoc = localStorage.getItem('kk_franchise_location');
            const savedFrAddr = localStorage.getItem('kk_franchise_address');
            const savedFrPinned = localStorage.getItem('kk_franchise_location_pinned');

            if (savedFrLoc && savedFrAddr) {
                const saved = JSON.parse(savedFrLoc);
                setFranchiseLocation(saved);
                setFranchiseAddress(savedFrAddr);
                if (savedFrPinned === 'true') setHasFranchisePinned(true);
                // Show the saved location straight away, then re-check GPS in the background on
                // every open so a customer who has moved sees their new nearest franchise.
                refreshFromGps(saved);
                return;
            }

            // 2. No saved location? Try live GPS
            const permState = await getGeolocationPermissionState();
            if (permState !== 'denied') {
                try {
                    setLoading(true);
                    const loc = await getCurrentLocation();
                    await setPinnedFranchiseLocation({ lat: loc.lat, lng: loc.lng });
                    return; 
                } catch {
                    // GPS failed — fall through
                } finally {
                    setLoading(false);
                }
            }
        };

        init().finally(() => setIsLocationReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setPinnedFranchiseLocation = useCallback(async (loc) => {
        if (!loc) return;

        const { lat, lng } = loc;
        const normalized = { lat, lng };
        setFranchiseLocation(normalized);
        localStorage.setItem('kk_franchise_location', JSON.stringify(normalized));

        let finalAddr = loc.address;
        if (!finalAddr) {
            const addr = await reverseGeocode(lat, lng);
            finalAddr = addr || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }

        setFranchiseAddress(finalAddr);
        localStorage.setItem('kk_franchise_address', finalAddr);

        setHasFranchisePinned(true);
        localStorage.setItem('kk_franchise_location_pinned', 'true');

        // Always sync with delivery location when the user explicitly changes their pinned location.
        // This ensures the checkout page reflects the location they are browsing in.
        setDeliveryLocation(normalized);
        setDeliveryAddress(finalAddr);
        setHasDeliveryPinned(true);
        localStorage.setItem('kk_delivery_location', JSON.stringify(normalized));
        localStorage.setItem('kk_delivery_address', finalAddr);
        localStorage.setItem('kk_delivery_location_pinned', 'true');
        
        // Also try to get components for structured address
        if (loc.addressComponents) {
            setDeliveryAddressComponents(loc.addressComponents);
            localStorage.setItem('kk_delivery_address_components', JSON.stringify(loc.addressComponents));
        } else {
            reverseGeocodeWithComponents(lat, lng).then(res => {
                if (res) {
                    setDeliveryAddressComponents(res.addressComponents);
                    localStorage.setItem('kk_delivery_address_components', JSON.stringify(res.addressComponents));
                }
            });
        }
    }, []);

    const setPinnedDeliveryLocation = useCallback(async (loc) => {
        if (!loc) return;

        const { lat, lng } = loc;
        const normalized = { lat, lng };
        setDeliveryLocation(normalized);
        localStorage.setItem('kk_delivery_location', JSON.stringify(normalized));

        let res = null;
        if (loc.address && loc.addressComponents) {
            res = { formattedAddress: loc.address, addressComponents: loc.addressComponents };
        } else {
            res = await reverseGeocodeWithComponents(lat, lng);
        }

        let finalAddr = '';
        if (res) {
            finalAddr = res.formattedAddress;
            setDeliveryAddress(finalAddr);
            setDeliveryAddressComponents(res.addressComponents);
            localStorage.setItem('kk_delivery_address', finalAddr);
            localStorage.setItem('kk_delivery_address_components', JSON.stringify(res.addressComponents));
        } else {
            finalAddr = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            setDeliveryAddress(finalAddr);
            setDeliveryAddressComponents(null);
            localStorage.setItem('kk_delivery_address', finalAddr);
        }

        setHasDeliveryPinned(true);
        localStorage.setItem('kk_delivery_location_pinned', 'true');

        // Sync back to franchise/browsing location
        setFranchiseLocation(normalized);
        setFranchiseAddress(finalAddr);
        setHasFranchisePinned(true);
        localStorage.setItem('kk_franchise_location', JSON.stringify(normalized));
        localStorage.setItem('kk_franchise_address', finalAddr);
        localStorage.setItem('kk_franchise_location_pinned', 'true');
    }, []);

    /**
     * Auto-detect current location (used primarily for franchiseLocation).
     * We still allow this as a helper, but mandatory flows should drive the user
     * through the map picker and call setPinnedFranchiseLocation / setPinnedDeliveryLocation.
     */
    const updateFranchiseLocation = useCallback(async (manual = false) => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const loc = await getCurrentLocation();
            await setPinnedFranchiseLocation({ lat: loc.lat, lng: loc.lng });
        } catch (err) {
            setError(err.message);
            if (!isPermissionDeniedError(err?.message)) {
                console.error('Location error:', err);
            }
            if (manual) throw err;
        } finally {
            setLoading(false);
        }
    }, [loading, setPinnedFranchiseLocation]);

    const updateDeliveryLocation = useCallback(async (manual = false) => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const loc = await getCurrentLocation();
            await setPinnedDeliveryLocation({ lat: loc.lat, lng: loc.lng });
        } catch (err) {
            setError(err.message);
            if (!isPermissionDeniedError(err?.message)) {
                console.error('Location error:', err);
            }
            if (manual) throw err;
        } finally {
            setLoading(false);
        }
    }, [loading, setPinnedDeliveryLocation]);

    // Backwards-compat alias
    const location = franchiseLocation;
    const address = franchiseAddress;

    const value = useMemo(() => ({
        // legacy consumers (home header etc.)
        location,
        address,

        // explicit franchise fields
        franchiseLocation,
        franchiseAddress,
        hasFranchisePinned,
        setPinnedFranchiseLocation,
        updateFranchiseLocation,

        // delivery fields
        deliveryLocation,
        deliveryAddress,
        deliveryAddressComponents,
        hasDeliveryPinned,
        setPinnedDeliveryLocation,
        updateDeliveryLocation,

        loading,
        error,
        isLocationReady,
    }), [
        isLocationReady,
        location,
        address,
        franchiseLocation,
        franchiseAddress,
        hasFranchisePinned,
        updateFranchiseLocation,
        deliveryLocation,
        deliveryAddress,
        deliveryAddressComponents,
        hasDeliveryPinned,
        loading,
        error,
        setPinnedFranchiseLocation,
        setPinnedDeliveryLocation,
        updateDeliveryLocation,
    ]);

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
}

export const useLocation = () => useContext(LocationContext);
