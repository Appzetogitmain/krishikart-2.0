import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { vendorNavItems, isVendorNavActive } from './vendorNavConfig';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <nav
            className={cn(
                "lg:hidden fixed bottom-0 left-0 right-0 z-40",
                "bg-white/95 backdrop-blur-xl border-t-2 border-slate-200",
                "shadow-[0_-2px_16px_rgba(0,0,0,0.06)]"
            )}
            style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))' }}
        >
            {/* Same destinations as desktop sidebar; scroll horizontally on narrow screens */}
            <div
                className={cn(
                    "flex overflow-x-auto overflow-y-hidden",
                    "scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                    "gap-1 px-2 pt-1.5 pb-1",
                    "min-h-[52px] items-stretch"
                )}
            >
                {vendorNavItems.map((item) => {
                    const isActive = isVendorNavActive(location.pathname, item.path);
                    const Icon = item.icon;
                    const label = item.shortLabel || item.label;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => navigate(item.path)}
                            aria-current={isActive ? 'page' : undefined}
                            title={item.label}
                            className={cn(
                                "flex shrink-0 flex-col items-center justify-center gap-0.5 py-1 px-2 min-w-[68px] max-w-[100px]",
                                "min-h-[44px] transition-all duration-150 active:scale-95"
                            )}
                        >
                            <div className={cn(
                                "relative flex items-center justify-center rounded-full p-1.5 transition-colors duration-200",
                                isActive && "bg-slate-900/10"
                            )}>
                                <Icon
                                    size={isActive ? 20 : 18}
                                    className={cn(
                                        "transition-colors duration-200",
                                        isActive ? "text-slate-900" : "text-slate-400"
                                    )}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                />
                            </div>
                            <span className={cn(
                                "text-[10px] sm:text-[10px] font-medium text-center transition-colors duration-200 leading-tight line-clamp-2",
                                isActive ? "text-slate-900" : "text-slate-400"
                            )}>
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
