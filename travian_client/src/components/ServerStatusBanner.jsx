import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

export default function ServerStatusBanner() {
    const [status, setStatus] = useState(null);
    const { lastMessage } = useGameWebSocket();

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const { data } = await api.get('game/server-status/');
                setStatus(data);
            } catch (error) {
                console.error('خطا در دریافت وضعیت سرور', error);
            }
        };
        fetchStatus();
    }, []);

    // اعلان زنده برای کاربرانی که همین الان آنلاین هستند (بدون نیاز به رفرش صفحه)
    useEffect(() => {
        if (lastMessage?.type === 'SERVER_FINISHED') {
            setStatus((prev) => ({ ...prev, is_finished: true, winner_username: lastMessage.data.winner }));
        }
    }, [lastMessage]);

    if (!status?.is_finished) return null;

    return (
        <div
            className="fixed bottom-0 left-0 w-full bg-gradient-to-l from-amber-600 to-amber-800 text-white text-center py-2 z-[999] font-bold shadow-lg text-sm"
            dir="rtl"
        >
            🏆 این سرور به پایان رسیده است! برنده: <span className="text-yellow-200">{status.winner_username}</span>
            {status.winner_alliance_tag && <span> (اتحاد [{status.winner_alliance_tag}])</span>}
            {' '}— دیگر امکان ساخت‌وساز، آموزش یا اعزام نیرو وجود ندارد.
        </div>
    );
}