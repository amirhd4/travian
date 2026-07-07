import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import {formatDuration} from "../utils/formatter.js";


const typeIcon = (type) => ({
    ATTACK: '🪓',
    RAID: '💰',
    REINFORCEMENT: '🛡️',
    SCOUT: '🔍',
    RETURN: '↩️',
}[type] || '➡️');

export default function Movements() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();
    const [data, setData] = useState({ outgoing: [], incoming: [] });
    const [loading, setLoading] = useState(true);

    const fetchMovements = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const res = await api.get('combat/movements/', { params: { village_id: activeVillageId } });
            setData(res.data);
        } catch (error) {
            console.error('خطا در دریافت حرکات نظامی', error);
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => {
        setLoading(true);
        fetchMovements();
    }, [fetchMovements]);

    // با رسیدن هر رویداد نبرد/بازگشت از وب‌سوکت، لیست را دوباره بخوان
    useEffect(() => {
        if (['COMBAT_RESULT', 'TROOPS_RETURNED', 'REINFORCEMENT_ARRIVED', 'SCOUT_RESULT'].includes(lastMessage?.type)) {
            fetchMovements();
        }
    }, [lastMessage, fetchMovements]);

    // شمارش معکوس محلی هر ثانیه
    useEffect(() => {
        const interval = setInterval(() => {
            setData((prev) => ({
                outgoing: prev.outgoing.map((m) => ({ ...m, remaining_seconds: Math.max(0, m.remaining_seconds - 1) })),
                incoming: prev.incoming.map((m) => ({ ...m, remaining_seconds: Math.max(0, m.remaining_seconds - 1) })),
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // همگام‌سازی دوره‌ای با سرور هر ۲۰ ثانیه
    useEffect(() => {
        const interval = setInterval(fetchMovements, 20000);
        return () => clearInterval(interval);
    }, [fetchMovements]);

    if (loading) {
        return (
            <div className="w-full min-h-screen bg-stone-200 pt-28 flex items-center justify-center">
                <p className="font-bold text-gray-500">در حال بارگذاری نقطه گردهمایی...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-3xl w-full space-y-6">
                {/* نیروهای در راه (اعزامی خودمان) */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">🚀 نیروهای اعزامی</h2>
                    {data.outgoing.length === 0 ? (
                        <p className="text-sm text-gray-500">هیچ نیروی در حال حرکتی ندارید.</p>
                    ) : (
                        <div className="space-y-2">
                            {data.outgoing.map((m) => (
                                <div key={m.id} className="flex items-center justify-between border p-3 rounded bg-stone-50">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{typeIcon(m.movement_type)}</span>
                                        <div>
                                            <p className="font-bold text-sm">{m.movement_type_display}</p>
                                            <p className="text-xs text-gray-500">
                                                مقصد: {m.target_name} ({m.target_coords})
                                            </p>
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-blue-700" dir="ltr">
                                        {formatDuration(m.remaining_seconds)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* حرکات ورودی (حملات و پشتیبانی‌ها) */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">📡 حرکات در حال ورود</h2>
                    {data.incoming.length === 0 ? (
                        <p className="text-sm text-gray-500">در حال حاضر هیچ نیرویی به سمت دهکده شما در حرکت نیست.</p>
                    ) : (
                        <div className="space-y-2">
                            {data.incoming.map((m) => (
                                <div
                                    key={m.id}
                                    className={`flex items-center justify-between border p-3 rounded ${
                                        m.is_hostile ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-green-50 border-green-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{m.is_hostile ? '⚔️' : typeIcon(m.movement_type)}</span>
                                        <div>
                                            <p className={`font-bold text-sm ${m.is_hostile ? 'text-red-700' : 'text-green-800'}`}>
                                                {m.movement_type_display}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {m.is_hostile
                                                    ? `از مختصات ${m.source_coords}`
                                                    : `از ${m.source_name} (${m.source_coords})`}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`font-mono font-bold ${m.is_hostile ? 'text-red-700' : 'text-green-700'}`}
                                        dir="ltr"
                                    >
                                        {formatDuration(m.remaining_seconds)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}