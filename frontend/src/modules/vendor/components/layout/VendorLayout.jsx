import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '../navigation/BottomNav';
import Sidebar from '../navigation/Sidebar';
import { Suspense, useState } from 'react';
import NewAssignmentAlert from '../modals/NewAssignmentAlert';
import VendorStatusAlert from '../modals/VendorStatusAlert';
import { useVendorAuth } from '../../contexts/VendorAuthContext';
import { VendorLanguageProvider, useVendorLanguage } from '../../contexts/VendorLanguageContext';
import LanguagePickerModal from '../modals/LanguagePickerModal';

// Inter has no Indian scripts; fall back to fonts every phone/PC already has for them
const PORTAL_FONT = { fontFamily: "'Inter', 'Noto Sans', 'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', system-ui, sans-serif" };

export default function VendorLayout() {
    return (
        <VendorLanguageProvider>
            <VendorLayoutInner />
        </VendorLanguageProvider>
    );
}

function FirstLoginLanguage() {
    const { needsChoice } = useVendorLanguage();
    return <LanguagePickerModal open={needsChoice} />;
}

function VendorLayoutInner() {
    const { 
        isAlertOpen, 
        setIsAlertOpen, 
        newAssignmentData,
        isStatusAlertOpen,
        setIsStatusAlertOpen,
        statusAlertData
    } = useVendorAuth();
    const location = useLocation();

    // Global Audio Unlocker (Modern Browser requirement)
    useState(() => {
        const unlockAudio = () => {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            if (context.state === 'suspended') {
                context.resume();
            }
            // Also play a silent buffer
            const buffer = context.createBuffer(1, 1, 22050);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);

            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);
    });

    const isAuthPage = location.pathname === '/vendor/login' ||
        location.pathname === '/vendor/signup' ||
        location.pathname === '/vendor/forgot-password' ||
        location.pathname.startsWith('/vendor/terms');

    if (isAuthPage) {
        return (
            <div className="min-h-screen bg-white">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="h-full"
                    >
                        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" /></div>}>
                            <Outlet />
                        </Suspense>
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    // Only hide bottom nav on order detail pages (e.g. /vendor/orders/:id).
    // Do NOT use pathname.includes('/dispatch') — it also matches /vendor/dispatch-history and hid the bar there.
    const hideNav = location.pathname.includes('/orders/');

    return (
        <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-slate-900 selection:text-white" style={PORTAL_FONT}>
            {/* Desktop Sidebar (Only visible on lg screens) */}
            <div className="hidden lg:block lg:w-72 fixed inset-y-0 left-0 z-50">
                <Sidebar />
            </div>

            <div className="flex-1 flex flex-col min-w-0 lg:ml-72 pb-20 lg:pb-10">
                <main className="flex-1 overflow-x-hidden px-4 py-5 md:p-8 lg:p-8">
                    {/* Quick fade-in only: waiting for the old page to animate out made every tab switch feel like a reload */}
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0.6 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.12 }}
                        className="h-full max-w-7xl mx-auto"
                    >
                        <Suspense fallback={
                            <div className="h-full w-full flex items-center justify-center p-20">
                                <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
                            </div>
                        }>
                            <Outlet />
                        </Suspense>
                    </motion.div>
                </main>
            </div>

            {/* Mobile bottom nav - full-width bar like user app (not floating) */}
            {!hideNav && <BottomNav />}

            <NewAssignmentAlert
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                data={newAssignmentData}
            />

            <FirstLoginLanguage />

            <VendorStatusAlert 
                isOpen={isStatusAlertOpen}
                onClose={() => setIsStatusAlertOpen(false)}
                data={statusAlertData}
            />
        </div>
    );
}
