import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff, Home, ImagePlus, Images, Info, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { askConfirm } from '@/lib/confirmDialog';

/*
 * Offer Banners (client, Nov 2026): the admin uploads offer images that slide by on their own
 * at the top of the customer home page (phones and computers). Up to 6 can show at a time.
 */

const MAX_ACTIVE = 6;
const MAX_MB = 5;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

function useCategories() {
    const [cats, setCats] = useState([]);
    useEffect(() => {
        api.get('/catalog/categories')
            .then(({ data }) => setCats(Array.isArray(data?.results) ? data.results : []))
            .catch(() => { });
    }, []);
    return cats;
}

/** Where the banner goes when tapped: nothing, all products, a category or a custom link */
function LinkPicker({ value, onChange, categories }) {
    const preset = useMemo(() => {
        if (!value) return '';
        if (value === '/products/all') return value;
        if (categories.some((c) => `/products/${c._id}` === value)) return value;
        return 'custom';
    }, [value, categories]);
    const [custom, setCustom] = useState(preset === 'custom');
    const mode = custom ? 'custom' : preset;

    return (
        <div className="space-y-2">
            <select
                value={mode}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'custom') { setCustom(true); onChange(value && preset === 'custom' ? value : ''); }
                    else { setCustom(false); onChange(v); }
                }}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
            >
                <option value="">Nothing (just show the image)</option>
                <option value="/products/all">All products</option>
                {categories.length > 0 && (
                    <optgroup label="A category">
                        {categories.map((c) => <option key={c._id} value={`/products/${c._id}`}>{c.name}</option>)}
                    </optgroup>
                )}
                <option value="custom">Other link…</option>
            </select>
            {mode === 'custom' && (
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="/products/all  or  https://…"
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                />
            )}
        </div>
    );
}

const linkLabel = (link, categories) => {
    if (!link) return 'No link';
    if (link === '/products/all') return 'Opens: All products';
    const cat = categories.find((c) => `/products/${c._id}` === link);
    return cat ? `Opens: ${cat.name}` : `Opens: ${link}`;
};

