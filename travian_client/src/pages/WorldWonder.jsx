import { useState, useEffect, useCallback } from 'react';
import LoadingState from '../components/LoadingState';
import { ConfirmModal, AlertModal } from '../components/Modal';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

export default function WorldWonder() {
    const villages = useGameStore((state) => state.villages);
    const { lastMessage } = useGameWebSocket();

    const [wwVillageId, setWwVillageId] = useState(null);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [alertMsg, setAlertMsg] = useState(null);

    useEffect(() => {
        const wwVillage = villages.find((v) => v.has_world_wonder);
        setWwVillageId(wwVillage ? wwVillage.id : null);
    }, [villages]);

    const fetchStatus = useCallback(async () => {
        if (!wwVillageId) { setLoading(false); return; }
        try {
            const { data } = await api.get('ww/upgrade/', { params: { village_id: wwVillageId } });
            setStatus(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [wwVillageId]);

    useEffect(() => { setLoading(true); fetchStatus(); }, [fetchStatus]);
    useEffect(() => { if (lastMessage?.type === 'COMBAT_RESULT') fetchStatus(); }, [lastMessage, fetchStatus]);

    const doUpgrade = async () => {
        setConfirmOpen(false);
        setUpgrading(true);
        try {
            const { data } = await api.post('ww/upgrade/', { village_id: wwVillageId });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchStatus();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در ارتقا' });
        } finally {
            setUpgrading(false);
        }
    };

    const bgStyle = {
        backgroundImage: "linear-gradient(180deg, rgba(10,10,25,.7), rgba(10,10,25,.85)), url('/assets/bgs/bg0.jpg')",
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0f172a',
    };

    if (loading) {
        return (
            <div className="w-full flex flex-col items-center" style={bgStyle}>
                <LoadingState label="در حال بارگذاری..." />
            </div>
        );
    }

    if (!wwVillageId) {
        return (
            <div className="w-full flex flex-col items-center" style={bgStyle}>
                <div className="panel !bg-ink-900/90 !border-gold-700/40 text-parchment-100 p-8 mt-10 max-w-lg text-center mx-4">
                    <h1 className="text-2xl font-extrabold text-gold-400 mb-4">🏛️ شگفتی جهان</h1>
                    <p className="text-parchment-300 text-sm leading-relaxed">
                        شما هنوز دهکده‌ای ندارید که شگفتی جهان در آن ساخته شده باشد. باید ابتدا یکی از دوازده «دهکده‌ی ویرانه»‌ی ناتار روی نقشه جهان را با نیروی سناتور تسخیر کنید.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center" style={bgStyle}>
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="شگفتی جهان" />
            <ConfirmModal
                open={confirmOpen} onCancel={() => setConfirmOpen(false)} onConfirm={doUpgrade}
                title="ارتقای شگفتی جهان" danger
                message="ارتقای شگفتی جهان نیازمند میلیون‌ها منبع است. آیا مطمئن هستید؟"
            />

            <div className="panel !bg-ink-900/90 !border-gold-700/40 p-8 max-w-2xl w-full text-center mt-4 mx-4">
                <h1 className="text-3xl font-extrabold text-gold-400 mb-2">🏛️ شگفتی جهان</h1>
                <p className="text-parchment-400 text-sm mb-8">اولین بازیکنی که این بنا را به سطح ۱۰۰ برساند، برنده‌ی بازی است.</p>

                <div className="flex justify-center items-center mb-8">
                    <div className="w-48 h-48 bg-ink-800 rounded-full border-8 border-gold-700 flex items-center justify-center shadow-inner relative overflow-hidden">
                        <div className="absolute bottom-0 w-full bg-gold-600 opacity-30 transition-all duration-1000" style={{ height: `${status.level}%` }} />
                        <span className="text-5xl font-black text-gold-400 z-10">{status.level}</span>
                    </div>
                </div>

                <div className="bg-ink-800/60 rounded-xl border border-ink-700 p-4 mb-6 text-right text-parchment-300 text-sm">
                    <p className="font-bold text-gold-400 mb-2">پیش‌نیازهای سطح بعدی ({status.level + 1}):</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>چوب/خشت/آهن/گندم: {status.next_level_cost.wood.toLocaleString()} از هرکدام</li>
                        <li>
                            نقشه‌ی ساخت:{' '}
                            {status.has_valid_plan ? <span className="text-brand-400">در دسترس ✔️</span> : <span className="text-rose-400">موجود نیست ✖️</span>}
                        </li>
                    </ul>
                </div>

                <button
                    onClick={() => setConfirmOpen(true)}
                    disabled={upgrading || !status.has_valid_plan}
                    className="btn-gold w-full py-4 text-lg"
                >
                    {upgrading ? "در حال ساخت سازه..." : "ارتقا به سطح بعدی 🔨"}
                </button>
            </div>
        </div>
    );
}