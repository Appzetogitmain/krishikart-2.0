import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { keepPage, peekPage } from '../lib/pageCache';
import { pageForRequest } from '../lib/requestStatus';

/*
 * /vendor/orders/:id used to open the old per-order quotation screen. Rates are now agreed on the
 * Quotation page and goods packed on Pack & Dispatch, so old links (dashboard, history, notifications)
 * go to the page that fits the order's stage.
 */
export default function OrderRedirect() {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        let alive = true;
        const go = (r) => { if (alive) navigate(pageForRequest(r), { replace: true }); };
        const cached = (peekPage('assignments') || []).find((r) => String(r._id) === String(id));
        if (cached) { go(cached); return () => { alive = false; }; }
        api.get('/procurement/vendor/my-assignments')
            .then((res) => {
                const list = keepPage('assignments', res.data?.results || []);
                go(list.find((r) => String(r._id) === String(id)));
            })
            .catch(() => go(null));
        return () => { alive = false; };
    }, [id, navigate]);

    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
}
