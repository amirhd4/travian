import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import useGameStore from '../store/useGameStore';

export default function VillagesOverview() {
    const navigate = useNavigate();
    const setActiveVillageId = useGameStore((state) => state.setActiveVillageId);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

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
                                <th className="p-3">🪵</th><th className="p-3">🧱</th>
                                <th className="p-3">⚒️</th><th className="p-3">🌾</th>
                                <th className="p-3">🔨 صف ساخت</th>
                                <th className="p-3 rounded-l-lg">⚔️ حمله در راه</th>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </PageShell>
    );
}