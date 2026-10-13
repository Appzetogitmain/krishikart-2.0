/**
 * Ask Cloudinary for a photo sized for where it is shown (and in a modern format) instead of
 * the full-size upload. Non-Cloudinary and already-transformed URLs are returned unchanged.
 */
export function optimizedImage(url, width = 400) {
    if (typeof url !== 'string') return url
    const marker = '/image/upload/'
    const at = url.indexOf(marker)
    if (at === -1 || !url.includes('res.cloudinary.com')) return url
    const rest = url.slice(at + marker.length)
    // Already has a transformation segment (e.g. "w_300,c_fill/…"): leave it alone
    if (/^[a-z]{1,3}_[^/]+\//.test(rest) && !/^v\d+\//.test(rest)) return url
    return `${url.slice(0, at + marker.length)}f_auto,q_auto,c_limit,w_${width}/${rest}`
}
