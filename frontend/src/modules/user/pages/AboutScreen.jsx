import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Globe, Award, Users } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'

export default function AboutScreen() {
    const navigate = useNavigate()

    return (
        <PageTransition>
            <div className="bg-[#f8fafd] min-h-screen">
                {/* Header */}
                <div className="bg-white px-6 py-6 border-b border-slate-50 flex items-center gap-4 sticky top-0 z-30">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-90 transition-transform">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">About Kisaankart</h1>
                </div>

                <div className="p-6 space-y-8">
                    {/* Hero Section */}
                    <div className="text-center py-6">
                        <div className="w-24 h-24 bg-primary rounded-[32px] flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-green-200 rotate-3 hover:rotate-6 transition-transform">
                            <span className="text-4xl font-black">K</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Kisaankart</h2>
                        <p className="text-sm font-bold text-slate-400 mt-2">Empowering Farmers, Everywhere.</p>
                        <div className="mt-4 inline-block bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                            Version 2.4.0
                        </div>
                    </div>

                    {/* Mission Text */}
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <h3 className="text-lg font-black text-slate-900 mb-3">Our Mission</h3>
                        <p className="text-sm text-slate-500 font-medium leading-loose">
                            To bridge the gap between farmers and high-quality agricultural inputs through technology. We strive to provide the best seeds, fertilizers, and equipment at fair prices, delivered directly to the farm.
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-5 rounded-[28px] text-center">
                            <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                            <h4 className="text-2xl font-black text-slate-900">50k+</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Happy Farmers</p>
                        </div>
                        <div className="bg-orange-50 p-5 rounded-[28px] text-center">
                            <Award className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                            <h4 className="text-2xl font-black text-slate-900">#1</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agri App</p>
                        </div>
                    </div>

                    {/* Footer Links */}
                    <div className="flex flex-col items-center gap-6 pt-8 border-t border-slate-100">
                        <div className="flex justify-center gap-8">
                            <button onClick={() => navigate('/privacy')} className="text-slate-400 hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest">Privacy</button>
                            <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest">Terms</button>
                            <a href="https://kisaankart.in" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest">Website</a>
                        </div>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                            &copy; {new Date().getFullYear()} Kisaankart Global
                        </p>
                    </div>
                </div>
            </div>
        </PageTransition>
    )
}
