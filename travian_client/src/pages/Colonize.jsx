import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import ResourceBar from '../components/ResourceBar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';

const GRID_RADIUS = 2;
const SETTLERS_REQUIRED = 3;

export default function Colonize() {
    const navigate = useNavigate();
    const villages = useGameStore((state) => state.villages);
    const setVillages = useGameStore((state) => state.setVillages);
    const setActiveVillageId = useGameStore((state) => state.setActiveVillageId);

    const [sourceId, setSourceId] = useState('');
    const [settlerCount, setSettlerCount] = useState(null);
    const [loadingSettlers, setLoadingSettlers] = useState(false);

    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [mapVillages, setMapVillages] = useState([]);
    const [loadingMap, setLoadingMap] = useState(false);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [autoFind, setAutoFind] = useState(true);

    const [villageName, setVillageName] = useState('دهکده جدید');
    const [submitting, setSubmitting] = useState(false);
    const [alertMsg, setAlertMsg] = useState(null);

    const [cultureInfo, setCultureInfo] = useState(null);
    useEffect(() => {
        api.get('game/culture-points/').then(({ data }) => setCultureInfo(data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (villages.length > 0 && !sourceId) {
            const capital = villages.find((v) => v.is_capital) || villages[0];
            setSourceId(capital.id);
            setCenter({ x: capital.x_coord, y: capital.y_coord });
        }
    }, [villages, sourceId]);

    const fetchSettlers = useCallback(async (villageId) => {
        if (!villageId) return;
        setLoadingSettlers(true);
        try {
            const { data } = await api.get('combat/village-troops/', { params: { village_id: villageId } });
            const settlers = data.filter((t) => t.is_settler).reduce((sum, t) => sum + t.count, 0);
            setSettlerCount(settlers);
        } catch (error) {
            console.error(error);
            setSettlerCount(0);
        } finally {
            setLoadingSettlers(false);
        }
    }, []);

    useEffect(() => { if (sourceId) fetchSettlers(sourceId); }, [sourceId, fetchSettlers]);

    const fetchMap = useCallback(async () => {
        setLoadingMap(true);
        try {
            const { data } = await api.get('game/world-map/', { params: { x: center.x, y: center.y, radius: GRID_RADIUS } });
            setMapVillages(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingMap(false);
        }
    }, [center]);

    useEffect(() => { if (!autoFind) fetchMap(); }, [autoFind, fetchMap]);

    const handleSourceChange = (id) => {
        setSourceId(id);
        const village = villages.find((v) => v.id === Number(id));
        if (village) setCenter({ x: village.x_coord, y: village.y_coord });
        setSelectedTarget(null);
    };

    const grid = [];
    for (let y = center.y + GRID_RADIUS; y >= center.y - GRID_RADIUS; y--) {
        for (let x = center.x - GRID_RADIUS; x <= center.x + GRID_RADIUS; x++) {
            const occupied = mapVillages.find((v) => v.x_coord === x && v.y_coord === y);
            grid.push({ x, y, occupied: !!occupied, name: occupied?.name });
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!sourceId) return;
        if (!autoFind && !selectedTarget) {
            setAlertMsg({ tone: 'error', text: 'لطفا یک نقطه خالی روی نقشه انتخاب کنید یا حالت جستجوی خودکار را فعال کنید.' });
            return;
        }
        setSubmitting(true);
        try {
            const payload = { source_village_id: sourceId, name: villageName || 'دهکده جدید' };
            if (!autoFind && selectedTarget) {
                payload.target_x = selectedTarget.x;
                payload.target_y = selectedTarget.y;
            }
            const { data } = await api.post('game/found-village/', payload);
            const villagesRes = await api.get('game/villages/');
            setVillages(villagesRes.data);
            setActiveVillageId(data.village.id);
            navigate('/village');
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تاسیس دهکده' });
        } finally {
            setSubmitting(false);
        }
    };

    const hasEnoughSettlers = settlerCount !== null && settlerCount >= SETTLERS_REQUIRED;

    return (
        <div
            className="w-full min-h-screen pt-24 pb-16 flex flex-col items-center"
            style={{
                // پیشنهاد عکس: همون world-map-bg.jpg برای هماهنگی با WorldMap
                backgroundImage: "linear-gradient(180deg, rgba(15,35,20,.55), rgba(15,35,20,.75)), url('/assets/maps/world-map-bg.jpg')",
                backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#12321c',
            }}
        >
            <ResourceBar />
            <Navbar />
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="تاسیس دهکده" />

            <div className="panel !bg-parchment-50/95 backdrop-blur max-w-2xl w-full mx-4 mt-2 p-6">
                <h2 className="text-xl font-extrabold text-ink-800 mb-2 text-center">🏕️ تاسیس دهکده جدید</h2>
                <p className="text-sm text-ink-500 text-center mb-6">
                    برای تاسیس یک دهکده جدید به {SETTLERS_REQUIRED} نیروی مهاجر در دهکده مبدا نیاز دارید.
                </p>

                {cultureInfo && (
                    <div className={`rounded-xl border p-3 mb-4 text-center text-sm font-bold ${
                        cultureInfo.can_found_next_village ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-gold-50 border-gold-300 text-gold-700'
                    }`}>
                        🏛️ امتیاز فرهنگی: {cultureInfo.culture_points} از {cultureInfo.next_village_required_cp} لازم برای دهکده‌ی شماره {cultureInfo.villages_count + 1}
                        {cultureInfo.can_found_next_village ? ' — آماده‌ی تاسیس!' : ` (تولید: ${cultureInfo.culture_points_per_hour}/ساعت)`}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="field-label">دهکده مبدا</label>
                        <select value={sourceId} onChange={(e) => handleSourceChange(e.target.value)} className="field">
                            {villages.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.is_capital ? '👑 ' : '🏘️ '}{v.name} ({v.x_coord}|{v.y_coord})
                                </option>
                            ))}
                        </select>
                        <p className={`text-xs font-bold mt-1 ${hasEnoughSettlers ? 'text-brand-700' : 'text-rose-600'}`}>
                            {loadingSettlers ? 'در حال بررسی...' : `مهاجران موجود: ${settlerCount ?? 0} از ${SETTLERS_REQUIRED} لازم`}
                        </p>
                    </div>

                    <div>
                        <label className="field-label">نام دهکده جدید</label>
                        <input type="text" value={villageName} onChange={(e) => setVillageName(e.target.value)} className="field" />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-ink-700 mb-3 cursor-pointer">
                            <input type="checkbox" checked={autoFind} onChange={(e) => { setAutoFind(e.target.checked); setSelectedTarget(null); }} />
                            جستجوی خودکار نزدیک‌ترین مکان آزاد روی نقشه
                        </label>

                        {!autoFind && (
                            <div className="bg-parchment-100 border border-parchment-300 rounded-xl p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <button type="button" onClick={() => setCenter((c) => ({ ...c, y: c.y + (GRID_RADIUS * 2 + 1) }))} className="btn-ghost text-xs !px-2 !py-1">⬆ شمال</button>
                                    <span className="text-xs font-bold text-ink-700">مرکز: ({center.x}|{center.y})</span>
                                    <button type="button" onClick={() => setCenter((c) => ({ ...c, y: c.y - (GRID_RADIUS * 2 + 1) }))} className="btn-ghost text-xs !px-2 !py-1">⬇ جنوب</button>
                                </div>

                                {loadingMap ? (
                                    <p className="text-center text-xs py-6 text-ink-500">در حال بارگذاری نقشه...</p>
                                ) : (
                                    <div className="grid grid-cols-5 gap-1">
                                        {grid.map((cell, i) => {
                                            const isSelected = selectedTarget?.x === cell.x && selectedTarget?.y === cell.y;
                                            return (
                                                <button type="button" key={i} disabled={cell.occupied}
                                                    onClick={() => setSelectedTarget({ x: cell.x, y: cell.y })}
                                                    className={`h-14 text-[10px] rounded-lg border-2 flex flex-col items-center justify-center transition ${
                                                        cell.occupied ? 'bg-rose-100 border-rose-300 text-rose-600 cursor-not-allowed' :
                                                        isSelected ? 'bg-brand-400 border-brand-600 text-white font-bold' :
                                                        'bg-white border-parchment-300 hover:border-gold-400 cursor-pointer'
                                                    }`}>
                                                    <span>{cell.x}|{cell.y}</span>
                                                    {cell.occupied && <span className="truncate w-full px-1">{cell.name}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex justify-between mt-2">
                                    <button type="button" onClick={() => setCenter((c) => ({ ...c, x: c.x - (GRID_RADIUS * 2 + 1) }))} className="btn-ghost text-xs !px-2 !py-1">⬅ غرب</button>
                                    <button type="button" onClick={() => setCenter((c) => ({ ...c, x: c.x + (GRID_RADIUS * 2 + 1) }))} className="btn-ghost text-xs !px-2 !py-1">شرق ➡</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button type="submit" disabled={submitting || !hasEnoughSettlers} className="btn-gold w-full py-3">
                        {submitting ? 'در حال تاسیس...' : '🏕️ تاسیس دهکده'}
                    </button>
                </form>
            </div>
            <Footer />
        </div>
    );
}