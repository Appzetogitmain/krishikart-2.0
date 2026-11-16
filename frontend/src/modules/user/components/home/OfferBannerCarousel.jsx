import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/axios'
import { optimizedImage } from '../../utils/optimizedImage'

/*
 * Offer banners on the home page (client, Nov 2026): the admin uploads 3-4 offer images
 * (Admin > Offer Banners) and they slide by on their own. Images are shown at 3:1 everywhere,
 * so one image works on phones and computers. Nothing is shown when there are no banners.
 */

const SLIDE_MS = 4000

let cached = null // keeps the banners while moving between pages

export default function OfferBannerCarousel({ className = '' }) {
    const navigate = useNavigate()
    const [banners, setBanners] = useState(cached || [])
    const [rawIndex, setIndex] = useState(0)
    const [paused, setPaused] = useState(false)
    const touch = useRef(null)

    useEffect(() => {
        let alive = true
        api.get('/banners')
            .then(({ data }) => {
                const list = Array.isArray(data?.results) ? data.results.filter((b) => b?.image) : []
                cached = list
                if (alive) setBanners(list)
            })
            .catch(() => { })
        return () => { alive = false }
    }, [])

    const count = banners.length
    const go = useCallback((i) => setIndex(((i % count) + count) % count), [count])
    // Stays valid if the list gets shorter after a refresh
    const index = count ? rawIndex % count : 0

    // Moves on by itself; stops while the mouse is over it or the tab is hidden
    useEffect(() => {
        if (count < 2 || paused) return undefined
        const id = setInterval(() => { if (!document.hidden) setIndex((i) => (i + 1) % count) }, SLIDE_MS)
        return () => clearInterval(id)
    }, [count, paused, index])

    if (!count) return null

    const open = (b) => {
        if (!b.link) return
        if (b.link.startsWith('/')) navigate(b.link)
        else window.open(b.link, '_blank', 'noopener,noreferrer')
    }

    const onTouchStart = (e) => { touch.current = e.touches[0].clientX; setPaused(true) }
    const onTouchEnd = (e) => {
        const start = touch.current
        touch.current = null
        setPaused(false)
        if (start == null) return
        const dx = e.changedTouches[0].clientX - start
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
    }

    return (
        <div className={className}>
        <section
            className="relative group"
            aria-roledescription="carousel"
            aria-label="Offers"
            data-offer-banners={count}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <div className="overflow-hidden rounded-2xl md:rounded-[28px] bg-slate-100 shadow-sm" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
                    {banners.map((b, i) => {
                        const Tag = b.link ? 'button' : 'div'
                        return (
                            <Tag
                                key={b._id || i}
                                {...(b.link ? { type: 'button', onClick: () => open(b) } : {})}
                                className="block w-full shrink-0 aspect-[3/1] p-0 border-0 bg-transparent"
                                aria-hidden={i !== index}
                                tabIndex={i === index && b.link ? 0 : -1}
                                aria-label={b.title || `Offer ${i + 1}`}
                            >
                                <img
                                    src={optimizedImage(b.image, 1600)}
                                    alt={b.title || `Offer ${i + 1}`}
                                    loading={i === 0 ? 'eager' : 'lazy'}
                                    draggable={false}
                                    className="w-full h-full object-cover select-none"
                                />
                            </Tag>
                        )
                    })}
                </div>
            </div>

            {count > 1 && (
                <>
                    <button type="button" onClick={() => go(index - 1)} aria-label="Previous offer"
                        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white shadow-md items-center justify-center text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronLeft size={22} />
                    </button>
                    <button type="button" onClick={() => go(index + 1)} aria-label="Next offer"
                        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white shadow-md items-center justify-center text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight size={22} />
                    </button>
                    <div className="absolute bottom-2.5 md:bottom-4 inset-x-0 flex justify-center gap-1.5">
                        {banners.map((b, i) => (
                            <button key={b._id || i} type="button" onClick={() => go(i)} aria-label={`Show offer ${i + 1}`}
                                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'} shadow`} />
                        ))}
                    </div>
                </>
            )}
        </section>
        </div>
    )
}
