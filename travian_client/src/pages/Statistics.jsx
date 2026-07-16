import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { AlertModal } from '../components/Modal';

const TABS = [
    { key: 'general', label: '🏆 رتبه‌بندی بازیکنان', image: '/assets/ui/status-top10.gif' },
    { key: 'attackers', label: '⚔️ مهاجم برتر (کلی)', image: '/assets/ui/status-off.gif' },
    { key: 'defenders', label: '🛡️ مدافع برتر (کلی)', image: '/assets/ui/status-def.gif' },
    { key: 'daily', label: '🎖️ مدال‌های روزانه', image: '/assets/ui/artefacts.gif' },
    { key: 'mymedals', label: '🎗️ مدال‌های من', image: '/assets/ui/artefacts.gif' },
    { key: 'ww', label: '🏛️ مسابقه شگفتی جهان', image: '/assets/ui/buildings-icon.gif' },
    { key: 'alliances', label: '🤝 اتحادها', image: '/assets/ui/friends-icon.gif' },
    { key: 'farms', label: '🌾 دهکده‌های فارم', image: '/assets/ui/buildings-icon.gif' },
];

const medalIcon = (rank) => (rank === 1 ? '🥇' : rank <= 3 ? '🥈' : '🥉');

function RankTable({ rows, valueLabel }) {
    if (rows.length === 0) return <EmptyState icon="📉" title="هنوز داده‌ای برای این رتبه‌بندی ثبت نشده است." />;
    return (
        <div style={{ overflowX: 'auto' }}>
            <table className="travian-table" style={{ textAlign: 'center' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'center' }}>رتبه</th>
                        <th style={{ textAlign: 'center' }}>بازیکن</th>
                        <th style={{ textAlign: 'center' }}>اتحاد</th>
                        <th style={{ textAlign: 'center' }}>{valueLabel}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.rank} style={row.rank <= 3 ? { background: '#e7f0ca' } : {}}>
                            <td style={{ fontWeight: 'bold', color: '#252525', textAlign: 'center' }}>
                                {row.rank <= 3 ? medalIcon(row.rank) : row.rank}
                            </td>
                            <td style={{ fontWeight: 'bold', color: '#252525', textAlign: 'center' }}>{row.player}</td>
                            <td style={{ fontSize: '12px', color: '#777', textAlign: 'center' }}>{row.alliance}</td>
                            <td style={{ fontWeight: 'bold', color: '#228B22', textAlign: 'center' }}>
                                {row.points?.toLocaleString?.() ?? row.population?.toLocaleString?.()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DailyMedalColumn({ title, icon, rows }) {
    return (
        <div style={{ background: '#F5F5F5', border: '1px solid #C9C9C9', padding: '12px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '12px', textAlign: 'center', color: '#252525' }}>{icon} {title}</p>
            {rows.length === 0 ? (
                <p style={{ fontSize: '11px', textAlign: 'center', padding: '16px 0', color: '#777' }}>هنوز مدالی اهدا نشده.</p>
            ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {rows.map((r) => (
                        <li key={r.rank} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                            padding: '4px 12px',
                            marginBottom: '4px',
                            background: '#FFF',
                            border: '1px solid #C9C9C9',
                        }}>
                            <span style={{ color: '#252525' }}>{medalIcon(r.rank)} رتبه {r.rank}</span>
                            <span style={{ fontWeight: 'bold', color: '#252525' }}>{r.player}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function Statistics() {
    const [stats, setStats] = useState({ general_ranking: [], world_wonder: [], top_attackers: [], top_defenders: [] });
    const [farms, setFarms] = useState([]);
    const [alliances, setAlliances] = useState([]);
    const [dailyMedals, setDailyMedals] = useState(null);
    const [myMedals, setMyMedals] = useState([]);
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [farmsLoading, setFarmsLoading] = useState(true);
    const [alliancesLoading, setAlliancesLoading] = useState(true);
    const [farmsFetched, setFarmsFetched] = useState(false);
    const [alliancesFetched, setAlliancesFetched] = useState(false);
    const [dailyFetched, setDailyFetched] = useState(false);
    const [myMedalsFetched, setMyMedalsFetched] = useState(false);
    const [alertMsg, setAlertMsg] = useState(null);

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

    useEffect(() => {
        if (activeTab !== 'alliances' || alliancesFetched) return;
        const fetchAlliances = async () => {
            setAlliancesLoading(true);
            try {
                const response = await api.get('game/alliances/');
                setAlliances(response.data);
            } catch (error) {
                console.error(error);
            } finally {
                setAlliancesLoading(false);
                setAlliancesFetched(true);
            }
        };
        fetchAlliances();
    }, [activeTab, alliancesFetched]);

    useEffect(() => {
        if (activeTab !== 'daily' || dailyFetched) return;
        api.get('game/medals/daily-latest/')
            .then(({ data }) => setDailyMedals(data))
            .catch(() => setDailyMedals({ day_number: null, attackers: [], defenders: [], population: [] }))
            .finally(() => setDailyFetched(true));
    }, [activeTab, dailyFetched]);

    const fetchMyMedals = () => {
        api.get('game/medals/mine/').then(({ data }) => setMyMedals(data)).catch(() => {});
    };

    useEffect(() => {
        if (activeTab !== 'mymedals' || myMedalsFetched) return;
        fetchMyMedals();
        setMyMedalsFetched(true);
    }, [activeTab, myMedalsFetched]);

    const handleToggleMedal = async (medalId) => {
        try {
            await api.post('game/medals/toggle/', { medal_id: medalId });
            fetchMyMedals();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: 'خطا در تغییر وضعیت نمایش مدال' });
        }
    };

    return (
        <PageShell maxWidth="max-w-4xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="آمار" />

            <div className="panel">
                <div className="panel-header">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📊 آمار و رتبه‌بندی</span>
                </div>
                <div className="panel-body">
                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #C9C9C9', marginBottom: '12px', overflowX: 'auto' }}>
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    flex: 1,
                                    minWidth: '150px',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: activeTab === tab.key ? '#498843' : '#E5E5E5',
                                    color: activeTab === tab.key ? '#FFF' : '#252525',
                                    borderBottom: activeTab === tab.key ? '2px solid #F88C1F' : '1px solid #C9C9C9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <img src={tab.image} alt="" style={{ width: '16px', height: '16px' }} onError={(e) => { e.target.style.display='none'; }} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {activeTab === 'general' && (
                        loading ? <LoadingState label="در حال پردازش اطلاعات سرور..." /> : (
                            <RankTable rows={stats.general_ranking} valueLabel="جمعیت" />
                        )
                    )}

                    {activeTab === 'attackers' && (
                        loading ? <LoadingState label="در حال پردازش اطلاعات سرور..." /> : (
                            <>
                                <p className="text-xs text-ink-500 text-center mb-4">
                                    مجموع ارزش جمعیتی نیروهای حریف که این بازیکن در نقش مهاجم، در کل طول عمر سرور کشته است.
                                </p>
                                <RankTable rows={stats.top_attackers} valueLabel="امتیاز مهاجم" />
                            </>
                        )
                    )}

                    {activeTab === 'defenders' && (
                        loading ? <LoadingState label="در حال پردازش اطلاعات سرور..." /> : (
                            <>
                                <p className="text-xs text-ink-500 text-center mb-4">
                                    مجموع ارزش جمعیتی نیروهای مهاجمینی که این بازیکن در نقش مدافع، در کل طول عمر سرور کشته است.
                                </p>
                                <RankTable rows={stats.top_defenders} valueLabel="امتیاز مدافع" />
                            </>
                        )
                    )}

                    {activeTab === 'daily' && (
                        !dailyFetched ? <LoadingState label="در حال بارگذاری مدال‌های روزانه..." /> :
                        !dailyMedals?.day_number ? <EmptyState icon="🎖️" title="هنوز مدال روزانه‌ای محاسبه نشده است." /> : (
                            <>
                                <p className="text-center text-sm font-bold text-gold-700 mb-4">مدال‌های روز {dailyMedals.day_number} سرور</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <DailyMedalColumn title="مهاجم روز" icon="⚔️" rows={dailyMedals.attackers} />
                                    <DailyMedalColumn title="مدافع روز" icon="🛡️" rows={dailyMedals.defenders} />
                                    <DailyMedalColumn title="پیشرفت روز" icon="📈" rows={dailyMedals.population} />
                                </div>
                            </>
                        )
                    )}

                    {activeTab === 'mymedals' && (
                        !myMedalsFetched ? <LoadingState label="در حال بارگذاری مدال‌های شما..." /> :
                        myMedals.length === 0 ? <EmptyState icon="🎗️" title="شما هنوز مدالی کسب نکرده‌اید." /> : (
                            <div className="space-y-2">
                                {myMedals.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between border border-parchment-300 bg-parchment-50 rounded-xl p-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{medalIcon(m.rank)}</span>
                                            <div>
                                                <p className="font-bold text-sm text-ink-800">{m.category_display}</p>
                                                <p className="text-xs text-ink-500">روز {m.day_number} — رتبه {m.rank}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleToggleMedal(m.id)}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-full ${m.is_visible ? 'bg-brand-100 text-brand-700' : 'bg-parchment-200 text-ink-500'}`}
                                        >
                                            {m.is_visible ? '👁️ نمایان در پروفایل' : '🙈 مخفی'}
                                        </button>
                                    </div>
                                ))}
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

                    {activeTab === 'alliances' && (
                        alliancesLoading ? <LoadingState label="در حال دریافت لیست اتحادها..." /> :
                        alliances.length === 0 ? <EmptyState icon="🤝" title="هنوز هیچ اتحادی تشکیل نشده است." /> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-center border-collapse">
                                    <thead>
                                        <tr className="bg-brand-100 text-brand-800 text-sm">
                                            <th className="p-3 rounded-r-lg">رتبه</th>
                                            <th className="p-3">نام اتحاد</th>
                                            <th className="p-3">تگ</th>
                                            <th className="p-3">موسس</th>
                                            <th className="p-3 rounded-l-lg">تعداد اعضا</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alliances.map((a) => (
                                            <tr key={a.rank} className={`transition hover:bg-brand-50/50 ${a.rank <= 3 ? 'bg-gold-50/60' : ''}`}>
                                                <td className="p-3 font-bold border-b border-parchment-200">
                                                    {a.rank <= 3 ? medalIcon(a.rank) : a.rank}
                                                </td>
                                                <td className="p-3 font-semibold border-b border-parchment-200">{a.name}</td>
                                                <td className="p-3 text-sm text-ink-500 border-b border-parchment-200">[{a.tag}]</td>
                                                <td className="p-3 text-sm text-ink-600 border-b border-parchment-200">{a.founder}</td>
                                                <td className="p-3 font-bold text-brand-700 border-b border-parchment-200">{a.member_count}</td>
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