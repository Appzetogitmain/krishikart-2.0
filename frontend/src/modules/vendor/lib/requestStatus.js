/** One place for what each procurement status means to the vendor (label, colour, next step). */

export const REQUEST_STATUS = {
    pending_assignment: { label: 'New request', cls: 'bg-blue-50 text-blue-700', next: 'Enter your rates' },
    assigned: { label: 'New request', cls: 'bg-blue-50 text-blue-700', next: 'Enter your rates' },
    requested: { label: 'New request', cls: 'bg-blue-50 text-blue-700', next: 'Enter your rates' },
    quoted: { label: 'Quote sent', cls: 'bg-amber-50 text-amber-700', next: 'Waiting for admin' },
    negotiating: { label: 'Admin offer', cls: 'bg-orange-50 text-orange-700', next: 'Reply to the offer' },
    approved: { label: 'To be packed', cls: 'bg-amber-50 text-amber-700', next: 'Pack the goods' },
    preparing: { label: 'Packing', cls: 'bg-green-100 text-green-800', next: 'Pack the goods' },
    ready_for_pickup: { label: 'Ready', cls: 'bg-green-100 text-green-800', next: 'Waiting for pickup' },
    picked_up: { label: 'Dispatched', cls: 'bg-green-50 text-green-700', next: '' },
    completed: { label: 'Received', cls: 'bg-green-50 text-green-700', next: '' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-600', next: '' },
};

export const statusOf = (s) => REQUEST_STATUS[s] || { label: s || '—', cls: 'bg-slate-100 text-slate-600', next: '' };

// Statuses where the vendor has to do something now
export const NEEDS_RATES = ['pending_assignment', 'assigned', 'requested'];
export const NEEDS_REPLY = ['negotiating'];
export const TO_PACK = ['approved', 'preparing'];
export const READY = ['ready_for_pickup'];
export const DONE = ['picked_up', 'completed'];

/** The page an order belongs on now (rates on Quotation, packing on Pack & Dispatch, sent ones in history). */
export const pageForRequest = (r) => {
    if (!r) return '/vendor/orders';
    if ([...NEEDS_RATES, ...NEEDS_REPLY, 'quoted'].includes(r.status)) return '/vendor/quotations';
    if ([...TO_PACK, ...READY].includes(r.status)) return `/vendor/dispatch?order=${r._id}`;
    if (DONE.includes(r.status)) return '/vendor/dispatch-history';
    return '/vendor/orders';
};
