import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Sprout, Search, ChevronLeft, ChevronRight, ArrowUpRight, ChevronDown,
    Mail, Phone, Menu, X,
    Wheat, ShieldCheck, Snowflake, Truck, Leaf, Package, Store, Users
} from 'lucide-react';
import api from '@/lib/axios';
import './landing.css';

/* ─────────────────────── DATA ─────────────────────── */
const heroSlides = [
    {
        image: '/assets/hero_banner_1.png',
        title: 'Farm Fresh Supplies at Mandi Rates',
        sub: 'Quality agricultural produce for your business, delivered to your doorstep.',
    },
    {
        image: '/assets/hero_banner_2.png',
        title: 'Expand Your Menu with Custom Produce',
        sub: 'From exotic vegetables to premium grains — whatever your kitchen needs.',
    },
    {
        image: '/assets/hero_banner_3.png',
        title: 'Supply Chain Solutions That Scale',
        sub: 'Reliable sourcing, quality checks, and on-time delivery — every single day.',
    },
];

const stats = [
    { value: '50+', label: 'products listed' },
    { value: '10+', label: 'franchise partners' },
    { value: '500+', label: 'orders delivered' },
    { value: '100+', label: 'vendor brands' },
];

const qualityCards = [
    {
        title: 'Farm Collection Centres',
        desc: 'We source directly from farmers, select the best produce, and deliver it fresh.',
        icon: Wheat,
        bg: '#e8f5e9',
        color: '#2e7d32',
    },
    {
        title: 'Quality-Checked Warehouse',
        desc: 'Every item is inspected at our warehouses before dispatch to ensure freshness.',
        icon: ShieldCheck,
        bg: '#e3f2fd',
        color: '#1565c0',
    },
    {
        title: 'Cold Supply Chain',
        desc: 'Temperature-controlled logistics preserve quality from farm to your doorstep.',
        icon: Snowflake,
        bg: '#e0f7fa',
        color: '#00838f',
    },
    {
        title: 'Same-Day Delivery',
        desc: 'Our dense franchise network enables rapid last-mile delivery every day.',
        icon: Truck,
        bg: '#fff3e0',
        color: '#e65100',
    },
];

const fallbackCategories = [
    { name: 'Vegetables', image: '/assets/cat_vegetables.png' },
    { name: 'Fruits', image: '/assets/cat_fruits.png' },
    { name: 'Dairy', image: '/assets/cat_dairy.png' },
    { name: 'Grains & Rice', image: '/assets/cat_grains.png' },
    { name: 'Spices', image: '/assets/cat_spices.png' },
    { name: 'Pulses', image: '/assets/cat_pulses.png' },
];

const testimonials = [
    { name: 'Rajesh Kumar', role: 'Farmer, Punjab', snippet: '...better rates and timely payments directly in my bank account...', quote: 'Kisaankart has completely changed how I sell my produce. I get better rates and timely payments directly in my bank account. The platform is reliable and transparent. My income has grown by 30% since joining.', color: '#2e7d32' },
    { name: 'Amit Sharma', role: 'Franchise Owner, Delhi', snippet: '...streamlines everything — from receiving stock to managing orders...', quote: 'Being a franchise partner is rewarding. The platform streamlines everything — from receiving stock to managing orders. Operating efficiency has gone up tremendously. Their tech-enabled platform makes daily operations a breeze.', color: '#1565c0' },
    { name: 'Priya Singh', role: 'Regular Buyer, Noida', snippet: '...freshness of vegetables is unmatched, like buying from the farm...', quote: 'The freshness of vegetables is unmatched. It feels like getting produce directly from the farm every morning. And the bulk pricing saves us significantly. I have recommended Kisaankart to all my neighbors.', color: '#6a1b9a' },
    { name: 'Suresh Patel', role: 'Vendor, Gujarat', snippet: '...supply chain has become more structured without the middleman...', quote: 'Since joining as a vendor, my supply chain has become more structured. I can reach more franchises and customers without the middleman hassle. The transparent pricing and consistent demand have stabilized my business.', color: '#e65100' },
    { name: 'Meena Devi', role: 'Home Chef, Mumbai', snippet: '...consistent quality and timely deliveries to scale my business...', quote: 'I rely on Kisaankart for all my ingredient sourcing. Consistent quality and timely deliveries have allowed me to scale my home food business confidently. The wide product range means I never need to source from multiple vendors.', color: '#00838f' },
    { name: 'Vikram Reddy', role: 'Restaurant Owner, Bangalore', snippet: '...reliable ingredient supply ensures consistent quality across outlets...', quote: 'Kisaankart has fueled our restaurant growth. Their reliable ingredient supply across our locations ensures consistent quality, which is key to our success. The franchise model means faster deliveries compared to traditional suppliers.', color: '#c62828' },
];

