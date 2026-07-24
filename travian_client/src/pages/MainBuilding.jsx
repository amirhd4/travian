import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

const RESOURCE_IMAGES = {
    wood: '/assets/ui/res-1.gif',
    clay: '/assets/ui/res-2.gif',
    iron: '/assets/ui/res-3.gif',
    crop: '/assets/ui/res-4.gif',
};

export default function MainBuilding() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const [data, setData] = useState({
        main_building_level: 0, speed_bonus_percent: 0,
        can_demolish: false, demolish_level_req: 10, demolishable_buildings: [],
    });
    const [loading, setLoading] = useState(true);
    const [selectedPosition, setSelectedPosition] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/main-building/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در بارگذاری اطلاعات' });
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    const handleDemolish = async () => {
        if (!selectedPosition) return;
        setSubmitting(true);
        try {
            const response = await api.post('game/main-building/', {
                village_id: activeVillageId,
                position: parseInt(selectedPosition),
            });
            setAlertMsg({ tone: 'success', text: response.data.message });
            setSelectedPosition('');
            fetchData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تخریب ساختمان' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری ساختمان اصلی...</p></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="ساختمان اصلی" />

            <WoodSign title="ساختمان اصلی" icon="🏗️">
                <p className="text-center text-xs text-ink-600 mb-4 leading-relaxed">
                    مهندسان و معماران در ساختمان اصلی گرد هم می‌آیند. سطح بالاتر = ساخت سریع‌تر.<br />
                    سطح فعلی: <span className="font-bold text-ink-800">{data.main_building_level}</span> ·
                    سرعت ساخت: <span className="font-bold text-green-700">+{data.speed_bonus_percent}%</span>
                </p>

                {/* Speed Bonus Visual */}
                <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-ink-600">سرعت ساخت و ساز</span>
                        <span className="text-sm font-bold text-green-700">+{data.speed_bonus_percent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div className="h-3 rounded-full bg-green-500 transition-all" style={{ width: `${Math.min(100, data.speed_bonus_percent / 2)}%` }} />
                    </div>
                    <p className="text-[10px] text-ink-400 mt-1 text-center">هر سطح = ۲٪ سرعت بیشتر (حداکثر ۴۰٪ در سطح ۲۰)</p>
                </div>

                {/* Demolish Section */}
                <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-bold text-ink-800 mb-3">🗑️ تخریب ساختمان</h3>

                    {!data.can_demolish ? (
                        <p className="text-xs text-ink-500 text-center py-4">
                            برای تخریب ساختمان‌ها به ساختمان اصلی سطح {data.demolish_level_req} نیاز دارید.<br />
                            (سطح فعلی: {data.main_building_level})
                        </p>
                    ) : (
                        <>
                            <p className="text-xs text-ink-500 mb-3">
                                ساختمان انتخاب شده ۱ سطح کاهش می‌یابد و ۵۰٪ منابع ساخت بازگردانده می‌شود.
                            </p>

                            {data.demolishable_buildings.length === 0 ? (
                                <p className="text-xs text-ink-400 text-center py-4">هیچ ساختمانی برای تخریب وجود ندارد.</p>
                            ) : (
                                <>
                                    <select
                                        value={selectedPosition}
                                        onChange={(e) => setSelectedPosition(e.target.value)}
                                        className="field w-full mb-3 text-xs"
                                    >
                                        <option value="">-- انتخاب ساختمان --</option>
                                        {data.demolishable_buildings.map((b) => (
                                            <option key={b.position} value={b.position}>
                                                {b.name} (سطح {b.level}) - موقعیت {b.position}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedPosition && (() => {
                                        const b = data.demolishable_buildings.find((x) => x.position === parseInt(selectedPosition));
                                        if (!b) return null;
                                        return (
                                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mb-3">
                                                <p className="text-xs font-bold text-amber-800 mb-2">بازگشت منابع:</p>
                                                <div className="flex gap-3 text-[10px] font-bold">
                                                    {Object.entries(b.refund).map(([res, amount]) => (
                                                        <span key={res}>
                                                            <img src={RESOURCE_IMAGES[res]} alt="" className="inline w-3 h-3 mr-0.5" style={{ verticalAlign: 'middle' }} />
                                                            +{amount.toLocaleString()}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-amber-600 mt-2">
                                                    سطح {b.level} → {b.level - 1 > 0 ? b.level - 1 : 'حذف'}
                                                </p>
                                            </div>
                                        );
                                    })()}

                                    <button
                                        onClick={handleDemolish}
                                        disabled={!selectedPosition || submitting}
                                        className={`w-full py-2 rounded-lg font-bold text-sm transition ${
                                            !selectedPosition || submitting
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                                        }`}
                                    >
                                        {submitting ? '...' : '🗑️ تخریب ساختمان'}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </WoodSign>
        </PageShell>
    );
}
