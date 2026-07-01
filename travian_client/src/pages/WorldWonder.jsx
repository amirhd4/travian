import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import { useGameWebSocket } from '../hooks/useGameWebSocket';

export default function WorldWonder() {
    const [wwData, setWwData] = useState({ level: 45, maxLevel: 100, isUpgrading: false });
    const [natarAlert, setNatarAlert] = useState(true);
    const wsMessage = useGameWebSocket();

    // گوش دادن به رویدادهای زنده (مثل رسیدن موج حمله ناتارها)
    useEffect(() => {
        if (wsMessage?.type === 'NATAR_ATTACK_WAVE') {
            alert(`⚠️ هشدار خطر: موج جدید حملات ناتارها به شگفتی جهان شما آغاز شد!`);
        }
    }, [wsMessage]);

    const handleUpgrade = () => {
        const confirm = window.confirm("ارتقای شگفتی جهان نیازمند میلیون‌ها منبع است. آیا مطمئن هستید؟");
        if (confirm) {
            setWwData({ ...wwData, isUpgrading: true });
            // در اینجا درخواست به بک‌اند ارسال می‌شود
            setTimeout(() => {
                setWwData(prev => ({ level: prev.level + 1, maxLevel: 100, isUpgrading: false }));
                alert("ارتقا با موفقیت انجام شد.");
            }, 3000);
        }
    };

    return (
        <div className="w-full min-h-screen bg-slate-900 pt-28 flex flex-col items-center">
            <ResourceBar />
            <Navbar />

            {/* نوار هشدار حملات ناتار */}
            {natarAlert && (
                <div className="max-w-2xl w-full bg-red-600/90 text-white p-3 rounded-lg mb-6 flex items-center justify-between shadow-red-500/50 shadow-lg animate-pulse">
                    <span className="font-bold text-sm">⚔️ اخطار سیستم: ارتش ناتارها متوجه ساخت‌وساز شما شده‌اند. امواج حمله در راه است!</span>
                    <button onClick={() => setNatarAlert(false)} className="text-white hover:text-gray-200">✖</button>
                </div>
            )}

            <div className="bg-gradient-to-b from-stone-800 to-stone-900 p-8 rounded-lg shadow-2xl border-4 border-amber-900 max-w-2xl w-full text-center">
                <h1 className="text-3xl font-extrabold text-amber-500 mb-2 drop-shadow-md">
                    🏛️ شگفتی جهان (World Wonder)
                </h1>
                <p className="text-gray-400 text-sm mb-8">عظیم‌ترین بنای تاریخ. اولین بازیکنی که این بنا را به سطح ۱۰۰ برساند، برنده بازی است.</p>

                <div className="flex justify-center items-center mb-8 relative">
                    {/* گرافیک ساده از شگفتی جهان */}
                    <div className="w-48 h-48 bg-stone-700 rounded-full border-8 border-amber-700 flex items-center justify-center shadow-inner relative overflow-hidden">
                        <div
                            className="absolute bottom-0 w-full bg-amber-600 opacity-30 transition-all duration-1000"
                            style={{ height: `${(wwData.level / wwData.maxLevel) * 100}%` }}
                        ></div>
                        <span className="text-5xl font-black text-amber-400 z-10">{wwData.level}</span>
                    </div>
                </div>

                <div className="bg-stone-800 p-4 rounded border border-stone-600 mb-6 text-right text-gray-300 text-sm">
                    <p className="font-bold text-amber-500 mb-2">پیش‌نیازهای سطح بعدی:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>چوب: {(wwData.level * 15000).toLocaleString()}</li>
                        <li>خشت: {(wwData.level * 16000).toLocaleString()}</li>
                        <li>نقشه ساخت (WW Plan): <span className="text-green-500">فعال ✔️</span></li>
                    </ul>
                </div>

                <button
                    onClick={handleUpgrade}
                    disabled={wwData.isUpgrading}
                    className="w-full bg-amber-700 text-amber-100 p-4 rounded-lg font-bold text-lg hover:bg-amber-600 transition border-b-4 border-amber-900 active:border-b-0 active:translate-y-1 disabled:opacity-50"
                >
                    {wwData.isUpgrading ? "در حال ساخت سازه..." : "ارتقا به سطح بعدی 🔨"}
                </button>
            </div>
        </div>
    );
}