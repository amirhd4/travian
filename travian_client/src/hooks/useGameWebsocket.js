import { useEffect, useState, useRef } from 'react';

export function useGameWebSocket(userId) {
    const [lastMessage, setLastMessage] = useState(null);

    // استفاده از useRef برای نگهداری نمونه سوکت و تایمر، بدون ایجاد رندر اضافی
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    const wsURL = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8000';
    console.log("Amiiir")
    useEffect(() => {
        // اگر آیدی کاربر وجود نداشت (مثلاً هنوز لاگین نکرده) اصلاً وصل نشو
        console.log('Reconnecting...');
        if (!userId) return;
        console.log('Reconnecting...2');
        const connectWebSocket = () => {
            console.log('Connected...');
            // دریافت توکن برای ارسال به بک‌اند (بک‌اند باید تنظیم شود تا توکن را از URL بخواند)
            const token = localStorage.getItem('access');
            const url = `${wsURL}/ws/game/?token=${token}`;

            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("اتصال زنده با سرور بازی برقرار شد 🟢");
                // اگر قبلاً تایمر اتصال مجدد روشن بوده، پاکش کن
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setLastMessage(data);

                // مدیریت نوتیفیکیشن‌ها
                if (data.type === 'COMBAT_RESULT') {
                    // نکته: استفاده از alert در بازی جالب نیست چون کل صفحه را قفل می‌کند.
                    // پیشنهاد: در آینده اینجا از کتابخانه‌هایی مثل react-toastify استفاده کنید.
                    console.log(`📢 گزارش جنگ جدید: ${data.data.message}`);
                }
            };

            ws.onclose = (event) => {
                console.log("اتصال زنده با سرور قطع شد 🔴");

                // کد 1000 یعنی ما خودمان عمداً سوکت را بستیم (مثلاً زمان خروج از اکانت)
                // اگر غیر از 1000 بود، یعنی اینترنت قطع شده و باید خودکار وصل شود
                if (event.code !== 1000) {
                    console.log("تلاش برای اتصال مجدد تا ۳ ثانیه دیگر...");
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connectWebSocket();
                    }, 3000);
                }
            };
        };

        connectWebSocket();

        // تابع پاکسازی (Cleanup) هنگام خارج شدن از کامپوننت
        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.close(1000); // بستن استاندارد سوکت
            }
        };
    }, [userId, wsURL]);

    // تابع کمکی برای ارسال پیام از فرانت به بک‌اند
    const sendMessage = (messageObject) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(messageObject));
        } else {
            console.warn("سوکت قطع است، پیام ارسال نشد.");
        }
    };

    // حالا هم آخرین پیام را برمی‌گردانیم، هم تابع ارسال پیام را
    return { lastMessage, sendMessage };
}