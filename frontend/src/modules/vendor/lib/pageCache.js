/**
 * Last data each vendor page loaded, kept in memory for this tab.
 * Pages show it straight away when the vendor comes back (no full-page spinner) and refresh it
 * quietly in the background. Cleared on login/logout so one vendor never sees another's data.
 */
const store = new Map();

export const peekPage = (key) => store.get(key);

export const keepPage = (key, value) => {
    store.set(key, value);
    return value;
};

export const clearPageCache = () => store.clear();
