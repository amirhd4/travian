import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

const TABS = [
    { key: 'general', label: '🏆 رتبه‌بندی بازیکنان' },
    { key: 'ww', label: '🏛️ مسابقه شگفتی جهان' },
    { key: 'farms', label: '🌾 دهکده‌های فارم' },
];

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
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    useEffect(() => {
        if (activeTab !== 'farms' || farmsFetched) return;
        const fetchFarms = async () => {
            setFarmsLoading(true);
            try {
                const response = await api.get('game/farm-villages/');
                setFarms(response.data);
            } catch (error) {
                console.error(error);
            } finally {
                setFarmsLoading(false);
                setFarmsFetched(true);
            }
        };
        fetchFarms();
    }, [activeTab, farmsFetched]);

    return (
        <PageShell maxWidth="max-w-4xl">
            <div className="panel overflow-hidden">
                <div className="flex overflow-x-auto border-b border-parchment-300">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 min-w-[150px] py-3 text-sm font-bold transition whitespace-nowrap ${activeTab === tab.key ? 'bg-gold-500 text-ink-900' : 'bg-parchment-100 text-ink-600 hover:bg-parchment-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="panel-body">
                    {activeTab === 'general' && (
                        loading ? <LoadingState label="در حال پردازش اطلاعات سرور..." /> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-center border-collapse">
                                    <thead>
                                        <tr className="bg-parchment-100 text-ink-700 text-sm">
                                            <th className="p-3 rounded-r-lg">رتبه</th>
                                            <th className="p-3">بازیکن</th>
                                            <th className="p-3">اتحاد</th>
                                            <th className="p-3 rounded-l-lg">جمعیت</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.general_ranking.map((row, i) => (
                                            <tr key={row.rank} className={`transition hover:bg-parchment-50 ${i < 3 ? 'bg-gold-50/60' : ''}`}>
                                                <td className="p-3 font-bold text-ink-600 border-b border-parchment-200">
                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : row.rank}
                                                </td>
                                                <td className="p-3 font-semibold text-ink-800 border-b border-parchment-200">{row.player}</td>
                                                <td className="p-3 text-sm text-ink-500 border-b border-parchment-200">{row.alliance}</td>
                                                <td className="p-3 font-bold text-brand-700 border-b border-parchment-200">{row.population}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {activeTab === 'ww' && (
                        loading ? <LoadingState label="در حال پردازش اطلاعات سرور..." /> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-center border-collapse">
                                    <thead>
                                        <tr className="bg-gold-100 text-gold-800 text-sm">
                                            <th className="p-3 rounded-r-lg">رتبه</th>
                                            <th className="p-3">مالک دهکده ناتار</th>
                                            <th className="p-3">سطح شگفتی جهان</th>
                                            <th className="p-3 rounded-l-lg">وضعیت حملات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.world_wonder.map((row) => (
                                            <tr key={row.rank} className="hover:bg-gold-50/50 transition">
                                                <td className="p-3 font-bold border-b border-parchment-200">{row.rank}</td>
                                                <td className="p-3 font-semibold border-b border-parchment-200">{row.player}</td>
                                                <td className="p-3 font-bold text-gold-700 text-lg border-b border-parchment-200">{row.ww_level}</td>
                                                <td className="p-3 text-sm font-bold text-rose-600 border-b border-parchment-200">{row.natar_attacks}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {activeTab === 'farms' && (
                        farmsLoading ? <LoadingState label="در حال دریافت دهکده‌های فارم..." /> :
                        farms.length === 0 ? <EmptyState icon="🌾" title="هیچ دهکده فارمی روی این سرور وجود ندارد." /> : (
                            <>
                                <p className="text-xs text-ink-500 text-center mb-4">
                                    این دهکده‌ها متعلق به NPC هستند و منابع نامحدود دارند؛ می‌توانید مستقیم از اینجا مختصات آن‌ها را بردارید و در «لیست مزرعه» ثبت کنید.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-center border-collapse">
                                        <thead>
                                            <tr className="bg-brand-100 text-brand-800 text-sm">
                                                <th className="p-3 rounded-r-lg">نام دهکده فارم</th>
                                                <th className="p-3">مختصات</th>
                                                <th className="p-3 rounded-l-lg">تولید ساعتی</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {farms.map((f) => (
                                                <tr key={f.id} className="hover:bg-brand-50/50 transition">
                                                    <td className="p-3 font-semibold border-b border-parchment-200">🌾 {f.name}</td>
                                                    <td className="p-3 text-sm text-ink-500 border-b border-parchment-200" dir="ltr">({f.x_coord}|{f.y_coord})</td>
                                                    <td className="p-3 font-bold text-brand-700 border-b border-parchment-200">
                                                        {typeof f.production_per_hour === 'number' ? f.production_per_hour.toLocaleString() : f.production_per_hour}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )
                    )}
                </div>
            </div>
        </PageShell>
    );
}