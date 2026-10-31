/**
 * Bill for a hotel order, printed from the franchise once the order is packed (client, Oct 2026: "after the order
 * is packed we need to have it billed by means of POS from the franchise"). Same 80 mm thermal format as the
 * counter-sale (POS) receipt. Several orders (a combined card) print in one go, one bill per page.
 */

const BILLABLE = new Set(['packed', 'ready', 'dispatched', 'out for delivery', 'delivered', 'received']);
/** A bill can be printed once the order is packed */
export const canBill = (order) => BILLABLE.has(String(order?.status || order?.orderStatus || '').toLowerCase());

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('en-IN');
const date = (d, withTime) => {
    const x = d ? new Date(d) : null;
    if (!x || Number.isNaN(x.getTime())) return '';
    return x.toLocaleString('en-IN', withTime
        ? { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
        : { day: '2-digit', month: 'short', year: 'numeric' });
};
const payText = (m) => {
    const s = String(m || '').toUpperCase();
    if (s === 'COD') return 'Cash on Delivery';
    if (s.includes('CREDIT')) return 'KK Credit';
    if (s.includes('WALLET')) return 'Kisaankart Wallet';
    if (['UPI', 'CARD', 'ONLINE', 'PREPAID', 'RAZORPAY'].includes(s)) return 'Paid online';
    return m || '';
};

/** Bill number shown on the bill: KK-<last 6 of the order id> */
export const billNumber = (order) => `KK-${String(order?.id || order?._id || '').slice(-6).toUpperCase()}`;

function billHtml(order, franchise) {
    const items = order.items || [];
    const sub = Number(order.subtotal) || items.reduce((s, i) => s + (Number(i.subtotal) || (Number(i.price) || 0) * (Number(i.quantity) || 0)), 0);
    const fee = Number(order.deliveryFee) || 0;
    const tax = Number(order.tax) || 0;
    const disc = Number(order.discountAmount) || 0;
    const total = Number(order.total ?? order.totalAmount) || sub + fee + tax - disc;
    const cod = String(order.paymentMode || order.paymentMethod || '').toUpperCase() === 'COD';
    const gst = franchise?.kyc?.gstNumber || franchise?.gstNumber;
    const storeAddr = franchise?.formattedAddress || [franchise?.area, franchise?.city].filter(Boolean).join(', ');
    const rows = items.map((i) => {
        const q = Number(i.quantity ?? i.qty) || 0;
        const packed = i.packedQuantity !== undefined && i.packedQuantity !== null && Number(i.packedQuantity) !== q ? Number(i.packedQuantity) : null;
        const amount = Number(i.subtotal) || (Number(i.price) || 0) * q;
        return `<div class="item"><div class="name">${esc(i.name)}</div>
            <div class="row"><span>${qty(q)} ${esc(i.unit || '')} x ${money(i.price)}</span><span>${money(amount)}</span></div>
            ${packed !== null ? `<div class="note">Packed: ${qty(packed)} ${esc(i.unit || '')}</div>` : ''}</div>`;
    }).join('');
    return `<section class="bill">
        <div class="center head">
            <div class="brand">KISAANKART</div>
            <div>${esc(franchise?.franchiseName || '')}</div>
            ${storeAddr ? `<div class="small">${esc(storeAddr)}</div>` : ''}
            ${franchise?.mobile ? `<div class="small">Ph: ${esc(franchise.mobile)}</div>` : ''}
            ${gst ? `<div class="small">GSTIN: ${esc(gst)}</div>` : ''}
            <div class="title">BILL / TAX INVOICE</div>
        </div>
        <div class="row"><span>Bill No:</span><span>${esc(billNumber(order))}</span></div>
        <div class="row"><span>Date:</span><span>${esc(date(new Date(), true))}</span></div>
        <div class="row"><span>Order date:</span><span>${esc(date(order.createdAt))}</span></div>
        ${order.deliverySlot || order.deliveryShift ? `<div class="row"><span>Delivery:</span><span>${esc(date(order.scheduledDate || order.createdAt))} ${esc(order.deliverySlot || order.deliveryShift)}</span></div>` : ''}
        <div class="sep"></div>
        <div><b>Bill to:</b> ${esc(order.hotelName || order.customerName || '')}</div>
        ${order.customerMobile ? `<div class="small">Ph: ${esc(order.customerMobile)}</div>` : ''}
        ${order.customerGst ? `<div class="small">GSTIN: ${esc(order.customerGst)}</div>` : ''}
        ${order.shippingAddress ? `<div class="small">${esc(order.shippingAddress)}</div>` : ''}
        <div class="sep"></div>
        ${rows}
        <div class="sep"></div>
        <div class="row"><span>Subtotal</span><span>${money(sub)}</span></div>
        ${fee ? `<div class="row"><span>Delivery fee</span><span>${money(fee)}</span></div>` : ''}
        ${tax ? `<div class="row"><span>Tax</span><span>${money(tax)}</span></div>` : ''}
        ${disc ? `<div class="row"><span>Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}</span><span>-${money(disc)}</span></div>` : ''}
        <div class="row total"><span>TOTAL</span><span>${money(total)}</span></div>
        <div class="row"><span>Payment:</span><span>${esc(payText(order.paymentMode || order.paymentMethod))}</span></div>
        ${cod ? `<div class="row due"><span>To collect</span><span>${money(total)}</span></div>` : ''}
        ${Number(order.packedWeightKg) > 0 ? `<div class="row"><span>Packed weight</span><span>${qty(order.packedWeightKg)} kg</span></div>` : ''}
        <div class="center foot">Thank you for your order!<br/>Kisaankart</div>
    </section>`;
}

/**
 * Opens the print dialog with the bill(s). Returns false when the browser blocked the print window.
 * @param {object[]} orders  franchise-mapped orders (FranchiseOrdersContext) or raw orders
 * @param {object} franchise the logged-in franchise (for the bill header)
 */
export function printBills(orders, franchise) {
    const list = (orders || []).filter(Boolean);
    if (!list.length) return false;
    const style = `<style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0; padding: 8px 10px; font-size: 12px; color: #000; background: #fff; }
        .bill { page-break-after: always; break-after: page; }
        .bill:last-child { page-break-after: auto; break-after: auto; }
        .center { text-align: center; }
        .head { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
        .brand { font-size: 18px; font-weight: bold; }
        .title { margin-top: 6px; font-weight: bold; }
        .small { font-size: 11px; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .row span:last-child { text-align: right; white-space: nowrap; }
        .item { margin-bottom: 4px; }
        .item .name { font-weight: bold; }
        .note { font-size: 11px; }
        .sep { border-top: 1px dashed #000; margin: 6px 0; }
        .total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 4px; margin-top: 2px; }
        .due { font-weight: bold; }
        .foot { margin-top: 12px; font-size: 11px; }
    </style>`;
    const w = window.open('', '_blank', 'width=420,height=640');
    if (!w) return false;
    w.document.write(`<html><head><title>${esc(list.length > 1 ? `${list.length} bills` : billNumber(list[0]))}</title>${style}</head><body>${list.map((o) => billHtml(o, franchise)).join('')}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
    return true;
}
