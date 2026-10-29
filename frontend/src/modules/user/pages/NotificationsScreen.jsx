import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import { useUserNotifications } from '../contexts/UserNotificationsContext';
import DesktopNotifications from '../components/notifications/DesktopNotifications';

export default function NotificationsScreen() {
    const navigate = useNavigate();
    const { notifications, hasUnread, markAllRead, markAsRead } = useUserNotifications();

    const handleMarkAllRead = useCallback(() => {
        markAllRead();
    }, [markAllRead]);

    return (
        <PageTransition>
            {/* Desktop layout (client mockup, Oct 2026); phones keep the list below */}
            <div className="hidden md:block"><DesktopNotifications /></div>
            <div className="md:hidden bg-[#f8fafd] min-h-screen">
                <div className="bg-white px-4 py-4 md:px-6 md:py-6 border-b border-slate-50 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-90 transition-transform"
                        >
                            <ArrowLeft size={18} className="md:w-5 md:h-5" />
                        </button>
                        <h1 className="text-[16px] md:text-xl font-black text-slate-900 tracking-tight">Notifications</h1>
                    </div>
                    <button
                        onClick={handleMarkAllRead}
                        disabled={!hasUnread}
                        className="text-[10px] font-black uppercase tracking-widest text-primary disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
                    >
                        Mark all read
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {notifications.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-6">
                                <Bell size={32} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900">No Notifications</h3>
                            <p className="text-sm text-slate-400 mt-2">You&apos;re all caught up!</p>
                        </div>
                    ) : (
                        notifications.map((notification, idx) => (
                            <motion.button
                                key={notification.id}
                                type="button"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                onClick={() => markAsRead(notification.id)}
                                className={`w-full text-left p-5 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden transition-colors ${notification.read ? 'bg-white' : 'bg-blue-50/50'}`}
                            >
                                {!notification.read && (
                                    <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-red-500" />
                                )}
                                <div className="flex gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${notification.color}`}>
                                        <notification.icon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900">{notification.title}</h3>
                                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{notification.message}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">{notification.time}</p>
                                    </div>
                                </div>
                            </motion.button>
                        ))
                    )}
                </div>
            </div>
        </PageTransition>
    );
}
