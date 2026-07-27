import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';
import VillageSearch from '../components/VillageSearch';

const MOVEMENT_OPTIONS = [
    { value: 'ATTACK', label: '🪓 حمله کامل', hint: 'تسخیر / نقشه ساخت', image: '/assets/ui/attack-symbol.gif' },
    { value: 'RAID', label: '💰 غارت منابع', hint: 'برداشت سریع منابع', image: '/assets/ui/gold-icon.gif' },
    { value: 'REINFORCEMENT', label: '🛡️ پشتیبانی نظامی', hint: 'تقویت دفاع متحد', image: '/assets/ui/status-def.gif' },
    { value: 'SCOUT', label: '🔍 شناسایی', hint: 'گزارش از دهکده هدف', image: '/assets/ui/cropfinder.gif' },
];

const CATAPULT_TARGETS = [
    { value: '', label: '🎲 تصادفی' },
    { value: 'ساختمان اصلی', label: 'ساختمان اصلی' },
    { value: 'انبار', label: 'انبار' },
    { value: 'سیلوی غله', label: 'سیلوی غله' },
    { value: 'پادگان', label: 'پادگان' },
    { value: 'اصطبل', label: 'اصطبل' },
    { value: 'کارگاه', label: 'کارگاه' },
    { value: 'آهنگری', label: 'آهنگری' },
    { value: 'آکادمی', label: 'آکادمی' },
    { value: 'بازارچه', label: 'بازارچه' },
    { value: 'سفارتخانه', label: 'سفارتخانه' },
    { value: 'خزانه‌داری', label: 'خزانه‌داری' },
    { value: 'اقامتگاه', label: 'اقامتگاه' },
    { value: 'قصر', label: 'قصر' },
    { value: 'تالار شهر', label: 'تالار شهر' },
    { value: 'مخفیگاه', label: 'مخفیگاه' },
    { value: 'آسیاب', label: 'آسیاب' },
    { value: 'کارگاه سنگ‌تراشی', label: 'کارگاه سنگ‌تراشی' },
    { value: 'عمارت قهرمان', label: 'عمارت قهرمان' },
    { value: 'محل گردهمایی', label: 'محل گردهمایی' },
];

