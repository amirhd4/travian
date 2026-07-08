import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

export default function WorldWonder() {
    const villages = useGameStore((state) => state.villages);
    const { lastMessage } = useGameWebSocket();

    const [wwVillageId, setWwVillageId] = useState(null);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);

    useEffect(() => {
        const wwVillage = villages.find((v) => v.has_world_wonder);
        setWwVillageId(wwVillage ? wwVillage.id : null);
    }, [villages]);

    const fetchStatus = useCallback(async () => {
        if (!wwVillageId) { setLoading(false); return; }
        try {
            const { data } = await api.get('ww/upgrade/', { params: { village_id: wwVillageId } });
            setStatus(data);
        } catch (error) {
            console.error('خطا در دریافت وضعیت شگفتی جهان', error);
        } finally {
            setLoading(false);
        }
    }, [wwVillageId]);

    useEffect(() => { setLoading(true); fetchStatus(); }, [fetchStatus]);

    useEffect(() => {
        if (lastMessage?.type === 'COMBAT_RESULT') fetchStatus();
    }, [lastMessage, fetchStatus]);

    const handleUpgrade = async () => {
        if (!window.confirm('ارتقای شگفتی جهان نیازمند میلیون‌ها منبع است. آیا مطمئن هستید؟')) return;
        setUpgrading(true);
        try {
            const { data } = await api.post('ww/upgrade/', { village_id: wwVillageId });
            alert(data.message);
            fetchStatus();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در ارتقا');
        } finally {
            setUpgrading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full min-h-screen bg-slate-900 pt-28 flex items-center justify-center">
                <p className="font-bold text-gray-300">در حال بارگذاری...</p>
            </div>
        );
    }

    if (!wwVillageId) {
        return (
            <div className="w-full min-h-screen bg-slate-900 pt-28 flex flex-col items-center">
                <ResourceBar />
                <Navbar />
                <div className="bg-stone-800 text-white p-8 rounded-lg mt-10 max-w-lg text-center">
                    <h1 className="text-2xl font-extrabold text-amber-500 mb-4">🏛️ شگفتی جهان</h1>
                    <p className="text-gray-300 text-sm">
                        شما هنوز دهکده‌ای ندارید که شگفتی جهان در آن ساخته شده باشد. باید ابتدا یکی از
                        دوازده «دهکده‌ی ویرانه»‌ی ناتار روی نقشه جهان را با نیروی سناتور تسخیر کنید.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-slate-900 pt-28 flex flex-col items-center">
            <ResourceBar />
            <Navbar />

            <div className="bg-gradient-to-b from-stone-800 to-stone-900 p-8 rounded-lg shadow-2xl border-4 border-amber-900 max-w-2xl w-full text-center mt-4">
                <h1 className="text-3xl font-extrabold text-amber-500 mb-2 drop-shadow-md">🏛️ شگفتی جهان</h1>
                <p className="text-gray-400 text-sm mb-8">اولین بازیکنی که این بنا را به سطح ۱۰۰ برساند، برنده‌ی بازی است.</p>

                <div className="flex justify-center items-center mb-8 relative">
                    <div className="w-48 h-48 bg-stone-700 rounded-full border-8 border-amber-700 flex items-center justify-center shadow-inner relative overflow-hidden">
                        <div
                            className="absolute bottom-0 w-full bg-amber-600 opacity-30 transition-all duration-1000"
                            style={{ height: `${status.level}%` }}
                        ></div>
                        <span className="text-5xl font-black text-amber-400 z-10">{status.level}</span>
                    </div>
                </div>

                <div className="bg-stone-800 p-4 rounded border border-stone-600 mb-6 text-right text-gray-300 text-sm">
                    <p className="font-bold text-amber-500 mb-2">پیش‌نیازهای سطح بعدی ({status.level + 1}):</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>چوب/خشت/آهن/گندم: {status.next_level_cost.wood.toLocaleString()} از هرکدام</li>
                        <li>
                            نقشه‌ی ساخت:{' '}
                            {status.has_valid_plan
                                ? <span className="text-green-500">در دسترس ✔️</span>
                                : <span className="text-red-500">موجود نیست ✖️</span>}
                        </li>
                    </ul>
                </div>

                <button
                    onClick={handleUpgrade}
                    disabled={upgrading || !status.has_valid_plan}
                    className="w-full bg-amber-700 text-amber-100 p-4 rounded-lg font-bold text-lg hover:bg-amber-600 transition border-b-4 border-amber-900 active:border-b-0 active:translate-y-1 disabled:opacity-50"
                >
                    {upgrading ? "در حال ساخت سازه..." : "ارتقا به سطح بعدی 🔨"}
                </button>
            </div>
        </div>
    );
}