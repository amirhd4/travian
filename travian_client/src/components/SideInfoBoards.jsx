import { useState, useEffect, useCallback } from 'react';
import useGameStore from '../store/useGameStore';
import WoodSign from './WoodSign';
import api from '../api/axiosConfig';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

// Format seconds to human-readable countdown
function formatCountdown(seconds) {
    if (!seconds || seconds <= 0) return null;
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// Format production rate
function formatProd(rate) {
    const r = Math.round(rate);
    return r >= 0 ? `+${r}` : `${r}`;
}

// Estimate XP needed for next level (Travian formula: level^2 * 100 roughly)
function xpForLevel(level) {
    return Math.max(100, Math.floor(level * level * 100));
}

export default function SideInfoBoards() {
    const user = useGameStore((state) => state.user);
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const activeVillage = villages.find((v) => v.id === activeVillageId);
    const production = useGameStore((state) => state.production);
    const { lastMessage } = useGameWebSocket();

    const [buildingQueue, setBuildingQueue] = useState([]);
    const [trainingQueue, setTrainingQueue] = useState([]);
    const [incomingAttacks, setIncomingAttacks] = useState([]);
    const [hero, setHero] = useState(null);
    const [serverStatus, setServerStatus] = useState(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // Fetch buildings that are upgrading
    const fetchBuildingQueue = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get(`game/villages/${activeVillageId}/buildings/`);
            const buildings = data.buildings || [];
            setBuildingQueue(buildings.filter(b => b.is_upgrading && b.upgrade_end_time));
        } catch { /* silent */ }
    }, [activeVillageId]);

    // Training queue — field: finishes_at, count, troop_name
    const fetchTrainingQueue = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('combat/barracks/queue/', { params: { village_id: activeVillageId } });
            setTrainingQueue(Array.isArray(data) ? data : []);
        } catch { /* silent */ }
    }, [activeVillageId]);

    // Incoming movements — field: incoming[], each has is_hostile, arrival_time, source_name, movement_type
    const fetchMovements = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('combat/movements/', { params: { village_id: activeVillageId } });
            const incoming = data?.incoming || [];
            setIncomingAttacks(incoming.filter(m => m.is_hostile));
        } catch { /* silent */ }
    }, [activeVillageId]);

    // Hero — fields: level, experience, health, fighting_strength_points
    const fetchHero = useCallback(async () => {
        try {
            const { data } = await api.get('combat/hero/');
            setHero(data);
        } catch { /* silent */ }
    }, []);

    // Server status — fields: artifacts_unlocked, artifacts_release_at, ww_unlocked, ww_plans_release_at, start_date, duration_days
    const fetchServerStatus = useCallback(async () => {
        try {
            const { data } = await api.get('game/server-status/');

console.log(data);

setServerStatus(data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchBuildingQueue();
        fetchTrainingQueue();
        fetchMovements();
        fetchHero();
        fetchServerStatus();

        const interval = setInterval(() => {
            fetchBuildingQueue();
            fetchTrainingQueue();
            fetchMovements();
        }, 15000);

        return () => clearInterval(interval);
    }, [fetchBuildingQueue, fetchTrainingQueue, fetchMovements, fetchHero, fetchServerStatus]);

    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'BUILDING_COMPLETE' || lastMessage.type === 'BUILDING_UPGRADE') fetchBuildingQueue();
        if (lastMessage.type === 'TROOP_TRAINED' || lastMessage.type === 'TRAINING_COMPLETE') fetchTrainingQueue();
        if (lastMessage.type === 'INCOMING_ATTACK' || lastMessage.type === 'COMBAT_RESULT') fetchMovements();
    }, [lastMessage, fetchBuildingQueue, fetchTrainingQueue, fetchMovements]);

    if (!user) return null;

    // Hero XP calculation — backend has `experience` and `level`, no xp_for_next_level
    const heroLevel = hero?.level || 1;
    const heroXpCurrent = hero?.experience || 0;
    const heroXpForNext = xpForLevel(heroLevel);
    const heroXpPercent = heroXpForNext > 0 ? Math.min(100, (heroXpCurrent / heroXpForNext) * 100) : 0;

    // Compute server end time from start_date + duration_days
    const serverEndDate = serverStatus?.start_date && serverStatus?.duration_days
        ? new Date(new Date(serverStatus.start_date).getTime() + serverStatus.duration_days * 86400000)
        : null;

    return (
        <>
            {/* ===== LEFT SIDEBAR: Player Info ===== */}
            <div className="hidden xl:block fixed top-32 left-3 w-48 z-[101] space-y-3">
                <WoodSign title={`👤 ${user.username || ''}`}>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1">
                                <span className="w-3.5 h-3.5 rounded-full bg-gold-500/20 border border-gold-500/50 flex items-center justify-center text-[8px]">💰</span>
                                <span className="font-bold text-gold-600">{(user.gold_coins ?? 0).toLocaleString()}</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3.5 h-3.5 rounded-full bg-gray-200 border border-gray-400 flex items-center justify-center text-[8px]">🪙</span>
                                <span className="font-bold text-gray-600">{(user.silver_coins ?? 0).toLocaleString()}</span>
                            </span>
                        </div>

                        {user.has_plus && (
                            <div className="text-[10px] text-center bg-gold-50 border border-gold-300 rounded-lg px-2 py-1 font-bold text-gold-700">
                                👑 Plus Active
                            </div>
                        )}

                        <p className="text-[11px] font-bold text-wood mb-1 text-center border-t border-parchment-200 pt-2">🏘️ دهکده‌ها:</p>
                        <ul className="text-[11px] text-wood-dark space-y-0.5 max-h-32 overflow-y-auto">
                            {villages.map((v) => (
                                <li key={v.id} className={`flex items-center gap-1 ${v.id === activeVillageId ? 'font-bold text-amber-700' : ''}`}>
                                    <span className="text-[9px]">{v.is_capital ? '👑' : '🏘️'}</span>
                                    <span className="truncate">{v.name}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </WoodSign>

                {hero && (
                    <WoodSign title="🦸 قهرمان">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-wood-dark">سطح:</span>
                                <span className="font-bold text-ink-800">{hero.level ?? 1}</span>
                            </div>
                            <div>
                                <div className="flex items-center justify-between text-[10px] text-wood-dark mb-0.5">
                                    <span>تجربه</span>
                                    <span>{Math.floor(heroXpCurrent)}/{heroXpForNext}</span>
                                </div>
                                <div className="w-full h-1.5 bg-ink-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all" style={{ width: `${heroXpPercent}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between text-[10px] text-wood-dark mb-0.5">
                                    <span>❤️ سلامتی</span>
                                    <span>{hero.health ?? 100}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-ink-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all" style={{ width: `${hero.health ?? 100}%` }} />
                                </div>
                            </div>
                            {hero.fighting_strength_points != null && (
                                <div className="text-[10px] text-wood-dark flex justify-between">
                                    <span>⚔️ قدرت رزمی: {hero.fighting_strength_points}</span>
                                </div>
                            )}
                            {hero.is_on_adventure && (
                                <div className="text-[10px] text-center bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-blue-700">
                                    🗺️ ماجراجویی ({formatCountdown(hero.adventure_remaining_seconds)} باقی‌مانده)
                                </div>
                            )}
                        </div>
                    </WoodSign>
                )}
            </div>

            {/* ===== RIGHT SIDEBAR: Village Info ===== */}
            {activeVillage && (
                <div className="hidden xl:block fixed top-32 right-3 w-48 z-[101] space-y-3">
                    <WoodSign title={activeVillage.name}>
                        <div className="space-y-1.5">
                            <p className="text-[11px] text-center text-wood-dark" dir="ltr">
                                📍 ({activeVillage.x_coord}|{activeVillage.y_coord})
                            </p>
                            <div className="text-center">
                                <span className="text-[10px] text-wood-dark">وفاداری:</span>
                                <span className={`text-[11px] font-bold ml-1 ${(activeVillage.loyalty ?? 100) < 50 ? 'text-rose-600' : 'text-green-700'}`}>
                                    {activeVillage.loyalty ?? 100}%
                                </span>
                            </div>
                            {activeVillage.population != null && (
                                <p className="text-[11px] text-center text-wood-dark">
                                    👥 جمعیت: {Math.floor(activeVillage.population).toLocaleString()}
                                </p>
                            )}
                        </div>
                    </WoodSign>

                    <WoodSign title="📊 تولید/ساعت">
                        <div className="space-y-1">
                            {[
                                { key: 'wood', img: '/assets/ui/res-1.gif', label: 'چوب' },
                                { key: 'clay', img: '/assets/ui/res-2.gif', label: 'خشت' },
                                { key: 'iron', img: '/assets/ui/res-3.gif', label: 'آهن' },
                                { key: 'crop', img: '/assets/ui/res-4.gif', label: 'گندم' },
                            ].map(({ key, img, label }) => (
                                <div key={key} className="flex items-center justify-between text-[11px]">
                                    <span className="flex items-center gap-1">
                                        <img src={img} alt="" className="w-3 h-3" onError={(e) => { e.target.style.display='none'; }} />
                                        <span className="text-wood-dark">{label}</span>
                                    </span>
                                    <span className={`font-bold ${(production[key] || 0) < 0 ? 'text-rose-600' : 'text-green-700'}`}>
                                        {formatProd(production[key] || 0)}/س
                                    </span>
                                </div>
                            ))}
                        </div>
                    </WoodSign>

                    {buildingQueue.length > 0 && (
                        <WoodSign title="🔨 در حال ساخت">
                            <div className="space-y-1.5">
                                {buildingQueue.slice(0, 3).map((b, i) => {
                                    const endTime = new Date(b.upgrade_end_time).getTime();
                                    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
                                    return (
                                        <div key={i} className="text-[11px]">
                                            <div className="flex items-center justify-between">
                                                <span className="text-wood-dark truncate">{b.name}</span>
                                                <span className="text-[10px] text-amber-600 font-bold">Lv.{b.level + 1}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <div className="flex-1 h-1 bg-ink-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-amber-500 rounded-full animate-pulse" />
                                                </div>
                                                <span className="text-[9px] font-mono text-amber-700">{formatCountdown(remaining)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </WoodSign>
                    )}

                    {trainingQueue.length > 0 && (
                        <WoodSign title="⚔️ در حال آموزش">
                            <div className="space-y-1">
                                {trainingQueue.slice(0, 3).map((t, i) => {
                                    // Field name: finishes_at, count, troop_name
                                    const remaining = t.remaining_seconds ?? (
                                        t.finishes_at ? Math.max(0, Math.floor((new Date(t.finishes_at).getTime() - now) / 1000)) : null
                                    );
                                    return (
                                        <div key={i} className="text-[11px] flex items-center justify-between">
                                            <span className="text-wood-dark truncate">{t.troop_name} x{t.count}</span>
                                            {remaining != null && (
                                                <span className="text-[9px] font-mono text-blue-700">{formatCountdown(remaining)}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </WoodSign>
                    )}

                    {incomingAttacks.length > 0 && (
                        <WoodSign title="🚨 حمله در راه!">
                            <div className="space-y-1">
                                {incomingAttacks.slice(0, 3).map((a, i) => {
                                    // Field name: arrival_time, movement_type, remaining_seconds, source_name
                                    const remaining = a.remaining_seconds ?? (
                                        a.arrival_time ? Math.max(0, Math.floor((new Date(a.arrival_time).getTime() - now) / 1000)) : null
                                    );
                                    const typeLabel = a.movement_type === 'SCOUT' ? '🔍 جاسوسی' : a.movement_type === 'RAID' ? '🏴 غارت' : '⚔️ حمله';
                                    return (
                                        <div key={i} className="text-[11px] bg-rose-50 border border-rose-200 rounded-lg p-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-rose-700">{typeLabel}</span>
                                                {remaining != null && (
                                                    <span className="text-[9px] font-mono font-bold text-rose-600 animate-pulse">
                                                        {formatCountdown(remaining)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </WoodSign>
                    )}

                    {serverStatus && (
                        <WoodSign title="⏳ زمان‌بندی سرور">
                            <div className="space-y-1.5">
                                {/* Artifacts — field: artifacts_unlocked, artifacts_release_at */}
                                <TimerRow
                                    label="🏺 شواهد"
                                    unlockTime={serverStatus.artifacts_release_at}
                                    now={now}
                                    released={serverStatus.artifacts_unlocked}
                                />
                                {/* WW Plans — field: ww_unlocked, ww_plans_release_at */}
                                <TimerRow
                                    label="📜 نقشه ساخت"
                                    unlockTime={serverStatus.ww_plans_release_at}
                                    now={now}
                                    released={serverStatus.ww_unlocked}
                                />
                                {/* Server end — computed from start_date + duration_days */}
                                {serverEndDate && (
                                    <TimerRow
                                        label="🏁 پایان سرور"
                                        unlockTime={serverEndDate.toISOString()}
                                        now={now}
                                        released={serverStatus.is_finished}
                                    />
                                )}
                                {/* Winner */}
                                {serverStatus.is_finished && serverStatus.winner_username && (
                                    <div className="text-[11px] bg-gold-50 border border-gold-300 rounded-lg p-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-wood-dark">🏆 برنده:</span>
                                            <span className="font-bold text-gold-700">{serverStatus.winner_username}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </WoodSign>
                    )}
                </div>
            )}
        </>
    );
}

function TimerRow({ label, unlockTime, now, released }) {
    if (released) {
        return (
            <div className="text-[11px] flex items-center justify-between">
                <span className="text-wood-dark">{label}</span>
                <span className="text-[10px] font-bold text-green-600">✅ فعال شد</span>
            </div>
        );
    }

    if (!unlockTime) return null;

    const unlockMs = new Date(unlockTime).getTime();
    const remaining = Math.max(0, Math.floor((unlockMs - now) / 1000));

    if (remaining <= 0) {
        return (
            <div className="text-[11px] flex items-center justify-between">
                <span className="text-wood-dark">{label}</span>
                <span className="text-[10px] font-bold text-green-600">✅ فعال شد</span>
            </div>
        );
    }

    return (
        <div className="text-[11px] flex items-center justify-between">
            <span className="text-wood-dark">{label}</span>
            <span className="text-[9px] font-mono font-bold text-amber-700">{formatCountdown(remaining)}</span>
        </div>
    );
}
