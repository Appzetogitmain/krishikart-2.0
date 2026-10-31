/**
 * City filter for head office (client, Nov 2026): the main admin - or a regional admin with several cities -
 * picks one city in the top bar and the whole panel (dashboard, orders, reports, lists, notifications) shows
 * only that city. Sent to the server as the "X-Admin-City" header (src/lib/axios.js); the server ignores it for
 * anyone not allowed to see that city. Kept per browser.
 */
const KEY = 'kkAdminCity';

export const getAdminCity = () => {
    try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
};

/** Switch city ('' = all cities) and reload, so every page fetches its data again */
export const setAdminCity = (code) => {
    try {
        if (code) localStorage.setItem(KEY, String(code).toUpperCase());
        else localStorage.removeItem(KEY);
    } catch { /* storage blocked: stays on all cities */ }
    window.location.reload();
};
