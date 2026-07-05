import { useEffect } from 'react';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

export default function ResourceBar() {
    const { resources, production, tickResources, updateResources, setProduction } = useGameStore();
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    // همگام‌سازی دوره‌ای منابع با سرور. قبلا این کامپوننت هیچ درخواستی به
    // سرور نمی‌زد و resources/production همیشه همان مقادیر پیش‌فرض استور
    // (0 و 300/300/300/150) باقی می‌ماندند که فقط در کلاینت تیک می‌خوردند.
    useEffect(() => {
        if (!activeVillageId) return;

        let cancelled = false;

        const fetchVillageResources = async () => {
            try {
                const { data } = await api.get(`game/villages/${activeVillageId}/`);
                if (cancelled) return;
                updateResources(data.resources);
                setProduction(data.production);
            } catch (error) {
                console.error("خطا در دریافت منابع دهکده", error);
            }
        };

        fetchVillageResources().then(r => null);
        // هر ۱۵ ثانیه یک بار دوباره با سرور همگام می‌شویم تا رویدادهایی مثل
        // پایان ارتقای ساختمان، غارت، یا تجارت هم در نوار منابع منعکس شوند
        const syncInterval = setInterval(fetchVillageResources, 15000);

        return () => {
            cancelled = true;
            clearInterval(syncInterval);
        };
    }, [activeVillageId, setProduction, updateResources]);

    useEffect(() => {
        // اجرای تیک‌زن هر ۱۰۰۰ میلی‌ثانیه (۱ ثانیه) برای نمایش نرم افزایش منابع
        // بین دو همگام‌سازی با سرور
        const interval = setInterval(() => {
            tickResources();
        }, 1000);

        return () => clearInterval(interval);
    }, [tickResources]);

    return (
        <div className="absolute top-0 left-0 w-full bg-black/90 text-white p-2 flex justify-center gap-8 z-10 shadow-lg border-b-2 border-travian-gold text-sm font-bold">
            <div className="flex flex-col items-center hover:text-green-400 cursor-default">
                <span>🪵 چوب: {Math.floor(resources.wood).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">{production.wood >= 0 ? '+' : ''}{Math.round(production.wood)}/ساعت</span>
            </div>
            <div className="flex flex-col items-center hover:text-orange-400 cursor-default">
                <span>🧱 خشت: {Math.floor(resources.clay).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">{production.clay >= 0 ? '+' : ''}{Math.round(production.clay)}/ساعت</span>
            </div>
            <div className="flex flex-col items-center hover:text-gray-400 cursor-default">
                <span>⚒️ آهن: {Math.floor(resources.iron).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">{production.iron >= 0 ? '+' : ''}{Math.round(production.iron)}/ساعت</span>
            </div>
            <div className="flex flex-col items-center hover:text-yellow-400 cursor-default">
                <span>🌾 گندم: {Math.floor(resources.crop).toLocaleString()}</span>
                <span className={`text-[10px] ${production.crop < 0 ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                    {production.crop >= 0 ? '+' : ''}{Math.round(production.crop)}/ساعت
                </span>
            </div>
        </div>
    );
}