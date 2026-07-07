import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import {formatDuration} from "../utils/formatter.js";

export default function Marketplace() {
    const { resources } = useGameStore();
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const [targetVillageId, setTargetVillageId] = useState('');
    const [payload, setPayload] = useState({ wood: 0, clay: 0, iron: 0, crop: 0 });
    const [loading, setLoading] = useState(false);

    const [status, setStatus] = useState(null);
    const [statusLoading, setStatusLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/marketplace/send/', { params: { village_id: activeVillageId } });
            setStatus(data);
        } catch (error) {
            console.error('خطا در دریافت وضعیت بازارچه', error);
        } finally {
            setStatusLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => {
        setStatusLoading(true);
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        if (lastMessage?.type === 'TRADE_DELIVERED') fetchStatus();
    }, [lastMessage, fetchStatus]);

    useEffect(() => {
        const interval = setInterval(fetchStatus, 15000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // شمارش معکوس محلی هر ثانیه
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
                        ...t,
                        delivery_remaining_seconds: Math.max(0, t.delivery_remaining_seconds - 1),
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
            alert('دهکده فعال هنوز مشخص نشده، لطفا لحظاتی صبر کنید و دوباره تلاش کنید.');
            return;
        }
        if (totalToSend <= 0) {
            alert('حداقل یک نوع منبع را برای ارسال مشخص کنید.');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('game/marketplace/send/', {
                source_village_id: activeVillageId,
                target_village_id: targetVillageId,
                resources: payload,
            });
            alert(response.data.message);
            setPayload({ wood: 0, clay: 0, iron: 0, crop: 0 });
            fetchStatus();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در ارسال منابع');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen bg-stone-100 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-md w-full space-y-6">
                <div className="bg-white p-8 rounded-lg shadow-xl border-t-4 border-travian-gold w-full">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">⚖️ بازارچه</h2>

                    {!statusLoading && status && (
                        <p className="text-center text-sm font-bold text-gray-600 mb-6">
                            🐪 تاجر آزاد: {status.available_merchants} از {status.total_merchants}
                            {' '}(ظرفیت هر تاجر: {status.merchant_capacity})
                        </p>
                    )}

                    <form onSubmit={handleSend} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">شناسه دهکده مقصد:</label>
                            <input
                                type="number" required
                                className="w-full p-2 border rounded focus:border-travian-gold outline-none"
                                value={targetVillageId} onChange={(e) => setTargetVillageId(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                            {['wood', 'clay', 'iron', 'crop'].map((res) => (
                                <div key={res}>
                                    <label className="block text-xs font-bold text-gray-600 mb-1 capitalize">
                                        {res === 'wood' ? '🪵 چوب' : res === 'clay' ? '🧱 خشت' : res === 'iron' ? '⚒️ آهن' : '🌾 گندم'}:
                                    </label>
                                    <input
                                        type="number" min="0" max={resources[res]}
                                        className="w-full p-1 border rounded text-center"
                                        value={payload[res]}
                                        onChange={(e) => setPayload({ ...payload, [res]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>

                        {totalToSend > 0 && (
                            <p className={`text-xs font-bold text-center ${notEnoughMerchants ? 'text-red-600' : 'text-green-700'}`}>
                                این محموله به {merchantsNeeded} تاجر نیاز دارد.
                                {notEnoughMerchants && ' تاجر کافی در دسترس نیست!'}
                            </p>
                        )}

                        <button
                            type="submit" disabled={loading || !activeVillageId || notEnoughMerchants}
                            className="w-full bg-amber-600 text-white p-3 rounded font-bold hover:bg-amber-700 transition disabled:bg-gray-400"
                        >
                            {loading ? 'در حال اعزام تاجران...' : 'ارسال تجار 🐪'}
                        </button>
                    </form>
                </div>

                {/* محموله‌های ارسالی */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300">
                    <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">🚚 محموله‌های ارسالی</h3>
                    {!status || status.outgoing_trades.length === 0 ? (
                        <p className="text-sm text-gray-500">هیچ محموله‌ی در حال ارسالی ندارید.</p>
                    ) : (
                        <div className="space-y-2">
                            {status.outgoing_trades.map((t) => (
                                <div key={t.id} className="border rounded p-2 bg-stone-50 text-sm">
                                    <div className="flex justify-between font-bold">
                                        <span>مقصد: {t.target_name}</span>
                                        <span className="font-mono" dir="ltr">
                                            {t.is_delivered ? '✅ تحویل شد' : formatDuration(t.delivery_remaining_seconds)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        🪵{t.resources.wood} 🧱{t.resources.clay} ⚒️{t.resources.iron} 🌾{t.resources.crop}
                                        {' '}| {t.merchants_used} تاجر
                                    </p>
                                    {t.is_delivered && (
                                        <p className="text-xs text-blue-600 mt-1">
                                            بازگشت تاجرها: {formatDuration(t.merchants_return_remaining_seconds)}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* محموله‌های در راه ورودی */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300">
                    <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">📥 محموله‌های در راه به سمت شما</h3>
                    {!status || status.incoming_trades.length === 0 ? (
                        <p className="text-sm text-gray-500">هیچ محموله‌ای در راه دهکده شما نیست.</p>
                    ) : (
                        <div className="space-y-2">
                            {status.incoming_trades.map((t) => (
                                <div key={t.id} className="border rounded p-2 bg-green-50 text-sm">
                                    <div className="flex justify-between font-bold text-green-800">
                                        <span>از: {t.source_name}</span>
                                        <span className="font-mono" dir="ltr">{formatDuration(t.delivery_remaining_seconds)}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        🪵{t.resources.wood} 🧱{t.resources.clay} ⚒️{t.resources.iron} 🌾{t.resources.crop}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}