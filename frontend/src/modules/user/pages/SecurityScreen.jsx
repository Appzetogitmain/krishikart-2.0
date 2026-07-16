import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, Lock, Server, EyeOff, Info, Mail, Phone } from 'lucide-react'
import { motion } from 'framer-motion'
import { STATIC_LEGAL_CONTACT } from '@/lib/legalDefaults'

const SECTIONS = [
  {
    title: '1. Account Protection',
    icon: Lock,
    content:
      'Your account is protected with secure authentication. Keep your login credentials private and notify us immediately if you suspect unauthorized access.',
  },
  {
    title: '2. Data Encryption',
    icon: Server,
    content:
      'We use industry-standard encryption for data in transit and at rest. Payment information is processed through certified payment partners.',
  },
  {
    title: '3. Access Controls',
    icon: EyeOff,
    content:
      'Internal access to customer and order data is limited to authorized personnel and systems needed to fulfill orders and support requests.',
  },
  {
    title: '4. Continuous Monitoring',
    icon: ShieldCheck,
    content:
      'We monitor our platform for suspicious activity and apply security updates regularly to protect users, vendors, and franchise partners.',
  },
]

export default function SecurityScreen() {
  const navigate = useNavigate()
  const email = STATIC_LEGAL_CONTACT.email
  const phone = STATIC_LEGAL_CONTACT.phone

  const contactBlock = useMemo(
    () => (
      <div className="p-5 bg-white rounded-2xl border-2 border-primary/20 shadow-sm shadow-primary/5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Report a security concern</h3>
            <p className="text-xs text-slate-500 font-medium">Email or call our support team</p>
          </div>
        </div>
        <div className="space-y-3">
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-900 font-semibold hover:bg-primary/5 transition-colors"
          >
            <Mail size={18} className="text-primary shrink-0" />
            <span className="break-all">{email}</span>
          </a>
          <a
            href={`tel:${phone.replace(/\s/g, '')}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-900 font-semibold hover:bg-primary/5 transition-colors"
          >
            <Phone size={18} className="text-primary shrink-0" />
            <span>{phone}</span>
          </a>
        </div>
      </div>
    ),
    [email, phone],
  )

  return (
    <div className="bg-white min-h-screen font-sans pb-20">
      <div className="bg-primary text-white p-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="p-1 hover:bg-white/10 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">Security</h1>
        </div>
      </div>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="w-16 h-1 bg-primary rounded-full" />
          <h2 className="text-3xl font-black text-slate-900 leading-tight">Platform Security</h2>
          <p className="text-slate-500 font-medium text-sm leading-relaxed">
            How KisaanKart protects your account, payments, and personal information across the marketplace.
          </p>
        </div>

        {contactBlock}

        <div className="space-y-8">
          {SECTIONS.map((section, idx) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 shrink-0 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-primary">
                <section.icon size={20} />
              </div>
              <div className="space-y-2 pt-1">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">{section.title}</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">{section.content}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
          <Info size={20} className="text-primary shrink-0" />
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
            Last Modified: April 2026. KisaanKart may update security practices as our platform evolves.
          </p>
        </div>
      </div>
    </div>
  )
}
