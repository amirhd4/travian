import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { AlertModal, ConfirmModal } from '../components/Modal';

const LOG_STYLES = {
    COMBAT:   { icon: '⚔️', border: 'border-rose-400', bg: 'bg-rose-50' },
    BUILDING: { icon: '🏗️', border: 'border-blue-400', bg: 'bg-blue-50' },
    TRADE:    { icon: '🤝', border: 'border-gold-400', bg: 'bg-gold-50' },
    SYSTEM:   { icon: 'ℹ️', border: 'border-parchment-400', bg: 'bg-parchment-100' },
};

const TABS = [
    { key: 'all', label: 'همه' },
    { key: 'trade', label: 'معاملات' },
    { key: 'reinforcement', label: 'نیروی کمکی' },
    { key: 'misc', label: 'متفرقه' },
];

function CombatReportRow({ report, onOpen }) {
    const resultIcon = report.won ? '🟢' : '🔴';
    const directionLabel = report.is_attacker ? 'اعزامی' : 'ورودی';

    return (
        <div
            onClick={() => onOpen(report)}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition hover:brightness-[0.98] ${
                report.is_read ? 'bg-parchment-50 border-parchment-300' : 'bg-gold-50 border-gold-300 font-bold'
            }`}
        >
            <div className="flex items-center gap-3">
                <span className="text-xl">{resultIcon}</span>
                <div>
                    <p className="text-sm text-ink-800">
                        {directionLabel} — {report.attacker_village_name} ⚔️ {report.defender_village_name}
                    </p>
                    <p className="text-xs text-ink-500">
                        {report.attacker_coords} → {report.defender_coords}
                        {report.conquered && <span className="text-gold-700 font-bold"> · 🏆 تسخیر شد</span>}
                    </p>
                </div>
            </div>
            <div className="text-left flex-shrink-0">
                <p className={`text-xs font-bold ${report.won ? 'text-brand-700' : 'text-rose-700'}`}>
                    {report.won ? 'پیروزی' : 'شکست'}
                </p>
                <p className="text-[10px] text-ink-400" dir="ltr">{new Date(report.created_at).toLocaleString('fa-IR')}</p>
            </div>
        </div>
    );
}

function CombatReportDetail({ report, onClose, onDelete }) {
    if (!report) return null;
    const renderTroops = (obj) => {
        const entries = Object.entries(obj || {});
        if (entries.length === 0) return <p className="text-xs text-ink-400">—</p>;
        return (
            <div className="grid grid-cols-2 gap-1 text-xs">
                {entries.map(([name, count]) => (
                    <span key={name} className="text-ink-700">{name}: <b>{count}</b></span>
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-ink-900/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4" onClick={onClose}>
            <div className="panel w-full max-w-lg p-6 relative max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-rose-100 text-rose-600 font-bold hover:bg-rose-200">×</button>
                <h3 className="text-lg font-extrabold text-ink-800 mb-1">
                    {report.attacker_village_name} ⚔️ {report.defender_village_name}
                </h3>
                <p className="text-xs text-ink-500 mb-4">
                    برنده: <b className={report.victory === 'attacker' ? 'text-brand-700' : 'text-rose-700'}>
                        {report.victory === 'attacker' ? 'مهاجم' : 'مدافع'}
                    </b>
                    {' · '}بونوس روحیه‌ی مدافع: {report.morale_percent}٪
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-parchment-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-ink-700 mb-1">نیروی اعزامی مهاجم</p>
                        {renderTroops(report.attacker_troops_sent)}
                        <p className="text-[10px] text-rose-600 mt-1">تلفات: {report.attacker_loss_percent}٪</p>
                    </div>
                    <div className="bg-parchment-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-ink-700 mb-1">بازماندگان مهاجم</p>
                        {renderTroops(report.attacker_troops_survived)}
                    </div>
                    <div className="bg-parchment-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-ink-700 mb-1">نیروی مدافع (قبل)</p>
                        {renderTroops(report.defender_troops_before)}
                    </div>
                    <div className="bg-parchment-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-ink-700 mb-1">نیروی مدافع (بعد)</p>
                        {renderTroops(report.defender_troops_after)}
                        <p className="text-[10px] text-rose-600 mt-1">تلفات: {report.defender_loss_percent}٪</p>
                    </div>
                </div>

                {(report.wall_damage_text || report.catapult_damage_text || report.trapped_summary) && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-3 text-xs text-rose-800 whitespace-pre-wrap">
                        {report.wall_damage_text}
                        {report.catapult_damage_text && `\n${report.catapult_damage_text}`}
                        {report.trapped_summary && `\n${report.trapped_summary}`}
                    </div>
                )}

                {report.loot && Object.values(report.loot).some((v) => v > 0) && (
                    <div className="bg-gold-50 border border-gold-200 rounded-lg p-3 mb-3 text-xs">
                        🪵{report.loot.wood} 🧱{report.loot.clay} ⚒️{report.loot.iron} 🌾{report.loot.crop}
                    </div>
                )}

                <button onClick={() => onDelete(report.id)} className="btn text-xs !bg-rose-100 !text-rose-700 hover:!bg-rose-200 w-full mt-2">
                    🗑️ حذف این گزارش
                </button>
            </div>
        </div>
    );
}

export default function Reports() {
    const [activeTab, setActiveTab] = useState('all');
    const [logs, setLogs] = useState([]);
    const [combatReports, setCombatReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openReport, setOpenReport] = useState(null);
    const [confirmState, setConfirmState] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchLogs = useCallback(async () => {
        try {
            const response = await api.get('game/logs/');
            setLogs(response.data);
        } catch (error) { console.error(error); }
    }, []);

    const fetchCombatReports = useCallback(async () => {
        try {
            const response = await api.get('combat/reports/');
            setCombatReports(response.data);
        } catch (error) { console.error(error); }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchLogs(), fetchCombatReports()]).finally(() => setLoading(false));
    }, [fetchLogs, fetchCombatReports]);

    const handleOpenReport = async (report) => {
        try {
            const { data } = await api.get(`combat/reports/${report.id}/`);
            setOpenReport(data);
            setCombatReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, is_read: true } : r)));
        } catch (error) {
            setAlertMsg({ tone: 'error', text: 'خطا در دریافت جزئیات گزارش' });
        }
    };

    const doDeleteReport = async (id) => {
        setConfirmState(null);
        try {
            await api.delete(`combat/reports/${id}/`);
            setOpenReport(null);
            fetchCombatReports();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: 'خطا در حذف گزارش' });
        }
    };

    const handleDeleteReport = (id) => {
        setConfirmState({ message: 'این گزارش جنگی حذف شود؟', danger: true, onConfirm: () => doDeleteReport(id) });
    };

    // فیلتر کردن گزارشات بر اساس تب فعال
    const getFilteredLogs = () => {
        switch (activeTab) {
            case 'trade':
                return logs.filter(log => log.log_type === 'TRADE');
            case 'reinforcement':
                return logs.filter(log => log.description.includes('پشتیبان') || log.description.includes('نیروهای پشتیبان'));
            case 'misc':
                return logs.filter(log => log.log_type === 'COMBAT' || log.log_type === 'BUILDING');
            case 'all':
            default:
                return logs;
        }
    };

    const getFilteredCombatReports = () => {
        switch (activeTab) {
            case 'trade':
                return [];
            case 'reinforcement':
                return combatReports.filter(r => r.movement_type === 'REINFORCEMENT');
            case 'misc':
                return combatReports;
            case 'all':
            default:
                return combatReports;
        }
    };

    const filteredLogs = getFilteredLogs();
    const filteredCombatReports = getFilteredCombatReports();
    const hasAnyReports = filteredLogs.length > 0 || filteredCombatReports.length > 0;

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="گزارشات" />
            <ConfirmModal open={!!confirmState} message={confirmState?.message} danger={confirmState?.danger} onConfirm={confirmState?.onConfirm} onCancel={() => setConfirmState(null)} />
            <CombatReportDetail report={openReport} onClose={() => setOpenReport(null)} onDelete={handleDeleteReport} />

            <div className="panel overflow-hidden">
                <div className="flex border-b border-parchment-300">
                    {TABS.map((tab) => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 py-3 text-sm font-bold transition ${activeTab === tab.key ? 'bg-gold-500 text-ink-900' : 'bg-parchment-100 text-ink-600 hover:bg-parchment-200'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="panel-body">
                    {loading ? <LoadingState label="در حال بارگذاری اطلاعات..." /> : (
                        <>
                            {!hasAnyReports ? (
                                <EmptyState icon="📜" title="هیچ گزارشی برای نمایش وجود ندارد." />
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {/* نمایش گزارشات عمومی */}
                                    {filteredLogs.map((log) => {
                                        const style = LOG_STYLES[log.log_type] || LOG_STYLES.SYSTEM;
                                        return (
                                            <div key={log.id} className={`flex items-start p-4 rounded-xl border-r-4 ${style.border} ${style.bg}`}>
                                                <span className="text-2xl ml-4">{style.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                                                        <span className="font-bold text-sm text-ink-700">{log.log_type_display}</span>
                                                        <span className="text-xs text-ink-400 font-mono" dir="ltr">{new Date(log.created_at).toLocaleString('fa-IR')}</span>
                                                    </div>
                                                    <p className="text-ink-800 text-sm leading-relaxed whitespace-pre-wrap">{log.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* نمایش گزارشات جنگی */}
                                    {filteredCombatReports.map((r) => (
                                        <CombatReportRow key={r.id} report={r} onOpen={handleOpenReport} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </PageShell>
    );
}