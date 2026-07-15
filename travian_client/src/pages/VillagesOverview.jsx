import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import useGameStore from '../store/useGameStore';

export default function VillagesOverview() {
    const navigate = useNavigate();
    const setActiveVillageId = useGameStore((state) => state.setActiveVillageId);
    const setVillages = useGameStore((state) => state.setVillages);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [confirmAbandon, setConfirmAbandon] = useState(null);
    const [abandoning, setAbandoning] = useState(false);

    const fetchOverview = useCallback(async () => {
        try {
            const { data } = await api.get('game/villages-overview/');
            setData(data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchOverview();
        const interval = setInterval(fetchOverview, 20000);
        return () => clearInterval(interval);
    }, [fetchOverview]);

    const handleAbandon = async () => {
        if (!confirmAbandon) return;
        setAbandoning(true);
        try {
            await api.post(`game/villages/${confirmAbandon.id}/abandon/`);
            setConfirmAbandon(null);
            const { data: villages } = await api.get('game/villages/');
            setVillages(villages);
            if (useGameStore.getState().activeVillageId === confirmAbandon.id && villages.length > 0) {
                setActiveVillageId(villages[0].id);
            }
            fetchOverview();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در رها کردن دهکده');
        } finally {
            setAbandoning(false);
        }
    };

    if (loading || !data) return <PageShell><LoadingState label="در حال بارگذاری همه‌ی دهکده‌ها..." /></PageShell>;

    const goToVillage = (id) => { setActiveVillageId(id); navigate('/village'); };

    return (
        <PageShell maxWidth="max-w-5xl">
            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">🏘️ نمای کلی دهکده‌ها</span>
                    <span className="badge-gold">جمعیت کل: {data.total_population.toLocaleString()}</span>
                </div>
                <div className="panel-body overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead>
                            <tr className="bg-parchment-100 text-ink-700 text-sm">
                                <th className="p-3 rounded-r-lg">دهکده</th>
                                <th className="p-3">جمعیت</th>
                                <th className="p-3"><img src="/assets/ui/res-1.gif" alt="چوب" className="w-4 h-4 mx-auto" /></th>
                                <th className="p-3"><img src="/assets/ui/res-2.gif" alt="خشت" className="w-4 h-4 mx-auto" /></th>
                                <th className="p-3"><img src="/assets/ui/res-3.gif" alt="آهن" className="w-4 h-4 mx-auto" /></th>
                                <th className="p-3"><img src="/assets/ui/res-4.gif" alt="گندم" className="w-4 h-4 mx-auto" /></th>
                                <th className="p-3"><img src="/assets/ui/troops-icon.gif" alt="صف ساخت" className="w-4 h-4 mx-auto" /></th>
                                <th className="p-3"><img src="/assets/ui/attack-symbol.gif" alt="حمله" className="w-4 h-4 mx-auto" /></th>
                                <th className="p-3 rounded-l-lg">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.villages.map((v) => (
                                <tr key={v.id} onClick={() => goToVillage(v.id)}
                                    className={`cursor-pointer hover:bg-parchment-50 transition ${v.incoming_attacks > 0 ? 'bg-rose-50' : ''}`}>
                                    <td className="p-3 font-bold text-ink-800 border-b border-parchment-200">
                                        {v.is_capital ? '👑 ' : '🏘️ '}{v.name}{v.has_world_wonder && ' 🏛️'}
                                    </td>
                                    <td className="p-3 border-b border-parchment-200">{v.population.toLocaleString()}</td>
                                    <td className="p-3 text-xs border-b border-parchment-200">{Math.floor(v.resources.wood)}</td>
                                    <td className="p-3 text-xs border-b border-parchment-200">{Math.floor(v.resources.clay)}</td>
                                    <td className="p-3 text-xs border-b border-parchment-200">{Math.floor(v.resources.iron)}</td>
                                    <td className="p-3 text-xs border-b border-parchment-200">{Math.floor(v.resources.crop)}</td>
                                    <td className="p-3 border-b border-parchment-200">{v.building_queue_active ? '🔨' : '—'}</td>
                                    <td className="p-3 border-b border-parchment-200">
                                        {v.incoming_attacks > 0 ? <span className="text-rose-600 font-bold">{v.incoming_attacks} ⚔️</span> : '—'}
                                    </td>
                                    <td className="p-3 border-b border-parchment-200" onClick={(e) => e.stopPropagation()}>
                                        {!v.is_capital && data.villages.length > 1 && (
                                            <button
                                                onClick={() => setConfirmAbandon(v)}
                                                className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded hover:bg-rose-200 transition"
                                            >
                                                🗑️ رها کردن
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {confirmAbandon && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center">
                        <h3 className="text-lg font-bold text-ink-800 mb-3">⚠️ رها کردن دهکده</h3>
                        <p className="text-sm text-ink-600 mb-5">
                            آیا مطمئن هستید که می‌خواهید دهکده «{confirmAbandon.name}» را رها کنید؟
                            <br />
                            <span className="text-rose-600 font-bold">این عمل غیرقابل بازگشت است.</span>
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setConfirmAbandon(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-bold"
                            >
                                لغو
                            </button>
                            <button
                                onClick={handleAbandon}
                                disabled={abandoning}
                                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition text-sm font-bold disabled:opacity-50"
                            >
                                {abandoning ? 'در حال رها کردن...' : 'تأیید رها کردن'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}