const checkFile = (file) => {
    if (!file) return false;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) { toast.error('Please choose a JPG, PNG, WEBP or GIF image'); return false; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Image is too big - keep it under ${MAX_MB} MB`); return false; }
    return true;
};

function AddBanner({ categories, onAdded }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState('');
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');
    const [saving, setSaving] = useState(false);
    const [size, setSize] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const pick = (f) => {
        if (!checkFile(f)) return;
        setFile(f);
        const url = URL.createObjectURL(f);
        setPreview(url);
        const img = new Image();
        img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = url;
    };

    const reset = () => { setFile(null); setPreview(''); setTitle(''); setLink(''); setSize(null); if (inputRef.current) inputRef.current.value = ''; };

    const save = async () => {
        if (!file) return toast.error('Please choose the offer image');
        try {
            setSaving(true);
            const fd = new FormData();
            fd.append('image', file);
            fd.append('title', title);
            fd.append('link', link);
            const { data } = await api.post('/banners/admin', fd, MULTIPART);
            toast.success(data?.message || 'Offer banner added');
            reset();
            onAdded();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Could not save the banner');
        } finally {
            setSaving(false);
        }
    };

    const ratio = size ? size.w / size.h : null;
    const offRatio = ratio && (ratio < 2.6 || ratio > 3.4);

    return (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm" data-add-banner>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <ImagePlus size={16} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Add an offer banner</span>
            </div>
            <div className="p-4 grid gap-4 md:grid-cols-[1.4fr_1fr]">
                <div>
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
                        className={cn(
                            'relative w-full aspect-[3/1] rounded-lg border-2 border-dashed overflow-hidden flex flex-col items-center justify-center gap-2 transition-colors',
                            preview ? 'border-transparent' : 'border-slate-300 hover:border-slate-400 bg-slate-50 text-slate-500',
                        )}
                    >
                        {preview ? (
                            <img src={preview} alt="New offer banner" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <>
                                <Upload size={22} />
                                <span className="text-sm font-semibold">Click or drop the offer image here</span>
                                <span className="text-[11px]">Best size: 1500 × 500 px (3:1) · JPG/PNG/WEBP · up to {MAX_MB} MB</span>
                            </>
                        )}
                    </button>
                    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" data-banner-file
                        onChange={(e) => pick(e.target.files?.[0])} />
                    {size && (
                        <p className={cn('mt-2 text-[12px]', offRatio ? 'text-amber-700' : 'text-slate-500')}>
                            {size.w} × {size.h} px
                            {offRatio && ' - this is not 3:1, so the top/bottom or sides will be cut off on the website. Use 1500 × 500 px for the best look.'}
                        </p>
                    )}
                </div>
                <div className="space-y-3">
                    <label className="block space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name (for your reference)</span>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Diwali 20% off"
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
                    </label>
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">When a customer taps it</span>
                        <LinkPicker value={link} onChange={setLink} categories={categories} />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={save} disabled={saving || !file}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md text-[11px] font-bold uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50">
                            <Upload size={14} /> {saving ? 'Uploading…' : 'Add banner'}
                        </button>
                        {file && (
                            <button type="button" onClick={reset} disabled={saving}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100">
                                <X size={14} /> Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function BannerRow({ banner, index, canUp, canDown, categories, busy, onChange, onMove, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(banner.title || '');
    const [link, setLink] = useState(banner.link || '');
    const fileRef = useRef(null);

    return (
        <div className={cn('rounded-lg border bg-white shadow-sm overflow-hidden', banner.isActive ? 'border-slate-200' : 'border-dashed border-slate-300')} data-banner-row={banner._id}>
            <div className="grid md:grid-cols-[320px_1fr]">
                <div className="relative bg-slate-100">
                    <img src={banner.image} alt={banner.title || 'Offer banner'} className={cn('w-full aspect-[3/1] object-cover', !banner.isActive && 'opacity-50 grayscale')} />
                    <span className={cn('absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                        banner.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white')}>
                        {banner.isActive ? `Showing · #${index + 1}` : 'Hidden'}
                    </span>
                </div>
                <div className="p-3 flex flex-col gap-2 min-w-0">
                    {editing ? (
                        <div className="space-y-2">
                            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Name"
                                className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm" />
                            <LinkPicker value={link} onChange={setLink} categories={categories} />
                            <div className="flex gap-2">
                                <button type="button" disabled={busy}
                                    onClick={async () => { if (await onChange(banner._id, { title, link })) setEditing(false); }}
                                    className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-[11px] font-bold uppercase tracking-widest disabled:opacity-50">Save</button>
                                <button type="button" onClick={() => { setEditing(false); setTitle(banner.title || ''); setLink(banner.link || ''); }}
                                    className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{banner.title || 'Untitled offer'}</p>
                            <p className="text-[12px] text-slate-500 truncate">{linkLabel(banner.link, categories)}</p>
                        </div>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-1.5">
                        <button type="button" disabled={busy || !canUp} onClick={() => onMove(index, -1)} title="Move up"
                            className="p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ArrowUp size={14} /></button>
                        <button type="button" disabled={busy || !canDown} onClick={() => onMove(index, 1)} title="Move down"
                            className="p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ArrowDown size={14} /></button>
                        <button type="button" disabled={busy} onClick={() => onChange(banner._id, { isActive: !banner.isActive })} data-toggle-banner
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                            {banner.isActive ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
                        </button>
                        {!editing && (
                            <button type="button" onClick={() => setEditing(true)}
                                className="px-2.5 py-1.5 rounded-md border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50">Edit</button>
                        )}
                        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                            <RefreshCw size={14} /> Change image
                        </button>
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (checkFile(f)) onChange(banner._id, { image: f }); }} />
                        <button type="button" disabled={busy} onClick={() => onDelete(banner)} data-delete-banner
                            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function OfferBannersScreen() {
    const categories = useCategories();
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get('/banners/admin');
            setBanners(Array.isArray(data?.results) ? data.results : []);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Could not load offer banners');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const activeCount = banners.filter((b) => b.isActive).length;
    // Showing ones first (in their order), then hidden ones - the same order the customers see
    const ordered = useMemo(() => [...banners.filter((b) => b.isActive), ...banners.filter((b) => !b.isActive)], [banners]);

    const change = async (id, { image, ...fields }) => {
        try {
            setBusy(true);
            let body = fields;
            if (image) { body = new FormData(); body.append('image', image); }
            const { data } = await api.put(`/banners/admin/${id}`, body, image ? MULTIPART : undefined);
            toast.success(data?.message || 'Saved');
            await load();
            return true;
        } catch (e) {
            toast.error(e.response?.data?.message || 'Could not save');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const move = async (i, dir) => {
        const next = [...ordered];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        setBanners(next);
        try {
            setBusy(true);
            await api.put('/banners/admin/reorder', { ids: next.map((b) => b._id) });
        } catch (e) {
            toast.error(e.response?.data?.message || 'Could not save the order');
            load();
        } finally {
            setBusy(false);
        }
    };

    const remove = async (b) => {
        if (!await askConfirm(`Delete the banner "${b.title || 'Untitled offer'}"? It will stop showing to customers.`)) return;
        try {
            setBusy(true);
            await api.delete(`/banners/admin/${b._id}`);
            toast.success('Offer banner removed');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Could not delete');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-full">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <Home size={12} /><ChevronRight size={10} /><span>Marketing</span><ChevronRight size={10} />
                        <span className="text-slate-900 tracking-widest">Offer banners</span>
                    </div>
                    <h1 className="text-sm font-bold text-slate-900">Home page offer banners</h1>
                </div>
            </header>

            <div className="p-4 max-w-5xl mx-auto space-y-4">
                <div role="note" className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex gap-3 text-xs text-slate-600">
                    <Info size={16} className="shrink-0 text-slate-400 mt-0.5" />
                    <p className="leading-relaxed">
                        These images slide by on their own at the top of the customer home page (website and phone), one every 4 seconds.
                        Keep 3-4 offers showing; up to {MAX_ACTIVE} can show at a time. Use 1500 × 500 px images and keep the text
                        away from the edges. Hidden banners stay saved so you can show them again later.
                    </p>
                </div>

                <AddBanner categories={categories} onAdded={load} />

                <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Your banners</span>
                    <span className="text-[12px] text-slate-600" data-banner-count>
                        <strong className="text-slate-900">{activeCount}</strong> of {MAX_ACTIVE} showing{banners.length > activeCount ? ` · ${banners.length - activeCount} hidden` : ''}
                    </span>
                </div>

                {loading ? (
                    <div className="space-y-3 animate-pulse">
                        {[0, 1].map((i) => <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg" />)}
                    </div>
                ) : ordered.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                        <Images size={28} className="mx-auto mb-2 text-slate-400" />
                        <p className="text-sm font-semibold">No offer banners yet</p>
                        <p className="text-[12px] mt-1">Add the first one above - the home page shows nothing here until you do.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {ordered.map((b, i) => (
                            <BannerRow key={`${b._id}-${b.updatedAt}`} banner={b} index={i} categories={categories}
                                busy={busy} onChange={change}
                                canUp={ordered[i - 1]?.isActive === b.isActive} canDown={ordered[i + 1]?.isActive === b.isActive} onMove={move} onDelete={remove} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
