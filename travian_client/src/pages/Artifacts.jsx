import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

const EFFECT_ICONS = {
    SCOUT_POWER: { emoji: '🦅', image: '/assets/ui/artifact-type1.gif' },
    TRAINING_SPEED: { emoji: '⚔️', image: '/assets/ui/artifact-type2.gif' },
    MOVEMENT_SPEED: { emoji: '👢', image: '/assets/ui/artifact-type3.gif' },
};

export default function Artifacts() {
    const [artifacts, setArtifacts] = useState([]);
    const [serverStatus, setServerStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchArtifacts = useCallback(async () => {
        try {
            const { data } = await api.get('game/artifacts/');
            setArtifacts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchArtifacts();
        api.get('game/server-status/').then(({ data }) => setServerStatus(data)).catch(() => {});
        const interval = setInterval(fetchArtifacts, 30000);
        return () => clearInterval(interval);
    }, [fetchArtifacts]);

    if (loading) return <PageShell><LoadingState label="در حال بارگذاری کتیبه‌ها..." /></PageShell>;

    return (
        <PageShell maxWidth="max-w-4xl">
            <div className="panel">
                <div className="panel-header"><span className="panel-title">🏺 کتیبه‌ها</span></div>
                <div className="panel-body">
                    {serverStatus && !serverStatus.artifacts_unlocked && (
                        <p className="text-center text-sm font-bold text-gold-700 bg-gold-50 border border-gold-300 rounded-xl p-3 mb-5">
                            کتیبه‌ها هنوز آزاد نشده‌اند. زمان تخمینی آزادسازی:{' '}
                            {serverStatus.artifacts_release_at
                                ? new Date(serverStatus.artifacts_release_at).toLocaleString('fa-IR')
                                : 'نامشخص'}
                        </p>
                    )}

                    {artifacts.length === 0 ? (
                        <EmptyState icon="🏺" title="هنوز هیچ کتیبه‌ای روی نقشه ظاهر نشده است." />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {artifacts.map((a) => (
                                <div key={a.id} className={`rounded-xl border-2 p-4 ${a.is_mine ? 'border-gold-500 bg-gold-50' : 'border-parchment-300 bg-parchment-50'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {EFFECT_ICONS[a.effect_type]?.image ? (
                                            <img src={EFFECT_ICONS[a.effect_type].image} alt="" className="w-8 h-8" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='inline'; }} />
                                        ) : null}
                                        <span className="text-2xl hidden">{EFFECT_ICONS[a.effect_type]?.emoji || '🏺'}</span>
                                        <div>
                                            <p className="font-bold text-ink-800">{a.name}</p>
                                            <p className="text-xs text-ink-500">{a.effect_type_display} — ضریب ×{a.multiplier}</p>
                                        </div>
                                        {a.is_alliance_wide && <span className="badge-gold mr-auto">🏛️ اتحادی</span>}
                                    </div>

                                    {!a.is_claimed ? (
                                        <p className="text-xs text-rose-600 font-bold">
                                            هنوز تسخیر نشده — در دهکده {a.holder_village_name} ({a.holder_coords}) نگهبانی می‌شود.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-xs text-ink-600">
                                                مالک: <span className="font-bold">{a.holder_player}</span> — دهکده: {a.holder_village_name} ({a.holder_coords})
                                            </p>
                                            <p className={`text-xs font-bold mt-1 ${a.is_activated ? 'text-brand-700' : 'text-orange-600'}`}>
                                                {a.is_activated
                                                    ? '✅ فعال'
                                                    : `⏳ در حال فعال‌سازی${a.activates_at ? ' تا ' + new Date(a.activates_at).toLocaleString('fa-IR') : ''}`}
                                            </p>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}