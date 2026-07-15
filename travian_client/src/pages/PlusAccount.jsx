import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import GoldFeatures from "../components/GoldFeatures.jsx";

const OPTIONS = [
    { days: 1, label: '۱ روز' },
    { days: 7, label: '۷ روز' },
    { days: 30, label: '۳۰ روز' },
];

function GoldBankSection() {
    const setUser = useGameStore((state) => state.setUser);
    const [email, setEmail] = useState('');
    const [amount, setAmount] = useState('');
    const [depositing, setDepositing] = useState(false);
    const [lastPin, setLastPin] = useState(null);

    const [pinInput, setPinInput] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchHistory = useCallback(async () => {
        try {
            const { data } = await api.get('game/gold-bank/mine/');
            setHistory(data);
        } catch (error) {
            console.error(error);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const refreshGoldCoins = async () => {
        const me = await api.get('auth/me/');
        setUser(me.data);
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        setDepositing(true);
        setLastPin(null);
        try {
            const { data } = await api.post('game/gold-bank/deposit/', { email, amount });
            setLastPin(data.pin_code);
            setAmount('');
            await refreshGoldCoins();
            fetchHistory();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در انتقال طلا به بانک' });
        } finally {
            setDepositing(false);
        }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        setWithdrawing(true);
        try {
            const { data } = await api.post('game/gold-bank/withdraw/', { pin_code: pinInput });
            setAlertMsg({ tone: 'success', text: data.message });
            setPinInput('');
            await refreshGoldCoins();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در دریافت طلا از بانک' });
        } finally {
            setWithdrawing(false);
        }
    };

    return (
        <WoodSign title="بانک طلا" icon="🏦">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="بانک طلا" />

            <p className="text-xs text-ink-500 mb-4 leading-relaxed">
                طلای حساب خود را با یک ایمیل به بانک منتقل کنید تا یک کد پین یک‌بارمصرف دریافت کنید؛
                این کد را می‌توانید بعدا روی همین حساب یا هر حساب/سرور دیگری از بازی وارد کنید تا طلا به آن اضافه شود.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form onSubmit={handleDeposit} className="bg-parchment-100 border border-parchment-300 rounded-xl p-4 space-y-3">
                    <p className="field-label">💸 انتقال طلا به بانک</p>
                    <div>
                        <label className="field-label">ایمیل</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
                    </div>
                    <div>
                        <label className="field-label">مقدار طلا</label>
                        <input type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} className="field" />
                    </div>
                    <button type="submit" disabled={depositing} className="btn-gold w-full">
                        {depositing ? '...' : 'انتقال به بانک'}
                    </button>

                    {lastPin && (
                        <div className="bg-brand-50 border border-brand-300 rounded-lg p-3 text-center">
                            <p className="text-xs text-ink-600 mb-1">کد پین شما (حتما ذخیره کنید):</p>
                            <p className="font-mono font-bold text-lg text-brand-800 tracking-widest" dir="ltr">{lastPin}</p>
                        </div>
                    )}
                </form>

                <form onSubmit={handleWithdraw} className="bg-parchment-100 border border-parchment-300 rounded-xl p-4 space-y-3">
                    <p className="field-label">📥 دریافت طلا از بانک</p>
                    <div>
                        <label className="field-label">کد پین</label>
                        <input
                            type="text" required value={pinInput}
                            onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                            className="field text-center tracking-widest font-mono font-bold" dir="ltr"
                        />
                    </div>
                    <button type="submit" disabled={withdrawing} className="btn-primary w-full">
                        {withdrawing ? '...' : 'دریافت طلا'}
                    </button>
                </form>
            </div>

            <div className="mt-5">
                <p className="field-label mb-2">تاریخچه‌ی انتقال‌های شما</p>
                {historyLoading ? (
                    <LoadingState label="در حال بارگذاری..." />
                ) : history.length === 0 ? (
                    <p className="text-xs text-ink-400 text-center py-3">هنوز هیچ انتقالی ثبت نکرده‌اید.</p>
                ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {history.map((h) => (
                            <div key={h.id} className="flex items-center justify-between bg-white/70 border border-parchment-200 rounded-lg px-3 py-2 text-xs">
                                <span className="font-mono tracking-wider" dir="ltr">{h.pin_code}</span>
                                <span className="font-bold text-ink-700">{h.amount} 💰</span>
                                <span className={h.is_redeemed ? 'text-ink-400' : 'text-brand-700 font-bold'}>
                                    {h.is_redeemed ? '✅ استفاده شده' : '⏳ استفاده‌نشده'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </WoodSign>
    );
}

export default function PlusAccount() {
    const setUser = useGameStore((state) => state.setUser);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchStatus = useCallback(async () => {
        try {
            const { data } = await api.get('game/plus/');
            setStatus(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const handleBuy = async (days) => {
        setBuying(days);
        try {
            const { data } = await api.post('game/plus/', { days });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchStatus();
            const me = await api.get('auth/me/');
            setUser(me.data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در خرید پلاس' });
        } finally {
            setBuying(null);
        }
    };

    if (loading || !status) return <PageShell><LoadingState /></PageShell>;

    return (
        <PageShell maxWidth="max-w-lg">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="اکانت پلاس" />

            <WoodSign title="اکانت پلاس" iconElement={<img src="/assets/ui/plus-icon.gif" alt="" className="w-5 h-5" onError={(e) => { e.target.style.display='none'; }} />}>
                {status.has_plus ? (
                    <p className="text-center text-sm font-bold text-brand-700 bg-brand-50 border border-brand-300 rounded-xl p-3 mb-4">
                        ✅ اکانت پلاس شما فعال است تا {new Date(status.expires_at).toLocaleString('fa-IR')}
                    </p>
                ) : (
                    <p className="text-center text-sm font-bold text-ink-500 bg-parchment-100 border border-parchment-300 rounded-xl p-3 mb-4">
                        اکانت پلاس شما غیرفعال است.
                    </p>
                )}

                <ul className="text-xs text-ink-700 list-disc list-inside space-y-1 mb-4 bg-white/70 rounded-xl p-3 border border-parchment-200">
                    <li>صف ساخت‌وساز دوتایی (۲ ساختمان هم‌زمان به‌جای ۱)</li>
                    <li>اولویت در پشتیبانی و امکانات آینده</li>
                </ul>

                <p className="text-center text-xs text-ink-500 mb-3">
                    هزینه: {status.cost_per_day} طلا به‌ازای هر روز — موجودی فعلی: {status.gold_coins} 💰
                </p>

                <div className="grid grid-cols-3 gap-2">
                    {OPTIONS.map((opt) => (
                        <button key={opt.days} onClick={() => handleBuy(opt.days)} disabled={buying === opt.days} className="btn-primary text-xs !py-2.5">
                            {buying === opt.days ? '...' : `${opt.label} (${opt.days * status.cost_per_day} 💰)`}
                        </button>
                    ))}
                </div>
            </WoodSign>

            <GoldBankSection />
            <GoldFeatures />
        </PageShell>
    );
}