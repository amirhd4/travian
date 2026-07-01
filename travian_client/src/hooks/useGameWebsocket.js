// src/hooks/useGameWebSocket.js
import { useEffect, useState } from 'react';

export function useGameWebSocket(userId = '1') {
    const [lastMessage, setLastMessage] = useState(null);

    useEffect(() => {
        // ایجاد اتصال با پروتکل سوکت بک‌اند
        const ws = new WebSocket(`ws://127.0.0.1:8000/ws/game/${userId}/`);

        ws.onopen = () => {
            console.log("اتصال زنده با سرور بازی برقرار شد 🟢");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setLastMessage(data);
            
            // مدیریت نوتیفیکیشن‌های عمومی مثل نتیجه نبردها
            if (data.type === 'COMBAT_RESULT') {
                alert(`📢 گزارش جنگ جدید: ${data.data.message}`);
            }
        };

        ws.onclose = () => {
            console.log("اتصال زنده با سرور قطع شد 🔴");
        };

        return () => {
            ws.close();
        };
    }, [userId]);

    return lastMessage;
}