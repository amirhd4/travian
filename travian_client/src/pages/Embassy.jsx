import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { AlertModal, ConfirmModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';

export default function Embassy() {
    const [embassyData, setEmbassyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [createForm, setCreateForm] = useState({ name: '', tag: '' });
    const [inviteUsername, setInviteUsername] = useState('');
    const currentUser = useGameStore((state) => state.user);

    const [alertMsg, setAlertMsg] = useState(null);
    const [confirmState, setConfirmState] = useState(null);

    const fetchEmbassyData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('game/embassy/');
            setEmbassyData(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEmbassyData(); }, [fetchEmbassyData]);

    const runAction = async (payload) => {
        try {
            const response = await api.post('game/embassy/', payload);
            setAlertMsg({ tone: 'success', text: response.data.message });
            fetchEmbassyData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || "خطا در انجام عملیات" });
        }
    };

    const handleCreateAlliance = async (e) => {
        e.preventDefault();
        await runAction({ action: 'create', ...createForm });
    };

    const handleJoinAlliance = async (id) => runAction({ action: 'join', alliance_id: id });

    const handleSendInvite = async (e) => {
        e.preventDefault();
        if (!inviteUsername.trim()) return;
        try {
            const response = await api.post('game/embassy/', { action: 'invite', username: inviteUsername.trim() });
            setAlertMsg({ tone: 'success', text: response.data.message });
            setInviteUsername('');
            fetchEmbassyData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || "خطا در ارسال دعوت‌نامه" });
        }
    };

    const handleCancelInvite = (inviteId, targetName) => {
        setConfirmState({
            message: `آیا مطمئنید می‌خواهید دعوت‌نامه برای ${targetName} را لغو کنید؟`, danger: true,
            onConfirm: () => {
                setConfirmState(null);
                runAction({ action: 'cancel_invite', invite_id: inviteId });
            },
        });
    };

    const handleDeclineInvite = (inviteId, allianceTag) => {
        setConfirmState({
            message: `آیا مطمئنید می‌خواهید دعوت‌نامه از اتحاد ${allianceTag} را رد کنید؟`, danger: true,
            onConfirm: () => {
                setConfirmState(null);
                runAction({ action: 'decline_invite', invite_id: inviteId });
            },
        });
    };

    const handleLeave = () => {
        setConfirmState({
            message: 'آیا مطمئنید می‌خواهید اتحاد را ترک کنید؟', danger: true,
            onConfirm: () => { setConfirmState(null); runAction({ action: 'leave' }); },
        });
    };

    const handleKick = (targetPlayerId, targetName) => {
        setConfirmState({
            message: `آیا مطمئنید می‌خواهید ${targetName} را اخراج کنید؟`, danger: true,
            onConfirm: () => { setConfirmState(null); runAction({ action: 'kick', target_player_id: targetPlayerId }); },
        });
    };

    const handlePromote = (targetPlayerId, role) => runAction({ action: 'promote', target_player_id: targetPlayerId, role });

    const handleDisband = () => {
        setConfirmState({
            message: 'این عملیات اتحاد را برای همیشه منحل می‌کند. ادامه می‌دهید؟', danger: true,
            onConfirm: () => { setConfirmState(null); runAction({ action: 'disband' }); },
        });
    };

    const isLeader = embassyData?.alliance_data?.role === 'Leader';
    const isLeaderOrDiplomat = embassyData?.alliance_data?.role === 'Leader' || embassyData?.alliance_data?.role === 'Diplomat';

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="سفارتخانه" />
            <ConfirmModal open={!!confirmState} message={confirmState?.message} danger={confirmState?.danger} onConfirm={confirmState?.onConfirm} onCancel={() => setConfirmState(null)} />

            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title flex items-center gap-2">
                        <img src="/assets/ui/friends-icon.gif" alt="" className="w-5 h-5" onError={(e) => { e.target.style.display='none'; }} />
                        سفارتخانه
                    </span>
                </div>
                <div className="panel-body">
                    {loading ? (
                        <LoadingState label="در حال ارتباط با دیپلمات‌ها..." />
                    ) : embassyData?.has_alliance ? (
                        <div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
                                <h3 className="text-xl font-bold text-blue-900">
                                    اتحاد: {embassyData.alliance_data.name} [{embassyData.alliance_data.tag}]
                                </h3>
                                <p className="text-sm font-bold text-blue-700 mt-2">مقام شما: {embassyData.alliance_data.role}</p>
                                <p className="text-xs text-blue-600 mt-1">
                                    ظرفیت اتحاد: {embassyData.alliance_data.members.length} از {embassyData.alliance_data.capacity} نفر (بر اساس سطح سفارت‌خانه‌ی اعضا)
                                </p>
                            </div>

                            <h4 className="field-label mb-2">لیست اعضا</h4>
                            <div className="overflow-x-auto mb-6">
                                <table className="w-full text-center border-collapse">
                                    <thead>
                                        <tr className="bg-parchment-100 text-sm">
                                            <th className="p-2 rounded-r-lg">بازیکن</th>
                                            <th className="p-2">نقش</th>
                                            {isLeader && <th className="p-2 rounded-l-lg">مدیریت</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {embassyData.alliance_data.members.map((m, i) => {
                                            const isSelf = currentUser && m.player_id === currentUser.id;
                                            return (
                                                <tr key={i} className="hover:bg-parchment-50">
                                                    <td className="p-2 font-bold text-ink-700 border-b border-parchment-200">
                                                        {m.player__email.split('@')[0]}{isSelf ? ' (شما)' : ''}
                                                    </td>
                                                    <td className="p-2 text-sm border-b border-parchment-200">{m.role}</td>
                                                    {isLeader && (
                                                        <td className="p-2 border-b border-parchment-200">
                                                            {!isSelf && (
                                                                <div className="flex gap-2 justify-center">
                                                                    {m.role !== 'Diplomat' && (
                                                                        <button onClick={() => handlePromote(m.player_id, 'Diplomat')} className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-bold hover:bg-purple-700">
                                                                            دیپلمات
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => handleKick(m.player_id, m.player__email.split('@')[0])} className="text-xs bg-rose-600 text-white px-2 py-1 rounded-full font-bold hover:bg-rose-700">
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
                            </div>

                            <div className="flex gap-3 justify-center mb-6">
                                <button onClick={handleLeave} className="btn-ghost">🚪 ترک اتحاد</button>
                                {isLeader && <button onClick={handleDisband} className="btn-danger">💥 انحلال اتحاد</button>}
                            </div>

                            {isLeaderOrDiplomat && (
                                <div className="mt-8 border-t border-parchment-300 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-parchment-100 rounded-xl border border-parchment-300 p-4">
                                        <h3 className="font-bold text-lg mb-4 text-ink-800">دعوت از بازیکن جدید ✉️</h3>
                                        <form onSubmit={handleSendInvite} className="space-y-3">
                                            <div>
                                                <label className="field-label">نام کاربری بازیکن</label>
                                                <input type="text" required className="field" value={inviteUsername} onChange={e => setInviteUsername(e.target.value)} placeholder="نام کاربری بازیکن را وارد کنید..." />
                                            </div>
                                            <button type="submit" className="btn-primary w-full">ارسال دعوت‌نامه 🚀</button>
                                        </form>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-lg mb-4 text-ink-800">دعوت‌نامه‌های فعال ارسال شده</h3>
                                        {!embassyData.alliance_data.sent_invitations || embassyData.alliance_data.sent_invitations.length === 0 ? (
                                            <EmptyState icon="📩" title="هیچ دعوت‌نامه فعالی ارسال نشده است." />
                                        ) : (
                                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                                {embassyData.alliance_data.sent_invitations.map(inv => (
                                                    <div key={inv.id} className="border border-parchment-300 bg-parchment-50 rounded-xl p-3 flex justify-between items-center">
                                                        <span className="font-bold text-sm text-ink-800">{inv.player_username}</span>
                                                        <button onClick={() => handleCancelInvite(inv.id, inv.player_username)} className="btn-danger text-xs !px-3 !py-1.5">لغو دعوت</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-parchment-100 rounded-xl border border-parchment-300 p-4">
                                <h3 className="font-bold text-lg mb-4 text-ink-800">تاسیس اتحاد جدید</h3>
                                <form onSubmit={handleCreateAlliance} className="space-y-3">
                                    <div>
                                        <label className="field-label">نام اتحاد</label>
                                        <input type="text" required className="field" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="field-label">تگ (مخفف)</label>
                                        <input type="text" required maxLength="10" className="field" value={createForm.tag} onChange={e => setCreateForm({...createForm, tag: e.target.value})} />
                                    </div>
                                    <button type="submit" className="btn-primary w-full">تاسیس 👑</button>
                                </form>
                            </div>

                            <div>
                                <h3 className="font-bold text-lg mb-4 text-ink-800">✉️ دعوت‌نامه‌های دریافتی شما</h3>
                                {!embassyData.invitations || embassyData.invitations.length === 0 ? (
                                    <div className="bg-parchment-50 border border-parchment-300 rounded-xl p-4 mb-6 text-center">
                                        <p className="text-sm text-ink-600 font-bold">شما در حال حاضر هیچ دعوت‌نامه‌ای دریافت نکرده‌آید.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-6">
                                        {embassyData.invitations.map(inv => (
                                            <div key={inv.id} className="border border-green-200 bg-green-50 rounded-xl p-3 flex justify-between items-center">
                                                <span className="font-bold text-sm text-green-900">[{inv.alliance_tag}] {inv.alliance_name}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleJoinAlliance(inv.alliance_id)} className="btn-primary text-xs !px-3 !py-1.5">پذیرش</button>
                                                    <button onClick={() => handleDeclineInvite(inv.id, inv.alliance_tag)} className="btn-ghost text-xs !px-3 !py-1.5 !text-rose-600">رد کردن</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <h3 className="font-bold text-lg mb-4 text-ink-800">🏛️ لیست کل اتحادهای سرور</h3>
                                {embassyData.available_alliances?.length === 0 ? (
                                    <EmptyState icon="🏛️" title="هیچ اتحادی در سرور وجود ندارد." />
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {embassyData.available_alliances.map(a => (
                                            <div key={a.id} className="border border-parchment-200 bg-parchment-50 rounded-xl p-2.5 flex justify-between items-center">
                                                <span className="font-bold text-xs text-ink-700">[{a.tag}] {a.name}</span>
                                                <span className="text-xs text-ink-500 font-bold">نیاز به دعوت‌نامه 🔒</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}
