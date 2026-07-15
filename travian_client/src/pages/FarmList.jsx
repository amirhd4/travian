import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { AlertModal, ConfirmModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';

const statusIcon = (status) => ({
    SUCCESS: { emoji: '✅', image: '/assets/ui/tick.png' },
    FAILED: { emoji: '❌', image: '/assets/ui/cancel.gif' },
    NEVER: { emoji: '⏳', image: '/assets/ui/clock.gif' },
}[status] || { emoji: '⏳', image: '/assets/ui/clock.gif' });

export default function FarmList() {
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [runningAll, setRunningAll] = useState(false);
    const [runningId, setRunningId] = useState(null);

    const [catalog, setCatalog] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formSourceId, setFormSourceId] = useState('');
    const [formTargetId, setFormTargetId] = useState('');
    const [formTroops, setFormTroops] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const [alertMsg, setAlertMsg] = useState(null);
    const [confirmState, setConfirmState] = useState(null); // { message, onConfirm, danger }

    const [farmLists, setFarmLists] = useState([]);
    const [activeFarmListId, setActiveFarmListId] = useState(null);
    const [newListName, setNewListName] = useState('');

    const fetchFarmLists = useCallback(async () => {
        try {
            const { data } = await api.get('combat/farm-list/manage/');
            setFarmLists(data);
            if (!activeFarmListId && data.length > 0) setActiveFarmListId(data[0].id);
        } catch (error) { console.error(error); }
    }, [activeFarmListId]);

    useEffect(() => { fetchFarmLists(); }, [fetchFarmLists]);

    const fetchEntries = useCallback(async () => {
        try {
            const { data } = await api.get('combat/farm-list/', { params: { farm_list_id: activeFarmListId } });
            setEntries(data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, [activeFarmListId]);

    useEffect(() => { if (activeFarmListId) fetchEntries(); }, [activeFarmListId, fetchEntries]);

    const handleCreateList = async () => {
        if (!newListName.trim()) return;
        const { data } = await api.post('combat/farm-list/manage/', { name: newListName.trim() });
        setNewListName('');
        await fetchFarmLists();
        setActiveFarmListId(data.id);
    };

    const fetchCatalog = useCallback(async () => {
        try {
            const { data } = await api.get('combat/troop-types/');
            setCatalog(data);
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => { fetchEntries(); fetchCatalog(); }, [fetchEntries, fetchCatalog]);
    useEffect(() => { if (activeVillageId && !formSourceId) setFormSourceId(activeVillageId); }, [activeVillageId, formSourceId]);

    const handleAddEntry = async (e) => {
        e.preventDefault();
        const troopsPayload = Object.fromEntries(Object.entries(formTroops).filter(([, v]) => parseInt(v) > 0));
        if (Object.keys(troopsPayload).length === 0) {
            setAlertMsg({ tone: 'error', text: 'حداقل یک نوع نیرو مشخص کنید.' });
            return;
        }
        setSubmitting(true);
        try {
            await api.post('combat/farm-list/', {
                source_village_id: formSourceId, target_village_id: formTargetId, troops_payload: troopsPayload,
                farm_list_id: activeFarmListId
            });
            setFormTargetId(''); setFormTroops({}); setShowForm(false);
            fetchEntries();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در افزودن ردیف' });
        } finally {
            setSubmitting(false);
        }
    };

    const doDelete = async (id) => {
        setConfirmState(null);
        try {
            await api.delete(`combat/farm-list/${id}/`);
            fetchEntries();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در حذف ردیف' });
        }
    };

    const handleDelete = (id) => {
        setConfirmState({ message: 'این ردیف از لیست مزرعه حذف شود؟', danger: true, onConfirm: () => doDelete(id) });
    };

    const handleRun = async (id) => {
        setRunningId(id);
        try {
            const { data } = await api.post('combat/farm-list/run/', { entry_id: id });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchEntries();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در اجرای غارت' });
        } finally {
            setRunningId(null);
        }
    };

    const doRunAll = async () => {
        setConfirmState(null);
        setRunningAll(true);
        try {
            const { data } = await api.post('combat/farm-list/run/', { run_all: true, farm_list_id: activeFarmListId });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchEntries();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در اجرای لیست مزرعه' });
        } finally {
            setRunningAll(false);
        }
    };

    const handleRunAll = () => {
        if (entries.length === 0) return;
        setConfirmState({ message: `همه‌ی ${entries.length} ردیف لیست مزرعه اجرا شود؟`, onConfirm: doRunAll });
    };

    if (loading) return <PageShell><LoadingState label="در حال بارگذاری لیست مزرعه..." /></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="لیست مزرعه" />
            <ConfirmModal
                open={!!confirmState}
                message={confirmState?.message}
                danger={confirmState?.danger}
                onConfirm={confirmState?.onConfirm}
                onCancel={() => setConfirmState(null)}
            />

            <div className="flex items-center gap-2 mb-4 flex-wrap">
                {farmLists.map((fl) => (
                    <button key={fl.id} onClick={() => setActiveFarmListId(fl.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 ${activeFarmListId === fl.id ? 'border-gold-500 bg-gold-50' : 'border-parchment-300 bg-white'}`}>
                        📋 {fl.name} ({fl.entries_count})
                    </button>
                ))}
                <input value={newListName} onChange={(e) => setNewListName(e.target.value)}
                    placeholder="نام لیست جدید" className="field text-xs w-32" />
                <button onClick={handleCreateList} className="btn-primary text-xs !px-3 !py-1.5">➕ لیست جدید</button>
            </div>
            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">🌾 لیست مزرعه</span>
                    <div className="flex gap-2">
                        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-xs !px-3 !py-1.5">
                            {showForm ? 'بستن فرم' : '➕ افزودن هدف'}
                        </button>
                        <button onClick={handleRunAll} disabled={runningAll || entries.length === 0} className="btn-danger text-xs !px-3 !py-1.5">
                            {runningAll ? 'در حال اعزام...' : '⚔️ اجرای همه'}
                        </button>
                    </div>
                </div>

                <div className="panel-body">
                    {showForm && (
                        <form onSubmit={handleAddEntry} className="bg-parchment-100 border border-parchment-300 rounded-xl p-4 mb-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="field-label">دهکده مبدا</label>
                                    <select value={formSourceId} onChange={(e) => setFormSourceId(e.target.value)} className="field">
                                        {villages.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.x_coord}|{v.y_coord})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="field-label">شناسه دهکده هدف</label>
                                    <input type="number" required value={formTargetId} onChange={(e) => setFormTargetId(e.target.value)} className="field" />
                                </div>
                            </div>

                            <div>
                                <label className="field-label mb-2">ترکیب نیرو برای هر بار غارت</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {catalog.map((unit) => (
                                        <div key={unit.id}>
                                            <label className="block text-[10px] text-ink-500 mb-1">{unit.name}</label>
                                            <input
                                                type="number" min="0"
                                                value={formTroops[unit.id] || ''}
                                                onChange={(e) => setFormTroops((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                                                className="field text-center text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" disabled={submitting} className="btn-primary w-full">
                                {submitting ? 'در حال افزودن...' : 'افزودن به لیست مزرعه'}
                            </button>
                        </form>
                    )}

                    {entries.length === 0 ? (
                        <EmptyState icon="🌾" title="لیست مزرعه شما خالی است." />
                    ) : (
                        <div className="space-y-2">
                            {entries.map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between border border-parchment-300 bg-parchment-50 p-3 rounded-xl">
                                    <div>
                                        <p className="font-bold text-sm text-ink-800 flex items-center gap-1.5">
                                            <img src={statusIcon(entry.last_run_status).image} alt="" className="w-4 h-4" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='inline'; }} />
                                            <span className="hidden">{statusIcon(entry.last_run_status).emoji}</span>
                                            {entry.source_name} ➡ {entry.target_name} ({entry.target_coords})
                                        </p>
                                        <p className="text-xs text-ink-500 mt-1">
                                            {Object.entries(entry.troops_payload).map(([tid, qty]) => `#${tid}×${qty}`).join(' | ')}
                                        </p>
                                        {entry.last_loot_summary && (
                                            <p className="text-xs text-brand-700 mt-1">آخرین نتیجه: {entry.last_loot_summary}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button onClick={() => handleRun(entry.id)} disabled={runningId === entry.id} className="btn-gold text-xs !px-3 !py-1.5">
                                            {runningId === entry.id ? '...' : '⚔️ اجرا'}
                                        </button>
                                        <button onClick={() => handleDelete(entry.id)} className="btn text-xs !px-3 !py-1.5 !bg-rose-100 !text-rose-700 hover:!bg-rose-200">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}