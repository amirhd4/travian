import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';

export default function Checkout() {
    const { authority } = useParams();
    const navigate = useNavigate();
    const setUser = useGameStore((state) => state.setUser);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [message, setMessage] = useState('');
    const [alertMsg, setAlertMsg] = useState(null);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            const { data } = await api.post('game/payment/mock-complete/', { authority });
            setMessage(data.message);
            setDone(true);
            const me = await api.get('auth/me/');
            setUser(me.data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تایید پرداخت' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen game-bg flex items-center justify-center p-4">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="پرداخت" />

            <div className="max-w-md w-full">
                <WoodSign title="درگاه پرداخت آزمایشی" icon="🏦">
                    <p className="text-xs text-center text-ink-500 mb-4 leading-relaxed">
                        این یک درگاه شبیه‌سازی‌شده است (بدون اتصال واقعی به بانک). در نسخه‌ی نهایی، این صفحه باید با درگاه واقعی (زرین‌پال/آیدی‌پی و...) جایگزین شود.
                    </p>

                    {done ? (
                        <div className="text-center">
                            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-100 flex items-center justify-center text-2xl">✅</div>
                            <p className="text-brand-700 font-bold text-sm mb-4">{message}</p>
                            <button onClick={() => navigate('/gold-shop')} className="btn-primary w-full">بازگشت به فروشگاه</button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-xs text-ink-500 mb-4">کد پیگیری: <span dir="ltr">{authority}</span></p>
                            <button onClick={handleConfirm} disabled={loading} className="btn-primary w-full py-3">
                                {loading ? 'در حال پردازش...' : '✅ پرداخت موفق (تستی)'}
                            </button>
                        </div>
                    )}
                </WoodSign>
            </div>
        </div>
    );
}