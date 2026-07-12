import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from "../utils/formatter.js";

const RESOURCE_META = {
    wood: { icon: '🪵', label: 'چوب' },
    clay: { icon: '🧱', label: 'خشت' },
    iron: { icon: '⚒️', label: 'آهن' },
    crop: { icon: '🌾', label: 'گندم' },
};

export default function Marketplace() {
    const { resources } = useGameStore();
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const [targetVillageId, setTargetVillageId] = useState('');
    const [payload, setPayload] = useState({ wood: 0, clay: 0, iron: 0, crop: 0 });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchStatus = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/marketplace/send/', { params: { village_id: activeVillageId } });
            setStatus(data);
        } catch (error) {
            console.error(error);
        } finally {
            setStatusLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setStatusLoading(true); fetchStatus(); }, [fetchStatus]);
    useEffect(() => { if (lastMessage?.type === 'TRADE_DELIVERED') fetchStatus(); }, [lastMessage, fetchStatus]);
    useEffect(() => {
        const interval = setInterval(fetchStatus, 15000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    useEffect(() => {
        const interval = setInterval(() => {
            setStatus((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    outgoing_trades: prev.outgoing_trades.map((t) => ({
                        ...t,
                        delivery_remaining_seconds: Math.max(0, t.delivery_remaining_seconds - 1),
                        merchants_return_remaining_seconds: Math.max(0, t.merchants_return_remaining_seconds - 1),
                    })),
                    incoming_trades: prev.incoming_trades.map((t) => ({
                        ...t, delivery_remaining_seconds: Math.max(0, t.delivery_remaining_seconds - 1),
                    })),
                };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const totalToSend = Object.values(payload).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
    const merchantsNeeded = status && totalToSend > 0 ? Math.max(1, Math.ceil(totalToSend / status.merchant_capacity)) : 0;
    const notEnoughMerchants = status && totalToSend > 0 && merchantsNeeded > status.available_merchants;

    const handleSend = async (e) => {
        e.preventDefault();
        if (!activeVillageId) {
            setAlertMsg({ tone: 'error', text: 'دهکده فعال هنوز مشخص نشده، لطفا لحظاتی صبر کنید.' });
            return;
        }
        if (totalToSend <= 0) {
            setAlertMsg({ tone: 'error', text: 'حداقل یک نوع منبع را برای ارسال مشخص کنید.' });
            return;
        }
        setLoading(true);
        try {
            const response = await api.post('game/marketplace/send/', {
                source_village_id: activeVillageId, target_village_id: targetVillageId, resources: payload,
            });
            setAlertMsg({ tone: 'success', text: response.data.message });
            setPayload({ wood: 0, clay: 0, iron: 0, crop: 0 });
            fetchStatus();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در ارسال منابع' });
        } finally {
            setLoading(false);
        }
    };

    const [npcLoading, setNpcLoading] = useState(false);

    const handleNpcTrade = async () => {
        if (!activeVillageId) return;
        setNpcLoading(true);
        try {
            const { data } = await api.post('game/npc-trade/', { village_id: activeVillageId });
            setAlertMsg({ tone: 'success', text: data.message });
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تاجر NPC' });
        } finally {
            setNpcLoading(false);
        }
    };

    return (
        <PageShell maxWidth="max-w-lg">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="بازارچه" />

            <div className="panel">
                <div className="panel-header"><span className="panel-title">⚖️ بازارچه</span></div>
                <div className="panel-body">
                    {!statusLoading && status && (
                        <div className="badge-gold text-sm w-full justify-center py-2 mb-5">
                            🐪 تاجر آزاد: {status.available_merchants} از {status.total_merchants} (ظرفیت هر تاجر: {status.merchant_capacity})
                        </div>
                    )}

                    <form onSubmit={handleSend} className="space-y-4">
                        <div>
                            <label className="field-label">شناسه دهکده مقصد</label>
                            <input type="number" required className="field" value={targetVillageId} onChange={(e) => setTargetVillageId(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-3 bg-parchment-100 p-4 rounded-xl border border-parchment-300">
                            {Object.entries(RESOURCE_META).map(([res, meta]) => (
                                <div key={res}>
                                    <label className="field-label">{meta.icon} {meta.label}</label>
                                    <input
                                        type="number" min="0" max={resources[res]}
                                        className="field text-center"
                                        value={payload[res]}
                                        onChange={(e) => setPayload({ ...payload, [res]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>

                        {totalToSend > 0 && (
                            <p className={`text-xs font-bold text-center ${notEnoughMerchants ? 'text-rose-600' : 'text-brand-700'}`}>
                                این محموله به {merchantsNeeded} تاجر نیاز دارد.
                                {notEnoughMerchants && ' تاجر کافی در دسترس نیست!'}
                            </p>
                        )}

                        <button type="submit" disabled={loading || !activeVillageId || notEnoughMerchants} className="btn-gold w-full py-3">
                            {loading ? 'در حال اعزام تاجران...' : 'ارسال تجار 🐪'}
                        </button>
                    </form>
                    <div className="mt-4 pt-4 border-t border-parchment-300 text-center">
                        <p className="text-xs text-ink-500 mb-2">تاجر NPC: منابع این دهکده را با طلا به مقادیر مساوی تبدیل می‌کند (هر ۱ ساعت یک‌بار).</p>
                        <button onClick={handleNpcTrade} disabled={npcLoading} className="btn-gold text-xs !px-4 !py-2">
                            {npcLoading ? '...' : '💱 استفاده از تاجر NPC'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="panel">
                <div className="panel-header"><span className="panel-title">🚚 محموله‌های ارسالی</span></div>
                <div className="panel-body">
                    {!status || status.outgoing_trades.length === 0 ? (
                        <EmptyState icon="📦" title="هیچ محموله‌ی در حال ارسالی ندارید." />
                    ) : (
                        <div className="space-y-2">
                            {status.outgoing_trades.map((t) => (
                                <div key={t.id} className="border border-parchment-300 rounded-xl p-3 bg-parchment-50 text-sm">
                                    <div className="flex justify-between font-bold text-ink-800">
                                        <span>مقصد: {t.target_name}</span>
                                        <span className="font-mono" dir="ltr">
                                            {t.is_delivered ? <span className="text-brand-700">✅ تحویل شد</span> : formatDuration(t.delivery_remaining_seconds)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-500 mt-1">
                                        🪵{t.resources.wood} 🧱{t.resources.clay} ⚒️{t.resources.iron} 🌾{t.resources.crop} | {t.merchants_used} تاجر
                                    </p>
                                    {t.is_delivered && (
                                        <p className="text-xs text-blue-600 mt-1">بازگشت تاجرها: {formatDuration(t.merchants_return_remaining_seconds)}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="panel">
                <div className="panel-header"><span className="panel-title">📥 محموله‌های در راه به سمت شما</span></div>
                <div className="panel-body">
                    {!status || status.incoming_trades.length === 0 ? (
                        <EmptyState icon="📭" title="هیچ محموله‌ای در راه دهکده شما نیست." />
                    ) : (
                        <div className="space-y-2">
                            {status.incoming_trades.map((t) => (
                                <div key={t.id} className="border border-brand-300 rounded-xl p-3 bg-brand-50 text-sm">
                                    <div className="flex justify-between font-bold text-brand-800">
                                        <span>از: {t.source_name}</span>
                                        <span className="font-mono" dir="ltr">{formatDuration(t.delivery_remaining_seconds)}</span>
                                    </div>
                                    <p className="text-xs text-ink-500 mt-1">
                                        🪵{t.resources.wood} 🧱{t.resources.clay} ⚒️{t.resources.iron} 🌾{t.resources.crop}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}