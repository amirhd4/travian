import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (d > 0) return `${d}روز ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

const RESOURCE_IMAGES = {
    wood: '/assets/ui/res-1.gif',
    clay: '/assets/ui/res-2.gif',
    iron: '/assets/ui/res-3.gif',
    crop: '/assets/ui/res-4.gif',
};

const RESOURCE_NAMES = { wood: 'چوب', clay: 'خاک رس', iron: 'آهن', crop: 'گندم' };

export default function TownHall() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { resources } = useGameStore();

    const [data, setData] = useState({ town_hall_level: 0, active_celebration: null, options: [] });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/town-hall/celebrate/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در بارگذاری اطلاعات' });
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleCelebrate = async (type) => {
        setSubmitting(type);
        try {
            const response = await api.post('game/town-hall/celebrate/', {
                village_id: activeVillageId,
                celebration_type: type,
            });
            setAlertMsg({ tone: 'success', text: response.data.message });
            fetchData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در برگزاری جشن' });
        } finally {
            setSubmitting(null);
        }
    };

    const canAfford = (cost) => {
        return resources.wood >= cost.wood && resources.clay >= cost.clay &&
               resources.iron >= cost.iron && resources.crop >= cost.crop;
    };

    const activeRemaining = data.active_celebration
        ? Math.max(0, Math.floor((new Date(data.active_celebration.ends_at || Date.now()).getTime() - now) / 1000))
        : 0;

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری تالار شهر...</p></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="تالار شهر" />

            <WoodSign title="تالار شهر" icon="🏛️">
                <p className="text-center text-xs text-ink-600 mb-4 leading-relaxed">
                    سطح تالار شهر: <span className="font-bold text-ink-800">{data.town_hall_level}</span><br />
                    با برگزاری جشن، امتیاز فرهنگی کسب کنید. جشن کوچک از سطح ۱ و جشن بزرگ از سطح ۱۰ فعال می‌شود.
                </p>

                {/* Active Celebration */}
                {data.active_celebration && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-center">
                        <p className="text-sm font-bold text-amber-800">🎉 {data.active_celebration.celebration_type_display} در حال برگزاری</p>
                        <p className="text-lg font-mono font-bold text-amber-700 mt-1" dir="ltr">{formatDuration(data.active_celebration.remaining_seconds)}</p>
                        <p className="text-xs text-amber-600 mt-1">زمان باقیمانده</p>
                    </div>
                )}

                {/* Celebration Options */}
                <div className="space-y-3">
                    {data.options.map((opt) => {
                        const affordable = canAfford(opt.cost);
                        const isActive = !!data.active_celebration;
                        const isDisabled = !opt.is_unlocked || isActive || submitting === opt.type || !affordable;

                        return (
                            <div key={opt.type} className={`rounded-xl border p-4 ${
                                opt.is_unlocked ? 'bg-white/80 border-parchment-300' : 'bg-gray-50 border-gray-200 opacity-60'
                            }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="font-bold text-ink-800">{opt.label}</p>
                                        <p className="text-xs text-ink-500">
                                            {opt.culture_points} امتیاز فرهنگی · {opt.duration_hours} ساعت
                                        </p>
                                        {!opt.is_unlocked && (
                                            <p className="text-xs text-red-500 mt-1">🔒 نیاز به تالار شهر سطح {opt.min_town_hall_level}</p>
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-ink-500 mb-1">هزینه:</p>
                                        <div className="flex gap-2 text-[10px] font-bold">
                                            {Object.entries(opt.cost).map(([res, amount]) => (
                                                <span key={res} className={resources[res] >= amount ? 'text-ink-700' : 'text-red-500'}>
                                                    <img src={RESOURCE_IMAGES[res]} alt="" className="inline w-3 h-3 mr-0.5" style={{ verticalAlign: 'middle' }} />
                                                    {amount.toLocaleString()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCelebrate(opt.type)}
                                    disabled={isDisabled}
                                    className={`w-full py-2 rounded-lg font-bold text-sm transition ${
                                        isDisabled
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer'
                                    }`}
                                >
                                    {submitting === opt.type ? '...' :
                                     isActive ? 'جشن در حال برگزاری' :
                                     !opt.is_unlocked ? 'قفل' :
                                     !affordable ? 'منابع کافی نیست' :
                                     `🎉 برگزاری جشن`}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </WoodSign>
        </PageShell>
    );
}
