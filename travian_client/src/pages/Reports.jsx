import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

const LOG_STYLES = {
    COMBAT:   { icon: '⚔️', border: 'border-rose-400', bg: 'bg-rose-50' },
    BUILDING: { icon: '🏗️', border: 'border-blue-400', bg: 'bg-blue-50' },
    TRADE:    { icon: '🤝', border: 'border-gold-400', bg: 'bg-gold-50' },
    SYSTEM:   { icon: 'ℹ️', border: 'border-parchment-400', bg: 'bg-parchment-100' },
};

export default function Reports() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await api.get('game/logs/');
                setLogs(response.data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    return (
        <PageShell maxWidth="max-w-3xl">
            <div className="panel">
                <div className="panel-header"><span className="panel-title">📜 گزارشات و وقایع</span></div>
                <div className="panel-body">
                    {loading ? (
                        <LoadingState label="در حال بارگذاری اطلاعات..." />
                    ) : logs.length === 0 ? (
                        <EmptyState icon="📜" title="هیچ گزارشی برای نمایش وجود ندارد." />
                    ) : (
                        <div className="flex flex-col gap-3">
                            {logs.map((log) => {
                                const style = LOG_STYLES[log.log_type] || LOG_STYLES.SYSTEM;
                                return (
                                    <div key={log.id} className={`flex items-start p-4 rounded-xl border-r-4 ${style.border} ${style.bg} transition hover:brightness-[0.98]`}>
                                        <span className="text-2xl ml-4">{style.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                                                <span className="font-bold text-sm text-ink-700">{log.log_type_display}</span>
                                                <span className="text-xs text-ink-400 font-mono" dir="ltr">
                                                    {new Date(log.created_at).toLocaleString('fa-IR')}
                                                </span>
                                            </div>
                                            <p className="text-ink-800 text-sm leading-relaxed whitespace-pre-wrap">{log.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}