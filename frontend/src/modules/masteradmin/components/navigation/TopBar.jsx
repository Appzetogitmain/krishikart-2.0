import {
  Bell,
  Search,
  UserCircle,
  RefreshCw,
  X,
  ShoppingCart,
  Users,
  Box,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { getSocket, joinAdminDeliveryTracking } from "@/lib/socket";
import { useMasterAdminAuth } from "../../contexts/MasterAdminAuthContext";

const formatNotificationTime = (createdAt) => {
  if (!createdAt) return "Just now";

  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) return "Just now";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
};

export default function TopBar() {
  const navigate = useNavigate();
  const { admin, logout } = useMasterAdminAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState({
    products: [],
    orders: [],
    vendors: [],
    franchises: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const profileMenuRef = useRef(null);
  const notificationMenuRef = useRef(null);
  const searchResultsRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async ({ silent = false } = {}) => {
    if (!silent) setIsNotificationsLoading(true);

    try {
      const response = await api.get("/masteradmin/notifications", {
        params: { limit: 20 },
      });
      const result = response.data?.result || {};
      setNotifications(result.notifications || []);
    } catch (error) {
      console.error("Admin notifications fetch error:", error);
    } finally {
      if (!silent) setIsNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const socket = getSocket();
    joinAdminDeliveryTracking();

    const handleAdminNotification = (payload) => {
      if (!payload?.id) return;

      setNotifications((prev) => {
        const deduped = prev.filter((item) => item.id !== payload.id);
        return [payload, ...deduped].slice(0, 20);
      });
    };

    socket.on("admin_notification", handleAdminNotification);
    return () => {
      socket.off("admin_notification", handleAdminNotification);
    };
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const response = await api.get(
            `/masteradmin/search?query=${searchQuery}`,
          );
          if (response.data.success) {
            setResults(response.data.result);
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults({ products: [], orders: [], vendors: [], franchises: [] });
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }

      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }

      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getLink = (category, item) => {
    switch (category) {
      case "products":
        return `/masteradmin/products/edit/${item._id}`;
      case "orders":
        return "/masteradmin/orders";
      case "vendors":
        return "/masteradmin/vendors";
      case "franchises":
        return "/masteradmin/franchises";
      default:
        return "#";
    }
  };

  const openNotification = async (notification) => {
    try {
      if (!notification.read) {
        await api.post(`/masteradmin/notifications/${notification.id}/read`);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, read: true } : item,
          ),
        );
      }
    } catch (error) {
      console.error("Mark notification read error:", error);
    } finally {
      setShowNotifications(false);
      if (notification.link) navigate(notification.link);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.post("/masteradmin/notifications/read-all");
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error("Mark all notifications read error:", error);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
      <div className="flex-1 flex items-center">
        <div className="relative w-full max-w-sm" ref={searchResultsRef}>
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-sm group focus-within:bg-white focus-within:border-slate-300 focus-within:ring-1 focus-within:ring-slate-900/5 transition-all w-full">
            <Search
              size={14}
              className="text-slate-400 group-focus-within:text-slate-900"
            />
            <input
              type="text"
              placeholder="Search products, orders, or vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.trim())}
              onFocus={() => setShowResults(true)}
              className="bg-transparent border-none outline-none text-[11px] w-full font-bold placeholder:text-slate-400 text-slate-900"
            />
            <div className="px-1.5 py-0.5 border border-slate-200 rounded-sm text-[10px] font-black text-slate-400 group-focus-within:opacity-0 transition-opacity">
              {isSearching ? (
                <RefreshCw size={10} className="animate-spin" />
              ) : (
                "⌘K"
              )}
            </div>
          </div>

          <AnimatePresence>
            {showResults && searchQuery.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-sm overflow-hidden z-[100] max-h-[400px] flex flex-col"
              >
                <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Search Results
                  </span>
                  <button
                    onClick={() => setShowResults(false)}
                    className="text-slate-400 hover:text-slate-900"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar">
                  {Object.entries(results).map(
                    ([category, items]) =>
                      items.length > 0 && (
                        <div
                          key={category}
                          className="p-2 border-b border-slate-50 last:border-none"
                        >
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2 px-2">
                            {category}
                          </h4>
                          <div className="space-y-1">
                            {items.map((item, idx) => (
                              <Link
                                key={idx}
                                to={getLink(category, item)}
                                onClick={() => setShowResults(false)}
                                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-sm transition-colors group"
                              >
                                <div className="w-8 h-8 bg-slate-100 rounded-sm flex-shrink-0 flex items-center justify-center text-slate-400 group-hover:bg-slate-200 overflow-hidden">
                                  {item.primaryImage || item.profilePicture ? (
                                    <img
                                      src={
                                        item.primaryImage ||
                                        item.profilePicture
                                      }
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : category === "orders" ? (
                                    <Box size={14} />
                                  ) : category === "vendors" ? (
                                    <Users size={14} />
                                  ) : (
                                    <ShoppingCart size={14} />
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-bold text-slate-900 truncate leading-tight">
                                    {item.name ||
                                      item.fullName ||
                                      item.franchiseName ||
                                      `#${item._id.slice(-6)}`}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                                    {item.category?.name ||
                                      item.orderStatus ||
                                      item.email ||
                                      item.city ||
                                      "Detail"}
                                  </span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ),
                  )}

                  {Object.values(results).every((arr) => arr.length === 0) &&
                    searchQuery.length >= 2 &&
                    !isSearching && (
                      <div className="p-8 text-center flex flex-col items-center gap-2">
                        <Search size={24} className="text-slate-200" />
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          No matching results found
                        </p>
                      </div>
                    )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 relative" ref={notificationMenuRef}>
          <button
            onClick={() => {
              setShowNotifications((prev) => !prev);
              if (!showNotifications) {
                fetchNotifications({ silent: true });
              }
            }}
            className="relative p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-all"
            aria-label="Open notifications"
            aria-expanded={showNotifications}
          >
            <Bell size={20} strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 rounded-full border-2 border-white text-[10px] font-black text-white flex items-center justify-center shadow-sm">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 shadow-2xl rounded-sm overflow-hidden z-[100]"
              >
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Notifications
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {unreadCount} unread
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchNotifications()}
                      className="p-1 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm transition-colors"
                      title="Refresh notifications"
                    >
                      <RefreshCw
                        size={12}
                        className={isNotificationsLoading ? "animate-spin" : ""}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-900"
                    >
                      Mark all read
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className={cn(
                          "w-full text-left p-3 border-b border-slate-50 last:border-none hover:bg-slate-50 transition-colors",
                          !notification.read && "bg-sky-50/40",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 leading-tight">
                              {notification.title}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed">
                              {notification.message}
                            </p>
                          </div>
                          {!notification.read && (
                            <span className="mt-1 w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                          {formatNotificationTime(notification.createdAt)}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Bell size={24} className="mx-auto text-slate-100 mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        No notifications yet
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className="flex items-center gap-3 pl-4 border-l border-slate-200 relative"
          ref={profileMenuRef}
        >
          <button
            type="button"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center gap-3 text-left rounded-sm hover:bg-slate-50 transition-colors px-1.5 py-1"
            aria-label="Open profile menu"
            aria-expanded={showProfileMenu}
          >
            <div className="text-right hidden sm:block">
              <p className="text-[13px] font-black text-slate-900 leading-none uppercase tracking-tight">
                {admin?.fullName || "Administrator"}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                {admin?.role?.replace("_", " ") || "Admin"}
              </p>
            </div>
            <div className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 hover:border-slate-900 transition-colors overflow-hidden">
              {admin?.profilePicture ? (
                <img
                  src={admin.profilePicture}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle size={24} />
              )}
            </div>
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-sm overflow-hidden z-[100]"
              >
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                    {admin?.fullName || "Administrator"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {admin?.email || admin?.role?.replace("_", " ") || "Admin"}
                  </p>
                </div>

                <div className="py-1">
                  <Link
                    to="/masteradmin/settings?section=profile"
                    onClick={() => setShowProfileMenu(false)}
                    className="block px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors uppercase tracking-widest"
                  >
                    View Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors uppercase tracking-widest"
                  >
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
