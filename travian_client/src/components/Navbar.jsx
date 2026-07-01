import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    // تابع کمکی برای استایل دادن به دکمه فعال
    const getBtnClass = (path) => {
        const base = "font-bold px-3 py-1 rounded transition ";
        return location.pathname === path
            ? base + "text-travian-gold bg-gray-700"
            : base + "hover:text-travian-gold";
    };

    return (
        <div className="absolute top-14 left-0 w-full bg-gray-800 text-white p-2 flex justify-center gap-6 z-10 border-b border-gray-700 shadow-md">
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
            <button onClick={handleLogout} className="text-red-400 hover:text-red-500 font-bold px-3 py-1 rounded transition ml-auto absolute left-4">
                🚪 خروج
            </button>
        </div>
    );
}