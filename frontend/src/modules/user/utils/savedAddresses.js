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

export function loadSavedAddresses(userId) {
    try {
        const userKey = getSavedAddressesStorageKey(userId)
        const raw = localStorage.getItem(userKey)
        if (raw) {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : []
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

export function saveSavedAddresses(userId, addresses) {
    const key = getSavedAddressesStorageKey(userId)
    localStorage.setItem(key, JSON.stringify(addresses))
}

export function upsertAddressByTag(savedAddresses, tag, details) {
    const normalizedTag = tag || 'other'
    const fullAddress = buildFullAddress(details)
    const label = ADDRESS_TAGS.find((item) => item.value === normalizedTag)?.label || 'Other'

    if (normalizedTag === 'home' || normalizedTag === 'work') {
        return [
            ...savedAddresses.filter((entry) => entry.tag !== normalizedTag),
            {
                id: normalizedTag,
                tag: normalizedTag,
                label,
                details,
                fullAddress,
                updatedAt: new Date().toISOString()
            }
        ]
    }

    const existingIdx = savedAddresses.findIndex((a) => a.fullAddress === fullAddress)
    if (existingIdx > -1) {
        const next = [...savedAddresses]
        next[existingIdx] = { ...next[existingIdx], details, updatedAt: new Date().toISOString() }
        return next
    }

    return [
        ...savedAddresses,
        {
            id: `other_${Date.now()}`,
            tag: 'other',
            label: 'Other',
            details,
            fullAddress,
            updatedAt: new Date().toISOString()
        }
    ]
}

export function deleteSavedAddress(savedAddresses, addressId) {
    return savedAddresses.filter((entry) => (entry.id || entry.tag) !== addressId)
}
