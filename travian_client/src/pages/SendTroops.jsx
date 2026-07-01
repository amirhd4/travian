import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import ResourceBar from '../components/ResourceBar';
import Navbar from '../components/Navbar';

export default function SendTroops() {
    const location = useLocation();
    const navigate = useNavigate();

    // دریافت اطلاعات دهکده مقصد از طریق ناوبری نقشه
    const targetVillageId = location.state?.targetVillageId || 0;
    const targetName = location.state?.targetName || "مختصات نامشخص";

    const [troops, setTroops] = useState({
        1: 0, // شناسه نیروی ۱ (مثلا گرزدار)
        2: 0  // شناسه نیروی ۲ (مثلا مدافع)
    });
    const [movementType, setMovementType] = useState('ATTACK');
    const [loading, setLoading] = useState(false);

    const handleInputChange = (id, value) => {
        setTroops(prev => ({ ...prev, [id]: Math.max(0, parseInt(value) || 0) }));
    };

    const handleSend = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.post('combat/send-troops/', {
                source_village_id: 1, // در پروژه اصلی از اطلاعات دهکده فعال کاربر پر می‌شود
                target_village_id: targetVillageId,
                movement_type: movementType,
                troops_payload: troops
            });

            alert(response.data.message);
            navigate('/village');
        } catch (error) {
            alert("خطا: " + (error.response?.data?.error || "ارتباط با سرور برقرار نشد"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-screen bg-stone-100 pt-28 flex flex-col items-center">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-8 rounded-lg shadow-xl border border-gray-300 max-w-md w-full">
                <h2 className="text-xl font-bold text-gray-800 mb-2 border-b pb-2">⚔️ نقطه گردهمایی نظامی</h2>
                <p className="text-sm text-gray-600 mb-6">هدف حمله: <span className="font-bold text-red-600">{targetName}</span></p>

                <form onSubmit={handleSend} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">نوع عملیات تاکتیکی:</label>
                        <select
                            value={movementType}
                            onChange={(e) => setMovementType(e.target.value)}
                            className="w-full p-2 border rounded bg-gray-50 focus:border-amber-600 outline-none font-semibold"
                        >
                            <option value="ATTACK">🪓 حمله کامل (جنگ تا سر حد مرگ)</option>
                            <option value="RAID">💰 غارت منابع (تک و پاتک سریع)</option>
                            <option value="REINFORCEMENT">🛡️ پشتیبانی نظامی (دفاع از هم‌پیمان)</option>
                        </select>
                    </div>

                    <div className="border p-4 rounded bg-gray-50 space-y-3">
                        <h3 className="text-sm font-bold text-gray-600 mb-1">انتخاب تعداد نیروهای اعزامی:</h3>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">🚷 سرباز گرزدار (نوع ۱):</span>
                            <input
                                type="number"
                                value={troops[1]}
                                onChange={(e) => handleInputChange(1, e.target.value)}
                                className="w-24 p-1 border rounded text-center font-bold"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">🛡️ محافظ نیزه‌دار (نوع ۲):</span>
                            <input
                                type="number"
                                value={troops[2]}
                                onChange={(e) => handleInputChange(2, e.target.value)}
                                className="w-24 p-1 border rounded text-center font-bold"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-red-700 text-white p-3 rounded font-bold hover:bg-red-800 transition disabled:bg-gray-400"
                    >
                        {loading ? "در حال اعزام ارتش..." : "🚀 تایید و حرکت نیروها"}
                    </button>
                </form>
            </div>
        </div>
    );
}