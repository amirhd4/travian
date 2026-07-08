import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import WoodSign from '../components/WoodSign';

export default function GoldShop() {
    const navigate = useNavigate();
    const [data, setData] = useState({ packages: [], active_discount_percent: 0 });
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState(null);

    const fetchPackages = useCallback(async () => {
        try {
            const res = await api.get('game/gold-packages/');
            setData(res.data);
        } catch (error) {
            console.error('خطا در دریافت بسته‌های طلا', error);
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
            alert(error.response?.data?.error || 'خطا در شروع پرداخت');
        } finally {
            setBuying(null);
        }
    };

    if (loading) {
        return (
            <div className="w-full min-h-screen game-sky-bg pt-32 flex items-center justify-center">
                <p className="font-bold text-wood-dark">در حال بارگذاری فروشگاه...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen game-sky-bg pt-32 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-3xl w-full px-4">
                <WoodSign title="💰 فروشگاه طلا">
                    {data.active_discount_percent > 0 && (
                        <p className="text-center text-xs font-bold text-red-600 bg-red-50 border border-red-300 rounded p-2 mb-3">
                            🎉 تخفیف ویژه‌ی فعال: {data.active_discount_percent}٪ طلای اضافه روی هر خرید!
                        </p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        {data.packages.map((pkg) => (
                            <div key={pkg.id} className="bg-white border-2 border-wood-light rounded-lg p-4 text-center shadow">
                                <p className="text-2xl mb-1">💰</p>
                                <p className="font-bold text-wood-dark text-sm">{pkg.name}</p>
                                <p className="text-amber-700 font-extrabold text-lg mt-1">{pkg.gold_amount}</p>
                                {data.active_discount_percent > 0 && (
                                    <p className="text-[10px] text-green-700 font-bold">
                                        (+{Math.round(pkg.gold_amount * data.active_discount_percent / 100)} هدیه)
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 mt-2">{Number(pkg.price).toLocaleString()} تومان</p>
                                <button
                                    onClick={() => handleBuy(pkg.id)}
                                    disabled={buying === pkg.id}
                                    className="btn-travian-green w-full mt-3 text-xs disabled:opacity-50"
                                >
                                    {buying === pkg.id ? '...' : 'خرید'}
                                </button>
                            </div>
                        ))}
                    </div>
                </WoodSign>
            </div>
        </div>
    );
}