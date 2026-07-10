import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';

export default function Statistics() {
    const [stats, setStats] = useState({ general_ranking: [], world_wonder: [] });
    const [farms, setFarms] = useState([]);
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [farmsLoading, setFarmsLoading] = useState(true);
    const [farmsFetched, setFarmsFetched] = useState(false);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await api.get('game/leaderboard/');
                setStats(response.data);
            } catch (error) {
                console.error("خطا در دریافت رتبه‌بندی:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    // دهکده‌های فارم فقط وقتی برای اولین بار به این تب رفته می‌شود گرفته می‌شود
    useEffect(() => {
        if (activeTab !== 'farms' || farmsFetched) return;

        const fetchFarms = async () => {
            setFarmsLoading(true);
            try {
                const response = await api.get('game/farm-villages/');
                setFarms(response.data);
            } catch (error) {
                console.error("خطا در دریافت دهکده‌های فارم:", error);
            } finally {
                setFarmsLoading(false);
                setFarmsFetched(true);
            }
        };
        fetchFarms();
    }, [activeTab, farmsFetched]);

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-300 max-w-4xl w-full">
                <div className="flex gap-4 mb-6 border-b-2 border-gray-200 pb-2 flex-wrap">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`text-lg font-bold px-4 py-2 rounded-t-lg transition ${activeTab === 'general' ? 'bg-travian-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        🏆 رتبه‌بندی بازیکنان
                    </button>
                    <button
                        onClick={() => setActiveTab('ww')}
                        className={`text-lg font-bold px-4 py-2 rounded-t-lg transition ${activeTab === 'ww' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        🏛️ مسابقه شگفتی جهان
                    </button>
                    <button
                        onClick={() => setActiveTab('farms')}
                        className={`text-lg font-bold px-4 py-2 rounded-t-lg transition ${activeTab === 'farms' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        🌾 دهکده‌های فارم
                    </button>
                </div>

                {activeTab === 'general' && (
                    loading ? (
                        <p className="text-center font-bold text-gray-500 py-10">در حال پردازش اطلاعات سرور...</p>
                    ) : (
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-700">
                                    <th className="p-3 border">رتبه</th>
                                    <th className="p-3 border">بازیکن</th>
                                    <th className="p-3 border">اتحاد</th>
                                    <th className="p-3 border">جمعیت</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.general_ranking.map((row) => (
                                    <tr key={row.rank} className="hover:bg-gray-50 transition">
                                        <td className="p-3 border font-bold text-gray-600">{row.rank}</td>
                                        <td className="p-3 border font-semibold">{row.player}</td>
                                        <td className="p-3 border text-sm text-gray-500">{row.alliance}</td>
                                        <td className="p-3 border font-bold text-blue-700">{row.population}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}

                {activeTab === 'ww' && (
                    loading ? (
                        <p className="text-center font-bold text-gray-500 py-10">در حال پردازش اطلاعات سرور...</p>
                    ) : (
                        <table className="w-full text-center border-collapse border-amber-200 border-2">
                            <thead>
                                <tr className="bg-amber-100 text-amber-900">
                                    <th className="p-3 border border-amber-200">رتبه</th>
                                    <th className="p-3 border border-amber-200">مالک دهکده ناتار</th>
                                    <th className="p-3 border border-amber-200">سطح شگفتی جهان</th>
                                    <th className="p-3 border border-amber-200">وضعیت حملات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.world_wonder.map((row) => (
                                    <tr key={row.rank} className="hover:bg-amber-50 transition">
                                        <td className="p-3 border border-amber-200 font-bold">{row.rank}</td>
                                        <td className="p-3 border border-amber-200 font-semibold">{row.player}</td>
                                        <td className="p-3 border border-amber-200 font-bold text-amber-700 text-lg">{row.ww_level}</td>
                                        <td className="p-3 border border-amber-200 text-sm font-bold text-red-600">{row.natar_attacks}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}

                {activeTab === 'farms' && (
                    farmsLoading ? (
                        <p className="text-center font-bold text-gray-500 py-10">در حال دریافت دهکده‌های فارم...</p>
                    ) : farms.length === 0 ? (
                        <p className="text-center text-gray-500 py-10">هیچ دهکده فارمی روی این سرور وجود ندارد.</p>
                    ) : (
                        <>
                            <p className="text-xs text-gray-500 text-center mb-4">
                                این دهکده‌ها متعلق به NPC هستند و منابع نامحدود دارند؛ می‌توانید مستقیم از اینجا مختصات آن‌ها
                                را بردارید و در «لیست مزرعه» برای غارت خودکار ثبت کنید.
                            </p>
                            <table className="w-full text-center border-collapse border-green-200 border-2">
                                <thead>
                                    <tr className="bg-green-100 text-green-900">
                                        <th className="p-3 border border-green-200">نام دهکده فارم</th>
                                        <th className="p-3 border border-green-200">مختصات</th>
                                        <th className="p-3 border border-green-200">تولید ساعتی (هر منبع)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {farms.map((f) => (
                                        <tr key={f.id} className="hover:bg-green-50 transition">
                                            <td className="p-3 border border-green-200 font-semibold">🌾 {f.name}</td>
                                            <td className="p-3 border border-green-200 text-sm text-gray-500" dir="ltr">
                                                ({f.x_coord}|{f.y_coord})
                                            </td>
                                            <td className="p-3 border border-green-200 font-bold text-green-700">
                                                {typeof f.production_per_hour === 'number'
                                                    ? f.production_per_hour.toLocaleString()
                                                    : f.production_per_hour}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )
                )}
            </div>
        </div>
    );
}