import { Link } from 'react-router-dom';
import { Sprout, Instagram, Twitter, Linkedin, Facebook, Mail, Phone } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-[#0a2512] text-white py-20 px-[5%]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16 border-b border-white/10 pb-16">
                <div className="flex flex-col gap-6">
                    <Link to="/" className="flex items-center gap-2 text-2xl font-black">
                        <img src="/logo.png" alt="Kisaan Kart" className="h-[72px] scale-[1.3] w-auto object-contain origin-left brightness-0 invert opacity-90" />
                    </Link>
                    <p className="text-white/60 font-medium leading-relaxed">
                        Kisaan Kart is India’s most trusted agricultural marketplace, connecting farmers directly with businesses for a sustainable future.
                    </p>
                    <div className="flex gap-4">
                        <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-landing-primary-light transition-colors"><Instagram size={20} /></a>
                        <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-landing-primary-light transition-colors"><Twitter size={20} /></a>
                        <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-landing-primary-light transition-colors"><Linkedin size={20} /></a>
                        <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-landing-primary-light transition-colors"><Facebook size={20} /></a>
                    </div>
                </div>

                <div>
                    <h4 className="text-lg font-bold mb-8 uppercase tracking-widest text-landing-primary-light">Quick Links</h4>
                    <ul className="flex flex-col gap-4 text-white/60 font-semibold">
                        <li><a href="/#about" className="hover:text-white transition-colors">About Us</a></li>
                        <li><a href="/#categories" className="hover:text-white transition-colors">Categories</a></li>
                        <li><a href="/#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
                        <li><Link to="/about" className="hover:text-white transition-colors">Sustainability</Link></li>
                        <li><Link to="/help-support" className="hover:text-white transition-colors">Contact Support</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="text-lg font-bold mb-8 uppercase tracking-widest text-landing-primary-light">Role Logins</h4>
                    <ul className="flex flex-col gap-4 text-white/60 font-semibold">
                        <li><Link to="/login" className="hover:text-white transition-colors">User Login</Link></li>
                        <li><Link to="/vendor/login" className="hover:text-white transition-colors">Vendor Portal</Link></li>
                        <li><Link to="/franchise/login" className="hover:text-white transition-colors">Franchise Login</Link></li>
                        <li><Link to="/delivery/login" className="hover:text-white transition-colors">Delivery Partner</Link></li>
                        <li><Link to="/masteradmin/login" className="hover:text-white transition-colors">Master Admin</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="text-lg font-bold mb-8 uppercase tracking-widest text-landing-primary-light">Get in touch</h4>
                    <div className="flex flex-col gap-6 text-white/60 font-semibold">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-landing-primary-light"><Mail size={20} /></div>
                            <a href="mailto:hello@kisaankart.com" className="hover:text-white">hello@kisaankart.com</a>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-landing-primary-light"><Phone size={20} /></div>
                            <a href="tel:+919999999999" className="hover:text-white">+91 999 999 9999</a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center text-white/30 text-sm font-bold uppercase tracking-[0.2em]">
                &copy; {new Date().getFullYear()} Kisaan Kart. All Rights Reserved.
            </div>
        </footer>
    );
}
