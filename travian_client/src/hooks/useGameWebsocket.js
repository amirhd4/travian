import { useEffect, useState, useRef } from 'react';
import useGameStore from '../store/useGameStore';

// همان دلیل axiosConfig.js: باید با هاست‌نیم فرانت‌اند (localhost) یکی باشد
const DEFAULT_WS_URL = import.meta.env.VITE_WS_BASE_URL || `ws://${window.location.hostname}:8000`;

export function useGameWebSocket() {
    const [lastMessage, setLastMessage] = useState(null);
    const accessToken = useGameStore((state) => state.accessToken);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
        if (!accessToken) return;

        let isUnmounted = false;

        const connectWebSocket = () => {
            const url = `${DEFAULT_WS_URL}/ws/game/?token=${accessToken}`;
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
                if (!isUnmounted && event.code !== 1000) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connectWebSocket();
                    }, 3000);
                }
            };
        };

        connectWebSocket();

        return () => {
            isUnmounted = true;
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.close(1000);
            }
        };
    }, [accessToken]);

    const sendMessage = (messageObject) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(messageObject));
        } else {
            console.warn("سوکت قطع است، پیام ارسال نشد.");
        }
    };

    return { lastMessage, sendMessage };
}