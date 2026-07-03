import { useNavigate, useLocation } from 'react-router-dom';
import useGameStore from "../store/useGameStore.js";
import api from "../api/axiosConfig.js";

export default function Navbar() {
    const navigate = useNavigate();
    const clearUser = useGameStore((state) => state.clearUser);
    const location = useLocation();

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
        <div className="fixed top-12 left-0 w-full bg-gray-800 text-white p-3 flex flex-wrap justify-center gap-4 z-[100] border-b-2 border-gray-900 shadow-xl">
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

            <button onClick={handleLogout} className="text-red-400 hover:text-red-500 hover:bg-red-900/30 font-bold px-3 py-1.5 rounded transition absolute left-4">
                🚪 خروج
            </button>
        </div>
    );
}