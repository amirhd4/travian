import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGameStore from "../store/useGameStore.js";
import api from "../api/axiosConfig.js";
import SideInfoBoards from "./SideInfoBoards.jsx";
import { useState as useRenameState } from 'react'; // اگر useState از قبل ایمپورت شده این خط لازم نیست، فقط مطمئن شو useState ایمپورت شده

const NAV_ITEMS = [
    { path: '/village', icon: '🌾', label: 'منابع' },
    { path: '/dorf2', icon: '🏛️', label: 'مرکز دهکده' },
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
    { path: '/blacksmith', icon: '🔨', label: 'آهنگری' },
];

export default function Navbar() {
    const navigate = useNavigate();
    const clearUser = useGameStore((state) => state.clearUser);
    const location = useLocation();

    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const setActiveVillageId = useGameStore((state) => state.setActiveVillageId);

    const [pendingQuests, setPendingQuests] = useState(0);

    const [unreadReports, setUnreadReports] = useState(0);

    useEffect(() => {
        const fetchUnreadReports = async () => {
            try {
                const { data } = await api.get('combat/reports/unread-count/');
                setUnreadReports(data.unread_count);
            } catch { /* silent */ }
        };
        fetchUnreadReports();
        const interval = setInterval(fetchUnreadReports, 30000);
        return () => clearInterval(interval);
    }, []);

    const setVillages = useGameStore((state) => state.setVillages);
    const [renaming, setRenaming] = useState(false);

    const handleRename = async () => {
        const activeVillage = villages.find((v) => v.id === activeVillageId);
        if (!activeVillage) return;
        const newName = window.prompt('نام جدید دهکده را وارد کنید:', activeVillage.name);
        if (!newName || !newName.trim()) return;
        setRenaming(true);
        try {
            await api.post('game/villages/rename/', { village_id: activeVillageId, name: newName.trim() });
            const { data } = await api.get('game/villages/');
            setVillages(data);
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در تغییر نام دهکده');
        } finally {
            setRenaming(false);
        }
    };

    useEffect(() => {
        const fetchQuestCount = async () => {
            try {
                const { data } = await api.get('game/quests/');
                setPendingQuests(data.filter((q) => q.is_completed && !q.is_reward_claimed).length);
            } catch { /* silent */ }
        };
        fetchQuestCount();
        const interval = setInterval(fetchQuestCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        try { await api.post('auth/logout/'); } catch { /* ignore */ }
        finally { clearUser(); navigate('/login'); }
    };

    return (
        <>
            <SideInfoBoards />
            <div className="w-full shrink-0 bg-ink-900/95 backdrop-blur border-b border-gold-600/40 shadow-card">
                <div className="max-w-7xl mx-auto flex items-center gap-2 px-3 py-2 overflow-x-auto">
                    {villages.length > 0 && (
                        <select
                            value={activeVillageId || ''}
                            onChange={(e) => setActiveVillageId(Number(e.target.value))}
                            className="bg-white text-ink-800 font-bold text-xs rounded-full px-3 py-2
                                       border border-gold-500/60 focus:outline-none cursor-pointer flex-shrink-0"
                            title="دهکده فعال"
                        >
                            {villages.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.is_capital ? '👑 ' : '🏘️ '}{v.name} ({v.x_coord}|{v.y_coord})
                                </option>
                            ))}
                        </select>
                    )}

                    {villages.length > 0 && (
                        <button
                            onClick={handleRename}
                            disabled={renaming}
                            title="تغییر نام دهکده فعال"
                            className="btn-icon flex-shrink-0 !w-9 !h-9 !bg-ink-800/60 !border-ink-700 text-parchment-100"
                        >
                            <span className="text-sm">✏️</span>
                        </button>
                    )}

                    <div className="w-px h-8 bg-ink-700 flex-shrink-0 mx-1" />

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                title={item.label}
                                className={`btn-icon flex-shrink-0 relative ${location.pathname === item.path ? 'active' : '!bg-ink-800/60 !border-ink-700 text-parchment-100'}`}
                            >
                                <span className="text-base">{item.icon}</span>
                                {item.path === '/reports' && unreadReports > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                        {unreadReports}
                                    </span>
                                )}
                            </button>
                        ))}

                        <button
                            onClick={() => navigate('/quests')}
                            title="کوئست‌ها"
                            className={`btn-icon flex-shrink-0 ${location.pathname === '/quests' ? 'active' : '!bg-ink-800/60 !border-ink-700 text-parchment-100'}`}
                        >
                            <span className="text-base">🎯</span>
                            {pendingQuests > 0 && (
                                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {pendingQuests}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={handleLogout}
                            title="خروج"
                            className="btn-icon flex-shrink-0 !bg-rose-600/90 !border-rose-700 text-white"
                        >
                            <span className="text-base">🚪</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}