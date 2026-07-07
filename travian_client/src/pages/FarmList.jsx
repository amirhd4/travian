import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import useGameStore from '../store/useGameStore';

const statusIcon = (status) => ({
    SUCCESS: '✅',
    FAILED: '❌',
    NEVER: '⏳',
}[status] || '⏳');

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

    const fetchEntries = useCallback(async () => {
        try {
            const { data } = await api.get('combat/farm-list/');
            setEntries(data);
        } catch (error) {
            console.error('خطا در دریافت لیست مزرعه', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCatalog = useCallback(async () => {
        try {
            const { data } = await api.get('combat/troop-types/');
            setCatalog(data);
        } catch (error) {
            console.error('خطا در دریافت فهرست نیروها', error);
        }
    }, []);

    useEffect(() => {
        fetchEntries();
        fetchCatalog();
    }, [fetchEntries, fetchCatalog]);

    useEffect(() => {
        if (activeVillageId && !formSourceId) setFormSourceId(activeVillageId);
    }, [activeVillageId, formSourceId]);

    const handleAddEntry = async (e) => {
        e.preventDefault();
        const troopsPayload = Object.fromEntries(
            Object.entries(formTroops).filter(([, v]) => parseInt(v) > 0)
        );
        if (Object.keys(troopsPayload).length === 0) {
            alert('حداقل یک نوع نیرو مشخص کنید.');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('combat/farm-list/', {
                source_village_id: formSourceId,
                target_village_id: formTargetId,
                troops_payload: troopsPayload,
            });
            setFormTargetId('');
            setFormTroops({});
            setShowForm(false);
            fetchEntries();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در افزودن ردیف');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('این ردیف از لیست مزرعه حذف شود؟')) return;
        try {
            await api.delete(`combat/farm-list/${id}/`);
            fetchEntries();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در حذف ردیف');
        }
    };

    const handleRun = async (id) => {
        setRunningId(id);
        try {
            const { data } = await api.post('combat/farm-list/run/', { entry_id: id });
            alert(data.message);
            fetchEntries();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در اجرای غارت');
        } finally {
            setRunningId(null);
        }
    };

    const handleRunAll = async () => {
        if (entries.length === 0) return;
        if (!window.confirm(`همه‌ی ${entries.length} ردیف لیست مزرعه اجرا شود؟`)) return;
        setRunningAll(true);
        try {
            const { data } = await api.post('combat/farm-list/run/', { run_all: true });
            alert(data.message);
            fetchEntries();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در اجرای لیست مزرعه');
        } finally {
            setRunningAll(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full min-h-screen bg-stone-200 pt-28 flex items-center justify-center">
                <p className="font-bold text-gray-500">در حال بارگذاری لیست مزرعه...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-3xl w-full space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-xl font-bold text-gray-800">🌾 لیست مزرعه</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowForm((v) => !v)}
                                className="text-xs font-bold bg-blue-700 text-white px-3 py-2 rounded hover:bg-blue-800"
                            >
                                {showForm ? 'بستن فرم' : '➕ افزودن هدف'}
                            </button>
                            <button
                                onClick={handleRunAll}
                                disabled={runningAll || entries.length === 0}
                                className="text-xs font-bold bg-red-700 text-white px-3 py-2 rounded hover:bg-red-800 disabled:bg-gray-400"
                            >
                                {runningAll ? 'در حال اعزام...' : '⚔️ اجرای همه'}
                            </button>
                        </div>
                    </div>

                    {showForm && (
                        <form onSubmit={handleAddEntry} className="bg-stone-50 border rounded p-4 mb-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">دهکده مبدا:</label>
                                    <select
                                        value={formSourceId}
                                        onChange={(e) => setFormSourceId(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    >
                                        {villages.map((v) => (
                                            <option key={v.id} value={v.id}>{v.name} ({v.x_coord}|{v.y_coord})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">شناسه دهکده هدف:</label>
                                    <input
                                        type="number" required
                                        value={formTargetId}
                                        onChange={(e) => setFormTargetId(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2">ترکیب نیرو برای هر بار غارت:</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {catalog.map((unit) => (
                                        <div key={unit.id}>
                                            <label className="block text-[10px] text-gray-500 mb-1">{unit.name}</label>
                                            <input
                                                type="number" min="0"
                                                value={formTroops[unit.id] || ''}
                                                onChange={(e) => setFormTroops((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                                                className="w-full p-1 border rounded text-center text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit" disabled={submitting}
                                className="w-full bg-green-700 text-white p-2 rounded font-bold hover:bg-green-800 disabled:bg-gray-400"
                            >
                                {submitting ? 'در حال افزودن...' : 'افزودن به لیست مزرعه'}
                            </button>
                        </form>
                    )}

                    {entries.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">لیست مزرعه شما خالی است.</p>
                    ) : (
                        <div className="space-y-2">
                            {entries.map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between border p-3 rounded bg-stone-50">
                                    <div>
                                        <p className="font-bold text-sm">
                                            {statusIcon(entry.last_run_status)} {entry.source_name} ➡ {entry.target_name} ({entry.target_coords})
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {Object.entries(entry.troops_payload).map(([tid, qty]) => `#${tid}×${qty}`).join(' | ')}
                                        </p>
                                        {entry.last_loot_summary && (
                                            <p className="text-xs text-blue-700 mt-1">آخرین نتیجه: {entry.last_loot_summary}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRun(entry.id)}
                                            disabled={runningId === entry.id}
                                            className="text-xs font-bold bg-amber-600 text-white px-3 py-2 rounded hover:bg-amber-700 disabled:bg-gray-400"
                                        >
                                            {runningId === entry.id ? '...' : '⚔️ اجرا'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(entry.id)}
                                            className="text-xs font-bold bg-red-100 text-red-700 px-3 py-2 rounded hover:bg-red-200"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}