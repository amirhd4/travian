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

    const handleLogout = async () => {
        try {
            // این کار refresh token رو روی سرور blacklist و کوکی رو پاک می‌کنه
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

            <button onClick={() => navigate('/village')} className={getBtnClass('/village')}>
                🏛️ دهکده من
            </button>
            <button onClick={() => navigate('/world-map')} className={getBtnClass('/world-map')}>
                🗺️ نقشه جهان
            </button>
            <button onClick={() => navigate('/reports')} className={getBtnClass('/reports')}>
                📜 گزارشات
            </button>
            <button onClick={() => navigate('/statistics')} className={getBtnClass('/statistics')}>
                📊 آمار
            </button>
            <button onClick={() => navigate('/marketplace')} className={getBtnClass('/marketplace')}>
                ⚖️ بازارچه
            </button>
            <button onClick={() => navigate('/world-wonder')} className={getBtnClass('/world-wonder')}>
                🏛️ شگفتی جهان
            </button>
            <button onClick={() => navigate('/messages')} className={getBtnClass('/messages')}>
                ✉️ پیام‌ها
            </button>
            <button onClick={() => navigate('/barracks')} className={getBtnClass('/barracks')}>
                ⚔️ پادگان
            </button>
            <button onClick={() => navigate('/embassy')} className={getBtnClass('/embassy')}>
                🏛️ سفارتخانه
            </button>
            <button onClick={() => navigate('/movements')} className={getBtnClass('/movements')}>
                📡 نقطه گردهمایی
            </button>
            <button onClick={() => navigate('/hero')} className={getBtnClass('/hero')}>
                🦸 قهرمان
            </button>
            <button onClick={() => navigate('/colonize')} className={getBtnClass('/colonize')}>
                🏕️ تاسیس دهکده
            </button>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-500 hover:bg-red-900/30 font-bold px-3 py-1.5 rounded transition absolute left-4">
                🚪 خروج
            </button>
        </div>
    );
}