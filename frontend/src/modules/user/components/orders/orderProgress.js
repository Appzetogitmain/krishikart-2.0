/*
 * Order progress shared by the desktop order pages (client mockups, Oct 2026): which steps are done,
 * which one is current, and when each happened (from order.statusHistory).
 */

export const shortId = (id) => String(id || '').slice(-8).toUpperCase()

const lower = (s) => String(s || '').toLowerCase()

/** Steps for one order. `steps` = [{ key, label, statuses: [...] }] in order. */
export function progressOf(order, steps) {
    const current = lower(order?.orderStatus)
    const history = order?.statusHistory || []
    const at = steps.findIndex((s) => s.statuses.includes(current))
    return steps.map((step, i) => {
        const entry = [...history].reverse().find((h) => step.statuses.includes(lower(h.status)))
        // Steps before the current one are done; the current one is "in progress" (a final step such as
        // Delivered counts as done once reached)
        const done = at > i || (at === i && !!step.final)
        return { ...step, done, current: at === i && !step.final, time: entry?.updatedAt || (i === 0 ? order?.createdAt : null) }
    })
}

// Orders list: four steps; the last reads "Out for delivery" until delivered
export function listSteps(order) {
    const delivered = ['delivered', 'received'].includes(lower(order?.orderStatus))
    return [
        { key: 'ordered', label: 'Ordered', statuses: ['placed', 'pending'] },
        { key: 'preparing', label: 'Preparing', statuses: ['assigned', 'accepted', 'procuring'] },
        { key: 'packed', label: 'Packed', statuses: ['packed', 'ready'] },
        delivered
            ? { key: 'delivered', label: 'Delivered', statuses: ['delivered', 'received'], final: true }
            : { key: 'out', label: 'Out for delivery', statuses: ['dispatched', 'out for delivery'] },
    ]
}

// Order details: six steps across the top
export const DETAIL_STEPS = [
    { key: 'placed', label: 'Order Placed', statuses: ['placed', 'pending'], note: 'We have received your order' },
    { key: 'accepted', label: 'Accepted', statuses: ['assigned', 'accepted'], note: 'The store accepted your order' },
    { key: 'procuring', label: 'Procuring', statuses: ['procuring'], note: 'We are getting your items' },
    { key: 'packed', label: 'Packed', statuses: ['packed', 'ready'], note: 'Your order is packed' },
    { key: 'out', label: 'Out for Delivery', statuses: ['dispatched', 'out for delivery'], note: 'On the way to you' },
    { key: 'delivered', label: 'Delivered', statuses: ['delivered', 'received'], note: 'Delivered at your address', final: true },
]

// Track order: the full timeline
export const TRACK_STEPS = [
    { key: 'placed', label: 'Placed', statuses: ['placed', 'pending'], note: 'We have received your order.' },
    { key: 'accepted', label: 'Accepted', statuses: ['assigned', 'accepted', 'procuring'], note: 'The store has accepted your order and is preparing your items.' },
    { key: 'packed', label: 'Packed', statuses: ['packed', 'ready'], note: 'Your order will be packed soon.', doneNote: 'Your order has been packed.' },
    { key: 'dispatched', label: 'Dispatched', statuses: ['dispatched', 'out for delivery'], note: 'Your order is on the way.' },
    { key: 'delivered', label: 'Delivered', statuses: ['delivered'], note: 'Your order will be delivered at your address.', doneNote: 'Delivered at your address.' },
    { key: 'received', label: 'Received', statuses: ['received'], note: 'Order complete. Thank you!', final: true },
]

// Headline for the current status
export const STATUS_TEXT = {
    placed: ['Order Placed', 'We have received your order.'],
    pending: ['Order Placed', 'We have received your order.'],
    assigned: ['Accepted', 'The store is preparing your order.'],
    accepted: ['Accepted', 'The store is preparing your order.'],
    procuring: ['Procuring', 'The store is preparing your order.'],
    packed: ['Packed', 'Your order is packed and ready.'],
    ready: ['Packed', 'Your order is packed and ready.'],
    dispatched: ['Out for Delivery', 'Your order is on the way.'],
    'out for delivery': ['Out for Delivery', 'Your order is on the way.'],
    delivered: ['Delivered', 'Your order has been delivered.'],
    received: ['Completed', 'Order complete. Thank you!'],
    cancelled: ['Cancelled', 'This order was cancelled.'],
}
export const statusText = (order) => STATUS_TEXT[lower(order?.orderStatus)] || [order?.orderStatus || 'Updating', '']

// Badge colours by status
export function statusTone(status) {
    const s = lower(status)
    if (['delivered', 'received'].includes(s)) return 'bg-green-50 text-green-700 border-green-100'
    if (['dispatched', 'out for delivery'].includes(s)) return 'bg-green-50 text-green-700 border-green-100'
    if (['packed', 'ready'].includes(s)) return 'bg-violet-50 text-violet-700 border-violet-100'
    if (['accepted', 'assigned', 'procuring'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-100'
    if (s === 'cancelled') return 'bg-red-50 text-red-600 border-red-100'
    return 'bg-sky-50 text-sky-700 border-sky-100'
}

// Short label for the badge
export function statusLabel(status) {
    const s = lower(status)
    if (['accepted', 'assigned', 'procuring'].includes(s)) return 'Being prepared'
    if (['packed', 'ready'].includes(s)) return 'Packed'
    if (['dispatched', 'out for delivery'].includes(s)) return 'Out for delivery'
    if (['delivered', 'received'].includes(s)) return 'Delivered'
    if (s === 'cancelled') return 'Cancelled'
    return 'Placed'
}

export const fmtDate = (d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString('en-US', opts) : '')
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '')
export const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString()
export const money = (v, digits = 2) => `₹${(Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`
