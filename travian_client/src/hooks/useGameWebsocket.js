import useWebSocket from 'react-use-websocket';
import useGameStore from '../store/useGameStore';

export const useGameWebSocket = () => {
    const token = localStorage.getItem('token');
    const updateResources = useGameStore((state) => state.updateResources);

    const { lastJsonMessage } = useWebSocket(
        // ارسال توکن در URL برای تایید هویت در Channels
        token ? `ws://127.0.0.1:8000/ws/game/?token=${token}` : null,
        {
            shouldReconnect: () => true, // اتصال مجدد خودکار در صورت قطعی
            onMessage: (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'building_completed') {
                    console.log('ساختمان تکمیل شد!', data);
                    // اینجا می‌توانیم یک هشدار (Toast) به کاربر نشان دهیم
                    alert(`ساختمان ${data.building_id} با موفقیت ارتقا یافت!`);
                    // همچنین باید لیست ساختمان‌ها را رفرش کنیم (در کامپوننت نقشه)
                }
                else if (data.type === 'gold_added') {
                    alert(`تعداد ${data.amount} سکه طلا به حساب شما واریز شد!`);
                }
            }
        }
    );

    return lastJsonMessage;
};