import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

function formatCountdown(targetDate) {
    if (!targetDate) return null;
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days} روز و ${hours} ساعت`;
    if (hours > 0) return `${hours} ساعت و ${minutes} دقیقه`;
    return `${minutes} دقیقه`;
}

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

    useEffect(() => {
        if (lastMessage?.type === 'SERVER_FINISHED') {
            api.get('game/server-status/')
                .then(({ data }) => setStatus(data))
                .catch(() => setStatus((prev) => ({ ...prev, is_finished: true, winner_username: lastMessage.data.winner })));
        }
    }, [lastMessage]);

    // اعلان زنده برای کاربرانی که همین الان آنلاین هستند (بدون نیاز به رفرش صفحه)
    useEffect(() => {
        if (lastMessage?.type === 'SERVER_FINISHED') {
            setStatus((prev) => ({ ...prev, is_finished: true, winner_username: lastMessage.data.winner }));
        }
    }, [lastMessage]);

    if (!status) return null;

    // نمایش پایان سرور
    if (status.is_finished) {
        return (
            <div
                className="fixed bottom-0 left-0 w-full bg-gradient-to-l from-amber-600 to-amber-800 text-white text-center py-2 z-[999] font-bold shadow-lg text-sm"
                dir="rtl"
            >
                <div>
                    🏆 این سرور به پایان رسیده است! برنده: <span className="text-yellow-200">{status.winner_username}</span>
                    {status.winner_alliance_tag && <span> (اتحاد [{status.winner_alliance_tag}])</span>}
                </div>
                {(status.greatest_empire_username || status.top_attacker_username || status.top_defender_username) && (
                    <div className="text-xs font-normal mt-1 flex flex-wrap justify-center gap-3">
                        {status.greatest_empire_username && <span>👑 بزرگترین امپراتوری: {status.greatest_empire_username}</span>}
                        {status.top_attacker_username && <span>⚔️ برترین مهاجم: {status.top_attacker_username}</span>}
                        {status.top_defender_username && <span>🛡️ برترین مدافع: {status.top_defender_username}</span>}
                    </div>
                )}
            </div>
        );
    }

    if (banners.length === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 w-full z-[999] shadow-lg" dir="rtl">
            {banners}
        </div>
    );
}
