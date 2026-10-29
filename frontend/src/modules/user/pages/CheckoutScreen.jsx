import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    MapPin,
    ChevronRight,
    Clock,
    Sparkles,
    Wallet,
    ShieldCheck,
    Check,
    Loader2,
    X,
    Edit3,
    CreditCard,
    QrCode,
    Ticket,
    CheckCircle2,
    Percent,
    LocateFixed,
    CalendarDays,
    ArrowRight
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'
import { useCart } from '../contexts/CartContext'
import { useOrders } from '@/modules/user/contexts/OrderContext'
import { useWallet } from '../contexts/WalletContext'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import api from '@/lib/axios'
import { toast } from 'sonner'
import { geocodeAddressFrontend, fetchAddressSuggestions, geocodePlaceId, getCurrentLocation, reverseGeocodeWithComponents } from '@/lib/geo'
import { useLocation } from '../contexts/LocationContext'

import {
    ADDRESS_TAGS,
    buildFullAddress,
    EMPTY_ADDRESS_DETAILS,
    fetchSavedAddresses,
    saveSavedAddresses,
    sortByRecent,
    upsertAddressByTag as upsertSavedAddress,
} from '../utils/savedAddresses'

/** Start time of each delivery window (local time). Only slots whose window hasn't started yet are selectable. */
const DELIVERY_SHIFT_SLOTS = [
    { label: '6 AM - 8 AM', start: [6, 0] },
    { label: '8 AM - 10 AM', start: [8, 0] },
    { label: '10 AM - 12 PM', start: [10, 0] },
    { label: '12 PM - 2 PM', start: [12, 0] },
    { label: '2 PM - 4 PM', start: [14, 0] },
    { label: '4 PM - 6 PM', start: [16, 0] },
    { label: '6 PM - 8 PM', start: [18, 0] }
]

function getISTDate(date = new Date()) {
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
}

function getShiftStartDate(shiftLabel, baseDate = new Date()) {
    const slot = DELIVERY_SHIFT_SLOTS.find((s) => s.label === shiftLabel)
    if (!slot) return null
    const d = new Date(baseDate)
    d.setHours(slot.start[0], slot.start[1], 0, 0)
    return d
}

/** True if this slot can be selected. Before 6 PM: only future windows. From 6 PM onward: all slots (e.g. next-day). */
function isDeliveryShiftSelectable(shiftLabel, targetDate, now = new Date()) {
    if (!targetDate) return true;
    
    const nowIST = getISTDate(now);
    // targetDate already holds IST wall-clock values (see getNext7Days), so don't shift it again
    const tDateIST = new Date(targetDate);
    
    // Normalize dates to midnight in IST for comparison
    tDateIST.setHours(0, 0, 0, 0);
    
    const todayIST = new Date(nowIST);
    todayIST.setHours(0, 0, 0, 0);

    // If target date is in the future, all shifts are selectable
    if (tDateIST.getTime() > todayIST.getTime()) {
        return true;
    }

    // If target date is in the past, no shifts are selectable
    if (tDateIST.getTime() < todayIST.getTime()) {
        return false;
    }

    // It's today
    const hour = nowIST.getHours();
    // From 6 PM (18:00) onwards — no slots selectable for today. Next-day slots open (handled by startOffset in getNext7Days)
    if (hour >= 18) {
        return false;
    }
    
    const start = getShiftStartDate(shiftLabel, nowIST);
    if (!start) return false;
    return nowIST.getTime() < start.getTime();
}

/** "YYYY-MM-DD" of a date strip entry (entries hold IST wall-clock values). */
const toDayKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Why there is no delivery on this day (admin holiday or weekly off), or null when it's open. */
function getOffDayReason(date, offDays) {
    if (!date || !offDays) return null;
    const holiday = (offDays.dates || []).find((h) => h.date === toDayKey(date));
    // A half day (only some slots closed) keeps the day open
    if (holiday && !(holiday.closedSlots || []).length) return holiday.reason?.trim() || 'Holiday';
    if ((offDays.weeklyOff || []).map(Number).includes(date.getDay())) return 'Weekly off';
    return null;
}

/** Half day: { reason, slots } when the admin closed only some slots on this day, else null. */
function getPartDay(date, offDays) {
    if (!date || !offDays) return null;
    const holiday = (offDays.dates || []).find((h) => h.date === toDayKey(date));
    if (!holiday || !(holiday.closedSlots || []).length) return null;
    return { reason: holiday.reason?.trim() || 'Half day', slots: holiday.closedSlots };
}

const isSlotClosed = (date, shift, offDays) => !!getPartDay(date, offDays)?.slots.includes(shift);

const getNext7Days = () => {
    const days = [];
    const nowIST = getISTDate();
    // If it's after 6 PM (18:00) IST, the first delivery day is tomorrow
    const startOffset = nowIST.getHours() >= 18 ? 1 : 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(nowIST);
        d.setDate(nowIST.getDate() + (startOffset + i));
        d.setHours(0, 0, 0, 0);
        days.push(d);
    }
    return days;
};

