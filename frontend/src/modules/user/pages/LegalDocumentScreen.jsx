import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, FileText, Shield, ScrollText, Mail } from 'lucide-react';
import { LEGAL_DOCUMENTS, LEGAL_LINKS } from '@/lib/legalDocuments';
import DesktopFooter from '../components/layout/DesktopFooter';

const ICONS = { privacy: Shield, terms: ScrollText, termsOfUse: FileText };

/** "**bold**" -> <strong>; e-mail addresses become mail links */
function Rich({ text }) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        return (
            <Fragment key={i}>
                {part.split(/(hello@kisaankart\.com)/g).map((p, j) => (p === 'hello@kisaankart.com'
                    ? <a key={j} href="mailto:hello@kisaankart.com" className="text-primary font-medium hover:underline">{p}</a>
                    : p))}
            </Fragment>
        );
    });
}

function Table({ head, rows }) {
    return (
        <>
            {/* Wide screens: a real table */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-[14px]">
                    <thead className="bg-slate-50">
                        <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i} className="align-top border-b last:border-0 border-slate-100">
                                {r.map((c, j) => <td key={j} className={j === 0 ? 'px-4 py-3 font-semibold text-slate-800 w-1/4' : 'px-4 py-3 text-slate-600'}><Rich text={c} /></td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Phones: one card per row */}
            <div className="sm:hidden space-y-2">
                {rows.map((r, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-3">
                        <p className="font-semibold text-slate-900 text-[14px]">{r[0]}</p>
                        {r.slice(1).map((c, j) => (
                            <p key={j} className="text-[13px] text-slate-600 mt-1">
                                <span className="text-slate-400">{head[j + 1]}: </span><Rich text={c} />
                            </p>
                        ))}
                    </div>
                ))}
            </div>
        </>
    );
}

/**
 * Privacy Policy / Terms & Conditions / Terms of Use - the client's official documents
 * (src/lib/legalDocuments.js), linked from the website footer.
 */
export default function LegalDocumentScreen({ docKey }) {
    const doc = LEGAL_DOCUMENTS[docKey];
    const navigate = useNavigate();
    const [tocOpen, setTocOpen] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        document.title = `${doc.title} | KisaanKart`;
    }, [doc.title]);

    const goTo = (id) => {
        setTocOpen(false);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="user-app-theme min-h-screen bg-slate-50 flex flex-col" data-legal-page={docKey}>
            {/* Top bar */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                        className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700"
                        aria-label="Back"
                    >
                        <ChevronLeft size={22} />
                    </button>
                    <Link to="/" className="shrink-0"><img src="/logo.png" alt="KisaanKart" className="h-12 w-auto object-contain" /></Link>
                    <nav className="ml-auto hidden md:flex items-center gap-1" aria-label="Legal documents">
                        {LEGAL_LINKS.map((l) => (
                            <Link
                                key={l.key}
                                to={l.path}
                                className={l.key === docKey
                                    ? 'px-3 py-2 rounded-lg text-[14px] font-semibold bg-primary/10 text-primary'
                                    : 'px-3 py-2 rounded-lg text-[14px] font-medium text-slate-600 hover:bg-slate-100'}
                            >
                                {l.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </header>

            {/* Title */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
                    <p className="text-[13px] font-semibold text-primary uppercase tracking-wide">KisaanKart · Zook Spaces Private Limited</p>
                    <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">{doc.title}</h1>
                    {doc.intro && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600"><Rich text={doc.intro} /></p>}
                    {/* Other documents on phones */}
                    <div className="mt-5 flex flex-wrap gap-2 md:hidden">
                        {LEGAL_LINKS.filter((l) => l.key !== docKey).map((l) => (
                            <Link key={l.key} to={l.path} className="px-3 py-1.5 rounded-full border border-slate-200 text-[13px] font-medium text-slate-700">{l.label}</Link>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-6 md:py-10 md:grid md:grid-cols-[240px_1fr] md:gap-10 flex-1">
                {/* Contents */}
                <aside className="mb-6 md:mb-0">
                    <div className="md:sticky md:top-24">
                        <button
                            type="button"
                            onClick={() => setTocOpen((v) => !v)}
                            className="md:hidden w-full flex items-center justify-between rounded-xl bg-white border border-slate-200 px-4 py-3 text-[14px] font-semibold text-slate-800"
                            aria-expanded={tocOpen}
                        >
                            Contents <ChevronDown size={18} className={tocOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        <p className="hidden md:block text-[12px] font-semibold uppercase tracking-wide text-slate-500 mb-3">Contents</p>
                        <ol className={`${tocOpen ? 'block' : 'hidden'} md:block mt-2 md:mt-0 rounded-xl md:rounded-none bg-white md:bg-transparent border md:border-0 border-slate-200 p-2 md:p-0 space-y-0.5`}>
                            {doc.sections.map((s) => (
                                <li key={s.id}>
                                    <button
                                        type="button"
                                        onClick={() => goTo(s.id)}
                                        className="w-full text-left px-2 py-1.5 rounded-lg text-[13px] text-slate-600 hover:bg-white hover:text-slate-900"
                                    >
                                        {s.heading}
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </div>
                </aside>

                {/* Document */}
                <article className="bg-white rounded-2xl border border-slate-200 p-5 md:p-10 space-y-10">
                    {doc.sections.map((s) => (
                        <section key={s.id} id={s.id} className="scroll-mt-24 space-y-3">
                            <h2 className="text-xl font-bold text-slate-900">{s.heading}</h2>
                            {s.blocks.map((b, i) => {
                                if (b.p) return <p key={i} className="text-[15px] leading-relaxed text-slate-700"><Rich text={b.p} /></p>;
                                if (b.list) {
                                    return (
                                        <ul key={i} className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-slate-700 marker:text-primary">
                                            {b.list.map((li, j) => <li key={j}><Rich text={li} /></li>)}
                                        </ul>
                                    );
                                }
                                if (b.table) return <Table key={i} {...b.table} />;
                                return null;
                            })}
                        </section>
                    ))}

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 flex items-start gap-3">
                        <Mail size={20} className="text-primary shrink-0 mt-0.5" />
                        <p className="text-[14px] text-slate-600">
                            Questions about this document? Write to <a href="mailto:hello@kisaankart.com" className="text-primary font-medium hover:underline">hello@kisaankart.com</a>.
                        </p>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <p className="text-[13px] font-semibold text-slate-500 mb-3">Also read</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {LEGAL_LINKS.filter((l) => l.key !== docKey).map((l) => {
                                const Icon = ICONS[l.key];
                                return (
                                    <Link key={l.key} to={l.path} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                                        <Icon size={18} className="text-primary" />
                                        <span className="text-[14px] font-semibold text-slate-800">{l.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </article>
            </div>

            <DesktopFooter />
        </div>
    );
}
