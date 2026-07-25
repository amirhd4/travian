import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import { AlertModal } from '../components/Modal';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import GoldFeatures from "../components/GoldFeatures.jsx";
import WoodSign from "../components/WoodSign.jsx";

const OPTIONS = [
    { days: 1, label: '۱ روز' },
    { days: 7, label: '۷ روز' },
    { days: 30, label: '۳۰ روز' },
];

// ----------------------------------------------------------------------
// 🏦 بخش بانک طلا
// ----------------------------------------------------------------------
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
            fetchHistory(); // بروزرسانی تاریخچه پس از دریافت موفق
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در دریافت طلا از بانک' });
        } finally {
            setWithdrawing(false);
        }
    };

    return (
        <div className="space-y-6">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="بانک طلا" />

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-md shadow-sm">
                <p className="text-sm text-amber-800 leading-relaxed font-medium">
                    طلای حساب خود را به بانک منتقل کنید تا یک <strong>کد پین یک‌بارمصرف</strong> دریافت کنید. این کد را می‌توانید بعداً روی همین حساب یا هر حساب/سرور دیگری وارد کنید تا طلا به آن اضافه شود.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* کارت انتقال به بانک */}
                <form onSubmit={handleDeposit} className="bg-white border-2 border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
                    <h4 className="text-md font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span>💸</span> انتقال طلا به بانک
                    </h4>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">ایمیل گیرنده / پشتیبان</label>
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all text-sm ltr-input" placeholder="example@mail.com" dir="ltr" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">مقدار طلا</label>
                            <div className="relative">
                                <input type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all text-sm ltr-input" placeholder="مثلاً 100" dir="ltr" />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">💰</span>
                            </div>
                        </div>
                        <button type="submit" disabled={depositing} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-2.5 rounded-lg shadow-md transition-transform transform active:scale-95 disabled:opacity-50">
                            {depositing ? 'در حال انتقال...' : 'انتقال به بانک'}
                        </button>
                    </div>

                    {lastPin && (
                        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-center animate-fade-in">
                            <p className="text-xs text-green-700 mb-1 font-bold">✅ انتقال موفق! کد پین شما (حتما ذخیره کنید):</p>
                            <div className="bg-white border-2 border-green-300 p-2 rounded mt-2">
                                <p className="font-mono font-black text-xl text-green-700 tracking-widest select-all" dir="ltr">{lastPin}</p>
                            </div>
                        </div>
                    )}
                </form>

                {/* کارت دریافت از بانک */}
                <form onSubmit={handleWithdraw} className="bg-white border-2 border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                    <h4 className="text-md font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span>📥</span> دریافت طلا از بانک
                    </h4>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">کد پین ۱۶ رقمی</label>
                            <input
                                type="text" required value={pinInput}
                                onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                className="w-full px-3 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none transition-all text-center tracking-widest font-mono font-bold text-slate-700" dir="ltr"
                            />
                        </div>
                        <button type="submit" disabled={withdrawing} className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold py-2.5 rounded-lg shadow-md transition-transform transform active:scale-95 disabled:opacity-50">
                            {withdrawing ? 'در حال بررسی...' : 'دریافت طلا'}
                        </button>
                    </div>
                </form>
            </div>

            {/* تاریخچه انتقال‌ها */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3 border-b pb-2">📜 تاریخچه‌ی انتقال‌های شما</h4>
                {historyLoading ? (
                    <LoadingState label="در حال دریافت تاریخچه..." />
                ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                        <span className="text-3xl mb-2">📭</span>
                        <p className="text-xs">هنوز هیچ انتقالی ثبت نکرده‌اید.</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                        {history.map((h) => (
                            <div key={h.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 hover:border-slate-300 rounded-lg px-4 py-3 text-sm transition-colors">
                                <span className="font-mono tracking-wider font-semibold text-slate-600" dir="ltr">{h.pin_code}</span>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-md">{h.amount} 💰</span>
                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${h.is_redeemed ? 'bg-slate-200 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                                        {h.is_redeemed ? 'استفاده شده' : 'فعال'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// 🌟 صفحه اصلی با تب‌بندی
// ----------------------------------------------------------------------
export default function PlusAccount() {
    const setUser = useGameStore((state) => state.setUser);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);

    // وضعیت تب فعال (plus, bank, features)
    const [activeTab, setActiveTab] = useState('plus');

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
        <PageShell maxWidth="max-w-2xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="مدیریت اکانت" />

            <WoodSign
                title="مرکز طلایی تراوین"
                iconElement={<img src="/assets/ui/plus-icon.gif" alt="" className="w-6 h-6 drop-shadow-md" onError={(e) => { e.target.style.display='none'; }} />}
            >
                {/* نوار تب‌ها */}
                <div className="flex flex-wrap md:flex-nowrap gap-2 bg-amber-100/50 p-1.5 rounded-xl border border-amber-200 mb-6">
                    <button
                        onClick={() => setActiveTab('plus')}
                        className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'plus' ? 'bg-white text-amber-700 shadow-sm border border-amber-200' : 'text-amber-700/60 hover:bg-amber-100 hover:text-amber-800'}`}
                    >
                        <span>⭐</span> اکانت پلاس
                    </button>
                    <button
                        onClick={() => setActiveTab('bank')}
                        className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'bank' ? 'bg-white text-amber-700 shadow-sm border border-amber-200' : 'text-amber-700/60 hover:bg-amber-100 hover:text-amber-800'}`}
                    >
                        <span>🏦</span> بانک طلا
                    </button>
                    <button
                        onClick={() => setActiveTab('features')}
                        className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'features' ? 'bg-white text-amber-700 shadow-sm border border-amber-200' : 'text-amber-700/60 hover:bg-amber-100 hover:text-amber-800'}`}
                    >
                        <span>⚡</span> امکانات طلا
                    </button>
                </div>

                {/* محتوای تب‌ها */}
                <div className="animate-fade-in-up">

                    {/* تب اکانت پلاس */}
                    {activeTab === 'plus' && (
                        <div className="space-y-5">
                            {status.has_plus ? (
                                <div className="flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
                                    <span className="text-3xl animate-pulse">👑</span>
                                    <div>
                                        <p className="text-sm font-black text-emerald-800">اکانت پلاس شما فعال است!</p>
                                        <p className="text-xs text-emerald-600 mt-1 font-medium">اعتبار تا: {new Date(status.expires_at).toLocaleString('fa-IR')}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
                                    <span className="text-4xl grayscale opacity-50 mb-2">👑</span>
                                    <p className="text-sm font-bold text-slate-500">
                                        اکانت پلاس شما در حال حاضر غیرفعال است.
                                    </p>
                                </div>
                            )}

                            <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
                                <h4 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                                    <span>✨</span> مزایای اکانت پلاس
                                </h4>
                                <ul className="text-sm text-slate-600 list-none space-y-2">
                                    <li className="flex items-center gap-2 before:content-['✓'] before:text-green-500 before:font-bold">
                                        صف ساخت‌وساز دوتایی (ارتقاء ۲ ساختمان به‌صورت هم‌زمان)
                                    </li>
                                    <li className="flex items-center gap-2 before:content-['✓'] before:text-green-500 before:font-bold">
                                        اولویت در دریافت پشتیبانی سریع
                                    </li>
                                    <li className="flex items-center gap-2 before:content-['✓'] before:text-green-500 before:font-bold">
                                        دسترسی زودهنگام به امکانات آینده سرور
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-slate-800 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>

                                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                                    <span className="text-sm text-slate-300">موجودی فعلی شما:</span>
                                    <span className="text-xl font-black text-amber-400 flex items-center gap-1">
                                        {status.gold_coins} <span className="text-2xl">💰</span>
                                    </span>
                                </div>

                                <p className="text-center text-xs text-slate-400 mb-4">
                                    تعرفه تمدید: <strong>{status.cost_per_day} طلا</strong> به‌ازای هر روز
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {OPTIONS.map((opt) => (
                                        <button
                                            key={opt.days}
                                            onClick={() => handleBuy(opt.days)}
                                            disabled={buying === opt.days || status.gold_coins < (opt.days * status.cost_per_day)}
                                            className={`relative py-3 rounded-lg font-bold text-sm transition-all shadow-md flex flex-col items-center justify-center gap-1 
                                                ${buying === opt.days ? 'bg-slate-600 text-slate-400 cursor-wait' : 
                                                status.gold_coins < (opt.days * status.cost_per_day) ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600' : 
                                                'bg-gradient-to-t from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 text-slate-900 transform hover:-translate-y-1'}`}
                                        >
                                            {buying === opt.days ? (
                                                'در حال پردازش...'
                                            ) : (
                                                <>
                                                    <span className="text-base">{opt.label}</span>
                                                    <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                                        {opt.days * status.cost_per_day} 💰
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* تب بانک طلا */}
                    {activeTab === 'bank' && <GoldBankSection />}

                    {/* تب امکانات طلا */}
                    {activeTab === 'features' && (
                        <div className="bg-white rounded-xl p-1 border border-amber-100 shadow-sm">
                             <GoldFeatures />
                        </div>
                    )}
                </div>
            </WoodSign>
        </PageShell>
    );
}