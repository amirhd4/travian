import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import ResourceBar from '../components/ResourceBar';
import Navbar from '../components/Navbar';
import useGameStore from '../store/useGameStore';

export default function SendTroops() {
    const location = useLocation();
    const navigate = useNavigate();
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const targetVillageId = location.state?.targetVillageId || 0;
    const targetName = location.state?.targetName || "مختصات نامشخص";

    const [availableTroops, setAvailableTroops] = useState([]);
    const [troops, setTroops] = useState({});
    const [movementType, setMovementType] = useState('ATTACK');
    const [sendHero, setSendHero] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const fetchTroops = useCallback(async () => {
        if (!activeVillageId) return;
        setFetching(true);
        try {
            const { data } = await api.get('combat/village-troops/', { params: { village_id: activeVillageId } });
            setAvailableTroops(data);
        } catch (error) {
            console.error('خطا در دریافت نیروهای دهکده', error);
        } finally {
            setFetching(false);
        }
    }, [activeVillageId]);

    useEffect(() => { fetchTroops(); }, [fetchTroops]);

    const handleInputChange = (id, value, max) => {
        const qty = Math.max(0, Math.min(max, parseInt(value) || 0));
        setTroops((prev) => ({ ...prev, [id]: qty }));
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!activeVillageId) {
            alert("دهکده فعال هنوز مشخص نشده، لطفا لحظاتی صبر کنید و دوباره تلاش کنید.");
            return;
        }

        const payload = Object.fromEntries(Object.entries(troops).filter(([, v]) => v > 0));
        if (Object.keys(payload).length === 0) {
            alert('حداقل یک نوع نیرو انتخاب کنید.');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('combat/send-troops/', {
                source_village_id: activeVillageId,
                target_village_id: targetVillageId,
                movement_type: movementType,
                troops_payload: payload,
                send_hero: sendHero,
            });
            alert(response.data.message);
            navigate('/village');
        } catch (error) {
            alert("خطا: " + (error.response?.data?.error || "ارتباط با سرور برقرار نشد"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen bg-stone-100 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-8 rounded-lg shadow-xl border border-gray-300 max-w-lg w-full">
                <h2 className="text-xl font-bold text-gray-800 mb-2 border-b pb-2">⚔️ نقطه گردهمایی نظامی</h2>
                <p className="text-sm text-gray-600 mb-6">هدف حمله: <span className="font-bold text-red-600">{targetName}</span></p>

                <form onSubmit={handleSend} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">نوع عملیات تاکتیکی:</label>
                        <select
                            value={movementType}
                            onChange={(e) => setMovementType(e.target.value)}
                            className="w-full p-2 border rounded bg-gray-50 focus:border-amber-600 outline-none font-semibold"
                        >
                            <option value="ATTACK">🪓 حمله کامل (تسخیر / نقشه ساخت)</option>
                            <option value="RAID">💰 غارت منابع</option>
                            <option value="REINFORCEMENT">🛡️ پشتیبانی نظامی</option>
                            <option value="SCOUT">🔍 شناسایی</option>
                        </select>
                    </div>

                    <div className="border p-4 rounded bg-gray-50 space-y-3">
                        <h3 className="text-sm font-bold text-gray-600 mb-1">انتخاب تعداد نیروهای اعزامی:</h3>
                        {fetching ? (
                            <p className="text-xs text-gray-500">در حال بارگذاری نیروهای موجود...</p>
                        ) : availableTroops.length === 0 ? (
                            <p className="text-xs text-gray-500">این دهکده هیچ نیرویی ندارد.</p>
                        ) : (
                            availableTroops.map((t) => (
                                <div key={t.troop_type_id} className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                        {t.name} <span className="text-xs text-gray-400">(موجود: {t.count})</span>
                                    </span>
                                    <input
                                        type="number" min="0" max={t.count}
                                        value={troops[t.troop_type_id] || ''}
                                        onChange={(e) => handleInputChange(t.troop_type_id, e.target.value, t.count)}
                                        className="w-24 p-1 border rounded text-center font-bold"
                                    />
                                </div>
                            ))
                        )}
                    </div>

                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-amber-50 border border-amber-300 rounded p-3 cursor-pointer">
                        <input type="checkbox" checked={sendHero} onChange={(e) => setSendHero(e.target.checked)} />
                        🦸 اعزام قهرمان همراه این نیرو (لازم برای تسخیر یا برداشتن نقشه‌ی ساخت)
                    </label>

                    <button
                        type="submit"
                        disabled={loading || !activeVillageId}
                        className="w-full bg-red-700 text-white p-3 rounded font-bold hover:bg-red-800 transition disabled:bg-gray-400"
                    >
                        {loading ? "در حال اعزام ارتش..." : "🚀 تایید و حرکت نیروها"}
                    </button>
                </form>
            </div>
        </div>
    );
}