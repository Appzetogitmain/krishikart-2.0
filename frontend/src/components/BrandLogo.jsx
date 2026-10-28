import { cn } from '@/lib/utils';

/**
 * Kisaankart's own logo (the farmer + leaf "Kisaan Kart" mark from the customer site), used by every
 * portal's sidebar instead of a different icon per portal. /logo-mark.png is /logo.png with the empty
 * margin trimmed, so it can sit at sidebar height. `label` is the portal name shown next to it.
 */
export default function BrandLogo({ label, collapsed = false, size = 'md', className }) {
    const h = collapsed ? 'h-9' : size === 'sm' ? 'h-10' : 'h-14';
    return (
        <div translate="no" className={cn('flex items-center gap-2.5 min-w-0', collapsed && 'justify-center', className)}>
            <img src="/logo-mark.png" alt="Kisaan Kart" className={cn(h, 'w-auto object-contain shrink-0')} />
            {!collapsed && label && (
                <span className="text-[11px] font-bold uppercase tracking-wider text-green-700 leading-tight border-l border-slate-200 pl-2.5">
                    {label}
                </span>
            )}
        </div>
    );
}
