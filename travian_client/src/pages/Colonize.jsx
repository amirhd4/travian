import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
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

    // پیش‌فرض: پایتخت به‌عنوان دهکده مبدا
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
            console.error('خطا در دریافت نیروهای مهاجر', error);
            setSettlerCount(0);
        } finally {
            setLoadingSettlers(false);
        }
    }, []);

    useEffect(() => {
        if (sourceId) fetchSettlers(sourceId);
    }, [sourceId, fetchSettlers]);

    const fetchMap = useCallback(async () => {
        setLoadingMap(true);
        try {
            const { data } = await api.get('game/world-map/', {
                params: { x: center.x, y: center.y, radius: GRID_RADIUS },
            });
            setMapVillages(data);
        } catch (error) {
            console.error('خطا در دریافت نقشه', error);
        } finally {
            setLoadingMap(false);
        }
    }, [center]);

    useEffect(() => {
        if (!autoFind) fetchMap();
    }, [autoFind, fetchMap]);

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
            alert('لطفا یک نقطه خالی روی نقشه انتخاب کنید یا حالت جستجوی خودکار را فعال کنید.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                source_village_id: sourceId,
                name: villageName || 'دهکده جدید',
            };
            if (!autoFind && selectedTarget) {
                payload.target_x = selectedTarget.x;
                payload.target_y = selectedTarget.y;
            }
            const { data } = await api.post('game/found-village/', payload);
            alert(data.message);

            // به‌روزرسانی لیست دهکده‌ها و انتخاب دهکده تازه‌تاسیس‌شده به‌عنوان فعال
            const villagesRes = await api.get('game/villages/');
            setVillages(villagesRes.data);
            setActiveVillageId(data.village.id);
            navigate('/village');
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در تاسیس دهکده');
        } finally {
            setSubmitting(false);
        }
    };

    const hasEnoughSettlers = settlerCount !== null && settlerCount >= SETTLERS_REQUIRED;

    return (
        <div className="w-full min-h-screen bg-emerald-900 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-amber-100 p-6 rounded-xl shadow-2xl border-4 border-amber-800 max-w-2xl w-full">
                <h2 className="text-2xl font-bold text-amber-900 mb-2 text-center">🏕️ تاسیس دهکده جدید</h2>
                <p className="text-sm text-amber-800 text-center mb-6">
                    برای تاسیس یک دهکده جدید به {SETTLERS_REQUIRED} نیروی مهاجر در دهکده مبدا نیاز دارید.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* انتخاب دهکده مبدا */}
                    <div>
                        <label className="block text-sm font-bold text-amber-900 mb-1">دهکده مبدا:</label>
                        <select
                            value={sourceId}
                            onChange={(e) => handleSourceChange(e.target.value)}
                            className="w-full p-2 border border-amber-400 rounded bg-white"
                        >
                            {villages.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.is_capital ? '👑 ' : '🏘️ '}{v.name} ({v.x_coord}|{v.y_coord})
                                </option>
                            ))}
                        </select>

                        <p className={`text-xs font-bold mt-1 ${hasEnoughSettlers ? 'text-green-700' : 'text-red-700'}`}>
                            {loadingSettlers
                                ? 'در حال بررسی تعداد مهاجران...'
                                : `مهاجران موجود: ${settlerCount ?? 0} از ${SETTLERS_REQUIRED} لازم`}
                        </p>
                    </div>

                    {/* نام دهکده جدید */}
                    <div>
                        <label className="block text-sm font-bold text-amber-900 mb-1">نام دهکده جدید:</label>
                        <input
                            type="text"
                            value={villageName}
                            onChange={(e) => setVillageName(e.target.value)}
                            className="w-full p-2 border border-amber-400 rounded bg-white"
                        />
                    </div>

                    {/* انتخاب مکان */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-amber-900 mb-3">
                            <input
                                type="checkbox"
                                checked={autoFind}
                                onChange={(e) => { setAutoFind(e.target.checked); setSelectedTarget(null); }}
                            />
                            جستجوی خودکار نزدیک‌ترین مکان آزاد روی نقشه
                        </label>

                        {!autoFind && (
                            <div className="bg-white/60 border border-amber-300 rounded p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setCenter((c) => ({ ...c, y: c.y + (GRID_RADIUS * 2 + 1) }))}
                                        className="text-xs bg-amber-700 text-white px-2 py-1 rounded"
                                    >⬆ شمال</button>
                                    <span className="text-xs font-bold text-amber-900">مرکز: ({center.x}|{center.y})</span>
                                    <button
                                        type="button"
                                        onClick={() => setCenter((c) => ({ ...c, y: c.y - (GRID_RADIUS * 2 + 1) }))}
                                        className="text-xs bg-amber-700 text-white px-2 py-1 rounded"
                                    >⬇ جنوب</button>
                                </div>

                                {loadingMap ? (
                                    <p className="text-center text-xs py-6">در حال بارگذاری نقشه...</p>
                                ) : (
                                    <div className="grid grid-cols-5 gap-1">
                                        {grid.map((cell, i) => {
                                            const isSelected = selectedTarget?.x === cell.x && selectedTarget?.y === cell.y;
                                            return (
                                                <button
                                                    type="button"
                                                    key={i}
                                                    disabled={cell.occupied}
                                                    onClick={() => setSelectedTarget({ x: cell.x, y: cell.y })}
                                                    className={`h-14 text-[10px] rounded border flex flex-col items-center justify-center transition
                                                        ${cell.occupied ? 'bg-red-200 border-red-400 text-red-700 cursor-not-allowed' :
                                                          isSelected ? 'bg-green-400 border-green-700 text-white font-bold' :
                                                          'bg-yellow-50 border-yellow-300 hover:bg-yellow-200 cursor-pointer'}`}
                                                >
                                                    <span>{cell.x}|{cell.y}</span>
                                                    {cell.occupied && <span className="truncate w-full px-1">{cell.name}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex justify-between mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setCenter((c) => ({ ...c, x: c.x - (GRID_RADIUS * 2 + 1) }))}
                                        className="text-xs bg-amber-700 text-white px-2 py-1 rounded"
                                    >⬅ غرب</button>
                                    <button
                                        type="button"
                                        onClick={() => setCenter((c) => ({ ...c, x: c.x + (GRID_RADIUS * 2 + 1) }))}
                                        className="text-xs bg-amber-700 text-white px-2 py-1 rounded"
                                    >شرق ➡</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !hasEnoughSettlers}
                        className="w-full bg-amber-800 text-white p-3 rounded font-bold hover:bg-amber-900 transition disabled:bg-gray-400"
                    >
                        {submitting ? 'در حال تاسیس...' : '🏕️ تاسیس دهکده'}
                    </button>
                </form>
            </div>
        </div>
    );
}