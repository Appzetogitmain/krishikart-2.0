/** Renders `text` with every occurrence of the search words highlighted. */
export default function HighlightText({ text = '', query = '' }) {
    const value = String(text ?? '')
    const words = String(query || '').trim().split(/\s+/).filter((w) => w.length > 0)
    if (!words.length) return value

    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const parts = value.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
    const lower = words.map((w) => w.toLowerCase())

    return parts.map((part, i) =>
        lower.includes(part.toLowerCase())
            ? <mark key={i} className="kk-highlight">{part}</mark>
            : part
    )
}
