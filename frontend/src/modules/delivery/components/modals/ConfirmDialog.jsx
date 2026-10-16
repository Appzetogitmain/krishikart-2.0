import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

/**
 * "Are you sure?" step shown before an action that changes an order, so a tap made by
 * mistake can still be cancelled. Use it through the useConfirm hook.
 */
export default function ConfirmDialog({
    open,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Yes, continue',
    cancelLabel = 'No, go back',
    tone = 'primary',
    onConfirm,
    onCancel,
}) {
    const confirmClass = tone === 'danger'
        ? 'bg-rose-600 hover:bg-rose-700'
        : 'bg-primary hover:opacity-90';

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        role="alertdialog"
                        aria-modal="true"
                        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 text-center">{title}</h3>
                        {message && (
                            <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">{message}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm active:scale-[0.98] transition-all"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                className={`py-3 rounded-xl text-white font-semibold text-sm active:scale-[0.98] transition-all ${confirmClass}`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