const faqs = [
    { q: 'What is Kisaankart?', a: 'Kisaankart is an agricultural marketplace that connects farmers and vendors directly with buyers through a network of local franchise hubs, ensuring fresh produce at fair prices.' },
    { q: 'How is Kisaankart different from other suppliers?', a: 'We operate through local franchise hubs which means faster delivery, quality-checked produce, and mandi-rate pricing without middlemen.' },
    { q: 'How can I become a vendor?', a: 'Visit the vendor signup page, fill in your details and documentation. Our team will review and onboard you within 48 hours.' },
    { q: 'Does Kisaankart deliver to homes?', a: 'Yes! We deliver to both individual consumers and businesses through our franchise delivery network.' },
    { q: 'How does the franchise model work?', a: 'Franchises act as local fulfillment hubs. They receive stock from vendors, pack orders, and dispatch them through delivery partners to end customers.' },
];

/* ─────────────────────── COMPONENT ─────────────────────── */
export default function LandingPage() {
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [heroIdx, setHeroIdx] = useState(0);
    const [categories, setCategories] = useState(fallbackCategories);
    const [products, setProducts] = useState([]);
    const [openFaq, setOpenFaq] = useState(null);
    const [mobileMenu, setMobileMenu] = useState(false);
    const [qualityFlipped, setQualityFlipped] = useState(() => qualityCards.map(() => false));
    const qualityCardRefs = useRef([]);
    const [testimonialMarqueePaused, setTestimonialMarqueePaused] = useState(false);
    const testimonialScrollRef = useRef(null);
    const testimonialPauseTimeoutRef = useRef(null);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Scroll to section when landing with hash (e.g. /#about, /#categories)
    useEffect(() => {
        const hash = location.hash?.slice(1);
        if (hash) {
            const el = document.getElementById(hash);
            if (el) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            }
        }
    }, [location.hash]);

    // Quality cards: flip one-by-one when they enter view on mobile, and allow click to toggle
    useEffect(() => {
        const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
        const refs = qualityCardRefs.current.filter(Boolean);
        if (refs.length === 0 || !isMobile()) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const i = refs.indexOf(entry.target);
                    if (i === -1) return;
                    setQualityFlipped((prev) => {
                        const next = [...prev];
                        next[i] = true;
                        return next;
                    });
                });
            },
            { threshold: 0.3, rootMargin: '0px 0px -20px 0px' }
        );
        refs.forEach((el) => observer.observe(el));
        return () => refs.forEach((el) => observer.unobserve(el));
    }, []);

    // Hero auto-play
    useEffect(() => {
        const timer = setInterval(() => setHeroIdx(i => (i + 1) % heroSlides.length), 5000);
        return () => clearInterval(timer);
    }, []);

    // Fetch categories
    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/catalog/categories');
                if (res.data.success && res.data.results?.length) {
                    // Only use API categories if they have valid images
                    const apiCats = res.data.results.filter(c => c.image && c.image.startsWith('http'));
                    if (apiCats.length > 0) setCategories(apiCats);
                }
            } catch { /* keep fallback */ }
        })();
    }, []);

    // Fetch products for rails
    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/products?limit=12');
                if (res.data.success) {
                    // Only show products that have valid images
                    const validProducts = (res.data.results || []).filter(p => p.image && p.image.startsWith('http'));
                    setProducts(validProducts);
                }
            } catch { /* keep empty */ }
        })();
    }, []);

    const prevSlide = useCallback(() => setHeroIdx(i => (i - 1 + heroSlides.length) % heroSlides.length), []);
    const nextSlide = useCallback(() => setHeroIdx(i => (i + 1) % heroSlides.length), []);

    return (
        <div className="landing-page">
            {/* ── NAVBAR ── */}
            <nav className={`lp-navbar ${scrolled ? 'scrolled' : ''}`}>
                <Link to="/" className="lp-navbar-logo">
                    <img src="/logo.png" alt="kisaankart" className="lp-navbar-logo-img" />
                </Link>
                <div className="lp-navbar-center">
                    <a href="#quality" className="lp-navbar-link">Quality</a>
                    <a href="#categories" className="lp-navbar-link">Browse Catalogue</a>
                    <a href="#delivery" className="lp-navbar-link">Delivery</a>
                    <a href="#faq" className="lp-navbar-link">FAQ</a>
                </div>
                <div className="lp-navbar-search">
                    <Search size={16} color="#999" />
                    <input type="text" placeholder="Search items or categories" readOnly onClick={() => window.location.href = '/#/login'} />
                </div>
                <div className="lp-navbar-right">
                    <Link to="/login" className="lp-login-btn">Login / Signup</Link>
                </div>
                <button className="lp-mobile-menu-btn" onClick={() => setMobileMenu(true)}>
                    <Menu size={28} />
                </button>
            </nav>

            {/* Mobile Menu */}
            {mobileMenu && (
                <div className="lp-mobile-overlay">
                    <button className="lp-mobile-close" onClick={() => setMobileMenu(false)}><X size={28} /></button>
                    <a href="#quality" onClick={() => setMobileMenu(false)}>Quality</a>
                    <a href="#categories" onClick={() => setMobileMenu(false)}>Browse Catalogue</a>
                    <a href="#delivery" onClick={() => setMobileMenu(false)}>Delivery</a>
                    <a href="#faq" onClick={() => setMobileMenu(false)}>FAQ</a>
                    <Link to="/login" className="lp-mobile-login-btn" onClick={() => setMobileMenu(false)}>Login / Signup</Link>
                </div>
            )}

            {/* ── HERO CAROUSEL ── */}
            <section className="lp-hero">
                {heroSlides.map((slide, i) => (
                    <div key={i} className={`lp-hero-slide ${i === heroIdx ? 'active' : ''}`}>
                        <img className="lp-hero-slide-bg" src={slide.image} alt={slide.title} />
                        <div className="lp-hero-slide-overlay" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}>
                            <h1 style={{ color: '#fff', fontSize: 48, fontWeight: 900, marginBottom: 12, maxWidth: 600, lineHeight: 1.15 }}>{slide.title}</h1>
                            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, maxWidth: 500, fontWeight: 500 }}>{slide.sub}</p>
                        </div>
                    </div>
                ))}
                <button className="lp-hero-nav prev" onClick={prevSlide}><ChevronLeft size={22} color="#333" /></button>
                <button className="lp-hero-nav next" onClick={nextSlide}><ChevronRight size={22} color="#333" /></button>
                <div className="lp-hero-dots">
                    {heroSlides.map((_, i) => (
                        <button key={i} className={`lp-hero-dot ${i === heroIdx ? 'active' : ''}`} onClick={() => setHeroIdx(i)} />
                    ))}
                </div>
            </section>

            {/* ── STATS ── */}
            <section className="lp-stats">
                {stats.map((s, i) => (
                    <div key={i} className="lp-stat">
                        <div className="lp-stat-value">{s.value}</div>
                        <div className="lp-stat-label">{s.label}</div>
                    </div>
                ))}
            </section>

            {/* ── QUALITY SECTION ── */}
            <section id="quality" className="lp-quality">
                <h2 className="lp-quality-heading">✦ <span>Quality at every step</span> ✦ Built on trust</h2>
                <div className="lp-quality-grid">
                    {qualityCards.map((card, i) => {
                        const IconComponent = card.icon;
                        const isFlipped = qualityFlipped[i];
                        return (
                            <motion.div
                                key={i}
                                ref={(el) => { qualityCardRefs.current[i] = el; }}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="lp-quality-card"
                                style={{ background: card.bg }}
                                onClick={() => setQualityFlipped((prev) => { const n = [...prev]; n[i] = !n[i]; return n; })}
                            >
                                <div className={`lp-quality-card-inner ${isFlipped ? 'flipped' : ''}`}>
                                    <div className="lp-quality-card-front">
                                        <div className="lp-quality-card-icon-wrap">
                                            <div className="lp-quality-card-icon-box" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                                                <IconComponent size={36} color={card.color} strokeWidth={1.8} />
                                            </div>
                                        </div>
                                        <h3 className="lp-quality-card-front-title">{card.title}</h3>
                                    </div>
                                    <div className="lp-quality-card-back">
                                        <h3 className="lp-quality-card-back-title">{card.title}</h3>
                                        <p className="lp-quality-card-back-desc">{card.desc}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </section>

            {/* ── NETWORK FLOW (Hyperpure-style animated diagram) ── */}
            <section className="lp-network">
                <h2 className="lp-network-heading">Building a wide network of<br /><span style={{ fontWeight: 500, fontSize: '0.65em', color: '#888' }}>— Sellers & Customers —</span></h2>

                {/* Animated Flow Diagram */}
                <div className="lp-flow-diagram">
                    {/* LEFT — Sellers */}
                    <div className="lp-flow-side lp-flow-left">
                        <div className="lp-flow-row">
                            <div className="lp-flow-avatars">
                                <div className="lp-flow-circle" style={{ background: '#e8f5e9' }}><Wheat size={20} color="#2e7d32" /></div>
                                <div className="lp-flow-circle" style={{ background: '#e8f5e9' }}><Leaf size={20} color="#2e7d32" /></div>
                            </div>
                            <div className="lp-flow-label" style={{ background: '#e8f5e9', color: '#2e7d32' }}>FARMERS</div>
                        </div>
                        <div className="lp-flow-row">
                            <div className="lp-flow-avatars">
                                <div className="lp-flow-circle" style={{ background: '#fff3e0' }}><Store size={20} color="#e65100" /></div>
                                <div className="lp-flow-circle" style={{ background: '#fff3e0' }}><Package size={20} color="#e65100" /></div>
                            </div>
                            <div className="lp-flow-label" style={{ background: '#fff3e0', color: '#e65100' }}>VENDORS</div>
                        </div>
                        <div className="lp-flow-row">
                            <div className="lp-flow-avatars">
                                <div className="lp-flow-circle" style={{ background: '#e3f2fd' }}><Truck size={20} color="#1565c0" /></div>
                                <div className="lp-flow-circle" style={{ background: '#e3f2fd' }}><Package size={20} color="#1565c0" /></div>
                            </div>
                            <div className="lp-flow-label" style={{ background: '#e3f2fd', color: '#1565c0' }}>WHOLESALERS</div>
                        </div>
                    </div>

                    {/* CENTER — Kisaankart Hub with animated SVG paths + floating thumbnails */}
                    <div className="lp-flow-center">
                        <svg className="lp-flow-svg lp-flow-svg-left" viewBox="-10 -60 420 420" preserveAspectRatio="none">
                            <defs>
                                <clipPath id="thumbL1"><circle cx="0" cy="0" r="24" /></clipPath>
                                <clipPath id="thumbL2"><circle cx="0" cy="0" r="24" /></clipPath>
                                <clipPath id="thumbL3"><circle cx="0" cy="0" r="24" /></clipPath>
                                <clipPath id="thumbL4"><circle cx="0" cy="0" r="20" /></clipPath>
                                <clipPath id="thumbL5"><circle cx="0" cy="0" r="20" /></clipPath>
                                <clipPath id="thumbL6"><circle cx="0" cy="0" r="20" /></clipPath>
                                <filter id="shadowL" x="-50%" y="-50%" width="200%" height="200%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                                </filter>
                            </defs>
                            {/* Arched paths — sellers to hub */}
                            <path d="M0,50 C80,-50 320,-50 400,150" className="lp-flow-path p-green" />
                            <path d="M0,150 C100,80 300,220 400,150" className="lp-flow-path p-orange" />
                            <path d="M0,250 C80,350 320,350 400,150" className="lp-flow-path p-blue" />
                            {/* Floating thumbnail 1: vegetables on green path */}
                            <g filter="url(#shadowL)">
                                <animateMotion dur="7s" repeatCount="indefinite" path="M0,50 C80,-50 320,-50 400,150" />
                                <circle r="26" fill="white" />
                                <image href="/assets/cat_vegetables.png" x="-24" y="-24" width="48" height="48" clipPath="url(#thumbL1)" />
                            </g>
                            <g filter="url(#shadowL)">
                                <animateMotion dur="7s" repeatCount="indefinite" path="M0,50 C80,-50 320,-50 400,150" begin="3.5s" />
                                <circle r="22" fill="white" />
                                <image href="/assets/cat_fruits.png" x="-20" y="-20" width="40" height="40" clipPath="url(#thumbL4)" />
                            </g>
                            {/* Floating thumbnail 2: dairy on orange path */}
                            <g filter="url(#shadowL)">
                                <animateMotion dur="6s" repeatCount="indefinite" path="M0,150 C100,80 300,220 400,150" />
                                <circle r="26" fill="white" />
                                <image href="/assets/cat_dairy.png" x="-24" y="-24" width="48" height="48" clipPath="url(#thumbL2)" />
                            </g>
                            <g filter="url(#shadowL)">
                                <animateMotion dur="6s" repeatCount="indefinite" path="M0,150 C100,80 300,220 400,150" begin="3s" />
                                <circle r="22" fill="white" />
                                <image href="/assets/cat_grains.png" x="-20" y="-20" width="40" height="40" clipPath="url(#thumbL5)" />
                            </g>
                            {/* Floating thumbnail 3: spices on blue path */}
                            <g filter="url(#shadowL)">
                                <animateMotion dur="7.5s" repeatCount="indefinite" path="M0,250 C80,350 320,350 400,150" />
                                <circle r="26" fill="white" />
                                <image href="/assets/cat_spices.png" x="-24" y="-24" width="48" height="48" clipPath="url(#thumbL3)" />
                            </g>
                            <g filter="url(#shadowL)">
                                <animateMotion dur="7.5s" repeatCount="indefinite" path="M0,250 C80,350 320,350 400,150" begin="3.8s" />
                                <circle r="22" fill="white" />
                                <image href="/assets/cat_pulses.png" x="-20" y="-20" width="40" height="40" clipPath="url(#thumbL6)" />
                            </g>
                        </svg>

                        <div className="lp-flow-hub">
                            <div className="lp-flow-hub-inner">
                                <Sprout size={28} color="#fff" />
                                <span>Kisaankart</span>
                            </div>
                        </div>

                        <svg className="lp-flow-svg lp-flow-svg-right" viewBox="-10 -60 420 420" preserveAspectRatio="none">
                            <defs>
                                <clipPath id="thumbR1"><circle cx="0" cy="0" r="24" /></clipPath>
                                <clipPath id="thumbR2"><circle cx="0" cy="0" r="24" /></clipPath>
                                <clipPath id="thumbR3"><circle cx="0" cy="0" r="24" /></clipPath>
                                <clipPath id="thumbR4"><circle cx="0" cy="0" r="20" /></clipPath>
                                <clipPath id="thumbR5"><circle cx="0" cy="0" r="20" /></clipPath>
                                <clipPath id="thumbR6"><circle cx="0" cy="0" r="20" /></clipPath>
                                <filter id="shadowR" x="-50%" y="-50%" width="200%" height="200%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                                </filter>
                            </defs>
                            {/* Arched paths — hub to customers */}
                            <path d="M0,150 C80,-50 320,-50 400,50" className="lp-flow-path p-purple" />
                            <path d="M0,150 C100,220 300,80 400,150" className="lp-flow-path p-red" />
                            <path d="M0,150 C80,350 320,350 400,250" className="lp-flow-path p-teal" />
                            {/* Floating thumbnail 1: vegetables on purple path */}
                            <g filter="url(#shadowR)">
                                <animateMotion dur="7s" repeatCount="indefinite" path="M0,150 C80,-50 320,-50 400,50" />
                                <circle r="26" fill="white" />
                                <image href="/assets/cat_vegetables.png" x="-24" y="-24" width="48" height="48" clipPath="url(#thumbR1)" />
                            </g>
                            <g filter="url(#shadowR)">
                                <animateMotion dur="7s" repeatCount="indefinite" path="M0,150 C80,-50 320,-50 400,50" begin="3.5s" />
                                <circle r="22" fill="white" />
                                <image href="/assets/cat_grains.png" x="-20" y="-20" width="40" height="40" clipPath="url(#thumbR4)" />
                            </g>
                            {/* Floating thumbnail 2: fruits on red path */}
                            <g filter="url(#shadowR)">
                                <animateMotion dur="6s" repeatCount="indefinite" path="M0,150 C100,220 300,80 400,150" />
                                <circle r="26" fill="white" />
                                <image href="/assets/cat_fruits.png" x="-24" y="-24" width="48" height="48" clipPath="url(#thumbR2)" />
                            </g>
                            <g filter="url(#shadowR)">
                                <animateMotion dur="6s" repeatCount="indefinite" path="M0,150 C100,220 300,80 400,150" begin="3s" />
                                <circle r="22" fill="white" />
                                <image href="/assets/cat_spices.png" x="-20" y="-20" width="40" height="40" clipPath="url(#thumbR5)" />
                            </g>
                            {/* Floating thumbnail 3: dairy on teal path */}
                            <g filter="url(#shadowR)">
                                <animateMotion dur="7.5s" repeatCount="indefinite" path="M0,150 C80,350 320,350 400,250" />
                                <circle r="26" fill="white" />
                                <image href="/assets/cat_dairy.png" x="-24" y="-24" width="48" height="48" clipPath="url(#thumbR3)" />
                            </g>
                            <g filter="url(#shadowR)">
                                <animateMotion dur="7.5s" repeatCount="indefinite" path="M0,150 C80,350 320,350 400,250" begin="3.8s" />
                                <circle r="22" fill="white" />
                                <image href="/assets/cat_pulses.png" x="-20" y="-20" width="40" height="40" clipPath="url(#thumbR6)" />
                            </g>
                        </svg>
                    </div>

                    {/* RIGHT — Customers */}
                    <div className="lp-flow-side lp-flow-right">
                        <div className="lp-flow-row">
                            <div className="lp-flow-label" style={{ background: '#f3e5f5', color: '#6a1b9a' }}>HOMES</div>
                            <div className="lp-flow-avatars">
                                <div className="lp-flow-circle" style={{ background: '#f3e5f5' }}><Users size={20} color="#6a1b9a" /></div>
                                <div className="lp-flow-circle" style={{ background: '#f3e5f5' }}><Users size={20} color="#6a1b9a" /></div>
                            </div>
                        </div>
                        <div className="lp-flow-row">
                            <div className="lp-flow-label" style={{ background: '#ffebee', color: '#c62828' }}>RESTAURANTS</div>
                            <div className="lp-flow-avatars">
                                <div className="lp-flow-circle" style={{ background: '#ffebee' }}><Store size={20} color="#c62828" /></div>
                                <div className="lp-flow-circle" style={{ background: '#ffebee' }}><Store size={20} color="#c62828" /></div>
                            </div>
                        </div>
                        <div className="lp-flow-row">
                            <div className="lp-flow-label" style={{ background: '#e0f7fa', color: '#00838f' }}>FRANCHISES</div>
                            <div className="lp-flow-avatars">
                                <div className="lp-flow-circle" style={{ background: '#e0f7fa' }}><Package size={20} color="#00838f" /></div>
                                <div className="lp-flow-circle" style={{ background: '#e0f7fa' }}><Package size={20} color="#00838f" /></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CTA Cards below the diagram */}
                <div className="lp-network-grid">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lp-network-card sellers">
                        <div className="lp-network-card-tag">FOR SELLERS</div>
                        <h2>Sell your produce now</h2>
                        <p>Join 100+ vendors on the platform</p>
                        <Link to="/vendor/signup" className="lp-network-card-btn">Register as a seller <ArrowUpRight size={18} /></Link>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="lp-network-card buyers">
                        <div className="lp-network-card-tag">FOR CUSTOMERS</div>
                        <h2>Smarter sourcing, better harvest</h2>
                        <p>Trusted by 500+ buyers across cities</p>
                        <Link to="/login" className="lp-network-card-btn">Signup now <ArrowUpRight size={18} /></Link>
                    </motion.div>
                </div>
            </section>

            {/* ── CATEGORIES ── */}
            <section id="categories" className="lp-categories">
                <h2 className="lp-categories-heading">OUR CATEGORIES</h2>
                <div className="lp-categories-grid">
                    {categories.map((cat, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                            <Link to="/login" className="lp-category-item">
                                <div className="lp-category-img"><img src={cat.image} alt={cat.name} /></div>
                                <div className="lp-category-name">{cat.name}</div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── PRODUCT RAILS ── */}
            {products.length > 0 && (
                <section className="lp-product-rails">
                    <div className="lp-product-rail">
                        <div className="lp-rail-header">
                            <div>
                                <span className="lp-rail-title">Popular Products</span>
                                <span className="lp-rail-subtitle">farm-fresh selections</span>
                            </div>
                            <Link to="/login" className="lp-rail-see-all">See all</Link>
                        </div>
                        <div className="lp-rail-scroll">
                            {products.map((p, i) => (
                                <div key={i} className="lp-product-card">
                                    <img className="lp-product-card-img" src={p.image} alt={p.name} />
                                    <div className="lp-product-card-body">
                                        <div className="lp-product-card-name">{p.name}</div>
                                        <div className="lp-product-card-price">₹{p.price}</div>
                                        <div className="lp-product-card-unit">{p.unit || 'per kg'}</div>
                                        <button className="lp-product-card-add" onClick={() => window.location.href = '/#/login'}>ADD +</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── DELIVERY MODELS ── */}
            <section id="delivery" className="lp-delivery">
                <h2>Our delivery models</h2>
                <p>We offer flexible delivery options tailored to your needs — whether it's next-day restocking or urgent same-day supplies.</p>
                <div className="lp-delivery-grid">
                    <div className="lp-delivery-card">
                        <img src="/assets/delivery_wholesale.png" alt="Wholesale Delivery" />
                        <div className="lp-delivery-card-label">
                            <Truck size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                            Wholesale Delivery
                        </div>
                    </div>
                    <div className="lp-delivery-card">
                        <img src="/assets/delivery_express.png" alt="Express Delivery" />
                        <div className="lp-delivery-card-label">
                            <Package size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                            Express Delivery
                        </div>
                    </div>
                </div>
            </section>

            {/* ── TESTIMONIALS (Hyperpure-style 3D Flip Cards) ── */}
            <section className="lp-testimonials">
                <h2>What our partners say about us</h2>
                <div
                    className="lp-testimonials-scroll"
                    ref={testimonialScrollRef}
                    onScroll={() => {
                        setTestimonialMarqueePaused(true);
                        if (testimonialPauseTimeoutRef.current) clearTimeout(testimonialPauseTimeoutRef.current);
                        testimonialPauseTimeoutRef.current = setTimeout(() => setTestimonialMarqueePaused(false), 2500);
                    }}
                    onWheel={() => {
                        setTestimonialMarqueePaused(true);
                        if (testimonialPauseTimeoutRef.current) clearTimeout(testimonialPauseTimeoutRef.current);
                        testimonialPauseTimeoutRef.current = setTimeout(() => setTestimonialMarqueePaused(false), 2500);
                    }}
                    onTouchStart={() => {
                        setTestimonialMarqueePaused(true);
                        if (testimonialPauseTimeoutRef.current) clearTimeout(testimonialPauseTimeoutRef.current);
                        testimonialPauseTimeoutRef.current = setTimeout(() => setTestimonialMarqueePaused(false), 2500);
                    }}
                >
                    <div className={`lp-marquee-track ${testimonialMarqueePaused ? 'lp-marquee-paused' : ''}`}>
                        {[...testimonials, ...testimonials].map((t, i) => (
                            <div key={i} className="lp-flip-card">
                                <div className="lp-flip-card-inner">
                                    {/* ── FRONT ── */}
                                    <div className="lp-flip-card-front">
                                        <div className="lp-flip-front-top">
                                            <div className="lp-flip-avatar" style={{ background: t.color }}>
                                                {t.name.charAt(0)}
                                            </div>
                                            <div className="lp-flip-brand-img" style={{ background: t.color + '18' }}>
                                                <Sprout size={32} color={t.color} />
                                            </div>
                                        </div>
                                        <div className="lp-flip-front-info">
                                            <div className="lp-flip-name">{t.name}</div>
                                            <div className="lp-flip-role">{t.role}</div>
                                        </div>
                                        <div className="lp-flip-snippet">{t.snippet}</div>
                                    </div>

                                    {/* ── BACK ── */}
                                    <div className="lp-flip-card-back">
                                        <div className="lp-flip-back-quote">
                                            <Sprout size={20} color={t.color} style={{ marginBottom: 12, opacity: 0.6 }} />
                                            <p>{t.quote}</p>
                                        </div>
                                        <div className="lp-flip-back-author">
                                            <div className="lp-flip-avatar-sm" style={{ background: t.color }}>{t.name.charAt(0)}</div>
                                            <div>
                                                <div className="lp-flip-name">{t.name}</div>
                                                <div className="lp-flip-role">{t.role}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section id="faq" className="lp-faq">
                <h3>Frequently asked questions</h3>
                {faqs.map((faq, i) => (
                    <div key={i} className="lp-faq-item">
                        <button className="lp-faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                            {faq.q}
                            <ChevronDown size={20} style={{ transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                        </button>
                        {openFaq === i && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="lp-faq-answer">
                                {faq.a}
                            </motion.div>
                        )}
                    </div>
                ))}
            </section>

            {/* ── FOOTER ── */}
            <footer className="lp-footer">
                <div className="lp-footer-grid">
                    <div className="lp-footer-company">
                        <h4>Company</h4>
                        <p><strong>Kisaankart Agriculture Private Limited</strong></p>
                        <p style={{ marginTop: 8 }}>Farm-fresh agricultural produce marketplace connecting farmers, vendors, and businesses.</p>
                        <a href="tel:+919999999999" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 13, textDecoration: 'none' }}>
                            <Phone size={14} /> +91 999 999 9999
                        </a>
                        <a href="mailto:hello@kisaankart.com" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 13, textDecoration: 'none' }}>
                            <Mail size={14} /> hello@kisaankart.com
                        </a>
                    </div>
                    <div className="lp-footer-column">
                        <h4>Know More</h4>
                        <a href="/#quality">Quality</a>
                        <a href="/#categories">Categories</a>
                        <a href="/#delivery">Delivery</a>
                        <a href="/#faq">FAQ</a>
                        <Link to="/about">About us</Link>
                    </div>
                    <div className="lp-footer-column">
                        <h4>Portals</h4>
                        <Link to="/login">User Login</Link>
                        <Link to="/vendor/login">Vendor Portal</Link>
                        <Link to="/franchise/login">Franchise Hub</Link>
                        <Link to="/delivery/login">Delivery Partner</Link>
                        <Link to="/masteradmin/login">Admin Panel</Link>
                    </div>
                </div>
                <div className="lp-footer-bottom">
                    Copyright &copy; {new Date().getFullYear()} Kisaankart. All Rights Reserved.
                </div>
            </footer>
        </div>
    );
}
