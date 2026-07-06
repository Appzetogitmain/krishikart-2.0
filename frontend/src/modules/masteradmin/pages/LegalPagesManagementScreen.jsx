import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Home,
    ChevronRight,
    Save,
    Shield,
    Mail,
    Phone,
    MapPin,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { toast } from 'sonner';

const TABS = [
    { id: 'terms', label: 'Terms & Conditions', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'contact', label: 'Contact Us', icon: Mail },
];

export default function LegalPagesManagementScreen() {
    const [activeTab, setActiveTab] = useState('terms');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [terms, setTerms] = useState({ content: '' });
    const [privacy, setPrivacy] = useState({ content: '', email: '', phone: '' });
    const [contact, setContact] = useState({
        content: '',
        email: '',
        phone: '',
        address: '',
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/masteradmin/legal-cms');
            if (data?.success && data?.result) {
                const r = data.result;
                setTerms({ content: r.terms?.content ?? '' });
                setPrivacy({
                    content: r.privacy?.content ?? '',
                    email: r.privacy?.email ?? '',
                    phone: r.privacy?.phone ?? '',
                });
                setContact({
                    content: r.contact?.content ?? '',
                    email: r.contact?.email ?? '',
                    phone: r.contact?.phone ?? '',
                    address: r.contact?.address ?? '',
                });
            }
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || 'Failed to load legal pages');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const saveSection = async (section) => {
        let payload = {};
        if (section === 'terms') payload = { content: terms.content };
        else if (section === 'privacy') payload = { ...privacy };
        else payload = { ...contact };

        try {
            setSaving(true);
            const { data } = await api.post('/masteradmin/legal-cms', {
                section,
                data: payload,
            });
            if (data?.success) {
                toast.success(data.message || 'Saved');
            }
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-56 bg-slate-100 rounded" />
                <div className="h-10 max-w-md bg-slate-50 border border-slate-200 rounded" />
                <div className="h-[420px] bg-slate-50 border border-slate-200 rounded" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-full">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <Home size={12} />
                        <ChevronRight size={10} />
                        <span>Settings</span>
                        <ChevronRight size={10} />
                        <span className="text-slate-900 tracking-widest">Legal pages</span>
                    </div>
                    <h1 className="text-sm font-bold text-slate-900">Terms, Privacy & Contact</h1>
                </div>
            </header>

            <div className="p-4 max-w-4xl mx-auto space-y-4">
                <div
                    role="note"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex gap-3 text-xs text-slate-600"
                >
                    <Info size={16} className="shrink-0 text-slate-400 mt-0.5" />
                    <p className="leading-relaxed">
                        This content is stored for your apps and public surfaces. Customer-facing apps can read it from{' '}
                        <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">GET /api/masteradmin/public/legal-pages</code>{' '}
                        (no auth).
                    </p>
                </div>

                <div className="flex flex-wrap gap-1 p-1 bg-white border border-slate-200 rounded-lg w-fit">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            className={cn(
                                'inline-flex items-center gap-2 px-3 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors',
                                activeTab === t.id
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                            )}
                        >
                            <t.icon size={14} />
                            {t.label}
                        </button>
                    ))}
                </div>

                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm"
                >
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                            {TABS.find((x) => x.id === activeTab)?.label}
                        </span>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveSection(activeTab)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
                        >
                            <Save size={14} />
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        {activeTab === 'terms' && (
                            <label className="block space-y-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Content (plain text or simple paragraphs)
                                </span>
                                <textarea
                                    value={terms.content}
                                    onChange={(e) => setTerms({ content: e.target.value })}
                                    rows={18}
                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 font-medium leading-relaxed resize-y min-h-[280px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                    placeholder="Enter terms text…"
                                />
                            </label>
                        )}

                        {activeTab === 'privacy' && (
                            <>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <Mail size={12} /> Contact email
                                    </span>
                                    <input
                                        type="email"
                                        value={privacy.email}
                                        onChange={(e) => setPrivacy((p) => ({ ...p, email: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="privacy@example.com"
                                    />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <Phone size={12} /> Contact phone
                                    </span>
                                    <input
                                        type="text"
                                        value={privacy.phone}
                                        onChange={(e) => setPrivacy((p) => ({ ...p, phone: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="+91 …"
                                    />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Policy content (plain text or simple paragraphs)
                                    </span>
                                    <textarea
                                        value={privacy.content}
                                        onChange={(e) => setPrivacy((p) => ({ ...p, content: e.target.value }))}
                                        rows={16}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 font-medium leading-relaxed resize-y min-h-[240px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                        placeholder="Enter privacy policy text…"
                                    />
                                </label>
                            </>
                        )}

                        {activeTab === 'contact' && (
                            <>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <Mail size={12} /> Support email
                                    </span>
                                    <input
                                        type="email"
                                        value={contact.email}
                                        onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="support@example.com"
                                    />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <Phone size={12} /> Phone
                                    </span>
                                    <input
                                        type="text"
                                        value={contact.phone}
                                        onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="+91 …"
                                    />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <MapPin size={12} /> Address
                                    </span>
                                    <textarea
                                        value={contact.address}
                                        onChange={(e) => setContact((c) => ({ ...c, address: e.target.value }))}
                                        rows={3}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-y"
                                        placeholder="Office / registered address"
                                    />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Extra message (optional)
                                    </span>
                                    <textarea
                                        value={contact.content}
                                        onChange={(e) => setContact((c) => ({ ...c, content: e.target.value }))}
                                        rows={8}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm leading-relaxed resize-y min-h-[160px]"
                                        placeholder="Hours, social links, or other contact copy…"
                                    />
                                </label>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
