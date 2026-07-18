import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGameStore from "../store/useGameStore.js";
import api from "../api/axiosConfig.js";

const NAV_ITEMS = [
    { path: '/village', cssClass: 'resources', label: 'منابع', accessKey: '1' },
    { path: '/dorf2', cssClass: 'village', label: 'مرکز دهکده', accessKey: '2' },
    { path: '/world-map', cssClass: 'map', label: 'نقشه', accessKey: '3' },
    { path: '/statistics', cssClass: 'stats', label: 'آمار', accessKey: '4' },
    { path: '/reports', cssClass: 'reports', label: 'گزارشات', accessKey: '5' },
    { path: '/messages', cssClass: 'messages', label: 'پیام‌ها', accessKey: '6' },
];

export default function Navbar() {
    const navigate = useNavigate();
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

    return (
        <ul id="navigation">
            {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                const unreadCount = item.path === '/reports' ? unreadReports :
                                   item.path === '/messages' ? unreadMessages : 0;
                return (
                    <li key={item.path} id={`n${NAV_ITEMS.indexOf(item) + 1}`} className={item.cssClass}>
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
                            {unreadCount > 0 && (
                                <span className="bubble" style={{ display: 'block' }}>
                                    <span className="bubble-content">{unreadCount}</span>
                                </span>
                            )}
                        </a>
                    </li>
                );
            })}
        </ul>
    );
}
