import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * App-wide "Are you sure?" dialog - used instead of the browser's window.confirm (client, Nov 2026:
 * no default browser pop-ups anywhere). Messages / errors use toast (sonner) instead of alert().
 *
 *   if (!(await askConfirm({ title: 'Delete this coupon?', message: '...', confirmLabel: 'Delete', tone: 'danger' }))) return;
 *
 * <ConfirmHost /> is mounted once in App.jsx.
 */

let openDialog = null;

export function askConfirm(options = {}) {
    // A plain question: deleting / removing something gets the red style
    const opts = typeof options === 'string'
        ? { message: options, ...(/delete|remove|decommission|discard|permanent/i.test(options) ? { tone: 'danger', confirmLabel: 'Yes' } : { confirmLabel: 'Yes' }) }
        : options;
    if (!openDialog) return Promise.resolve(false); // host not mounted: never act without an answer
    return new Promise((resolve) => openDialog({ ...opts, resolve }));
}

export function ConfirmHost() {
    const [req, setReq] = useState(null);

    useEffect(() => {
        openDialog = (r) => setReq((cur) => {
            cur?.resolve(false); // a newer question replaces an unanswered one
            return r;
        });
        return () => { openDialog = null; };
    }, []);

    useEffect(() => {
        if (!req) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter') close(true);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const close = (answer) => {
        req?.resolve(answer);
        setReq(null);
    };

    if (!req) return null;
    const danger = req.tone === 'danger';
    return (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4" data-confirm-dialog>
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => close(false)} />
            <div role="alertdialog" aria-modal="true" className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center">{req.title || 'Are you sure?'}</h3>
                {req.message && <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed whitespace-pre-line">{req.message}</p>}
                <div className="grid grid-cols-2 gap-3 mt-6">
                    <button type="button" onClick={() => close(false)} data-confirm-cancel
                        className="py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm active:scale-[0.98] transition-all">
                        {req.cancelLabel || 'Cancel'}
                    </button>
                    <button type="button" onClick={() => close(true)} data-confirm-ok autoFocus
                        className={`py-3 rounded-xl text-white font-semibold text-sm active:scale-[0.98] transition-all ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-green-700 hover:bg-green-800'}`}>
                        {req.confirmLabel || 'Yes, continue'}
                    </button>
                </div>
            </div>
        </div>
    );
}
