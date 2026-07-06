import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import useGameStore from '../store/useGameStore';

export default function Embassy() {
    const [embassyData, setEmbassyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [createForm, setCreateForm] = useState({ name: '', tag: '' });
    const currentUser = useGameStore((state) => state.user);

    const fetchEmbassyData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('game/embassy/');
            setEmbassyData(response.data);
        } catch (error) {
            console.error("خطا در دریافت اطلاعات سفارت", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmbassyData();
    }, [fetchEmbassyData]);

    const runAction = async (payload, confirmMessage) => {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        try {
            const response = await api.post('game/embassy/', payload);
            alert(response.data.message);
            fetchEmbassyData();
        } catch (error) {
            alert(error.response?.data?.error || "خطا در انجام عملیات");
        }
    };

    const handleCreateAlliance = async (e) => {
        e.preventDefault();
        await runAction({ action: 'create', ...createForm });
    };

    const handleJoinAlliance = async (id) => {
        await runAction({ action: 'join', alliance_id: id });
    };

    const handleLeave = async () => {
        await runAction({ action: 'leave' }, "آیا مطمئنید می‌خواهید اتحاد را ترک کنید؟");
    };

    const handleKick = async (targetPlayerId, targetName) => {
        await runAction(
            { action: 'kick', target_player_id: targetPlayerId },
            `آیا مطمئنید می‌خواهید ${targetName} را اخراج کنید؟`
        );
    };

    const handlePromote = async (targetPlayerId, role) => {
        await runAction({ action: 'promote', target_player_id: targetPlayerId, role });
    };

    const handleDisband = async () => {
        await runAction({ action: 'disband' }, "این عملیات اتحاد را برای همیشه منحل می‌کند. ادامه می‌دهید؟");
    };

    const isLeader = embassyData?.alliance_data?.role === 'Leader';

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-blue-800 max-w-3xl w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">🏛️ سفارتخانه</h2>

                {loading ? (
                    <p className="text-center font-bold py-10">در حال ارتباط با دیپلمات‌ها...</p>
                ) : embassyData?.has_alliance ? (
                    <div>
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6 text-center">
                            <h3 className="text-xl font-bold text-blue-900">
                                اتحاد: {embassyData.alliance_data.name} [{embassyData.alliance_data.tag}]
                            </h3>
                            <p className="text-sm font-bold text-blue-700 mt-2">مقام شما: {embassyData.alliance_data.role}</p>
                        </div>

                        <h4 className="font-bold mb-2">لیست اعضا:</h4>
                        <table className="w-full border-collapse text-center mb-6">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-2 border">بازیکن</th>
                                    <th className="p-2 border">نقش</th>
                                    {isLeader && <th className="p-2 border">مدیریت</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {embassyData.alliance_data.members.map((m, i) => {
                                    const isSelf = currentUser && m.player_id === currentUser.id;
                                    return (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-2 border font-bold text-gray-700">
                                                {m.player__email.split('@')[0]}{isSelf ? ' (شما)' : ''}
                                            </td>
                                            <td className="p-2 border text-sm">{m.role}</td>
                                            {isLeader && (
                                                <td className="p-2 border">
                                                    {!isSelf && (
                                                        <div className="flex gap-2 justify-center">
                                                            {m.role !== 'Diplomat' && (
                                                                <button
                                                                    onClick={() => handlePromote(m.player_id, 'Diplomat')}
                                                                    className="text-xs bg-purple-600 text-white px-2 py-1 rounded font-bold hover:bg-purple-700"
                                                                >
                                                                    دیپلمات
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleKick(m.player_id, m.player__email.split('@')[0])}
                                                                className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold hover:bg-red-700"
                                                            >
                                                                اخراج
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={handleLeave}
                                className="bg-gray-600 text-white px-4 py-2 rounded font-bold hover:bg-gray-700"
                            >
                                🚪 ترک اتحاد
                            </button>
                            {isLeader && (
                                <button
                                    onClick={handleDisband}
                                    className="bg-red-700 text-white px-4 py-2 rounded font-bold hover:bg-red-800"
                                >
                                    💥 انحلال اتحاد
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* فرم تاسیس */}
                        <div className="bg-gray-50 p-4 rounded border">
                            <h3 className="font-bold text-lg mb-4">تاسیس اتحاد جدید</h3>
                            <form onSubmit={handleCreateAlliance} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold mb-1">نام اتحاد:</label>
                                    <input type="text" required className="w-full p-2 border rounded"
                                        value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">تگ (مخفف):</label>
                                    <input type="text" required maxLength="10" className="w-full p-2 border rounded"
                                        value={createForm.tag} onChange={e => setCreateForm({...createForm, tag: e.target.value})} />
                                </div>
                                <button type="submit" className="w-full bg-blue-700 text-white p-2 rounded font-bold hover:bg-blue-800">تاسیس 👑</button>
                            </form>
                        </div>

                        {/* لیست اتحادها برای پیوستن */}
                        <div>
                            <h3 className="font-bold text-lg mb-4">پیوستن به اتحادها</h3>
                            {embassyData.available_alliances?.length === 0 ? (
                                <p className="text-sm text-gray-500">هیچ اتحادی در سرور وجود ندارد.</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {embassyData.available_alliances.map(a => (
                                        <div key={a.id} className="border p-3 rounded flex justify-between items-center bg-white hover:bg-gray-50">
                                            <span className="font-bold text-sm">[{a.tag}] {a.name}</span>
                                            <button onClick={() => handleJoinAlliance(a.id)} className="bg-green-600 text-white text-xs px-3 py-1 rounded font-bold hover:bg-green-700">پیوستن</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}