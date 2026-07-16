import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGameStore from "../store/useGameStore.js";
import api from "../api/axiosConfig.js";

const NAV_ITEMS = [
    { path: '/village', class: 'resources', label: 'منابع', accessKey: '1' },
    { path: '/dorf2', class: 'village', label: 'مرکز دهکده', accessKey: '2' },
    { path: '/world-map', class: 'map', label: 'نقشه', accessKey: '3' },
    { path: '/statistics', class: 'stats', label: 'آمار', accessKey: '4' },
    { path: '/reports', class: 'reports', label: 'گزارشات', accessKey: '5' },
    { path: '/messages', class: 'messages', label: 'پیام‌ها', accessKey: '6' },
];

export default function Navbar() {
    const navigate = useNavigate();
    const clearUser = useGameStore((state) => state.clearUser);
    const location = useLocation();

    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const setActiveVillageId = useGameStore((state) => state.setActiveVillageId);

    const [unreadReports, setUnreadReports] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const { data } = await api.get('combat/reports/unread-count/');
                setUnreadReports(data.unread_count);
            } catch { /* silent */ }
            try {
                const { data } = await api.get('game/messages/unread-count/');
                setUnreadMessages(data.unread_count);
            } catch { /* silent */ }
        };
        fetchCounts();
        const interval = setInterval(fetchCounts, 30000);
        return () => clearInterval(interval);
    }, []);

    const setVillages = useGameStore((state) => state.setVillages);

    const handleRename = async () => {
        const activeVillage = villages.find((v) => v.id === activeVillageId);
        if (!activeVillage) return;
        const newName = window.prompt('نام جدید دهکده را وارد کنید:', activeVillage.name);
        if (!newName || !newName.trim()) return;
        try {
            await api.post('game/villages/rename/', { village_id: activeVillageId, name: newName.trim() });
            const { data } = await api.get('game/villages/');
            setVillages(data);
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در تغییر نام دهکده');
        }
    };

    const handleLogout = async () => {
        try { await api.post('auth/logout/'); } catch { /* ignore */ }
        finally { clearUser(); navigate('/login'); }
    };

    return (
        <>
            {/* Village name sign (RTL: right side) */}
            {villages.length > 0 && activeVillageId && (
                <div id="villageName">
                    <div>
                        <select
                            value={activeVillageId || ''}
                            onChange={(e) => setActiveVillageId(Number(e.target.value))}
                            style={{
                                width: '100%',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                background: 'transparent',
                                border: 'none',
                                color: '#252525',
                                textAlign: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            {villages.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.is_capital ? '★ ' : ''}{v.name}
                                </option>
                            ))}
                        </select>
                        <div className="loyalty">
                            <button
                                onClick={handleRename}
                                style={{ background: 'none', border: 'none', color: '#99C01A', fontSize: '10px', cursor: 'pointer' }}
                            >
                                ✏️ تغییر نام
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main navigation (RTL) */}
            <ul id="navigation">
                {NAV_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <li key={item.path} className={item.class}>
                            <a
                                href="#"
                                accessKey={item.accessKey}
                                title={item.label}
                                className={isActive ? 'active' : ''}
                                onClick={(e) => {
                                    e.preventDefault();
                                    navigate(item.path);
                                }}
                            >
                                {/* Unread count bubbles */}
                                {item.path === '/reports' && unreadReports > 0 && (
                                    <span className="bubble" style={{ top: '0', left: '51px' }}>
                                        {unreadReports}
                                    </span>
                                )}
                                {item.path === '/messages' && unreadMessages > 0 && (
                                    <span className="bubble" style={{ top: '0', left: '51px' }}>
                                        {unreadMessages}
                                    </span>
                                )}
                            </a>
                        </li>
                    );
                })}
            </ul>

            {/* Logout button (RTL: left side) */}
            <div style={{
                position: 'absolute',
                left: '10px',
                top: '0',
                zIndex: 10,
            }}>
                <button
                    onClick={handleLogout}
                    style={{
                        background: '#DE0000',
                        border: '1px solid #aa0000',
                        color: '#FFF',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                    }}
                    title="خروج"
                >
                    🚪 خروج
                </button>
            </div>
        </>
    );
}
