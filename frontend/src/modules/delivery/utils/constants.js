export const DELIVERY_STATUS = {
    ASSIGNED: 'assigned',
    PICKED_UP: 'picked_up',
    ON_THE_WAY: 'on_the_way',
    DELIVERED: 'delivered',
};

export const PRIORITY = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
};

export const ROUTES = {
    LOGIN: '/delivery/login',
    DASHBOARD: '/delivery/dashboard',
    REQUESTS: '/delivery/requests',
    ACTIVE: '/delivery/active',
    HISTORY: '/delivery/history',
    RETURN_PICKUPS: '/delivery/return-pickups',
    COD_REMITTANCE: '/delivery/cod-remittance',
    REPORTS: '/delivery/reports',
    PROFILE: '/delivery/profile',
    MAP: '/delivery/map',
    PICKUP: '/delivery/pickup',
    COMPLETION: '/delivery/completion',
};

export const STATUS_COLORS = {
    [DELIVERY_STATUS.ASSIGNED]: 'bg-blue-100 text-blue-700 border-blue-200',
    [DELIVERY_STATUS.PICKED_UP]: 'bg-purple-100 text-purple-700 border-purple-200',
    [DELIVERY_STATUS.ON_THE_WAY]: 'bg-amber-100 text-amber-700 border-amber-200',
    [DELIVERY_STATUS.DELIVERED]: 'bg-green-100 text-green-700 border-green-200',
};
