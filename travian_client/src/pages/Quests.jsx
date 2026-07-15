import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import { AlertModal } from '../components/Modal';

export default function Quests() {
    const [quests, setQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchQuests = useCallback(async () => {
        try {
            const { data } = await api.get('game/quests/');
            setQuests(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuests();
        const interval = setInterval(fetchQuests, 15000);
        return () => clearInterval(interval);
    }, [fetchQuests]);

    const handleClaim = async (questId) => {
        setClaiming(questId);
        try {
            const { data } = await api.post('game/quests/claim/', { quest_id: questId });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchQuests();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در دریافت پاداش' });
        } finally {
            setClaiming(null);
        }
    };

    const rewardText = (reward) => {
        const parts = [];
        if (reward.wood) parts.push(`🪵${reward.wood}`);
        if (reward.clay) parts.push(`🧱${reward.clay}`);
        if (reward.iron) parts.push(`⚒️${reward.iron}`);
        if (reward.crop) parts.push(`🌾${reward.crop}`);
        if (reward.gold) parts.push(`💰${reward.gold}`);
        return parts.join(' ');
    };

    if (loading) return <PageShell><LoadingState label="در حال بارگذاری کوئست‌ها..." /></PageShell>;

    const completedCount = quests.filter((q) => q.is_completed).length;

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="کوئست‌ها" />

            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">🎯 کوئست‌های آموزشی</span>
                    <span className="badge-gold">{completedCount} از {quests.length} تکمیل شده</span>
                </div>

                <div className="panel-body space-y-3">
                    {quests.map((q) => {
                        const progressPercent = Math.min(100, (q.current_value / q.condition_target) * 100);
                        const questImages = {
                            1: '/assets/quests/intro.jpg',
                            2: '/assets/quests/wood.jpg',
                            3: '/assets/quests/main.jpg',
                            4: '/assets/quests/farm.jpg',
                            5: '/assets/quests/barracks.jpg',
                            6: '/assets/quests/units.jpg',
                            7: '/assets/quests/report.jpg',
                            8: '/assets/quests/neighbour.jpg',
                            9: '/assets/quests/rank.jpg',
                            10: '/assets/quests/new_village.jpg',
                        };
                        const questImage = questImages[q.order];
                        return (
                            <div key={q.id} className={`rounded-xl p-4 border-2 transition ${
                                q.is_reward_claimed ? 'bg-parchment-100 border-parchment-300 opacity-60' :
                                q.is_completed ? 'bg-brand-50 border-brand-400' : 'bg-parchment-50 border-parchment-300'
                            }`}>
                                <div className="flex justify-between items-start mb-1 gap-2">
                                    <div className="flex items-start gap-3">
                                        {questImage && (
                                            <img src={questImage} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" onError={(e) => { e.target.style.display='none'; }} />
                                        )}
                                        <div>
                                            <p className="font-bold text-sm text-ink-800">
                                                {q.is_reward_claimed ? '✅' : q.is_completed ? '🎁' : '📋'} {q.order}. {q.title}
                                            </p>
                                            <p className="text-xs text-ink-500 mt-1">{q.description}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-gold-700 whitespace-nowrap">{rewardText(q.reward)}</span>
                                </div>

                                <div className="progress-track mt-2">
                                    <div className={`h-full rounded-full transition-all ${q.is_completed ? 'bg-brand-500' : 'bg-gold-500'}`} style={{ width: `${progressPercent}%` }} />
                                </div>
                                <p className="text-[10px] text-ink-400 mt-1">{q.current_value} / {q.condition_target}</p>

                                {q.is_completed && !q.is_reward_claimed && (
                                    <button onClick={() => handleClaim(q.id)} disabled={claiming === q.id} className="btn-primary w-full mt-2 text-xs !py-2">
                                        {claiming === q.id ? 'در حال دریافت...' : '🎁 دریافت پاداش'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </PageShell>
    );
}