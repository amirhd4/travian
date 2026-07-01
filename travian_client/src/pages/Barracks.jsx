import { useState } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import useGameStore from '../store/useGameStore';

export default function Barracks() {
    const { resources, updateResources } = useGameStore();
    const [loading, setLoading] = useState(false);

    // استیت برای نگهداری مقادیر ورودی هر نیروی نظامی
    const [trainQueue, setTrainQueue] = useState({
        '1': 0, // گرزدار
        '2': 0  // نیزه‌دار
    });

    // دیتای ثابت نیروها (برای نمایش هزینه‌ها)
    const unitData = [
        { id: '1', name: '🚷 گرزدار', desc: 'نیروی هجومی ارزان و سریع برای غارت.', costs: { wood: 95, clay: 75, iron: 40, crop: 40 } },
        { id: '2', name: '🛡️ محافظ نیزه‌دار', desc: 'بهترین نیروی دفاعی در برابر سواره‌نظام.', costs: { wood: 145, clay: 70, iron: 85, crop: 40 } }
    ];

    const handleInputChange = (id, value) => {
        setTrainQueue(prev => ({ ...prev, [id]: Math.max(0, parseInt(value) || 0) }));
    };

    const calculateMaxPossible = (costs) => {
        return Math.floor(Math.min(
            resources.wood / costs.wood,
            resources.clay / costs.clay,
            resources.iron / costs.iron,
            resources.crop / costs.crop
        ));
    };

    const handleTrain = async (unitId, costs) => {
        const quantity = trainQueue[unitId];
        if (quantity <= 0) return;

        setLoading(true);
        try {
            const response = await api.post('combat/barracks/train/', {
                village_id: 1, // در پروژه نهایی از اطلاعات کاربر گرفته می‌شود
                troop_type: unitId,
                quantity: quantity
            });

            alert(response.data.message);

            // کسر منابع در فرانت‌اند برای آپدیت لحظه‌ای ظاهر بازی
            updateResources({
                wood: resources.wood - (costs.wood * quantity),
                clay: resources.clay - (costs.clay * quantity),
                iron: resources.iron - (costs.iron * quantity),
                crop: resources.crop - (costs.crop * quantity)
            });

            // صفر کردن فیلد ورودی بعد از موفقیت
            setTrainQueue(prev => ({ ...prev, [unitId]: 0 }));

        } catch (error) {
            alert("خطا: " + (error.response?.data?.error || "ارتباط با سرور برقرار نشد"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-amber-800 max-w-3xl w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">⚔️ پادگان (سطح ۵)</h2>
                <p className="text-gray-500 mb-6 text-sm">در اینجا می‌توانید پیاده‌نظام خود را آموزش دهید. هر چه سطح پادگان بالاتر باشد، نیروها سریع‌تر آماده می‌شوند.</p>

                <div className="space-y-6">
                    {unitData.map(unit => {
                        const maxUnits = calculateMaxPossible(unit.costs);

                        return (
                            <div key={unit.id} className="border border-gray-300 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center bg-stone-50">
                                {/* تصویر و نام */}
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-gray-800">{unit.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{unit.desc}</p>

                                    {/* هزینه‌ها */}
                                    <div className="flex gap-3 mt-3 text-xs font-bold text-gray-600">
                                        <span>🪵 {unit.costs.wood}</span>
                                        <span>🧱 {unit.costs.clay}</span>
                                        <span>⚒️ {unit.costs.iron}</span>
                                        <span>🌾 {unit.costs.crop}</span>
                                    </div>
                                </div>

                                {/* کنترل‌های آموزش */}
                                <div className="flex items-center gap-3 w-full md:w-auto bg-white p-3 rounded shadow-sm border">
                                    <div className="flex flex-col items-center">
                                        <input
                                            type="number" min="0" max={maxUnits}
                                            value={trainQueue[unit.id] || ''}
                                            onChange={(e) => handleInputChange(unit.id, e.target.value)}
                                            className="w-20 p-2 border border-gray-400 rounded text-center font-bold outline-none focus:border-amber-600"
                                            placeholder="تعداد"
                                        />
                                        <button
                                            onClick={() => handleInputChange(unit.id, maxUnits)}
                                            className="text-[10px] text-green-700 hover:underline mt-1 cursor-pointer font-bold"
                                        >
                                            (حداکثر: {maxUnits})
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleTrain(unit.id, unit.costs)}
                                        disabled={loading || trainQueue[unit.id] <= 0}
                                        className="bg-amber-700 text-white px-4 py-2 rounded font-bold hover:bg-amber-800 transition disabled:bg-gray-400 whitespace-nowrap"
                                    >
                                        آموزش 🔨
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}