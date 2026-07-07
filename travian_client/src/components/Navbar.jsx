import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGameStore from "../store/useGameStore.js";
import api from "../api/axiosConfig.js";

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
                // بی‌صدا نادیده گرفته می‌شود؛ نوار ناوبری نباید به‌خاطر این قابلیت جانبی خراب شود
            }
        };
        fetchQuestCount();
        const interval = setInterval(fetchQuestCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        try {
            await api.post('auth/logout/');
        } catch (error) {
            // حتی اگه درخواست به سرور fail بشه، کاربر رو محلی خارج می‌کنیم
        } finally {
            clearUser();
            navigate('/login');
        }
    };

    const getBtnClass = (path) => {
        const base = "font-bold px-3 py-1.5 rounded transition text-sm md:text-base ";
        return location.pathname === path
            ? base + "text-yellow-400 bg-gray-700 shadow-inner"
            : base + "hover:text-yellow-400 hover:bg-gray-700/50";
    };

    return (
        <div className="fixed top-12 left-0 w-full bg-gray-800 text-white p-3 flex flex-wrap justify-center items-center gap-4 z-[100] border-b-2 border-gray-900 shadow-xl">
            {villages.length > 0 && (
                <select
                    value={activeVillageId || ''}
                    onChange={(e) => setActiveVillageId(Number(e.target.value))}
                    className="bg-gray-700 text-yellow-300 font-bold text-sm rounded px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-yellow-400 cursor-pointer"
                    title="دهکده فعال"
                >
                    {villages.map((v) => (
                        <option key={v.id} value={v.id}>
                            {v.is_capital ? '👑 ' : '🏘️ '}{v.name} ({v.x_coord}|{v.y_coord})
                        </option>
                    ))}
                </select>
            )}

            <button onClick={() => navigate('/village')} className={getBtnClass('/village')}>🏛️ دهکده من</button>
            <button onClick={() => navigate('/world-map')} className={getBtnClass('/world-map')}>🗺️ نقشه جهان</button>
            <button onClick={() => navigate('/colonize')} className={getBtnClass('/colonize')}>🏕️ تاسیس دهکده</button>
            <button onClick={() => navigate('/movements')} className={getBtnClass('/movements')}>📡 نقطه گردهمایی</button>
            <button onClick={() => navigate('/farm-list')} className={getBtnClass('/farm-list')}>🌾 لیست مزرعه</button>
            <button onClick={() => navigate('/reports')} className={getBtnClass('/reports')}>📜 گزارشات</button>
            <button onClick={() => navigate('/statistics')} className={getBtnClass('/statistics')}>📊 آمار</button>
            <button onClick={() => navigate('/marketplace')} className={getBtnClass('/marketplace')}>⚖️ بازارچه</button>
            <button onClick={() => navigate('/world-wonder')} className={getBtnClass('/world-wonder')}>🏛️ شگفتی جهان</button>
            <button onClick={() => navigate('/messages')} className={getBtnClass('/messages')}>✉️ پیام‌ها</button>
            <button onClick={() => navigate('/barracks')} className={getBtnClass('/barracks')}>⚔️ پادگان</button>
            <button onClick={() => navigate('/embassy')} className={getBtnClass('/embassy')}>🏛️ سفارتخانه</button>
            <button onClick={() => navigate('/hero')} className={getBtnClass('/hero')}>🦸 قهرمان</button>

            <button onClick={() => navigate('/quests')} className={`relative ${getBtnClass('/quests')}`}>
                🎯 کوئست‌ها
                {pendingQuests > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                        {pendingQuests}
                    </span>
                )}
            </button>

            <button onClick={handleLogout} className="text-red-400 hover:text-red-500 hover:bg-red-900/30 font-bold px-3 py-1.5 rounded transition absolute left-4">
                🚪 خروج
            </button>
        </div>
    );
}