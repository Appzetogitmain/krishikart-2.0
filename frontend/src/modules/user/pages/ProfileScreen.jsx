import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, Package, Wallet,
  ChevronRight, Bell, Heart,
  Info, Power, CreditCard,
  Trash2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageTransition from '../components/layout/PageTransition'
import { cn } from '@/lib/utils'
import { useWallet } from '../contexts/WalletContext'
import api from '@/lib/axios'

export default function ProfileScreen() {
  const navigate = useNavigate()
  const { balance, creditLimit, availableCredit } = useWallet()


  const userData = JSON.parse(localStorage.getItem('userData') || '{}')

  const handleLogout = () => {
    localStorage.removeItem('userToken')
    localStorage.removeItem('userData')
    localStorage.removeItem('token') // Fallback
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This action is permanent and cannot be undone.")) {
      try {
        await api.delete('/user/delete-account')
        alert("Account deleted successfully.")
        handleLogout()
      } catch (error) {
        console.error("Failed to delete account", error)
        alert(error.response?.data?.message || "Failed to delete account. Please try again.")
      }
    }
  }

  const walletItems = [
    {
      icon: Wallet,
      label: "Kisaankart wallet",
      path: "/wallet",
      badge: <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center justify-center">₹{balance || 0}</div>
    }
  ];

  if (creditLimit > 0) {
    walletItems.push({
      icon: CreditCard,
      label: "Kisaankart Credit",
      path: "/credit-info",
      badge: <div className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center justify-center">₹{availableCredit || 0}</div>
    });
  }

  const sections = [
    {
      title: "Orders",
      items: [
        { icon: Package, label: "Your orders", path: "/orders" },
      ]
    },
    {
      title: "Wallet & payment",
      items: walletItems
    },
    {
      title: "Others",
      items: [
        { icon: User, label: "Profile settings", path: "/edit-profile" },
        { icon: Bell, label: "Notifications", path: "/notifications" },
        { icon: Heart, label: "My list", path: "/wishlist" },
        { icon: Info, label: "Contact us", path: "/help-support" },
      ]
    }
  ]

  return (
    <PageTransition>
      <div className="bg-[#f2f5f8] min-h-screen pb-32 font-sans md:hidden">
        {/* Profile Header */}
        <div className="bg-white px-5 pt-8 pb-5 rounded-b-[28px] shadow-sm mb-4">
          <div className="flex items-center gap-3.5" onClick={() => navigate('/edit-profile')}>
            <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center border border-slate-900 shrink-0">
              <span className="text-xl font-black text-white uppercase">
                {userData.fullName ? userData.fullName.charAt(0) : 'G'}
              </span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-[18px] font-black text-slate-900 leading-tight tracking-tight">
                {userData.fullName ? userData.fullName.split(' ')[0] : 'Guest'}
              </h1>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="px-3.5 space-y-3.5">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-white/50">
              <div className="px-4 pt-4 pb-1.5 flex items-center gap-2.5">
                <div className="w-[2.5px] h-3.5 bg-emerald-600 rounded-full" />
                <h2 className="text-[14px] font-black text-slate-800 tracking-tight">{section.title}</h2>
              </div>

              <div className="flex flex-col">
                {section.items.map((item, iIdx) => (
                  <div key={iIdx}>
                    {(() => {
                      const isToggle = item.type === "toggle";
                      const Tag = isToggle ? 'div' : 'button';
                      return (
                        <Tag
                          onClick={() => {
                            if (item.onClick) {
                              item.onClick()
                              return
                            }
                            if (!isToggle && item.path !== "#") {
                              navigate(item.path)
                            }
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-3 transition-colors group",
                            !isToggle && "active:bg-slate-50 cursor-pointer"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                              {item.isVeg ? (
                                <div className="w-4 h-4 border-[1.5px] border-emerald-600 flex items-center justify-center rounded-[2px] p-[2px]">
                                  <div className="w-full h-full bg-emerald-600 rounded-full" />
                                </div>
                              ) : item.icon && (
                                <item.icon size={17} strokeWidth={2.5} />
                              )}
                            </div>
                            <span className="text-[13.5px] font-bold text-slate-700 tracking-tight">{item.label}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.badge}
                            {isToggle ? (
                              <Switch
                                checked={isVegMode}
                                onCheckedChange={setIsVegMode}
                                className="scale-[0.85] origin-right data-[state=checked]:bg-emerald-600"
                              />
                            ) : (
                              <ChevronRight size={15} className="text-slate-200" />
                            )}
                          </div>
                        </Tag>
                      );
                    })()}
                    {iIdx < section.items.length - 1 && (
                      <div className="mx-4 border-b border-slate-50/80" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full bg-white rounded-[20px] px-6 py-3.5 flex items-center gap-3 text-emerald-600 font-extrabold text-[14.5px] shadow-sm active:bg-slate-50 transition-all mt-1"
          >
            <Power size={17} strokeWidth={3} />
            Logout
          </button>

          {/* Delete Account Button */}
          <button
            onClick={handleDeleteAccount}
            className="w-full bg-red-50 rounded-[20px] px-6 py-3.5 flex items-center gap-3 text-red-600 font-extrabold text-[14.5px] shadow-sm active:bg-red-100 transition-all mt-3"
          >
            <Trash2 size={17} strokeWidth={3} />
            Delete Account
          </button>
        </div>

        <p className="text-center text-[10px] font-bold text-slate-300 mt-8 mb-6 uppercase tracking-widest">
          Build 2.4.0 · Kisaankart Global
        </p>
      </div>

      {/* Desktop Fallback */}
      <div className="hidden md:block bg-slate-50 min-h-screen pb-20 pt-10">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-3xl font-black text-slate-900 mb-8">My account</h1>

          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 space-y-6">
              {sections.map((section, sIdx) => (
                <div key={sIdx} className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <div className="w-1 h-6 bg-emerald-600 rounded-full" />
                    {section.title}
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {section.items.map((item, iIdx) => (
                      <button
                        key={iIdx}
                        onClick={() => item.path && navigate(item.path)}
                        className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                          {item.icon && <item.icon size={22} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.label}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={handleLogout}
                className="w-full bg-white rounded-[32px] p-6 flex items-center justify-center gap-3 text-emerald-600 font-black border-2 border-dashed border-emerald-100 hover:bg-emerald-50 transition-all"
              >
                <Power size={24} />
                Logout from Kisaankart
              </button>

              {/* Delete Account Button */}
              <button
                onClick={handleDeleteAccount}
                className="w-full bg-red-50 rounded-[32px] p-6 flex items-center justify-center gap-3 text-red-600 font-black border-2 border-dashed border-red-100 hover:bg-red-100/50 transition-all mt-4"
              >
                <Trash2 size={24} />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
