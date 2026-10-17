import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Notices when a new version of the site has been deployed while this tab is open, and offers a
 * one-tap refresh. Without it a page left open (e.g. a vendor or admin panel) keeps running the old
 * code until someone reloads it.
 */

const CHECK_EVERY_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

const bundleOf = (html) => (String(html).match(/\/assets\/index-[\w-]+\.js/) || [])[0] || null;

const currentBundle = () => {
    const el = [...document.querySelectorAll('script[src]')].find((s) => /\/assets\/index-[\w-]+\.js/.test(s.src));
    return el ? (el.src.match(/\/assets\/index-[\w-]+\.js/) || [])[0] : null;
};

export default function VersionWatcher() {
    useEffect(() => {
        const running = currentBundle();
        if (!running) return undefined; // dev server: nothing to compare
        let lastCheck = 0;
        let notified = false;

        const check = async () => {
            if (notified || Date.now() - lastCheck < MIN_GAP_MS) return;
            lastCheck = Date.now();
            try {
                const res = await fetch(`${window.location.pathname}?v=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return;
                const latest = bundleOf(await res.text());
                if (latest && latest !== running) {
                    notified = true;
                    toast('A new version of Kisaankart is available', {
                        description: 'Refresh to get the latest changes.',
                        duration: Infinity,
                        action: { label: 'Refresh', onClick: () => window.location.reload() },
                    });
                }
            } catch {
                // offline or blocked: try again later
            }
        };

        const timer = setInterval(check, CHECK_EVERY_MS);
        const onFocus = () => check();
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            clearInterval(timer);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, []);

    return null;
}
