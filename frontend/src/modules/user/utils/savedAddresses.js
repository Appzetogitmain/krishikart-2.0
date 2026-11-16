import api from '@/lib/axios'

export const SAVED_ADDRESSES_KEY = 'kk_user_saved_addresses'

export const ADDRESS_TAGS = [
    { value: 'home', label: 'Home' },
    { value: 'work', label: 'Work' },
    { value: 'other', label: 'Other' }
]

export const EMPTY_ADDRESS_DETAILS = {
    flat: '',
    floor: '',
    colony: '',
    landmark: '',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '',
}

export function getSavedAddressesStorageKey(userId) {
    return userId ? `${SAVED_ADDRESSES_KEY}_${userId}` : SAVED_ADDRESSES_KEY
}

export function buildFullAddress(details = {}) {
    const parts = []
    if (details.flat) parts.push(`Flat: ${details.flat}`)
    if (details.floor) parts.push(`Floor: ${details.floor}`)
    if (details.colony) parts.push(details.colony)
    if (details.landmark) parts.push(`Landmark: ${details.landmark}`)
    if (details.city) parts.push(details.city)
    if (details.state) parts.push(details.state)
    if (details.pincode) parts.push(details.pincode)
    return parts.join(', ')
}

/** Same address typed with different spaces/case counts as one */
export const addressKey = (text) => String(text ?? '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim().toLowerCase()

/** One entry per address and per id (Home/Work win over an "Other" with the same text). */
export function dedupeAddresses(list = []) {
    const ordered = [...list.filter((a) => a?.tag && a.tag !== 'other'), ...list.filter((a) => !a?.tag || a.tag === 'other')]
    const kept = new Map()
    const byAddress = new Set()
    const ids = new Set()
    const tags = new Set()
    for (const a of ordered) {
        if (!a) continue
        if (a.tag && a.tag !== 'other') {
            if (tags.has(a.tag)) continue
            tags.add(a.tag)
        }
        const key = addressKey(a.fullAddress)
        if (byAddress.has(key)) continue
        byAddress.add(key)
        const entry = { ...a }
        if (!entry.id || ids.has(entry.id)) entry.id = `${entry.tag || 'other'}_${Date.now()}_${kept.size}`
        ids.add(entry.id)
        kept.set(a, entry)
    }
    return list.map((a) => kept.get(a)).filter(Boolean)
}

export function loadSavedAddresses(userId) {
    try {
        const userKey = getSavedAddressesStorageKey(userId)
        const raw = localStorage.getItem(userKey)
        if (raw) {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? dedupeAddresses(parsed) : []
        }

        const legacyRaw = localStorage.getItem(SAVED_ADDRESSES_KEY)
        if (legacyRaw && userId) {
            const parsed = JSON.parse(legacyRaw)
            if (Array.isArray(parsed)) {
                localStorage.setItem(userKey, legacyRaw)
                return parsed
            }
        }
    } catch (error) {
        console.error('Failed to load saved addresses:', error)
    }
    return []
}

/** Saves on this device and on the account (so the list shows on any phone). */
export function saveSavedAddresses(userId, addresses) {
    const key = getSavedAddressesStorageKey(userId)
    try { localStorage.setItem(key, JSON.stringify(addresses)) } catch { /* storage full or blocked */ }
    if (userId) {
        api.put('/user/addresses', { addresses }).catch((error) => {
            console.error('Failed to sync saved addresses:', error)
        })
    }
}

/**
 * Loads the account's saved addresses. For a returning customer the server starts the list
 * from their earlier order addresses. Addresses saved only on this phone (older app versions)
 * are uploaded once so they are not lost.
 */
export async function fetchSavedAddresses(userId) {
    const local = loadSavedAddresses(userId)
    try {
        const res = await api.get('/user/addresses')
        let list = res.data?.results || res.data?.result || []
        if (!Array.isArray(list)) list = []
        // Only addresses really missing on the account (not the same one with other spacing, not one already there by id)
        const missingLocal = local.filter((l) => !list.some((s) => s.id === l.id || addressKey(s.fullAddress) === addressKey(l.fullAddress)))
        if (missingLocal.length) {
            const merged = [...list, ...missingLocal]
            const saved = await api.put('/user/addresses', { addresses: merged })
            list = saved.data?.results || saved.data?.result || merged
        }
        list = dedupeAddresses(list)
        try { localStorage.setItem(getSavedAddressesStorageKey(userId), JSON.stringify(list)) } catch { /* ignore */ }
        return list
    } catch (error) {
        console.error('Failed to load saved addresses:', error)
        return local
    }
}

/** Most recently used (or edited) address first. */
export function sortByRecent(addresses = []) {
    const t = (a) => new Date(a.lastUsedAt || a.updatedAt || 0).getTime()
    return [...addresses].sort((a, b) => t(b) - t(a))
}

/**
 * Add or update an address. Home and Work are one each; "Other" entries are matched by text.
 * `extra` may carry `location` ({lat,lng}) and `lastUsedAt`.
 */
export function upsertAddressByTag(savedAddresses, tag, details, extra = {}) {
    const normalizedTag = tag || 'other'
    const fullAddress = buildFullAddress(details)
    const label = ADDRESS_TAGS.find((item) => item.value === normalizedTag)?.label || 'Other'
    const now = new Date().toISOString()
    const withExtra = (entry, previous) => {
        const next = { ...entry }
        const location = extra.location || (previous && previous.fullAddress === fullAddress ? previous.location : undefined)
        if (location) next.location = location
        else delete next.location
        const lastUsedAt = extra.lastUsedAt || previous?.lastUsedAt
        if (lastUsedAt) next.lastUsedAt = lastUsedAt
        return next
    }

    if (normalizedTag === 'home' || normalizedTag === 'work') {
        const previous = savedAddresses.find((entry) => entry.tag === normalizedTag)
        return [
            ...savedAddresses.filter((entry) => entry.tag !== normalizedTag),
            withExtra({ id: normalizedTag, tag: normalizedTag, label, details, fullAddress, updatedAt: now }, previous)
        ]
    }

    const existingIdx = savedAddresses.findIndex((a) => addressKey(a.fullAddress) === addressKey(fullAddress))
    if (existingIdx > -1) {
        const next = [...savedAddresses]
        next[existingIdx] = withExtra({ ...next[existingIdx], details, updatedAt: now }, next[existingIdx])
        return next
    }

    return [
        ...savedAddresses,
        withExtra({ id: `other_${Date.now()}`, tag: 'other', label: 'Other', details, fullAddress, updatedAt: now })
    ]
}

export function deleteSavedAddress(savedAddresses, addressId) {
    return savedAddresses.filter((entry) => (entry.id || entry.tag) !== addressId)
}
