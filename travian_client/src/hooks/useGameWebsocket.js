import { useEffect, useState, useRef } from 'react';
import useGameStore from '../store/useGameStore';

export function useGameWebSocket(userId) {
    const [lastMessage, setLastMessage] = useState(null);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    const wsURL = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8000';

    useEffect(() => {
        if (!userId) return;

        const connectWebSocket = () => {
            // توکن از حافظه (Zustand) خونده می‌شه، نه از localStorage
            const token = useGameStore.getState().accessToken;
            const url = `${wsURL}/ws/game/?token=${token}`;

            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setLastMessage(data);

                if (data.type === 'COMBAT_RESULT') {
                    console.log(`📢 گزارش جنگ جدید: ${data.data.message}`);
                }
            };

            ws.onclose = (event) => {
                if (event.code !== 1000) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connectWebSocket();
                    }, 3000);
                }
            };
        };

        connectWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.close(1000);
            }
        };
    }, [userId, wsURL]);

    const sendMessage = (messageObject) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(messageObject));
        } else {
            console.warn("سوکت قطع است، پیام ارسال نشد.");
        }
    };

    return { lastMessage, sendMessage };
}