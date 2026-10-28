import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '../navigation/BottomNav';
import Sidebar from '../navigation/Sidebar';
import { useState, Suspense } from 'react';
import NewOrderAlert from '../modals/NewOrderAlert';
import ProcurementUpdateAlert from '../modals/ProcurementUpdateAlert';
import LanguagePickerModal from '../modals/LanguagePickerModal';
import { FranchiseLanguageProvider, useFranchiseLanguage } from '../../contexts/FranchiseLanguageContext';

export default function FranchiseLayout() {
    return (
        <FranchiseLanguageProvider>
            <FranchiseShell />
        </FranchiseLanguageProvider>
    );
}

/** The owner picks a language the first time they open the portal (no language saved yet). */
function FirstLoginLanguage() {
    const { needsChoice } = useFranchiseLanguage();
    return <LanguagePickerModal open={needsChoice} />;
}

function FranchiseShell() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    // Pages where we might want to hide navigation (e.g., login)
    const hideNav = location.pathname.includes('/login');

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

    return (
        <div className="fixed inset-0 flex overflow-hidden bg-[#f8fafd] text-slate-900 font-sans selection:bg-emerald-100">
            {/* Desktop Sidebar */}
            {!hideNav && <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}

            <main className="flex-1 flex flex-col min-w-0 h-full relative transition-all duration-300">
                <div className="flex-1 overflow-y-scroll overflow-x-hidden scrolling-touch overscroll-contain touch-pan-y custom-scrollbar">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="h-full"
                        >
                            <Suspense fallback={
                                <div className="h-full w-full flex items-center justify-center p-20">
                                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            }>
                                <Outlet />
                            </Suspense>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Mobile Bottom Nav */}
                {!hideNav && (
                    <div className="lg:hidden sticky bottom-0 z-50">
                        <BottomNav />
                    </div>
                )}
            </main>
            <NewOrderAlert />
            <ProcurementUpdateAlert />
            {!hideNav && <FirstLoginLanguage />}
        </div>
    );
}