export default function SendTroops() {
    const location = useLocation();
    const navigate = useNavigate();
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const targetVillageIdFromState = location.state?.targetVillageId || 0;
    const targetNameFromState = location.state?.targetName || "مختصات نامشخص";

    const [targetVillageId, setTargetVillageId] = useState(targetVillageIdFromState);
    const [targetName, setTargetName] = useState(targetNameFromState);

    const [availableTroops, setAvailableTroops] = useState([]);
    const [troops, setTroops] = useState({});
    const [movementType, setMovementType] = useState('ATTACK');
    const [scoutType, setScoutType] = useState('RESOURCES_AND_BUILDINGS');
    const [sendHero, setSendHero] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [heroStatus, setHeroStatus] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);
    const [catapultTarget, setCatapultTarget] = useState('');

    useEffect(() => {
        api.get('combat/hero/').then(({ data }) => setHeroStatus(data)).catch(() => {});
    }, []);

    const fetchTroops = useCallback(async () => {
        if (!activeVillageId) return;
        setFetching(true);
        try {
            const { data } = await api.get('combat/village-troops/', { params: { village_id: activeVillageId } });
            setAvailableTroops(data);
        } catch (error) {
            console.error(error);
        } finally {
            setFetching(false);
        }
    }, [activeVillageId]);

    useEffect(() => { fetchTroops(); }, [fetchTroops]);

    const handleInputChange = (id, value, max) => {
        const qty = Math.max(0, Math.min(max, parseInt(value) || 0));
        setTroops((prev) => ({ ...prev, [id]: qty }));
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!activeVillageId) {
            setAlertMsg({ tone: 'error', text: 'دهکده فعال هنوز مشخص نشده، لطفا لحظاتی صبر کنید.' });
            return;
        }
        const payload = Object.fromEntries(Object.entries(troops).filter(([, v]) => v > 0));
        if (Object.keys(payload).length === 0) {
            setAlertMsg({ tone: 'error', text: 'حداقل یک نوع نیرو انتخاب کنید.' });
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('combat/send-troops/', {
                source_village_id: activeVillageId,
                target_village_id: targetVillageId,
                movement_type: movementType,
                troops_payload: payload,
                send_hero: sendHero,
                catapult_target_building: movementType === 'ATTACK' ? catapultTarget : null,
                scout_type: movementType === 'SCOUT' ? scoutType : null,
            });
            navigate('/village', { state: { flash: response.data.message } });
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'ارتباط با سرور برقرار نشد' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageShell maxWidth="max-w-xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="اعزام نیرو" />

            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">⚔️ نقطه گردهمایی نظامی</span>
                </div>
                <div className="panel-body">
                    {targetVillageIdFromState ? (
                        <p className="text-sm text-ink-600 mb-6">
                            هدف حمله: <span className="font-bold text-rose-600">{targetName}</span>
                        </p>
                    ) : (
                        <div className="mb-6 p-4 bg-parchment-100 rounded-xl border border-parchment-300">
                            <h3 className="field-label mb-2">🎯 انتخاب دهکده هدف</h3>
                            <VillageSearch onVillageSelected={(v) => {
                                if (v) {
                                    setTargetVillageId(v.id);
                                    setTargetName(v.name);
                                } else {
                                    setTargetVillageId(0);
                                    setTargetName("مختصات نامشخص");
                                }
                            }} />
                        </div>
                    )}

                    <form onSubmit={handleSend} className="space-y-5">
                        <div>
                            <label className="field-label">نوع عملیات تاکتیکی</label>
                            <div className="grid grid-cols-2 gap-2">
                                {MOVEMENT_OPTIONS.map((opt) => (
                                    <button
                                        type="button" key={opt.value}
                                        onClick={() => setMovementType(opt.value)}
                                        className={`text-right p-3 rounded-xl border-2 transition ${movementType === opt.value ? 'border-gold-500 bg-gold-50' : 'border-parchment-300 bg-white hover:border-parchment-400'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {/*<img src={opt.image} alt="" className="w-5 h-5" onError={(e) => { e.target.style.display='none'; }} />*/}
                                            <span className="block font-bold text-sm text-ink-800">{opt.label}</span>
                                        </div>
                                        <span className="block text-[11px] text-ink-500">{opt.hint}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {movementType === 'SCOUT' && (
                            <div>
                                <label className="field-label">🔎 نوع شناسایی (جاسوسی)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setScoutType('RESOURCES_AND_BUILDINGS')}
                                        className={`text-center p-3 rounded-xl border-2 transition text-sm font-bold ${scoutType === 'RESOURCES_AND_BUILDINGS' ? 'border-gold-500 bg-gold-50 text-ink-800' : 'border-parchment-300 bg-white text-ink-600 hover:border-parchment-400'}`}
                                    >
                                        🌾 منابع و ساختمان‌ها
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setScoutType('TROOPS_AND_DEFENSE')}
                                        className={`text-center p-3 rounded-xl border-2 transition text-sm font-bold ${scoutType === 'TROOPS_AND_DEFENSE' ? 'border-gold-500 bg-gold-50 text-ink-800' : 'border-parchment-300 bg-white text-ink-600 hover:border-parchment-400'}`}
                                    >
                                        🛡️ نیروها و دفاع
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="rounded-xl border border-parchment-300 bg-parchment-50 p-4 space-y-3">
                            <h3 className="field-label">تعداد نیروهای اعزامی</h3>
                            {fetching ? (
                                <p className="text-xs text-ink-500">در حال بارگذاری نیروهای موجود...</p>
                            ) : availableTroops.length === 0 ? (
                                <p className="text-xs text-ink-500">این دهکده هیچ نیرویی ندارد.</p>
                            ) : (
                                availableTroops.map((t) => (
                                    <div key={t.troop_type_id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-parchment-200">
                                        <span className="text-sm font-medium text-ink-700">
                                            {t.name} <span className="text-xs text-ink-400">(موجود: {t.count})</span>
                                        </span>
                                        <input
                                            type="number" min="0" max={t.count}
                                            value={troops[t.troop_type_id] || ''}
                                            onChange={(e) => handleInputChange(t.troop_type_id, e.target.value, t.count)}
                                            className="field w-24 text-center font-bold"
                                        />
                                    </div>
                                ))
                            )}
                        </div>

                        {movementType === 'ATTACK' && (
                            <div>
                                <label className="field-label">🎯 هدف منجنیق (در صورت وجود منجنیق در نیروی اعزامی)</label>
                                <select value={catapultTarget} onChange={(e) => setCatapultTarget(e.target.value)} className="field">
                                    {CATAPULT_TARGETS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        )}

                        {(movementType === 'ATTACK' || movementType === 'RAID' || movementType === 'REINFORCEMENT') && (
                            heroStatus && !heroStatus.is_alive ? (
                                <p className="text-xs text-rose-700 font-bold bg-rose-50 border border-rose-300 rounded-xl p-3">
                                    ⚰️ قهرمان شما از پای درآمده و قادر به اعزام نیست.
                                </p>
                            ) : heroStatus && (heroStatus.is_on_adventure || heroStatus.is_away) ? (
                                <p className="text-xs text-orange-700 font-bold bg-orange-50 border border-orange-300 rounded-xl p-3">
                                    🚫 قهرمان شما هم‌اکنون در دسترس نیست.
                                </p>
                            ) : (
                                <label className="flex items-center gap-2 text-sm font-bold text-ink-700 bg-gold-50 border border-gold-300 rounded-xl p-3 cursor-pointer">
                                    <input type="checkbox" checked={sendHero} onChange={(e) => setSendHero(e.target.checked)} />
                                    🦸 اعزام قهرمان همراه این نیرو
                                </label>
                            )
                        )}

                        <button type="submit" disabled={loading || !activeVillageId} className="btn-danger w-full py-3">
                            {loading ? "در حال اعزام ارتش..." : "🚀 تایید و حرکت نیروها"}
                        </button>
                    </form>
                </div>
            </div>
        </PageShell>
    );
}