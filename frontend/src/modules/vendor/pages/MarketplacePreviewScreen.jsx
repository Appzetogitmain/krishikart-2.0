import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutGrid,
    Smartphone,
    Globe,
    IndianRupee,
    Star,
    ShoppingCart,
    Monitor,
    Loader2
} from 'lucide-react';
import mockProduce from '../data/mockProduce.json';
import { cn } from '@/lib/utils';
import VendorBackBar from '../components/navigation/VendorBackBar';

export default function MarketplacePreviewScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [previewMode, setPreviewMode] = useState('user'); // 'user' or 'franchise'

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary" /></div>;

    const availableItems = mockProduce.filter(item => item.available);

    return (
        <div className="space-y-8 pb-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <VendorBackBar className="!min-h-[40px] !min-w-[40px]" />
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Marketplace Preview</h1>
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-10">See how your products look to buyers</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm self-start">
                    <button
                        onClick={() => setPreviewMode('user')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            previewMode === 'user' ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <ShoppingCart size={14} />
                        User App
                    </button>
                    <button
                        onClick={() => setPreviewMode('franchise')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            previewMode === 'franchise' ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <LayoutGrid size={14} />
                        Franchise
                    </button>
                </div>
            </header>

            {/* Device Frame */}
            <div className="flex justify-center">
                <div className="w-full max-w-[380px] aspect-[9/19] bg-slate-900 rounded-[50px] p-4 border-[6px] border-slate-800 shadow-2xl relative overflow-hidden">
                    {/* Device Status Bar */}
                    <div className="flex justify-between items-center px-6 py-4 text-white">
                        <span className="text-xs font-bold">9:41</span>
                        <div className="flex gap-1.5 items-center opacity-80">
                            <div className="w-4 h-2 bg-white/40 rounded-sm" />
                            <div className="w-1 h-1 bg-white rounded-full" />
                        </div>
                    </div>

                    {/* App Content Area */}
                    <div className="bg-[#f8fafd] h-full rounded-[38px] overflow-y-auto no-scrollbar pt-4">
                        <div className="px-5 mb-6">
                            <h4 className="text-lg font-black text-slate-900 leading-tight">Fresh from Farm</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Handpicked for you</p>
                        </div>

                        {/* Marketplace Grid Mockup */}
                        <div className="grid grid-cols-2 gap-4 px-5 pb-20">
                            {availableItems.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-white rounded-3xl p-3 border border-slate-100 shadow-sm group"
                                >
                                    <div className="aspect-square rounded-2xl bg-slate-50 mb-3 overflow-hidden">
                                        <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.name} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-black text-slate-900 leading-none">{item.name}</h5>
                                        <div className="flex items-center justify-between mt-3">
                                            <div className="flex items-center gap-0.5 text-slate-900">
                                                <IndianRupee size={10} />
                                                <span className="text-xs font-black">{item.price}</span>
                                            </div>
                                            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center">
                                                <ShoppingCart size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Home Indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full" />
                </div>
            </div>

            {/* Context Info */}
            <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 pt-10">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-start gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                        <Smartphone size={20} />
                    </div>
                    <div>
                        <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Customer View</h5>
                        <p className="text-[10px] font-medium text-slate-400 mt-1 leading-relaxed">How customers see your products and prices in the Kisaankart app.</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-start gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Monitor size={20} />
                    </div>
                    <div>
                        <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Franchise View</h5>
                        <p className="text-[10px] font-medium text-slate-400 mt-1 leading-relaxed">How franchises see your products when they order stock.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
