import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import WoodSign from '../components/WoodSign';
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

    const fetchStatus = useCallback(async () => {
        try {
            const { data } = await api.get('game/plus/');
            setStatus(data);
        } catch (error) {
            console.error('خطا در دریافت وضعیت پلاس', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const handleBuy = async (days) => {
        setBuying(days);
        try {
            const { data } = await api.post('game/plus/', { days });
            alert(data.message);
            fetchStatus();
            const me = await api.get('auth/me/');
            setUser(me.data);
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در خرید پلاس');
        } finally {
            setBuying(null);
        }
    };

    if (loading || !status) {
        return (
            <div className="w-full min-h-screen game-sky-bg pt-32 flex items-center justify-center">
                <p className="font-bold text-wood-dark">در حال بارگذاری...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen game-sky-bg pt-32 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-lg w-full px-4">
                <WoodSign title="👑 اکانت پلاس">
                    {status.has_plus ? (
                        <p className="text-center text-sm font-bold text-green-700 bg-green-50 border border-green-400 rounded p-3 mb-4">
                            ✅ اکانت پلاس شما فعال است تا {new Date(status.expires_at).toLocaleString('fa-IR')}
                        </p>
                    ) : (
                        <p className="text-center text-sm font-bold text-gray-600 bg-gray-50 border border-gray-300 rounded p-3 mb-4">
                            اکانت پلاس شما غیرفعال است.
                        </p>
                    )}

                    <ul className="text-xs text-wood-dark list-disc list-inside space-y-1 mb-4 bg-white/60 rounded p-3">
                        <li>صف ساخت‌وساز دوتایی (۲ ساختمان هم‌زمان به‌جای ۱)</li>
                        <li>اولویت در پشتیبانی و امکانات آینده</li>
                    </ul>

                    <p className="text-center text-xs text-gray-500 mb-3">
                        هزینه: {status.cost_per_day} طلا به‌ازای هر روز — موجودی فعلی: {status.gold_coins} 💰
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                        {OPTIONS.map((opt) => (
                            <button
                                key={opt.days}
                                onClick={() => handleBuy(opt.days)}
                                disabled={buying === opt.days}
                                className="btn-travian-green text-xs disabled:opacity-50"
                            >
                                {buying === opt.days ? '...' : `${opt.label} (${opt.days * status.cost_per_day} 💰)`}
                            </button>
                        ))}
                    </div>
                </WoodSign>
            </div>
        </div>
    );
}