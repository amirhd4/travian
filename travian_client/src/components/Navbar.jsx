import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGameStore from "../store/useGameStore.js";
import api from "../api/axiosConfig.js";

const NAV_ITEMS = [
    { path: '/village', icon: '🏛️', label: 'دهکده' },
    { path: '/world-map', icon: '🗺️', label: 'نقشه' },
    { path: '/colonize', icon: '🏕️', label: 'تاسیس' },
    { path: '/movements', icon: '📡', label: 'گردهمایی' },
    { path: '/farm-list', icon: '🌾', label: 'مزرعه' },
    { path: '/reports', icon: '📜', label: 'گزارشات' },
    { path: '/statistics', icon: '📊', label: 'آمار' },
    { path: '/marketplace', icon: '⚖️', label: 'بازارچه' },
    { path: '/world-wonder', icon: '🏆', label: 'شگفتی جهان' },
    { path: '/messages', icon: '✉️', label: 'پیام‌ها' },
    { path: '/barracks', icon: '⚔️', label: 'پادگان' },
    { path: '/embassy', icon: '🏰', label: 'سفارتخانه' },
    { path: '/hero', icon: '🦸', label: 'قهرمان' },
    { path: '/gold-shop', icon: '💰', label: 'فروشگاه طلا' },
    { path: '/plus', icon: '👑', label: 'پلاس' },
];

export default function Navbar() {
    const navigate = useNavigate();
    const clearUser = useGameStore((state) => state.clearUser);
    const location = useLocation();

    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const setActiveVillageId = useGameStore((state) => state.setActiveVillageId);

    const [pendingQuests, setPendingQuests] = useState(0);

    useEffect(() => {
        const fetchQuestCount = async () => {
            try {
                const { data } = await api.get('game/quests/');
                setPendingQuests(data.filter((q) => q.is_completed && !q.is_reward_claimed).length);
            } catch (error) {
                // بی‌صدا نادیده گرفته می‌شود
            }
        };
        fetchQuestCount();
        const interval = setInterval(fetchQuestCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        try { await api.post('auth/logout/'); } catch (error) { /* ignore */ }
        finally { clearUser(); navigate('/login'); }
    };

    return (
        <div className="fixed top-16 left-0 w-full bg-gradient-to-b from-parchment-dark to-[#d9c9a0] border-b-2 border-wood-light shadow-lg z-[100] px-2 py-2">
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-6xl mx-auto">
                {villages.length > 0 && (
                    <select
                        value={activeVillageId || ''}
                        onChange={(e) => setActiveVillageId(Number(e.target.value))}
                        className="bg-white text-wood-dark font-bold text-xs rounded-full px-3 py-2 border-2 border-wood-light focus:outline-none cursor-pointer ml-2"
                        title="دهکده فعال"
                    >
                        {villages.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.is_capital ? '👑 ' : '🏘️ '}{v.name} ({v.x_coord}|{v.y_coord})
                            </option>
                        ))}
                    </select>
                )}

                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`wood-icon-btn w-12 h-12 ${location.pathname === item.path ? 'active' : ''}`}
                        title={item.label}
                    >
                        <span className="text-lg">{item.icon}</span>
                    </button>
                ))}

                <button
                    onClick={() => navigate('/quests')}
                    className={`wood-icon-btn w-12 h-12 ${location.pathname === '/quests' ? 'active' : ''}`}
                    title="کوئست‌ها"
                >
                    <span className="text-lg">🎯</span>
                    {pendingQuests > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-bounce">
                            {pendingQuests}
                        </span>
                    )}
                </button>

                <button
                    onClick={handleLogout}
                    className="wood-icon-btn w-12 h-12 border-red-700 bg-red-50 text-red-700 ml-2"
                    title="خروج"
                >
                    <span className="text-lg">🚪</span>
                </button>
            </div>
        </div>
    );
}