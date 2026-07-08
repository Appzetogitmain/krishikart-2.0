import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestFCMToken, messaging, onMessage } from '@/lib/firebase';
import api from '@/lib/axios';
import { toast } from 'sonner';

export const useFCM = (isAuthenticated, userType) => {
    const navigate = useNavigate();

    const saveToken = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const token = await requestFCMToken();

            if (token) {
                const response = await api.post(`/${userType}/fcm-token`, { token });

                if (response.data.success) {
                    localStorage.setItem(`fcm_token_${userType}`, token);
                }
            }
        } catch (error) {
            console.error(`[useFCM] Error in token registration:`, error);
        }
    }, [isAuthenticated, userType]);

    useEffect(() => {
        if (isAuthenticated) {
            saveToken();

            const unsubscribe = onMessage(messaging, async (payload) => {
                const data = payload.data || {};

                window.dispatchEvent(
                    new CustomEvent('kk:fcm-message', {
                        detail: {
                            userType,
                            payload,
                        },
                    }),
                );

                // Show UI toast for immediate feedback
                toast.info(payload.notification.title, {
                    description: payload.notification.body
                });

                // 2. Show native notification via Service Worker registration
                // Force Action Center visibility with high priority flags
                if (typeof window !== 'undefined' && 'Notification' in window && window.Notification && window.Notification.permission === 'granted') {
                    try {
                        if ('serviceWorker' in navigator) {
                            const registration = await navigator.serviceWorker.ready;
                            if (registration) {
                                registration.showNotification(payload.notification.title || 'Kisaankart', {
                                    body: payload.notification.body || '',
                                    icon: '/favicon.png',
                                    data: payload.data || {},
                                    tag: 'kisaankart-foreground',
                                    badge: '/favicon.png',
                                    requireInteraction: true, // IMPORTANT: Keeps it in the Action Center until dismissed
                                    renotify: true,
                                    silent: false
                                });
                            }
                        }
                    } catch (err) {
                        console.error('[useFCM] Failed to trigger native foreground notification:', err);
                    }
                }

                // 3. Deep-link for delivery assignment notifications while app is in foreground
                if (userType === 'delivery' && data.type === 'new_delivery' && data.orderId && data.link) {
                    try {
                        navigate(data.link);
                    } catch (navErr) {
                        console.error('[useFCM] Failed to navigate on new_delivery notification:', navErr);
                    }
                }

                // 4. Deep-link for vendor procurement assignment notifications while app is in foreground
                if (userType === 'vendor' && data.type === 'assignment' && data.requestId && data.link) {
                    try {
                        navigate(data.link);
                    } catch (navErr) {
                        console.error('[useFCM] Failed to navigate on vendor assignment notification:', navErr);
                    }
                }
            });

            return () => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                } else {
                    console.error('[useFCM] unsubscribe was not a function during cleanup');
                }
            };
        }
    }, [isAuthenticated, saveToken]);

    return { saveToken };
};
