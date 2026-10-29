import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, ChevronRight, Package, PackageOpen, ShoppingCart, Tag, Truck, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserNotifications } from '../../contexts/UserNotificationsContext'

/*
 * Desktop notifications (client mockup, Oct 2026): filter tabs, "Today" / "Earlier" groups and larger,
 * easier-to-read cards. Phones keep the list in NotificationsScreen.
 */

// Which tab a notification belongs to
const kindOf = (n) => {
    const text = `${n.title} ${n.message}`.toLowerCase()
    if (['offer', 'promo', 'coupon'].includes(n.type)) return 'offers'
    if (n.type === 'delivery' || /deliver|dispatch|out for/.test(text)) return 'delivery'
    return 'orders'
}

const KIND_LABEL = { orders: 'Order', delivery: 'Delivery', offers: 'Offer' }

// Icon and colour for the card, from what the notification says
function look(n) {
    const text = `${n.title} ${n.message}`.toLowerCase()
    if (n.type === 'wallet' || n.type === 'wallet_recharge') return { Icon: Wallet, tile: 'bg-sky-50 text-sky-700' }
    if (kindOf(n) === 'offers') return { Icon: Tag, tile: 'bg-orange-50 text-orange-600' }
    if (/partly delivered/.test(text)) return { Icon: PackageOpen, tile: 'bg-green-50 text-green-700' }
    if (/delivered|completed/.test(text)) return { Icon: CheckCircle2, tile: 'bg-green-700 text-white' }
    if (kindOf(n) === 'delivery') return { Icon: Truck, tile: 'bg-green-50 text-green-700' }
    if (/placed/.test(text)) return { Icon: ShoppingCart, tile: 'bg-green-50 text-green-700' }
    return { Icon: Package, tile: 'bg-green-50 text-green-700' }
}

const isToday = (d) => new Date(d).toDateString() === new Date().toDateString()

export default function DesktopNotifications() {
    const navigate = useNavigate()
    const { notifications, hasUnread, markAllRead, markAsRead } = useUserNotifications()
    const [tab, setTab] = useState('all')

    const counts = useMemo(() => {
        const c = { all: notifications.length, orders: 0, delivery: 0, offers: 0 }
        notifications.forEach((n) => { c[kindOf(n)] += 1 })
        return c
    }, [notifications])

    const shown = notifications.filter((n) => tab === 'all' || kindOf(n) === tab)
    const groups = [
        ['Today', shown.filter((n) => isToday(n.createdAt))],
        ['Earlier', shown.filter((n) => !isToday(n.createdAt))],
    ].filter(([, list]) => list.length)

    const TABS = [
        { id: 'all', label: 'All', Icon: Package },
        { id: 'orders', label: 'Orders', Icon: Package },
        { id: 'delivery', label: 'Delivery', Icon: Truck },
        { id: 'offers', label: 'Offers', Icon: Tag },
    ]

    const open = (n) => {
        markAsRead(n.id)
        if (n.link && n.link.startsWith('/')) navigate(n.link)
        else if (n.meta?.orderId) navigate(`/order-detail/${n.meta.orderId}`)
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-16">
            <div className="max-w-[1440px] mx-auto px-8 pt-1">
                <div className="flex items-start justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <span className="w-[72px] h-[72px] rounded-2xl bg-green-100 text-green-700 flex items-center justify-center">
                            <Bell size={34} className="fill-green-700" />
                        </span>
                        <div>
                            <h1 className="text-[38px] font-bold text-slate-900 tracking-tight leading-tight">Notifications</h1>
                            <p className="text-[18px] text-slate-600">Stay updated with your orders, deliveries and offers</p>
                        </div>
                    </div>
                    <button type="button" onClick={markAllRead} disabled={!hasUnread}
                        className="mt-3 inline-flex items-center gap-3 h-14 px-6 rounded-2xl bg-green-50 border border-green-100 text-green-800 text-[17px] font-bold hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        <CheckCircle2 size={22} className="fill-green-700 text-white" /> Mark all as read
                    </button>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                    {TABS.map(({ id, label, Icon }) => (
                        <button key={id} type="button" onClick={() => setTab(id)}
                            className={cn('inline-flex items-center gap-2.5 h-[52px] px-6 rounded-2xl text-[17px] font-semibold border transition-colors',
                                tab === id ? 'bg-green-700 border-green-700 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50')}>
                            <Icon size={20} /> {label} ({counts[id]})
                        </button>
                    ))}
                </div>

                {groups.length === 0 ? (
                    <div className="mt-10 bg-white rounded-2xl border border-slate-200 py-20 text-center">
                        <Bell size={44} className="mx-auto text-slate-300" />
                        <p className="mt-4 text-[22px] font-bold text-slate-900">No notifications</p>
                        <p className="text-[17px] text-slate-600 mt-1">You&apos;re all caught up!</p>
                    </div>
                ) : groups.map(([title, list]) => (
                    <section key={title} className="mt-8">
                        <h2 className="text-[22px] font-bold text-slate-900 mb-3">{title}</h2>
                        <div className="space-y-3">
                            {list.map((n) => {
                                const { Icon, tile } = look(n)
                                return (
                                    <button key={n.id} type="button" onClick={() => open(n)}
                                        className={cn('w-full text-left flex items-center gap-5 px-6 py-5 rounded-2xl border transition-colors',
                                            n.read ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-green-50/70 border-green-100 hover:bg-green-50')}>
                                        <span className={cn('w-16 h-16 rounded-2xl flex items-center justify-center shrink-0', tile)}>
                                            <Icon size={30} />
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-[20px] font-bold text-slate-900">{n.title}</span>
                                            {n.message && <span className="block text-[17px] text-slate-700 mt-0.5 leading-snug">{n.message}</span>}
                                            <span className="block text-[15px] text-slate-500 mt-1.5">{n.time} • {KIND_LABEL[kindOf(n)]}</span>
                                        </span>
                                        {!n.read && <span className="w-3 h-3 rounded-full bg-green-600 shrink-0" aria-label="Unread" />}
                                        <ChevronRight size={24} className="text-slate-400 shrink-0" />
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    )
}
