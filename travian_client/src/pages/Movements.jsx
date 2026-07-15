import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from '../utils/formatter.js';

const typeIcon = (type) => ({
    ATTACK: { emoji: '🪓', image: '/assets/ui/attack-symbol.gif' },
    RAID: { emoji: '💰', image: '/assets/ui/gold-icon.gif' },
    REINFORCEMENT: { emoji: '🛡️', image: '/assets/ui/status-def.gif' },
    SCOUT: { emoji: '🔍', image: '/assets/ui/cropfinder.gif' },
    RETURN: { emoji: '↩️', image: '/assets/ui/car-icon.gif' },
}[type] || { emoji: '➡️', image: '/assets/ui/car-icon.gif' });

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
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchMovements(); }, [fetchMovements]);

    useEffect(() => {
        if (['COMBAT_RESULT', 'TROOPS_RETURNED', 'REINFORCEMENT_ARRIVED', 'SCOUT_RESULT'].includes(lastMessage?.type)) {
            fetchMovements();
        }
    }, [lastMessage, fetchMovements]);

    useEffect(() => {
        const interval = setInterval(() => {
            setData((prev) => ({
                outgoing: prev.outgoing.map((m) => ({ ...m, remaining_seconds: Math.max(0, m.remaining_seconds - 1) })),
                incoming: prev.incoming.map((m) => ({ ...m, remaining_seconds: Math.max(0, m.remaining_seconds - 1) })),
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(fetchMovements, 20000);
        return () => clearInterval(interval);
    }, [fetchMovements]);

    if (loading) return <PageShell><LoadingState label="در حال بارگذاری نقطه گردهمایی..." /></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <div className="panel">
                <div className="panel-header"><span className="panel-title">🚀 نیروهای اعزامی</span></div>
                <div className="panel-body">
                    {data.outgoing.length === 0 ? (
                        <EmptyState icon="🏕️" title="هیچ نیروی در حال حرکتی ندارید." />
                    ) : (
                        <div className="space-y-2">
                            {data.outgoing.map((m) => (
                                <div key={m.id} className="flex items-center justify-between border border-parchment-300 bg-parchment-50 rounded-xl p-3">
                                    <div className="flex items-center gap-3">
                                        <img src={typeIcon(m.movement_type).image} alt="" className="w-6 h-6" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='inline'; }} />
                                        <span className="text-xl hidden">{typeIcon(m.movement_type).emoji}</span>
                                        <div>
                                            <p className="font-bold text-sm text-ink-800">{m.movement_type_display}</p>
                                            <p className="text-xs text-ink-500">مقصد: {m.target_name} ({m.target_coords})</p>
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-brand-700" dir="ltr">{formatDuration(m.remaining_seconds)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="panel">
                <div className="panel-header"><span className="panel-title">📡 حرکات در حال ورود</span></div>
                <div className="panel-body">
                    {data.incoming.length === 0 ? (
                        <EmptyState icon="🕊️" title="در حال حاضر هیچ نیرویی به سمت دهکده شما در حرکت نیست." />
                    ) : (
                        <div className="space-y-2">
                            {data.incoming.map((m) => (
                                <div key={m.id} className={`flex items-center justify-between border rounded-xl p-3 ${m.is_hostile ? 'bg-rose-50 border-rose-300 animate-pulse' : 'bg-brand-50 border-brand-300'}`}>
                                    <div className="flex items-center gap-3">
                                        {m.is_hostile ? (
                                            <>
                                                <img src="/assets/ui/attack-symbol.gif" alt="" className="w-6 h-6" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='inline'; }} />
                                                <span className="text-xl hidden">⚔️</span>
                                            </>
                                        ) : (
                                            <>
                                                <img src={typeIcon(m.movement_type).image} alt="" className="w-6 h-6" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='inline'; }} />
                                                <span className="text-xl hidden">{typeIcon(m.movement_type).emoji}</span>
                                            </>
                                        )}
                                        <div>
                                            <p className={`font-bold text-sm ${m.is_hostile ? 'text-rose-700' : 'text-brand-800'}`}>{m.movement_type_display}</p>
                                            <p className="text-xs text-ink-500">
                                                {m.is_hostile ? `از مختصات ${m.source_coords}` : `از ${m.source_name} (${m.source_coords})`}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-mono font-bold ${m.is_hostile ? 'text-rose-700' : 'text-brand-700'}`} dir="ltr">
                                        {formatDuration(m.remaining_seconds)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}