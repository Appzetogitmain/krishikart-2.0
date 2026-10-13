import { motion } from 'framer-motion';
import { FileCheck, ShieldCheck, XCircle, ExternalLink, Calendar, UserCheck, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ApprovalCard({ item, type, onApprove, onReject, onViewDoc }) {
    const isVendor = type === 'vendor';
    const isFranchise = type === 'franchise';
    const isDelivery = type === 'delivery';
    const isCredit = type === 'credit';

    const isAlreadyApproved = isVendor ? item.status === 'active'
        : isFranchise ? item.kyc?.status === 'verified'
        : isDelivery ? (item.isApproved || item.approvalStatus === 'approved')
        : false;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 rounded-sm overflow-hidden flex flex-col group hover:border-slate-400 transition-all cursor-pointer"
            onClick={() => onViewDoc(item)}
        >
            <div className="p-4 flex items-start justify-between border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-sm flex items-center justify-center border",
                        isVendor ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                            isFranchise ? "bg-blue-50 border-blue-100 text-blue-600" :
                                isDelivery ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-purple-50 border-purple-100 text-purple-600"
                    )}>
                        {isVendor ? <UserCheck size={18} /> :
                            isFranchise ? <ShieldCheck size={18} /> :
                                isDelivery ? <Users size={18} /> : <FileCheck size={18} />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-xs leading-none mb-1">
                            {item.fullName || item.vendorName || item.franchiseName || item.hotelName}
                        </h4>
                        <div className="flex items-center gap-1.5">
                            <Calendar size={10} className="text-slate-400" />
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                {new Date(item.createdAt || item.submittedAt || item.requestedAt).toLocaleDateString('en-GB')}
                            </span>
                        </div>
                    </div>
                </div>
                <div className={cn(
                    "px-1.5 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                    isAlreadyApproved ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                )}>
                    {isDelivery && item.pendingDocs?.status === 'pending' && (
                        <span className="bg-blue-100 text-blue-600 px-1 rounded-sm">DOC UPDATE</span>
                    )}
                    {isVendor ? item.status : isDelivery ? (item.isApproved || item.approvalStatus === 'approved' ? 'Approved' : 'Pending') : item.kyc?.status || 'Pending'}
                </div>
            </div>

            <div className="p-4 flex-1 space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Documents to Check</span>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onViewDoc(item); }}
                            className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                            <ExternalLink size={10} />
                            View Profile
                        </button>
                    </div>
                    <div className="space-y-1.5 grayscale group-hover:grayscale-0 transition-all">
                        {isVendor && [
                            { label: 'Aadhar Card', value: item.aadharCard },
                            { label: 'PAN Card', value: item.panCard },
                            { label: 'Shop Proof', value: item.shopEstablishmentProof },
                            { label: 'FSSAI License', value: item.fssaiLicense }
                        ].map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                <span className="text-[10px] font-medium text-slate-600 flex items-center gap-1.5">
                                    <CheckCircle2 size={10} className={doc.value ? "text-emerald-500" : "text-slate-300"} />
                                    {doc.label}
                                </span>
                                {doc.value && <ExternalLink size={10} className="text-slate-300 group-hover:text-primary transition-colors" />}
                            </div>
                        ))}
                        {isFranchise && [
                            { label: 'Aadhaar Card', value: item.kyc?.aadhaarImage },
                            { label: 'PAN Card', value: item.kyc?.panImage },
                            { label: 'FSSAI', value: item.kyc?.fssaiCertificate },
                            { label: 'Shop establishment', value: item.kyc?.shopEstablishmentCertificate },
                            { label: 'GST certificate', value: item.kyc?.gstCertificate },
                        ].map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                <span className="text-[10px] font-medium text-slate-600 flex items-center gap-1.5">
                                    <CheckCircle2 size={10} className={doc.value ? "text-emerald-500" : "text-slate-300"} />
                                    {doc.label}
                                </span>
                                {doc.value && <ExternalLink size={10} className="text-slate-300 group-hover:text-primary transition-colors" />}
                            </div>
                        ))}
                        {isDelivery && [
                            { label: 'Aadhar Number', value: item.aadharNumber, image: item.aadharImage },
                            { label: 'PAN Number', value: item.panNumber, image: item.panImage },
                            { label: 'License Number', value: item.licenseNumber, image: item.licenseImage }
                        ].map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-medium text-slate-600 flex items-center gap-1.5">
                                        <CheckCircle2 size={10} className={doc.image ? "text-emerald-500" : "text-slate-300"} />
                                        {doc.label}
                                    </span>
                                    {doc.value && <span className="text-[10px] font-bold text-slate-900 ml-4 tabular-nums">{doc.value}</span>}
                                </div>
                                {doc.image && <ExternalLink size={10} className="text-slate-300 group-hover:text-primary transition-colors" />}
                            </div>
                        ))}
                        {isCredit && (
                            <div className="flex flex-col gap-1 p-2 bg-slate-50 border border-slate-100 rounded-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Credit Requested</span>
                                <span className="text-lg font-black text-slate-900 tabular-nums leading-none">₹{item.requestedLimit.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-2 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    disabled={item.status === 'blocked' || item.kyc?.status === 'rejected'}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReject(item); }}
                    className="py-1.5 bg-white border border-slate-200 text-slate-500 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                    <XCircle size={12} />
                    Reject
                </button>
                <button
                    type="button"
                    disabled={isAlreadyApproved}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onApprove(item); }}
                    className="py-1.5 bg-slate-900 text-white rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:bg-emerald-500 disabled:opacity-100"
                >
                    <CheckCircle2 size={12} className={cn(isAlreadyApproved ? "text-slate-900" : "text-emerald-400")} />
                    {isAlreadyApproved ? 'Verified' : 'Verify'}
                </button>
            </div>
        </motion.div>
    );
}
