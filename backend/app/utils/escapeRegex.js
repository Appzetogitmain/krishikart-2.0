/** Text typed by a user, used inside a search pattern: "ras[" or "+" must match literally, not crash the query. */
export const escapeRegex = (s) => String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default escapeRegex;
