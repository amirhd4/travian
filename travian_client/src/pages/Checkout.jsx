import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import WoodSign from '../components/WoodSign';
import useGameStore from '../store/useGameStore';

export default function Checkout() {
    const { authority } = useParams();
    const navigate = useNavigate();
    const setUser = useGameStore((state) => state.setUser);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [message, setMessage] = useState('');

    const handleConfirm = async () => {
        setLoading(true);
        try {
            const { data } = await api.post('game/payment/mock-complete/', { authority });
            setMessage(data.message);
            setDone(true);
            const me = await api.get('auth/me/');
            setUser(me.data);
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در تایید پرداخت');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen game-sky-bg flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <WoodSign title="🏦 درگاه پرداخت آزمایشی">
                    <p className="text-xs text-center text-gray-600 mb-4">
                        این یک درگاه شبیه‌سازی‌شده است (بدون اتصال واقعی به بانک). در نسخه‌ی
                        نهایی، این صفحه باید با درگاه واقعی (زرین‌پال/آیدی‌پی و...) جایگزین شود.
                    </p>

                    {done ? (
                        <div className="text-center">
                            <p className="text-green-700 font-bold text-sm mb-4">✅ {message}</p>
                            <button onClick={() => navigate('/gold-shop')} className="btn-travian-green">
                                بازگشت به فروشگاه
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-xs text-gray-500 mb-4">کد پیگیری: {authority}</p>
                            <button onClick={handleConfirm} disabled={loading} className="btn-travian-green disabled:opacity-50">
                                {loading ? 'در حال پردازش...' : '✅ پرداخت موفق (تستی)'}
                            </button>
                        </div>
                    )}
                </WoodSign>
            </div>
        </div>
    );
}