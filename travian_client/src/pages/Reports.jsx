import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';

export default function Reports() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await api.get('game/logs/');
                setLogs(response.data);
            } catch (error) {
                console.error("خطا در دریافت گزارشات:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    // انتخاب آیکون بر اساس نوع لاگ
    const getLogIcon = (logType) => {
        switch(logType) {
            case 'COMBAT': return '⚔️';
            case 'BUILDING': return '🏗️';
            case 'TRADE': return '🤝';
            default: return 'ℹ️';
        }
    };

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300 max-w-3xl w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-travian-green pb-2">
                    📜 گزارشات و وقایع
                </h2>

                {loading ? (
                    <p className="text-center text-gray-500 font-bold">در حال بارگذاری اطلاعات...</p>
                ) : logs.length === 0 ? (
                    <p className="text-center text-gray-500">هیچ گزارشی برای نمایش وجود ندارد.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className={`flex items-start p-4 rounded-md border-l-4 shadow-sm transition hover:bg-gray-50
                                    ${log.log_type === 'COMBAT' ? 'border-red-500 bg-red-50' : 
                                      log.log_type === 'BUILDING' ? 'border-blue-500 bg-blue-50' : 'border-gray-400 bg-gray-100'}`}
                            >
                                <span className="text-2xl ml-4">{getLogIcon(log.log_type)}</span>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-sm text-gray-700">
                                            {log.log_type_display}
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono" dir="ltr">
                                            {new Date(log.created_at).toLocaleString('fa-IR')}
                                        </span>
                                    </div>
                                    <p className="text-gray-800 text-sm leading-relaxed">
                                        {log.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}