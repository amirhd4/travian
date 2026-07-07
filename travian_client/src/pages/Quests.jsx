import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';

export default function Quests() {
    const [quests, setQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(null);

    const fetchQuests = useCallback(async () => {
        try {
            const { data } = await api.get('game/quests/');
            setQuests(data);
        } catch (error) {
            console.error('خطا در دریافت کوئست‌ها', error);
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
            alert(data.message);
            fetchQuests();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در دریافت پاداش');
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

    if (loading) {
        return (
            <div className="w-full min-h-screen bg-stone-200 pt-28 flex items-center justify-center">
                <p className="font-bold text-gray-500">در حال بارگذاری کوئست‌ها...</p>
            </div>
        );
    }

    const completedCount = quests.filter((q) => q.is_completed).length;

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-3xl w-full">
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-xl font-bold text-gray-800">🎯 کوئست‌های آموزشی</h2>
                        <span className="text-sm font-bold text-gray-500">{completedCount} از {quests.length} تکمیل شده</span>
                    </div>

                    <div className="space-y-3">
                        {quests.map((q) => {
                            const progressPercent = Math.min(100, (q.current_value / q.condition_target) * 100);
                            return (
                                <div
                                    key={q.id}
                                    className={`border rounded p-4 ${
                                        q.is_reward_claimed ? 'bg-gray-100 border-gray-300 opacity-70' :
                                        q.is_completed ? 'bg-green-50 border-green-400' : 'bg-stone-50 border-gray-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">
                                                {q.is_reward_claimed ? '✅' : q.is_completed ? '🎁' : '📋'} {q.order}. {q.title}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">{q.description}</p>
                                        </div>
                                        <span className="text-xs font-bold text-amber-700 whitespace-nowrap">
                                            {rewardText(q.reward)}
                                        </span>
                                    </div>

                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                                        <div
                                            className={`h-2 transition-all ${q.is_completed ? 'bg-green-500' : 'bg-amber-500'}`}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {q.current_value} / {q.condition_target}
                                    </p>

                                    {q.is_completed && !q.is_reward_claimed && (
                                        <button
                                            onClick={() => handleClaim(q.id)}
                                            disabled={claiming === q.id}
                                            className="mt-2 w-full bg-green-700 text-white text-xs font-bold py-2 rounded hover:bg-green-800 disabled:bg-gray-400"
                                        >
                                            {claiming === q.id ? 'در حال دریافت...' : '🎁 دریافت پاداش'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}