import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import { getUnitImage } from '../constants/images';

function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (d > 0) return `${d}روز ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

const RESOURCE_IMAGES = {
    wood: '/assets/ui/res-1.gif',
    clay: '/assets/ui/res-2.gif',
    iron: '/assets/ui/res-3.gif',
    crop: '/assets/ui/res-4.gif',
};

const TABS = [
    { key: 'training', label: 'آموزش', icon: '⚔️' },
    { key: 'culture', label: 'امتیازات فرهنگی', icon: '📜' },
    { key: 'loyalty', label: 'وفاداری', icon: '🛡️' },
    { key: 'expansion', label: 'گسترش', icon: '🗺️' },
    { key: 'capital', label: 'تغییر پایتخت', icon: '👑' },
];

const CAPITAL_COST = { wood: 5000, clay: 5000, iron: 5000, crop: 5000 };

export default function Palace() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { resources } = useGameStore();
    const villages = useGameStore((state) => state.villages);

    const [data, setData] = useState({
        building_level: 0, building_name: null, is_capital: false,
        trainable: [], queue: [], culture_points: { current: 0, village_production: 0 },
        loyalty: 100, expansion: { captured_villages: [], settlers_available: 0, settlers_required: 3 },
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('training');
    const [submitting, setSubmitting] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);
    const [trainQty, setTrainQty] = useState({});
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/residence/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در بارگذاری اطلاعات' });
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    const handleTrain = async (troopTypeId) => {
        const qty = trainQty[troopTypeId] || 0;
        if (qty <= 0) return;
        setSubmitting(troopTypeId);
        try {
            const response = await api.post('game/residence/', {
                village_id: activeVillageId,
                troop_type_id: troopTypeId,
                quantity: qty,
            });
            setAlertMsg({ tone: 'success', text: response.data.message });
            setTrainQty((prev) => ({ ...prev, [troopTypeId]: 0 }));
            fetchData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در آموزش' });
        } finally {
            setSubmitting(null);
        }
    };

    const handleChangeCapital = async () => {
        setSubmitting('capital');
        try {
            const response = await api.post('game/villages/move-capital/', {
                new_village_id: activeVillageId,
            });
            setAlertMsg({ tone: 'success', text: response.data.message });
            fetchData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تغییر پایتخت' });
        } finally {
            setSubmitting(null);
        }
    };

    const canAfford = (cost, qty = 1) => {
        return resources.wood >= (cost.wood || 0) * qty &&
               resources.clay >= (cost.clay || 0) * qty &&
               resources.iron >= (cost.iron || 0) * qty &&
               resources.crop >= (cost.crop || 0) * qty;
    };

    const canAffordCapital = canAfford(CAPITAL_COST);

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری قصر...</p></PageShell>;

    const renderTrainingTab = () => {
        if (data.is_capital) {
            return <p className="text-center text-sm text-amber-700 py-6">این دهکده پایتخت شماست. آموزش مهاجر/چیف امکان‌پذیر نیست.</p>;
        }
        if (data.building_level < 10) {
            return <p className="text-center text-sm text-ink-500 py-6">برای یافتن دهکده جدید به سطح ۱۰ قصر نیاز دارید.</p>;
        }
        return (
            <div className="space-y-3">
                {data.trainable.map((t) => {
                    const qty = trainQty[t.troop_type_id] || 0;
                    const maxUnits = Math.floor(Math.min(
                        resources.wood / (t.cost.wood || 1),
                        resources.clay / (t.cost.clay || 1),
                        resources.iron / (t.cost.iron || 1),
                        resources.crop / (t.cost.crop || 1),
                    ));
                    return (
                        <div key={t.troop_type_id} className="flex items-center gap-4 rounded-xl p-3 bg-white/80 border border-parchment-300">
                            <img src={getUnitImage(t.troop_type_id)} alt={t.name}
                                className="w-14 h-14 object-contain rounded-lg border border-parchment-300 bg-parchment-100 flex-shrink-0"
                                onError={(e) => { e.target.style.display = 'none'; }} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-ink-800">{t.name}</p>
                                    {t.is_settler && <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-bold">مهاجر</span>}
                                    {t.is_chief && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">چیف</span>}
                                </div>
                                <p className="text-xs text-ink-500">موجود: {t.count_in_village}</p>
                                <div className="flex gap-2 text-[10px] font-bold mt-1">
                                    {Object.entries(t.cost).map(([res, amount]) => (
                                        <span key={res}>
                                            <img src={RESOURCE_IMAGES[res]} alt="" className="inline w-3 h-3 mr-0.5" style={{ verticalAlign: 'middle' }} />
                                            {amount.toLocaleString()}
                                        </span>
                                    ))}
                                    <span className="text-ink-400">⏱ {formatDuration(t.train_time_seconds)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <input type="number" min="0" max={maxUnits} value={qty || ''}
                                    onChange={(e) => setTrainQty((prev) => ({ ...prev, [t.troop_type_id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                    className="field w-16 text-center text-xs" placeholder="تعداد" />
                                <button onClick={() => handleTrain(t.troop_type_id)}
                                    disabled={submitting === t.troop_type_id || qty <= 0 || !canAfford(t.cost, qty)}
                                    className={`text-xs px-3 py-2 rounded-lg font-bold ${
                                        submitting === t.troop_type_id || qty <= 0 || !canAfford(t.cost, qty)
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer'
                                    }`}>
                                    {submitting === t.troop_type_id ? '...' : 'آموزش'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderCapitalTab = () => (
        <div className="space-y-4">
            {data.is_capital ? (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-300 text-center">
                    <p className="text-sm font-bold text-amber-800">⭐ این دهکده پایتخت شماست</p>
                    <p className="text-xs text-amber-600 mt-1">برای تغییر پایتخت، ابتدا باید قصر را در دهکده مقصد بسازید.</p>
                </div>
            ) : (
                <>
                    <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300">
                        <p className="text-sm font-bold text-ink-800 mb-2">تغییر پایتخت</p>
                        <p className="text-xs text-ink-500 mb-3">
                            پایتخت خود را به این دهکده منتقل کنید. توجه: منابع ساختمان‌های منابع پایتخت قدیمی به سطح ۱۰ کاهش می‌یابد.
                        </p>
                        <div className="text-xs font-bold mb-3">
                            <span className="text-ink-500">هزینه: </span>
                            {Object.entries(CAPITAL_COST).map(([res, amount]) => (
                                <span key={res} className={resources[res] >= amount ? 'text-ink-700' : 'text-red-500'}>
                                    <img src={RESOURCE_IMAGES[res]} alt="" className="inline w-3 h-3 mr-0.5" style={{ verticalAlign: 'middle' }} />
                                    {amount.toLocaleString()}
                                </span>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleChangeCapital}
                        disabled={submitting === 'capital' || !canAffordCapital}
                        className={`w-full py-2 rounded-lg font-bold text-sm transition ${
                            submitting === 'capital' || !canAffordCapital
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                        }`}>
                        {submitting === 'capital' ? '...' : !canAffordCapital ? 'منابع کافی نیست' : '👑 تغییر پایتخت به این دهکده'}
                    </button>
                </>
            )}
        </div>
    );

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="قصر" />

            <WoodSign title="قصر" icon="👑">
                <p className="text-center text-xs text-ink-600 mb-3">
                    سطح: <span className="font-bold text-ink-800">{data.building_level}</span>
                    {data.is_capital && <span className="mr-2 text-amber-600 font-bold">⭐ پایتخت</span>}
                </p>

                <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
                    {TABS.map((tab) => (
                        <button key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-shrink-0 py-2 px-3 text-xs font-bold transition ${
                                activeTab === tab.key
                                    ? 'text-amber-700 border-b-2 border-amber-600'
                                    : 'text-ink-400 hover:text-ink-600'
                            }`}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'training' && renderTrainingTab()}
                {activeTab === 'culture' && (
                    <div className="space-y-4">
                        <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300">
                            <p className="text-sm font-bold text-ink-800 mb-2">📊 آمار امتیاز فرهنگی</p>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between"><span className="text-ink-500">امتیاز فرهنگی فعلی:</span><span className="font-bold text-ink-800">{data.culture_points.current?.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-ink-500">تولید این دهکده:</span><span className="font-bold text-ink-800">+{data.culture_points.village_production}/ساعت</span></div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'loyalty' && (
                    <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300 text-center">
                        <p className="text-sm font-bold text-ink-800 mb-2">🛡️ وفاداری دهکده</p>
                        <div className="text-3xl font-bold my-3" style={{ color: data.loyalty >= 70 ? '#228B22' : data.loyalty >= 40 ? '#F88C1F' : '#DE0000' }}>
                            {data.loyalty}%
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                            <div className="h-3 rounded-full transition-all" style={{ width: `${data.loyalty}%`, backgroundColor: data.loyalty >= 70 ? '#228B22' : data.loyalty >= 40 ? '#F88C1F' : '#DE0000' }} />
                        </div>
                    </div>
                )}
                {activeTab === 'expansion' && (
                    <div className="space-y-4">
                        <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300">
                            <p className="text-xs text-ink-500 mb-3">
                                مهاجران: {data.expansion.settlers_available}/{data.expansion.settlers_required} برای تأسیس دهکده جدید
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="h-2 rounded-full bg-teal-500" style={{ width: `${Math.min(100, (data.expansion.settlers_available / data.expansion.settlers_required) * 100)}%` }} />
                            </div>
                        </div>
                        {data.expansion.captured_villages.length > 0 ? (
                            <div className="space-y-2">
                                {data.expansion.captured_villages.map((v) => (
                                    <div key={v.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-parchment-300">
                                        <div>
                                            <p className="font-bold text-sm text-ink-800">{v.name}</p>
                                            <p className="text-xs text-ink-500">({v.y_coord}|{v.x_coord})</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-xs text-ink-400 py-4">دهکده تسخیر شده‌ای وجود ندارد.</p>
                        )}
                    </div>
                )}
                {activeTab === 'capital' && renderCapitalTab()}
            </WoodSign>
        </PageShell>
    );
}
