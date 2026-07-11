import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';

const OPTIONS = [
    { days: 1, label: '۱ روز' },
    { days: 7, label: '۷ روز' },
    { days: 30, label: '۳۰ روز' },
];

export default function PlusAccount() {
    const setUser = useGameStore((state) => state.setUser);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchStatus = useCallback(async () => {
        try {
            const { data } = await api.get('game/plus/');
            setStatus(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const handleBuy = async (days) => {
        setBuying(days);
        try {
            const { data } = await api.post('game/plus/', { days });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchStatus();
            const me = await api.get('auth/me/');
            setUser(me.data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در خرید پلاس' });
        } finally {
            setBuying(null);
        }
    };

    if (loading || !status) return <PageShell><LoadingState /></PageShell>;

    return (
        <PageShell maxWidth="max-w-lg">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="اکانت پلاس" />

            <WoodSign title="اکانت پلاس" icon="👑">
                {status.has_plus ? (
                    <p className="text-center text-sm font-bold text-brand-700 bg-brand-50 border border-brand-300 rounded-xl p-3 mb-4">
                        ✅ اکانت پلاس شما فعال است تا {new Date(status.expires_at).toLocaleString('fa-IR')}
                    </p>
                ) : (
                    <p className="text-center text-sm font-bold text-ink-500 bg-parchment-100 border border-parchment-300 rounded-xl p-3 mb-4">
                        اکانت پلاس شما غیرفعال است.
                    </p>
                )}

                <ul className="text-xs text-ink-700 list-disc list-inside space-y-1 mb-4 bg-white/70 rounded-xl p-3 border border-parchment-200">
                    <li>صف ساخت‌وساز دوتایی (۲ ساختمان هم‌زمان به‌جای ۱)</li>
                    <li>اولویت در پشتیبانی و امکانات آینده</li>
                </ul>

                <p className="text-center text-xs text-ink-500 mb-3">
                    هزینه: {status.cost_per_day} طلا به‌ازای هر روز — موجودی فعلی: {status.gold_coins} 💰
                </p>

                <div className="grid grid-cols-3 gap-2">
                    {OPTIONS.map((opt) => (
                        <button key={opt.days} onClick={() => handleBuy(opt.days)} disabled={buying === opt.days} className="btn-primary text-xs !py-2.5">
                            {buying === opt.days ? '...' : `${opt.label} (${opt.days * status.cost_per_day} 💰)`}
                        </button>
                    ))}
                </div>
            </WoodSign>
        </PageShell>
    );
}