export default function CheckoutScreen() {
    const navigate = useNavigate()
    const { cartItems, cartTotal, clearCart, deliveryConstraints, getActivePrice } = useCart()
    const locationCtx = useLocation()
    const ctxDeliveryAddress = locationCtx?.deliveryAddress
    const ctxDeliveryLocation = locationCtx?.deliveryLocation
    const ctxDeliveryComponents = locationCtx?.deliveryAddressComponents
    const ctxHasDeliveryPinned = locationCtx?.hasDeliveryPinned
    const ctxUpdateDeliveryLocation = locationCtx?.updateDeliveryLocation
    const { placeOrder } = useOrders()
    const { balance, payWithWallet, useCreditAmount: deductCreditLocally, creditLimit, creditUsed, availableCredit, creditBlocked } = useWallet()

    const [step, setStep] = useState(1) // 1: Address, 2: Payment, 3: Success
    /** After place / Razorpay verify: `{ orders, orderGroupId }` (split by category when multiple). */
    const [lastPlacement, setLastPlacement] = useState(null)
    const [selectedMethod, setSelectedMethod] = useState('upi')
    useEffect(() => {
        if (creditBlocked && selectedMethod === 'credit') setSelectedMethod('upi')
    }, [creditBlocked, selectedMethod])
    const [isPlacingOrder, setIsPlacingOrder] = useState(false)
    const [isEditingAddress, setIsEditingAddress] = useState(false)

    // Pre-order States
    const [availableDates, setAvailableDates] = useState(getNext7Days)
    const [selectedDate, setSelectedDate] = useState(availableDates[0])
    // Days the admin closed for delivery (festivals, weekly off); the server rejects them too
    const [offDays, setOffDays] = useState({ weeklyOff: [], dates: [] })

    useEffect(() => {
        // Fetched on every checkout visit so a holiday added today shows up without an app restart
        api.get('/catalog/settings')
            .then((res) => {
                const list = res.data?.results || res.data?.result || []
                const setting = Array.isArray(list) ? list.find((s) => s.key === 'delivery_off_days') : null
                if (setting?.value) setOffDays(setting.value)
            })
            .catch(() => { /* the server still checks the date when the order is placed */ })
    }, [])

    // Never leave a closed day selected: move to the first open one
    useEffect(() => {
        if (!getOffDayReason(selectedDate, offDays)) return
        const firstOpen = availableDates.find((d) => !getOffDayReason(d, offDays))
        if (firstOpen) setSelectedDate(firstOpen)
    }, [offDays, availableDates, selectedDate])

    // Coupon States
    const [couponCode, setCouponCode] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState(null)
    const [availableCoupons, setAvailableCoupons] = useState([])
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
    const [showCouponList, setShowCouponList] = useState(false)
    const [isManualAddress, setIsManualAddress] = useState(false)

    const [user, setUser] = useState(null)
    const [deliveryAddress, setDeliveryAddress] = useState('')
    const [savedAddresses, setSavedAddresses] = useState([])
    const [addressTag, setAddressTag] = useState('home')
    const [addressDetails, setAddressDetails] = useState({
        flat: '',
        floor: '',
        colony: '',
        landmark: '',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '',
    });
    // Where the delivery address came from: a saved address the customer picked ('saved'), a
    // location they pinned on this visit ('pin'), or their profile ('profile'). A saved address is
    // never overwritten by the phone's GPS text.
    const addressSourceRef = useRef((() => {
        try {
            return sessionStorage.getItem('kk_checkout_prompt_address') === '1' ? 'pin' : 'profile'
        } catch {
            return 'profile'
        }
    })())
    const autoPickedSavedRef = useRef(false)
    const [selectedAddressId, setSelectedAddressId] = useState(null)
    const [pinNonce, setPinNonce] = useState(0)
    const [deliveryShift, setDeliveryShift] = useState('');
    /** Re-render every minute so past slots become disabled without refresh */
    const [shiftTimeTick, setShiftTimeTick] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
        const id = setInterval(() => setShiftTimeTick((n) => n + 1), 60000)
        return () => clearInterval(id)
    }, [])

    // Roll the date strip forward when the IST day changes or it passes 6 PM while the page is open
    useEffect(() => {
        const fresh = getNext7Days()
        if (fresh[0].getTime() === availableDates[0].getTime()) return
        setAvailableDates(fresh)
        if (selectedDate.getTime() < fresh[0].getTime()) {
            setSelectedDate(fresh[0])
        }
    }, [shiftTimeTick])

    useEffect(() => {
        if (!deliveryShift) return
        if (!isDeliveryShiftSelectable(deliveryShift, selectedDate) || isSlotClosed(selectedDate, deliveryShift, offDays)) {
            setDeliveryShift('')
        }
    }, [deliveryShift, shiftTimeTick, selectedDate, offDays])

    const handlePinCurrentLocation = async () => {
        if (!ctxUpdateDeliveryLocation) {
            try {
                sessionStorage.setItem('kk_checkout_prompt_address', '1');
            } catch (_) { /* ignore */ }
            navigate('/location-picker?type=delivery&returnTo=/checkout');
            return;
        }
        try {
            addressSourceRef.current = 'pin';
            setSelectedAddressId(null);
            await ctxUpdateDeliveryLocation(true);
            setPinNonce((n) => n + 1);
            toast.success('Current location pinned for delivery.');
            // Already on checkout: open form only if house no. is missing
            setAddressDetails((current) => {
                if (!current.flat?.trim()) {
                    setIsEditingAddress(true);
                }
                return current;
            });
        } catch (error) {
            console.error('Pin current location error:', error);
            toast.error(error?.message || 'Unable to fetch your current location.');
        }
    }

    const persistSavedAddresses = (addresses) => {
        setSavedAddresses(addresses)
        saveSavedAddresses(user?._id, addresses)
    }

    const parseAddressToDetails = (address = '') => {
        if (!address || typeof address !== 'string') return null

        const parts = address.split(',').map(part => part.trim()).filter(Boolean)
        if (parts.length < 5) return null

        let flat = ''
        let floor = ''
        let colony = ''
        let landmark = ''
        let city = 'Indore'
        let state = 'Madhya Pradesh'

        // New format: Flat: X, Floor: Y, Colony..., Landmark: Z, City, State
        if (parts[0]?.toLowerCase().startsWith('flat:') && parts[1]?.toLowerCase().startsWith('floor:') && parts.length >= 6) {
            flat = parts[0].replace(/^Flat:\s*/i, '').trim()
            floor = parts[1].replace(/^Floor:\s*/i, '').trim()
            colony = parts[2] || ''
            landmark = (parts[3] || '').replace(/^Landmark:\s*/i, '').trim()
            city = parts[4] || city
            state = parts[5] || state
        } else {
            // Backward compatibility: Floor, Colony, Landmark, City, State
            floor = parts[0] || ''
            colony = parts[1] || ''
            landmark = (parts[2] || '').replace(/^Landmark:\s*/i, '').trim()
            city = parts[3] || city
            state = parts[4] || state
        }

        return {
            flat: flat || '',
            floor: floor || '',
            colony: colony || '',
            landmark: landmark || '',
            city: city || 'Indore',
            state: state || 'Madhya Pradesh'
        }
    }

    const extractStreetAddress = (fullAddress, components) => {
        if (!fullAddress) return '';
        let street = fullAddress;
        street = street.replace(/,?\s*India$/i, '').trim();
        if (components?.pincode) {
            street = street.replace(new RegExp(`,?\\s*${components.pincode}$`, 'i'), '').trim();
        }
        if (components?.state) {
            street = street.replace(new RegExp(`,?\\s*${components.state}$`, 'i'), '').trim();
        }
        if (components?.city) {
            street = street.replace(new RegExp(`,?\\s*${components.city}$`, 'i'), '').trim();
        }
        return street.replace(/,\s*$/, '').trim();
    }

    const persistAddressToProfile = async (fullAddress) => {
        if (!fullAddress) return
        await api.put('/user/update-profile', { address: fullAddress })
        setUser(prev => prev ? { ...prev, address: fullAddress } : prev)
        setDeliveryAddress(fullAddress)
    }

    const handleSelectSavedAddress = (saved, { silent = false } = {}) => {
        if (!saved?.details) return
        addressSourceRef.current = 'saved'
        setSelectedAddressId(saved.id || saved.tag)
        setAddressTag(saved.tag || 'other')
        setAddressDetails({ ...EMPTY_ADDRESS_DETAILS, ...saved.details })
        const fullAddress = saved.fullAddress || buildFullAddress(saved.details)
        setDeliveryAddress(fullAddress)
        setIsManualAddress(true)
        if (!silent) toast.success(`${saved.label || 'Address'} selected`)
    }

    const openNewAddressForm = () => {
        setSelectedAddressId(null)
        setAddressTag('other')
        const streetAddress = addressSourceRef.current === 'pin' ? extractStreetAddress(ctxDeliveryAddress, ctxDeliveryComponents) : ''
        setAddressDetails({
            ...EMPTY_ADDRESS_DETAILS,
            colony: streetAddress || '',
            city: ctxDeliveryComponents?.city || EMPTY_ADDRESS_DETAILS.city,
            state: ctxDeliveryComponents?.state || EMPTY_ADDRESS_DETAILS.state,
            pincode: ctxDeliveryComponents?.pincode || '',
        })
        setIsEditingAddress(true)
    }

    const handleSearchChange = async (val) => {
        setSearchQuery(val);
        if (val.length < 3) {
            setSuggestions([]);
            return;
        }
        setIsSearching(true);
        const results = await fetchAddressSuggestions(val);
        setSuggestions(results);
        setIsSearching(false);
    }

    // "Use my current location" inside the address form: GPS -> fill area / city / state /
    // pincode and pin the exact spot for delivery. House no. and floor still come from the customer.
    const [isLocatingInForm, setIsLocatingInForm] = useState(false)
    const handleUseCurrentLocationInForm = async () => {
        if (isLocatingInForm) return
        setIsLocatingInForm(true)
        try {
            const { lat, lng } = await getCurrentLocation()
            const geo = await reverseGeocodeWithComponents(lat, lng)
            const components = geo?.addressComponents || {}
            const street = extractStreetAddress(geo?.formattedAddress, components)
            setAddressDetails(prev => ({
                ...prev,
                colony: street || components.area || prev.colony,
                city: components.city || prev.city,
                state: components.state || prev.state,
                pincode: components.pincode || prev.pincode,
            }))
            addressSourceRef.current = 'pin' // use these exact coordinates for the order
            setSelectedAddressId(null)
            await locationCtx?.setPinnedDeliveryLocation?.({
                lat, lng, address: geo?.formattedAddress, addressComponents: geo?.addressComponents,
            })
            setSearchQuery('')
            setSuggestions([])
            toast.success('Current location filled in. Please add your house / flat number.')
        } catch (err) {
            console.error('Use current location error:', err)
            toast.error(err?.message || 'Unable to fetch your current location. Please allow location access.')
        } finally {
            setIsLocatingInForm(false)
        }
    }

    const handleSelectSuggestion = async (s) => {
        setSearchQuery(s.description);
        setSuggestions([]);
        setIsPlacingOrder(true);
        try {
            const geocoded = await geocodePlaceId(s.placeId);
            if (geocoded) {
                const { addressComponents, lat, lng } = geocoded;
                setAddressDetails(prev => ({
                    ...prev,
                    colony: addressComponents.area || prev.colony,
                    city: addressComponents.city || prev.city,
                    state: addressComponents.state || prev.state,
                    pincode: addressComponents.pincode || prev.pincode
                }));
                // Update map pin context
                if (ctxUpdateDeliveryLocation) {
                    await locationCtx.setPinnedDeliveryLocation({ lat, lng, address: geocoded.formattedAddress, addressComponents });
                }
                toast.success('Address details filled!');
            }
        } catch (err) {
            console.error('Select suggestion error:', err);
            toast.error('Failed to fetch address details');
        } finally {
            setIsPlacingOrder(false);
        }
    }

    useEffect(() => {
        fetchProfile()
        fetchAvailableCoupons()
    }, [])

    // Saved addresses come from the account (a returning customer's earlier order addresses are
    // already there). Unless the customer just pinned a new location, start on the one they used last.
    useEffect(() => {
        if (!user?._id) return
        let cancelled = false
        fetchSavedAddresses(user._id).then((list) => {
            if (cancelled) return
            setSavedAddresses(list)
            if (!autoPickedSavedRef.current && addressSourceRef.current !== 'pin' && list.length > 0) {
                autoPickedSavedRef.current = true
                handleSelectSavedAddress(sortByRecent(list)[0], { silent: true })
            }
        })
        return () => { cancelled = true }
    }, [user?._id])

    // A location pinned on the map / by GPS fills the area, city and pincode. It never touches a
    // saved address the customer picked, and never keeps the house number of a different address.
    useEffect(() => {
        if (!ctxDeliveryAddress) return;
        if (addressSourceRef.current === 'saved') return;
        setDeliveryAddress(ctxDeliveryAddress);

        if (ctxDeliveryComponents) {
            setAddressDetails(prev => {
                const streetAddress = extractStreetAddress(ctxDeliveryAddress, ctxDeliveryComponents);
                const colony = streetAddress || ctxDeliveryComponents.area || prev.colony;
                // Same place as before: keep what the customer typed. A different place: start the
                // house details afresh instead of mixing two addresses.
                const samePlace = prev.colony && colony && prev.colony.trim().toLowerCase() === colony.trim().toLowerCase();
                // Just pinned a new place: ask for the house number straight away
                if (addressSourceRef.current === 'pin' && !(samePlace && prev.flat)) setIsEditingAddress(true);
                return {
                    ...prev,
                    city: ctxDeliveryComponents.city || prev.city,
                    state: ctxDeliveryComponents.state || prev.state,
                    colony,
                    pincode: ctxDeliveryComponents.pincode || prev.pincode,
                    flat: samePlace ? (prev.flat || '') : '',
                    floor: samePlace ? (prev.floor || '') : '',
                    landmark: samePlace ? (prev.landmark || '') : '',
                };
            });
            setIsManualAddress(false);
        } else {
            const parsed = parseAddressToDetails(ctxDeliveryAddress);
            if (parsed) {
                setAddressDetails(prev => ({ ...prev, ...parsed }));
            }
            setIsManualAddress(false);
        }
    }, [ctxDeliveryAddress, ctxDeliveryComponents, ctxHasDeliveryPinned, pinNonce])

    // Open address editor only after a fresh map/GPS pin when house no. is still missing.
    // Do NOT open on every checkout visit — that was spamming the Change Address popup.
    useEffect(() => {
        let cancelled = false;
        let timer;

        const maybePrompt = () => {
            let shouldPrompt = false;
            try {
                shouldPrompt = sessionStorage.getItem('kk_checkout_prompt_address') === '1';
            } catch (_) {
                shouldPrompt = false;
            }
            if (!shouldPrompt || cancelled) return;

            try {
                sessionStorage.removeItem('kk_checkout_prompt_address');
            } catch (_) { /* ignore */ }

            // Wait for profile / saved address hydrate so we don't open when flat already exists
            timer = setTimeout(() => {
                if (cancelled) return;
                setAddressDetails((current) => {
                    if (!current.flat?.trim()) {
                        setIsEditingAddress(true);
                    }
                    return current;
                });
            }, 600);
        };

        maybePrompt();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [])

    const fetchProfile = async () => {
        try {
            const response = await api.get('/user/me')
            const userData = response.data.result
            setUser(userData)
            setDeliveryAddress(userData.address || '')
            if (userData.address) {
                const parsed = parseAddressToDetails(userData.address)
                if (parsed) {
                    setAddressDetails(parsed)
                } else {
                    setAddressDetails(prev => ({ ...prev, colony: userData.address }))
                }
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error)
        }
    }

    const fetchAvailableCoupons = async () => {
        try {
            const response = await api.get('/coupons/visible');
            if (response.data.success) {
                // Backend array response is in 'results'
                setAvailableCoupons(response.data.results || response.data.result || []);
            }
        } catch (error) {
            console.error('Failed to fetch coupons:', error);
        }
    };

    const handleApplyCoupon = async () => {
        if (!couponCode) return
        setIsValidatingCoupon(true)
        try {
            const response = await api.post('/coupons/validate', {
                code: couponCode,
                cartValue: cartTotal
            })
            if (response.data.success) {
                setAppliedCoupon(response.data.result)
                toast.success("Coupon applied!")
                setShowCouponList(false)
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Invalid coupon")
            setAppliedCoupon(null)
        } finally {
            setIsValidatingCoupon(false)
        }
    }

    const discountAmount = appliedCoupon ? (appliedCoupon.discount || 0) : 0
    const actualDeliveryFee = cartTotal >= parseFloat(deliveryConstraints.freeMov) ? 0 : parseFloat(deliveryConstraints.baseFee)
    const finalDeliveryFee = (appliedCoupon?.type === 'free_delivery') ? 0 : actualDeliveryFee

    // Dynamic Tax calculation matching backend logic (Entire Order)
    const taxRateString = deliveryConstraints.tax || '0'
    const taxRate = parseFloat(taxRateString) / 100
    const tax = parseFloat(((cartTotal + finalDeliveryFee) * taxRate).toFixed(2))

    const total = parseFloat((cartTotal + finalDeliveryFee + tax - discountAmount).toFixed(2))
    const walletContribution = Math.min(Number(balance || 0), total)
    const walletShortfall = parseFloat(Math.max(0, total - walletContribution).toFixed(2))
    const creditContribution = Math.min(Number(availableCredit || 0), total)
    const creditShortfall = parseFloat(Math.max(0, total - creditContribution).toFixed(2))
    const isWalletShort = selectedMethod === 'wallet' && walletShortfall > 0
    const isCreditShort = selectedMethod === 'credit' && creditShortfall > 0
    const hasStructuredAddress = !!(addressDetails.flat && addressDetails.colony && addressDetails.city && addressDetails.state)
    const displayAddress = hasStructuredAddress
        ? buildFullAddress(addressDetails)
        : (deliveryAddress || '')

    const handleRazorpayPayment = async (orderData, payableAmount = total) => {
        try {
            // 1. Load Razorpay Script
            const res = await loadRazorpay()
            if (!res) {
                toast.error("Could not open the payment page. Please check your internet connection.")
                return
            }
            if (!import.meta.env.VITE_RAZORPAY_KEY_ID) {
                toast.error("Online payment is not configured. Please choose another payment method.")
                return
            }

            // 2. Create Razorpay Order on Backend
            // The server works out the amount from the cart; payableAmount is only a fallback
            const { data: { result: order } } = await api.post('/payment/create-order', {
                amount: payableAmount,
                orderData
            })

            // 3. Open Razorpay Modal
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
                name: "Kisaankart",
                description: "Fresh Harvest Delivery",
                image: "/logo.png",
                order_id: order.id,
                handler: async (response) => {
                    try {
                        setIsPlacingOrder(true)
                        const verifyRes = await api.post('/payment/verify', {
                            ...response,
                            orderData
                        })

                        if (verifyRes.data.success) {
                            const r = verifyRes.data.result
                            if (orderData.paymentMethod === 'Wallet + Online' && orderData.walletAmountUsed > 0) {
                                payWithWallet(orderData.walletAmountUsed)
                            }
                            if (orderData.paymentMethod === 'Credit + Online' && orderData.creditAmountUsed > 0) {
                                deductCreditLocally(orderData.creditAmountUsed)
                            }
                            const orders = Array.isArray(r?.orders)
                                ? r.orders
                                : r?.order
                                  ? [r.order]
                                  : r?._id
                                    ? [r]
                                    : []
                            setLastPlacement({
                                orders,
                                orderGroupId: r?.orderGroupId ?? null,
                            })
                            setStep(3)
                            setTimeout(() => {
                                clearCart()
                            }, 500)
                        } else {
                            const errorMsg = verifyRes.data.message || "Payment verification failed"
                            console.error("Verification failed:", errorMsg)
                            toast.error(errorMsg)
                        }
                    } catch (err) {
                        console.error("Verification error details:", {
                            message: err.message,
                            response: err.response?.data,
                            status: err.response?.status
                        })

                        // Show specific error message from backend if available
                        const errorMessage = err.response?.data?.message || err.message || "Payment verification failed"
                        toast.error(errorMessage)
                    } finally {
                        setIsPlacingOrder(false)
                    }
                },
                prefill: {
                    name: user?.fullName,
                    email: user?.email,
                    contact: user?.mobile
                },
                theme: {
                    color: "#00b894" // Primary teal color
                }
            }

            const paymentObject = new window.Razorpay(options)
            paymentObject.on('payment.failed', (response) => {
                toast.error(response?.error?.description || "Payment failed. Please try again.")
            })
            paymentObject.open()

        } catch (error) {
            console.error("Razorpay flow error:", error)
            toast.error(error.response?.data?.message || "Could not initiate payment")
        } finally {
            setIsPlacingOrder(false)
        }
    }

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true)
                return
            }
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.async = true
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handlePlaceOrder = async () => {
        if (!user || !user.fullName || user.fullName.toLowerCase() === 'dev user' || user.fullName.toLowerCase() === 'guest user') {
            toast.error("Please complete your profile (add your name) before placing an order.");
            navigate('/edit-profile');
            return;
        }

        if (!addressDetails.flat || !addressDetails.colony || !addressDetails.city || !addressDetails.state) {
            toast.error("Please fill all the mandatory address fields (Flat/House No., Colony, City, State)");
            setIsEditingAddress(true);
            return;
        }

        // Only compare with the map pin when the address actually came from that pin
        if (addressSourceRef.current === 'pin' && ctxDeliveryComponents?.city) {
            const manualCity = addressDetails.city.trim().toLowerCase();
            const pinnedCity = ctxDeliveryComponents.city.trim().toLowerCase();
            if (manualCity && !pinnedCity.includes(manualCity) && !manualCity.includes(pinnedCity)) {
                toast.error(`The city you typed does not match the location pinned on the map. Please fix the city or re-pin your location.`);
                setIsEditingAddress(true);
                return;
            }
        }
        if (!deliveryShift) {
            toast.error("Please select a delivery time slot");
            return;
        }
        if (!isDeliveryShiftSelectable(deliveryShift, selectedDate)) {
            toast.error("This delivery slot is no longer available. Please pick a later time.");
            setDeliveryShift('');
            return;
        }
        if (isSlotClosed(selectedDate, deliveryShift, offDays)) {
            toast.error("This delivery slot is closed on the chosen day. Please pick another slot.");
            setDeliveryShift('');
            return;
        }

        setIsPlacingOrder(true)

        const methodMap = {
            wallet: 'Wallet',
            credit: 'Credit',
            upi: 'UPI',
            card: 'Card',
            cod: 'COD'
        }

        const fullAddress = buildFullAddress(addressDetails)

        try {
            await persistAddressToProfile(fullAddress)
        } catch (error) {
            console.error('Failed to persist address:', error)
            toast.error('Could not save address to profile')
        }

        // Coordinates: the map pin if this address came from it; else the saved address's own
        // location; else look the typed address up.
        const selectedSaved = savedAddresses.find((a) => (a.id || a.tag) === selectedAddressId);
        let coords = null;
        if (addressSourceRef.current === 'pin' && ctxDeliveryLocation) {
            coords = ctxDeliveryLocation;
        } else if (selectedSaved?.location && selectedSaved.fullAddress === fullAddress) {
            coords = selectedSaved.location;
        }
        if (!coords) {
            try {
                coords = await geocodeAddressFrontend(fullAddress);
            } catch (geoErr) {
                // non-fatal
            }
        }

        // Remember this address on the account (most recently used comes first next time)
        try {
            const lat = Number(coords?.lat), lng = Number(coords?.lng);
            const next = upsertSavedAddress(savedAddresses, selectedSaved?.tag || addressTag, addressDetails, {
                location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
                lastUsedAt: new Date().toISOString(),
            });
            persistSavedAddresses(next);
        } catch (saveErr) {
            console.error('Could not remember address:', saveErr);
        }

        const orderData = {
            shippingAddress: fullAddress,
            shippingLocation: coords,
            paymentMethod: methodMap[selectedMethod],
            deliveryShift: deliveryShift,
            // Calendar day in IST as YYYY-MM-DD (availableDates hold IST wall-clock values)
            scheduledDate: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
            isPreOrder: selectedDate.toDateString() !== getISTDate().toDateString(),
            couponCode: appliedCoupon?.code || '',
            discountAmount: discountAmount
        }

        // Online Payment Flow (Razorpay)
        if (selectedMethod === 'upi') {
            await handleRazorpayPayment(orderData)
            return
        }

        if (selectedMethod === 'wallet') {
            if (walletShortfall > 0) {
                await handleRazorpayPayment({
                    ...orderData,
                    paymentMethod: 'Wallet + Online',
                    walletAmountUsed: walletContribution,
                    onlineAmountPaid: walletShortfall
                }, walletShortfall)
                return
            }
        }

        if (selectedMethod === 'credit') {
            if (creditShortfall > 0) {
                await handleRazorpayPayment({
                    ...orderData,
                    paymentMethod: 'Credit + Online',
                    creditAmountUsed: creditContribution,
                    onlineAmountPaid: creditShortfall
                }, creditShortfall)
                return
            }
        }

        // Standard direct order flow (COD/Wallet/Credit)
        const result = await placeOrder(orderData)

        if (result.success) {
            if (selectedMethod === 'wallet') {
                payWithWallet(walletContribution)
            }
            setLastPlacement({
                orders: result.orders || (result.order ? [result.order] : []),
                orderGroupId: result.orderGroupId ?? null,
            })
            setStep(3)
            setTimeout(() => {
                clearCart()
            }, 500)
        } else {
            toast.error(result.message || "Failed to place order")
        }

        setIsPlacingOrder(false)
    }

    if (step === 3) {
        return (
            <PageTransition>
                <div className="bg-white min-h-screen flex flex-col items-center justify-center p-8 text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-24 h-24 bg-primary rounded-[40px] md:rounded-xl flex items-center justify-center text-white mb-8 shadow-2xl shadow-green-100"
                    >
                        <Check size={48} strokeWidth={3} />
                    </motion.div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight md:font-bold">Order placed successfully!</h1>
                    {(lastPlacement?.orders?.length ?? 0) > 1 && (
                        <p className="mt-4 text-sm font-medium text-slate-600 max-w-md">
                            Your cart was split into {lastPlacement.orders.length} orders by category. Each is delivered by the nearest store for that category, and you can track them separately.
                        </p>
                    )}

                    <div className="mt-8 w-full max-w-md space-y-3">
                        {lastPlacement?.orders?.map((order, idx) => (
                            <Button
                                key={order._id || idx}
                                onClick={() => navigate(`/track-order/${order._id}`, { replace: true, state: { fromCheckout: true } })}
                                className="w-full h-16 md:h-14 rounded-3xl md:rounded-lg bg-primary text-xl font-black md:font-bold md:text-lg shadow-lg shadow-green-100 active:scale-95 transition-all"
                            >
                                {lastPlacement.orders.length > 1 ? `Track Order ${idx + 1}` : 'Track My Order'}
                            </Button>
                        ))}
                    </div>
                    <Button
                        onClick={() => navigate('/orders', { replace: true })}
                        variant="outline"
                        className="mt-4 w-full max-w-md h-14 rounded-3xl md:rounded-lg text-slate-500 font-bold border-slate-200"
                    >
                        View All Orders
                    </Button>
                </div>
            </PageTransition>
        )
    }

    return (
        <PageTransition>
            <div className="bg-[#f8fafd] min-h-screen overflow-x-hidden pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-20">
                {/* Mobile Header */}
                <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl px-3 py-2 pt-2 border-b border-slate-100/80 shadow-[0_1px_10px_rgba(0,0,0,0.04)] flex items-center justify-between md:hidden">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => navigate(-1)} className="min-h-[40px] min-w-[40px] shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm text-slate-600 active:scale-95 transition-transform">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight truncate">Checkout</h1>
                    </div>
                </div>

                <div className="max-w-7xl md:max-w-[1440px] mx-auto md:px-8">
                    <div className="md:flex md:gap-8 md:pt-1 md:pb-12">
                        <div className="flex-1 space-y-10 md:space-y-5 px-4 md:px-0 min-w-0">
                            <div className="hidden md:flex items-start justify-between gap-6">
                                <div>
                                    <h1 className="text-[42px] font-bold text-slate-900 tracking-tight leading-tight">Checkout</h1>
                                    <p className="text-[18px] text-slate-600">Complete your order in 2 easy steps</p>
                                </div>
                                <div className="flex items-center gap-4 pt-3">
                                    {[[1, 'Address'], [2, 'Payment']].map(([n, label], i) => (
                                        <div key={n} className="flex items-center gap-4">
                                            {i > 0 && <span className={cn("w-16 h-[3px] rounded-full", step >= n ? "bg-green-600" : "bg-slate-200")} />}
                                            <span className="flex items-center gap-2.5">
                                                <span className={cn("w-10 h-10 rounded-full flex items-center justify-center text-[17px] font-bold", step >= n ? "bg-green-700 text-white" : "bg-slate-200 text-slate-600")}>{n}</span>
                                                <span className={cn("text-[18px] font-semibold", step >= n ? "text-green-800" : "text-slate-500")}>{label}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Delivery Address */}
                            <section className="md:bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm md:p-6">
                                <div className="mb-3 md:mb-4">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest md:normal-case md:tracking-normal md:text-slate-900 md:text-[22px] md:font-bold md:flex md:items-center md:gap-3">
                                                <MapPin size={26} className="hidden md:block text-green-700" />
                                                Delivery Address
                                            </h2>
                                            <p className="hidden md:block text-[15px] text-slate-500 pl-[38px]">Choose where you want to receive your order</p>
                                        </div>
                                        <div className="hidden md:flex items-center gap-3 flex-wrap justify-end">
                                            {ctxHasDeliveryPinned && !isManualAddress && (
                                                <div className="flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1">
                                                    <CheckCircle2 size={12} />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Location pinned</span>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handlePinCurrentLocation}
                                                disabled={isPlacingOrder}
                                                className={cn(
                                                    "flex items-center gap-1.5 text-[15px] font-semibold transition-colors",
                                                    isPlacingOrder ? "text-slate-300 cursor-not-allowed" : "text-green-700 hover:text-green-800"
                                                )}
                                            >
                                                <MapPin size={17} />
                                                <span>{ctxHasDeliveryPinned ? 'Re-pin my location' : 'Pin my location'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    try {
                                                        sessionStorage.setItem('kk_checkout_prompt_address', '1');
                                                    } catch (_) { /* ignore */ }
                                                    navigate('/location-picker?type=delivery&returnTo=/checkout');
                                                }}
                                                disabled={isPlacingOrder}
                                                className={cn(
                                                    "flex items-center gap-1.5 text-[15px] font-semibold transition-colors",
                                                    isPlacingOrder ? "text-slate-300 cursor-not-allowed" : "text-green-700 hover:text-green-800"
                                                )}
                                            >
                                                <MapPin size={17} />
                                                <span>Pin on map</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingAddress(true)}
                                                disabled={isPlacingOrder}
                                                className={cn(
                                                    "text-[15px] font-bold transition-colors",
                                                    isPlacingOrder ? "text-slate-300 cursor-not-allowed" : "text-green-700 hover:text-green-800"
                                                )}
                                            >
                                                Change
                                            </button>
                                        </div>
                                    </div>
                                    {/* Mobile: actions on second row — avoids cramped single line */}
                                    <div className="flex flex-wrap items-center gap-2 mt-1 md:hidden">
                                        {ctxHasDeliveryPinned && !isManualAddress && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                                                <CheckCircle2 size={11} className="shrink-0" />
                                                Pinned
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handlePinCurrentLocation}
                                            disabled={isPlacingOrder}
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm active:scale-[0.98] transition-transform",
                                                isPlacingOrder && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <MapPin size={12} className="text-primary shrink-0" />
                                            {ctxHasDeliveryPinned ? 'Re-pin location' : 'Pin my location'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                try {
                                                    sessionStorage.setItem('kk_checkout_prompt_address', '1');
                                                } catch (_) { /* ignore */ }
                                                navigate('/location-picker?type=delivery&returnTo=/checkout');
                                            }}
                                            disabled={isPlacingOrder}
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm active:scale-[0.98] transition-transform",
                                                isPlacingOrder && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <MapPin size={12} className="text-blue-500 shrink-0" />
                                            Pick on map
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm md:p-0 md:mt-5 md:border-0 md:shadow-none">
                                    <div className="flex items-start gap-3 md:gap-4 min-w-0">
                                        <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl md:rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                                            <MapPin size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0 pr-1">
                                            <h3 className="text-sm md:text-[18px] font-black text-slate-900 md:font-bold">{user?.fullName || 'My Home'}</h3>
                                            <p className="text-xs md:text-[16px] text-slate-500 font-medium leading-relaxed mt-1 break-words">
                                                {displayAddress || 'No address provided. Tap the pencil to add your address.'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => !isPlacingOrder && setIsEditingAddress(true)}
                                            disabled={isPlacingOrder}
                                            className={cn(
                                                "w-9 h-9 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/5 transition-all border border-slate-100",
                                                isPlacingOrder && "opacity-50 cursor-not-allowed"
                                            )}
                                            aria-label="Edit delivery address"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        {savedAddresses.length > 0 && (
                                            <>
                                                <p className="text-[11px] md:text-[14px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                    {savedAddresses.length === 1 ? 'Your saved address' : 'Choose from your saved addresses'}
                                                </p>
                                                <div className="space-y-2">
                                                    {sortByRecent(savedAddresses).map((saved) => {
                                                        const key = saved.id || saved.tag
                                                        const active = key === selectedAddressId
                                                        return (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                disabled={isPlacingOrder}
                                                                onClick={() => handleSelectSavedAddress(saved)}
                                                                className={cn(
                                                                    "w-full text-left flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all md:px-5 md:py-4 md:rounded-2xl md:gap-4",
                                                                    active ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"
                                                                )}
                                                            >
                                                                <span className={cn(
                                                                    "mt-0.5 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                                                    active ? "border-primary bg-primary" : "border-slate-300"
                                                                )}>
                                                                    {active && <Check size={10} strokeWidth={4} className="text-white" />}
                                                                </span>
                                                                <span className="min-w-0">
                                                                    <span className="block text-xs md:text-[17px] font-bold text-slate-900">{saved.label || 'Saved address'}</span>
                                                                    <span className="block text-[11px] md:text-[15px] text-slate-500 leading-snug line-clamp-2 break-words">{saved.fullAddress}</span>
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </>
                                        )}
                                        <button
                                            type="button"
                                            disabled={isPlacingOrder}
                                            onClick={openNewAddressForm}
                                            className="mt-3 text-xs font-bold text-primary hover:text-primary/80 md:w-full md:h-14 md:px-5 md:mt-4 md:rounded-2xl md:border md:border-dashed md:border-slate-300 md:text-[16px] md:text-left md:text-green-700 md:hover:bg-green-50"
                                        >
                                            + Add a new address
                                        </button>
                                    </div>
                                </div>
                            </section>


                            {/* Delivery Date Selection */}
                            <section className="mt-8 md:mt-0 md:bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm md:p-6">
                                <div className="mb-3">
                                    <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest md:normal-case md:tracking-normal md:text-slate-900 md:text-[22px] md:font-bold md:flex md:items-center md:gap-3">
                                        <CalendarDays size={26} className="hidden md:block text-green-700" />
                                        Select Delivery Date
                                    </h2>
                                    <p className="text-[10px] md:text-[15px] text-slate-400 md:text-slate-500 font-medium md:pl-[38px]">
                                        Choose when you want your fresh harvest delivered.
                                    </p>
                                </div>
                                <div className="flex gap-2 md:gap-3 md:mt-4 overflow-x-auto pb-2 custom-scrollbar">
                                    {availableDates.map((date, idx) => {
                                        const isSelected = selectedDate.toDateString() === date.toDateString();
                                        const isToday = getISTDate().toDateString() === date.toDateString();
                                        const offReason = getOffDayReason(date, offDays);
                                        if (offReason) {
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    disabled
                                                    aria-disabled
                                                    title={`No delivery: ${offReason}`}
                                                    className="shrink-0 w-16 h-20 md:w-[104px] md:h-[112px] rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 text-slate-400 flex flex-col items-center justify-center gap-1 cursor-not-allowed"
                                                >
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">
                                                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                                    </span>
                                                    <span className="text-lg md:text-[30px] font-black tabular-nums leading-none line-through">
                                                        {date.getDate()}
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase text-rose-500 leading-tight text-center px-1 line-clamp-2">
                                                        {offReason}
                                                    </span>
                                                </button>
                                            );
                                        }
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setSelectedDate(date)}
                                                className={cn(
                                                    "shrink-0 w-16 h-20 md:w-[104px] md:h-[112px] rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all",
                                                    isSelected
                                                        ? "bg-primary border-primary text-white shadow-lg shadow-emerald-100"
                                                        : "bg-white border-slate-100 text-slate-600 hover:border-slate-200"
                                                )}
                                            >
                                                <span className={cn("text-[10px] md:text-[15px] font-black md:font-semibold uppercase md:normal-case tracking-tighter md:tracking-normal", isSelected ? "text-emerald-100" : "text-slate-400")}>
                                                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                                </span>
                                                <span className="text-lg md:text-[30px] font-black tabular-nums leading-none">
                                                    {date.getDate()}
                                                </span>
                                                {getPartDay(date, offDays) ? (
                                                    <span
                                                        title={`${getPartDay(date, offDays).reason}: some slots closed`}
                                                        className={cn("text-[9px] font-black uppercase leading-tight text-center px-1 line-clamp-2", isSelected ? "text-amber-100" : "text-amber-600")}
                                                    >
                                                        Half day
                                                    </span>
                                                ) : (
                                                    <span className={cn("text-[10px] md:text-[14px] font-black md:font-semibold uppercase md:normal-case", isSelected ? "text-emerald-100" : "text-slate-400")}>
                                                        {isToday ? 'Today' : date.toLocaleDateString('en-US', { month: 'short' })}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>


                            {/* Shift Timing */}
                            <section className="mt-6 md:mt-0 pt-2 border-t border-slate-200/60 md:bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm md:p-6">
                                <div className="mb-2 md:mb-3 space-y-1">
                                    <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest md:normal-case md:tracking-normal md:text-slate-900 md:text-[22px] md:font-bold md:flex md:items-center md:gap-3">
                                        <Clock size={26} className="hidden md:block text-green-700" />
                                        Delivery Time Slot
                                    </h2>
                                    <p className="text-[10px] md:text-[15px] text-slate-400 md:text-slate-500 font-medium leading-snug md:pl-[38px]">
                                        You can only choose time slots that haven’t started yet. After 6 PM, slots open for the next day.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                                    {DELIVERY_SHIFT_SLOTS.map(({ label: shift }) => {
                                        const closedForDay = isSlotClosed(selectedDate, shift, offDays)
                                        const selectable =
                                            !getOffDayReason(selectedDate, offDays) && !closedForDay && isDeliveryShiftSelectable(shift, selectedDate)
                                        const selected = deliveryShift === shift
                                        return (
                                            <button
                                                key={shift}
                                                type="button"
                                                disabled={!selectable}
                                                aria-disabled={!selectable}
                                                onClick={() => {
                                                    if (!selectable) return
                                                    setDeliveryShift(shift)
                                                }}
                                                className={cn(
                                                    'rounded-lg md:rounded-xl border flex items-center justify-center gap-1.5 px-2 py-2.5 md:p-4 text-[11px] md:text-[16px] font-bold leading-tight text-center transition-all min-h-[2.75rem] md:min-h-0',
                                                    !selectable &&
                                                        'cursor-not-allowed opacity-45 border-slate-100 bg-slate-50 text-slate-400 shadow-none',
                                                    selectable &&
                                                        !selected &&
                                                        'border-slate-100 hover:border-slate-200 text-slate-600 bg-white',
                                                    selectable && selected && 'border-primary bg-primary/5 text-primary shadow-sm'
                                                )}
                                            >
                                                <Clock
                                                    size={12}
                                                    className="shrink-0 md:w-[14px] md:h-[14px]"
                                                    strokeWidth={2.25}
                                                />
                                                <span className="leading-snug">
                                                    {closedForDay ? <><s>{shift}</s> <span className="text-rose-500">Closed</span></> : shift}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                                {getPartDay(selectedDate, offDays) && (
                                    <p className="mt-3 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                        {getPartDay(selectedDate, offDays).reason}: the store is open for part of the day. Closed slots: {getPartDay(selectedDate, offDays).slots.join(', ')}.
                                    </p>
                                )}
                                {DELIVERY_SHIFT_SLOTS.every(({ label }) => !isDeliveryShiftSelectable(label, selectedDate)) && (
                                    <p className="mt-3 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                        No delivery slots are left for today. Please try again tomorrow.
                                    </p>
                                )}
                            </section>


                            {/* Promo Code */}
                            <section className="mt-4 md:mt-0 md:bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm md:p-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest md:normal-case md:tracking-normal md:text-slate-900 md:text-[22px]">Apply Coupon</h2>
                                    {availableCoupons.length > 0 && (
                                        <button
                                            onClick={() => setShowCouponList(prev => !prev)}
                                            className="text-primary text-[11px] md:text-[15px] font-bold uppercase md:normal-case"
                                        >
                                            {showCouponList ? 'Hide Offers' : 'View Offers'}
                                        </button>
                                    )}
                                </div>
                                <div className="bg-white rounded-4xl p-4 border border-slate-100 shadow-sm space-y-4 md:p-0 md:border-0 md:shadow-none">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                                                placeholder="Enter Code"
                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 md:py-4 text-sm md:text-[16px] font-bold focus:outline-none focus:border-primary transition-all uppercase"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleApplyCoupon}
                                            disabled={isValidatingCoupon || !couponCode}
                                            className="rounded-xl px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                                        >
                                            {isValidatingCoupon ? <Loader2 size={16} className="animate-spin" /> : 'Apply'}
                                        </Button>
                                    </div>

                                    {appliedCoupon && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex items-start justify-between group"
                                        >
                                            <div className="flex gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                                    <CheckCircle2 size={24} />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-slate-900 uppercase">'{appliedCoupon.code}' Applied!</span>
                                                        <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-sm uppercase tracking-widest">
                                                            Save ₹{appliedCoupon.discount}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] font-bold text-emerald-700 leading-tight">
                                                        {appliedCoupon.message || appliedCoupon.title || "Discount applied successfully!"}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setAppliedCoupon(null); setCouponCode(''); }}
                                                className="w-8 h-8 rounded-full hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-all"
                                            >
                                                <X size={16} />
                                            </button>
                                        </motion.div>
                                    )}

                                    <AnimatePresence>
                                        {showCouponList && availableCoupons.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="pt-2 space-y-3 overflow-hidden"
                                            >
                                                <div className="h-px bg-slate-100 my-2" />
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-0.5">Exclusive Offers for You</h4>
                                                <div className="space-y-3 max-h-64 overflow-y-auto pr-1 no-scrollbar">
                                                    {availableCoupons.map((coupon) => (
                                                        <div
                                                            key={coupon._id}
                                                            onClick={() => { setCouponCode(coupon.code); }}
                                                            className="p-4 rounded-2xl border border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group relative overflow-hidden"
                                                        >
                                                            <div className="flex items-center gap-4 relative z-10">
                                                                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all duration-300">
                                                                    <Percent size={20} />
                                                                </div>
                                                                <div className="space-y-0.5">
                                                                    <div className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                                                        {coupon.code}
                                                                        {coupon.isFirstTimeUserOnly && (
                                                                            <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-black uppercase">NEW USER</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">{coupon.title}</div>
                                                                    {coupon.description && (
                                                                        <div className="text-[10px] text-slate-400 font-bold lowercase italic leading-none mt-1 line-clamp-1">{coupon.description}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button className="text-[10px] font-black text-emerald-600 uppercase tracking-widest px-3 py-1.5 rounded-lg border border-emerald-100 bg-white shadow-sm group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all">
                                                                Use Now
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </section>


                            {/* Payment Method */}
                            <section className="mt-4 md:mt-0 md:bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm md:p-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest md:normal-case md:tracking-normal md:text-slate-900 md:text-[22px]">Select Payment Method</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(() => {
                                        const paymentMethods = [
                                            {
                                                id: 'wallet',
                                                name: 'KK Wallet',
                                                icon: Wallet,
                                                color: 'text-primary bg-primary/5',
                                                subtitle: walletShortfall > 0
                                                    ? `Use ₹${walletContribution.toLocaleString()} from wallet, pay ₹${walletShortfall.toLocaleString()} online`
                                                    : 'Balance: ₹' + balance.toLocaleString()
                                            },
                                            {
                                                id: 'credit',
                                                name: 'KK Credit',
                                                icon: CreditCard,
                                                color: 'text-amber-600 bg-amber-50',
                                                disabled: creditBlocked,
                                                subtitle: creditBlocked
                                                    ? 'On hold - please contact support'
                                                    : creditShortfall > 0
                                                        ? `Use ₹${creditContribution.toLocaleString()} from credit, pay ₹${creditShortfall.toLocaleString()} online`
                                                        : 'Available: ₹' + availableCredit.toLocaleString()
                                            },
                                            { id: 'upi', name: 'Google Pay / UPI', icon: Sparkles, color: 'text-blue-500 bg-blue-50' },
                                            { id: 'cod', name: 'Cash on Delivery', icon: ShieldCheck, color: 'text-emerald-500 bg-emerald-50' }
                                        ];

                                        return paymentMethods.map((method) => (
                                            <button
                                                key={method.id}
                                                disabled={method.disabled}
                                                onClick={() => { if (!method.disabled) setSelectedMethod(method.id) }}
                                                className={cn(
                                                    "w-full p-4 rounded-[28px] md:p-5 md:rounded-2xl bg-white border flex items-center justify-between transition-all outline-none text-left",
                                                    selectedMethod === method.id ? "border-primary bg-primary/2 shadow-sm" : "border-slate-100 hover:border-slate-200",
                                                    method.disabled && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("w-12 h-12 rounded-2xl md:rounded-lg flex items-center justify-center", method.color)}>
                                                        <method.icon size={22} />
                                                    </div>
                                                    <div className="text-left">
                                                        <span className="text-sm md:text-[17px] font-bold text-slate-900 leading-none">{method.name}</span>
                                                        {method.subtitle && <p className="text-[10px] md:text-[14px] font-medium text-primary mt-1">{method.subtitle}</p>}
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                                    selectedMethod === method.id ? "border-primary bg-primary" : "border-slate-200"
                                                )}>
                                                    {selectedMethod === method.id && <Check size={12} className="text-white" strokeWidth={4} />}
                                                </div>
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </section>
                        </div>

                        {/* Order Summary Sidebar */}
                        <div className="w-full md:w-[440px] shrink-0 mt-8 md:mt-0 px-4 md:px-0">
                            <div className="bg-white rounded-[32px] md:rounded-2xl p-6 md:p-7 space-y-4 border border-slate-100 md:border-slate-200 shadow-sm sticky top-24 md:top-28">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-base md:text-[24px] font-bold text-slate-900">Order Summary</h3>
                                    <span className="hidden md:inline-flex h-8 px-3 rounded-full bg-green-100 text-green-800 text-[14px] font-semibold items-center">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</span>
                                </div>
                                {/* Desktop: what is being ordered */}
                                <div className="hidden md:block space-y-3 max-h-[220px] overflow-y-auto pr-1 pb-3 border-b border-slate-100">
                                    {cartItems.map((item) => {
                                        const size = Number(item.unitValue)
                                        const pack = size > 0 ? `${size} ${item.unit || ''}`.trim() : (item.unit || '')
                                        const unitPrice = getActivePrice ? getActivePrice(item) : Number(item.price) || 0
                                        return (
                                            <div key={item.id} className="flex items-center gap-3">
                                                <img src={item.primaryImage || item.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-50 shrink-0" onError={(e) => { e.target.style.visibility = 'hidden' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[16px] font-bold text-slate-900 truncate">{item.name}</p>
                                                    <p className="text-[14px] text-slate-600">₹{unitPrice} / {pack}</p>
                                                </div>
                                                <p className="text-[14px] text-slate-600 text-right tabular-nums">{item.quantity} × {pack}</p>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="space-y-4 pt-2">
                                    <div className="flex justify-between items-center text-sm md:text-[17px] font-medium text-slate-500">
                                        <span>Order Value</span>
                                        <span>₹{cartTotal}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm md:text-[17px] font-medium text-slate-500">
                                        <span>Delivery Fee</span>
                                        <span className={finalDeliveryFee === 0 ? "text-green-600 font-bold" : ""}>
                                            {finalDeliveryFee === 0 ? 'FREE' : `₹${finalDeliveryFee}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm md:text-[17px] font-medium text-slate-500">
                                        <span>Taxes & Charges ({taxRateString}%)</span>
                                        <span title={`GST applied to total order amount`}>₹{tax}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                                            <span>Coupon Discount</span>
                                            <span>- ₹{discountAmount}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center justify-between text-[11px] md:text-[15px] font-bold text-slate-600">
                                        <span>KK Wallet Balance</span>
                                        <span className="tabular-nums">₹{balance.toLocaleString()}</span>
                                    </div>
                                    {selectedMethod === 'wallet' && (
                                        <div className="flex items-center justify-between text-[11px] md:text-[15px] font-bold text-primary">
                                            <span>{walletShortfall > 0 ? 'Wallet Used Now' : 'Wallet Covers'}</span>
                                            <span className="tabular-nums">₹{walletContribution.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {isWalletShort && (
                                        <div className="flex items-center justify-between text-[11px] md:text-[15px] font-bold text-blue-600">
                                            <span>Online Remaining</span>
                                            <span className="tabular-nums">₹{walletShortfall.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {selectedMethod === 'credit' && (
                                        <div className="flex items-center justify-between text-[11px] md:text-[15px] font-bold text-amber-700">
                                            <span>{creditShortfall > 0 ? 'Credit Used Now' : 'Credit Covers'}</span>
                                            <span className="tabular-nums">₹{creditContribution.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {isCreditShort && (
                                        <div className="flex items-center justify-between text-[11px] md:text-[15px] font-bold text-blue-600">
                                            <span>Online Remaining</span>
                                            <span className="tabular-nums">₹{creditShortfall.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-[11px] md:text-[15px] font-bold text-amber-700">
                                        <span>KK Credit Available</span>
                                        <span className="tabular-nums">₹{availableCredit.toLocaleString()}</span>
                                    </div>
                                </div>

                                {isWalletShort && (
                                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] font-bold text-blue-700">
                                        Your wallet balance will be used first. The remaining ₹{walletShortfall.toLocaleString()} will open in online payment automatically.
                                    </div>
                                )}
                                {isCreditShort && (
                                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] font-bold text-blue-700">
                                        Your credit balance will be used first. The remaining ₹{creditShortfall.toLocaleString()} will open in online payment automatically.
                                    </div>
                                )}

                                <div className="border-t border-slate-100 pt-6">
                                    <div className="hidden md:flex justify-between items-center mb-8">
                                        <span className="text-[24px] font-bold text-slate-900">Total Payable</span>
                                        <span className="text-[34px] font-bold text-green-700 tracking-tight tabular-nums">₹{total}</span>
                                    </div>

                                    <Button
                                        onClick={handlePlaceOrder}
                                        disabled={isPlacingOrder || cartItems.length === 0}
                                        className="hidden md:flex w-full h-16 rounded-2xl bg-green-700 hover:bg-green-800 text-[20px] font-bold shadow-lg shadow-green-700/20 transition-all active:scale-[0.98] items-center justify-center gap-3"
                                    >
                                        {isPlacingOrder ? <Loader2 className="animate-spin mr-2" /> : <>Place Order Now <ArrowRight size={22} /></>}
                                    </Button>

                                    <div className="mt-4 md:mt-6 flex items-center justify-center gap-2 text-slate-400 md:rounded-xl md:bg-green-50 md:py-3 md:text-green-800">
                                        <ShieldCheck size={16} className="md:w-6 md:h-6 md:text-green-700" />
                                        <span className="text-[11px] md:text-[15px] font-medium md:font-semibold">Safe & Secure Transactions</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integrated Sticky Proceed Bar - Mobile Only */}
                <div className="fixed bottom-0 left-0 right-0 z-60 bg-white/95 backdrop-blur-xl border-t border-slate-100/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] max-w-md mx-auto md:hidden">
                    <div className="flex items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <div className="shrink-0 flex flex-col justify-center min-w-0 max-w-[42%]">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Final Amount</span>
                            <span className="text-lg font-black text-slate-900 leading-none tracking-tight tabular-nums truncate">₹{total}</span>
                        </div>

                        <Button
                            onClick={handlePlaceOrder}
                            disabled={isPlacingOrder || cartItems.length === 0}
                            className="flex-1 min-h-[48px] h-11 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold shadow-md shadow-primary/15 transition-all active:scale-[0.98] flex items-center justify-center px-3"
                        >
                            {isPlacingOrder ? <Loader2 className="animate-spin mr-2 size-4" /> : 'Place Order Now'}
                        </Button>
                    </div>
                </div>

                {/* Edit Address Drawer */}
                <AnimatePresence>
                    {isEditingAddress && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsEditingAddress(false)}
                                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-100"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-101 shadow-2xl md:max-w-xl md:mx-auto md:bottom-10 md:rounded-[40px] flex flex-col max-h-[90vh]"
                            >
                                <div className="flex justify-between items-center mb-6 px-8 pt-8 shrink-0">
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {ctxHasDeliveryPinned && !addressDetails.flat ? 'Complete Delivery Address' : 'Change Delivery Address'}
                                    </h2>
                                    <button onClick={() => setIsEditingAddress(false)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto px-8 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Save as</label>
                                        <div className="flex gap-2">
                                            {ADDRESS_TAGS.map((tag) => (
                                                <button
                                                    key={tag.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setAddressTag(tag.value);
                                                        
                                                        // Load existing address for Home/Work/Other
                                                        const existing = savedAddresses.find(a => a.tag === tag.value);
                                                        if (existing) {
                                                            setAddressDetails(existing.details);
                                                        } else {
                                                            // If no existing address for this tag, reset to pinned location defaults
                                                            const streetAddress = extractStreetAddress(ctxDeliveryAddress, ctxDeliveryComponents);
                                                            setAddressDetails({
                                                                flat: '',
                                                                floor: '',
                                                                colony: streetAddress || ctxDeliveryComponents?.area || '',
                                                                landmark: '',
                                                                city: ctxDeliveryComponents?.city || 'Indore',
                                                                state: ctxDeliveryComponents?.state || 'Madhya Pradesh',
                                                                pincode: ctxDeliveryComponents?.pincode || '',
                                                            });
                                                        }
                                                    }}
                                                    className={cn(
                                                        "px-3 py-2 rounded-xl border text-xs font-bold transition-all",
                                                        addressTag === tag.value
                                                            ? "border-primary bg-primary/5 text-primary"
                                                            : "border-slate-200 text-slate-500 hover:border-slate-300"
                                                    )}
                                                >
                                                    {tag.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={handleUseCurrentLocationInForm}
                                            disabled={isLocatingInForm}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-bold text-primary active:scale-[0.99] transition-all disabled:opacity-60"
                                        >
                                            {isLocatingInForm
                                                ? <><Loader2 size={16} className="animate-spin" /> Fetching your location...</>
                                                : <><LocateFixed size={16} /> Use my current location</>}
                                        </button>
                                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                                            <span className="h-px flex-1 bg-slate-100" /> or search <span className="h-px flex-1 bg-slate-100" />
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                <MapPin size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => handleSearchChange(e.target.value)}
                                                placeholder="Search for your colony or area..."
                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 pl-10 text-sm font-bold placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                                            />
                                            {searchQuery && (
                                                <button 
                                                    onClick={() => {
                                                        setSearchQuery('');
                                                        setSuggestions([]);
                                                    }}
                                                    className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors p-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                            
                                            {isSearching && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <Loader2 size={16} className="animate-spin text-primary" />
                                                </div>
                                            )}
                                            
                                            <AnimatePresence>
                                                {suggestions.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[999] overflow-hidden py-2"
                                                    >
                                                        {suggestions.map((s, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => handleSelectSuggestion(s)}
                                                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-start gap-3"
                                                            >
                                                                <MapPin size={14} className="mt-1 text-slate-300" />
                                                                <span className="text-xs font-bold text-slate-700 leading-tight">{s.description}</span>
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="h-px bg-slate-100 my-2" />
                                        
                                        <div className="space-y-3">
                                        <input
                                            type="text"
                                            value={addressDetails.flat}
                                            onChange={(e) => setAddressDetails(prev => ({ ...prev, flat: e.target.value }))}
                                            placeholder="Flat / House No. *"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                        <input
                                            type="text"
                                            value={addressDetails.floor}
                                            onChange={(e) => setAddressDetails(prev => ({ ...prev, floor: e.target.value }))}
                                            placeholder="Floor (Optional)"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                        <input
                                            type="text"
                                            value={addressDetails.colony}
                                            onChange={(e) => setAddressDetails(prev => ({ ...prev, colony: e.target.value }))}
                                            placeholder="Colony / Street / Area *"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                        <input
                                            type="text"
                                            value={addressDetails.landmark}
                                            onChange={(e) => setAddressDetails(prev => ({ ...prev, landmark: e.target.value }))}
                                            placeholder="Landmark (Optional)"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={addressDetails.city}
                                                readOnly
                                                placeholder="City *"
                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-not-allowed opacity-70"
                                            />
                                            <input
                                                type="text"
                                                value={addressDetails.state}
                                                readOnly
                                                placeholder="State *"
                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-not-allowed opacity-70"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={addressDetails.pincode}
                                            readOnly
                                            placeholder="Pincode (Optional)"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-not-allowed opacity-70"
                                        />
                                    </div>
                                </div>
                                </div>
                                <div className="shrink-0 px-8 pt-4 pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
                                    <Button
                                        onClick={async () => {
                                            if (!addressDetails.flat || !addressDetails.colony || !addressDetails.city || !addressDetails.state) {
                                                toast.error("Please fill all mandatory fields (Flat, Colony, City, State)");
                                                return;
                                            }

                                            // Validation: Check if manual city matches pinned city (only for a pinned address)
                                            if (addressSourceRef.current === 'pin' && ctxDeliveryComponents?.city) {
                                                const manualCity = addressDetails.city.trim().toLowerCase();
                                                const pinnedCity = ctxDeliveryComponents.city.trim().toLowerCase();
                                                if (manualCity && !pinnedCity.includes(manualCity) && !manualCity.includes(pinnedCity)) {
                                                    toast.error(`The city you typed does not match the location pinned on the map. Please fix the city or re-pin your location.`);
                                                    return;
                                                }
                                            }

                                            const fullAddress = buildFullAddress(addressDetails)
                                            try {
                                                await persistAddressToProfile(fullAddress)
                                                const lat = Number(ctxDeliveryLocation?.lat), lng = Number(ctxDeliveryLocation?.lng)
                                                const pinLocation = addressSourceRef.current === 'pin' && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined
                                                const next = upsertSavedAddress(savedAddresses, addressTag, addressDetails, { location: pinLocation })
                                                persistSavedAddresses(next)
                                                const savedEntry = next.find((a) => a.fullAddress === fullAddress && (a.tag === addressTag || addressTag === 'other'))
                                                if (savedEntry) handleSelectSavedAddress(savedEntry, { silent: true })
                                                toast.success('Address saved')
                                            } catch (error) {
                                                console.error('Save address error:', error)
                                                toast.error('Failed to save address')
                                                return
                                            }
                                            setIsEditingAddress(false)
                                        }}
                                        className="w-full h-12 rounded-xl bg-primary font-bold text-white shadow-lg shadow-green-100"
                                    >
                                        Save Address
                                    </Button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </PageTransition>
    )
}





