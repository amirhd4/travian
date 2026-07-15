import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';

export default function GoldShop() {
    const navigate = useNavigate();
    const [data, setData] = useState({ packages: [], active_discount_percent: 0 });
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchPackages = useCallback(async () => {
        try {
            const res = await api.get('game/gold-packages/');
            setData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPackages(); }, [fetchPackages]);

    const handleBuy = async (packageId) => {
        setBuying(packageId);
        try {
            const { data } = await api.post('game/payment/create/', { package_id: packageId });
            navigate(`/checkout/${data.authority}`);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در شروع پرداخت' });
        } finally {
            setBuying(null);
        }
    };

    if (loading) return <PageShell><LoadingState label="در حال بارگذاری فروشگاه..." /></PageShell>;

    return (
        <PageShell maxWidth="max-w-4xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="فروشگاه طلا" />

            <WoodSign title="فروشگاه طلا" icon="💰">
                {data.active_discount_percent > 0 && (
                    <p className="text-center text-xs font-bold text-rose-600 bg-rose-50 border border-rose-300 rounded-xl p-2.5 mb-4">
                        🎉 تخفیف ویژه فعال: {data.active_discount_percent}٪ طلای اضافه روی هر خرید!
                    </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {data.packages.map((pkg) => (
                        <div key={pkg.id} className="bg-white border-2 border-parchment-300 rounded-xl p-4 text-center shadow-soft hover:border-gold-400 transition">
                            <img src="/assets/ui/gold.gif" alt="طلا" className="w-12 h-12 mx-auto mb-1" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                            <p className="text-3xl mb-1 hidden">💰</p>
                            <p className="font-bold text-ink-800 text-sm">{pkg.name}</p>
                            <p className="text-gold-600 font-extrabold text-xl mt-1">{pkg.gold_amount}</p>
                            {data.active_discount_percent > 0 && (
                                <p className="text-[10px] text-brand-700 font-bold">
                                    (+{Math.round(pkg.gold_amount * data.active_discount_percent / 100)} هدیه)
                                </p>
                            )}
                            <p className="text-xs text-ink-500 mt-2">{Number(pkg.price).toLocaleString()} تومان</p>
                            <button onClick={() => handleBuy(pkg.id)} disabled={buying === pkg.id} className="btn-gold w-full mt-3 text-xs !py-2">
                                {buying === pkg.id ? '...' : 'خرید'}
                            </button>
                        </div>
                    ))}
                </div>
            </WoodSign>
        </PageShell>
    );
}