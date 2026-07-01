import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';

export default function Statistics() {
    const [stats, setStats] = useState({ general_ranking: [], world_wonder: [] });
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-300 max-w-4xl w-full">
                <div className="flex gap-4 mb-6 border-b-2 border-gray-200 pb-2">
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
                </div>

                {loading ? (
                    <p className="text-center font-bold text-gray-500 py-10">در حال پردازش اطلاعات سرور...</p>
                ) : activeTab === 'general' ? (
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
                )}
            </div>
        </div>
    );
}