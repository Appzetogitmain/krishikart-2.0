import {
    LayoutDashboard,
    Package,
    ClipboardList,
    Truck,
    History,
    UserCircle,
    HelpCircle,
    FileText,
    Archive
} from 'lucide-react';

/**
 * Single source of truth for vendor app navigation.
 * Desktop sidebar shows all; mobile bottom bar scrolls horizontally to fit the same items.
 */
export const vendorNavItems = [
    { id: 'dashboard', path: '/vendor/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Home' },
    { id: 'orders', path: '/vendor/orders', icon: ClipboardList, label: 'Manage Orders', shortLabel: 'Orders' },
    { id: 'inventory', path: '/vendor/inventory', icon: Package, label: 'Inventory', shortLabel: 'Stock' },
    { id: 'dispatch', path: '/vendor/dispatch', icon: Truck, label: 'Active Dispatch', shortLabel: 'Dispatch' },
    { id: 'quotations', path: '/vendor/quotations', icon: FileText, label: 'Proposals & Audits', shortLabel: 'Quotes' },
    { id: 'history', path: '/vendor/dispatch-history', icon: History, label: 'Dispatch History', shortLabel: 'History' },
    { id: 'reports', path: '/vendor/reports', icon: FileText, label: 'Reports', shortLabel: 'Reports' },
    { id: 'rejections', path: '/vendor/rejected-stock', icon: Archive, label: 'Rejected Stock', shortLabel: 'Rejected' },
    {
        id: 'profile',
        path: '/vendor/profile',
        icon: UserCircle,
        label: 'Account Settings',
        shortLabel: 'Account',
    },
    { id: 'help', path: '/vendor/help-support', icon: HelpCircle, label: 'Help & Support', shortLabel: 'Help' },
];

/**
 * Active state for sidebar / bottom nav (avoids /vendor/dispatch matching /vendor/dispatch-history).
 */
export function isVendorNavActive(pathname, itemPath) {
    if (itemPath === '/vendor/dashboard') {
        return pathname === '/vendor/dashboard' || pathname === '/vendor';
    }
    if (itemPath === '/vendor/orders') {
        return pathname.startsWith('/vendor/orders');
    }
    if (itemPath === '/vendor/dispatch') {
        return pathname === '/vendor/dispatch';
    }
    if (itemPath === '/vendor/dispatch-history') {
        return pathname === '/vendor/dispatch-history';
    }
    if (itemPath === '/vendor/quotations') {
        return pathname.startsWith('/vendor/quotations');
    }
    if (itemPath === '/vendor/reports') {
        return pathname === '/vendor/reports';
    }
    if (itemPath === '/vendor/rejected-stock') {
        return pathname === '/vendor/rejected-stock';
    }
    return pathname === itemPath;
}
