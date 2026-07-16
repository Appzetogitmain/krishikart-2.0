import { Sprout, Mail, Phone, MapPin, ShieldCheck, Truck, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DesktopFooter() {
    return (
        <footer className="hidden md:block bg-white border-t border-slate-100 pt-20 pb-10">
            <div className="max-w-7xl mx-auto px-8">
                <div className="grid grid-cols-4 gap-12">
                    {/* Brand Column */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="Kisaan Kart" className="h-[80px] scale-[1.3] w-auto object-contain origin-left" />
                        </div>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Empowering local farmers by connecting them directly with businesses. Freshness delivered to your doorstep.
                        </p>
                        <div className="flex gap-6 opacity-40 grayscale">
                            <ShieldCheck size={24} />
                            <Truck size={24} />
                            <RotateCcw size={24} />
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-slate-900 font-bold mb-6">Explore</h4>
                        <ul className="space-y-4">
                            <li><Link to="/home" className="text-slate-500 hover:text-primary text-sm transition-colors">Home</Link></li>
                            <li><Link to="/categories" className="text-slate-500 hover:text-primary text-sm transition-colors">All Categories</Link></li>
                            <li><Link to="/offers" className="text-slate-500 hover:text-primary text-sm transition-colors">Seasonal Offers</Link></li>
                            <li><Link to="/about" className="text-slate-500 hover:text-primary text-sm transition-colors">About Us</Link></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="text-slate-900 font-bold mb-6">Support</h4>
                        <ul className="space-y-4">
                            <li><Link to="/help-support" className="text-slate-500 hover:text-primary text-sm transition-colors">Help Center</Link></li>
                            <li><Link to="/help-support" className="text-slate-500 hover:text-primary text-sm transition-colors">Contact Support</Link></li>
                            <li><Link to="/help-support" className="text-slate-500 hover:text-primary text-sm transition-colors">FAQs</Link></li>
                            <li><Link to="/help-support" className="text-slate-500 hover:text-primary text-sm transition-colors">Return Policy</Link></li>
                        </ul>
                    </div>


                </div>

                <div className="mt-20 pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-slate-400 text-xs">
                        &copy; {new Date().getFullYear()} Kisaan Kart. All rights reserved.
                    </p>
                    <div className="flex gap-8">
                        <Link to="/privacy" className="text-slate-400 hover:text-slate-600 text-xs">Privacy Policy</Link>
                        <Link to="/terms" className="text-slate-400 hover:text-slate-600 text-xs">Terms of Service</Link>
                        <Link to="/security" className="text-slate-400 hover:text-slate-600 text-xs">Security</Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
