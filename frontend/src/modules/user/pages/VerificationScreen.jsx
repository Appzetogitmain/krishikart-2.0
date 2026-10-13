import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle, FileText, ChevronRight } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'

export default function VerificationScreen() {
    const navigate = useNavigate()

    const documents = [
        { title: "Aadhar Card", status: "Verified", date: "12 Jan, 2024" },
        { title: "PAN Card", status: "Verified", date: "12 Jan, 2024" },
        { title: "GST Certificate", status: "Pending", date: "Submitted yesterday" },
        { title: "Land Ownership Proof", status: "Rejected", date: "Please re-upload" }
    ]

    return (
        <PageTransition>
            <div className="bg-[#f8fafd] min-h-screen">
                {/* Header */}
                <div className="bg-white px-6 py-6 border-b border-slate-50 flex items-center gap-4 sticky top-0 z-30">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-90 transition-transform">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Verification Status</h1>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Card */}
                    <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm text-center">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-500 mx-auto mb-4 border-4 border-white shadow-lg shadow-green-100">
                            <ShieldCheck size={40} />
                        </div>
                        <h2 className="text-xl font-black text-slate-900">Partially Verified</h2>
                        <p className="text-sm text-slate-400 font-medium mt-2 leading-relaxed">
                            Your basic details are verified. Upload your business documents to get higher limits.
                        </p>
                    </div>

                    {/* Documents List */}
                    <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-4">Submitted Documents</h3>
                        <div className="space-y-3">
                            {documents.map((doc, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900">{doc.title}</h4>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${
                                                doc.status === 'Verified' ? 'text-green-500' :
                                                doc.status === 'Pending' ? 'text-amber-500' : 'text-red-500'
                                            }`}>
                                                {doc.status === 'Verified' ? <span className="flex items-center gap-1"><CheckCircle2 size={10} /> Verified</span> :
                                                 doc.status === 'Pending' ? <span className="flex items-center gap-1"><AlertCircle size={10} /> Pending</span> :
                                                 <span className="flex items-center gap-1"><AlertCircle size={10} /> Action Required</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-300" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Button */}
                    <Button className="w-full h-16 rounded-[24px] bg-primary text-white font-black text-lg shadow-lg shadow-green-100 mt-4">
                        Upload New Document
                    </Button>
                </div>
            </div>
        </PageTransition>
    )
}
