import { useEffect } from 'react';
import useGameStore from '../store/useGameStore';

export default function ResourceBar() {
    const { resources, production, tickResources } = useGameStore();

    useEffect(() => {
        // اجرای تیک‌زن هر ۱۰۰۰ میلی‌ثانیه (۱ ثانیه)
        const interval = setInterval(() => {
            tickResources();
        }, 1000);

        return () => clearInterval(interval);
    }, [tickResources]);

    return (
        <div className="absolute top-0 left-0 w-full bg-black/90 text-white p-2 flex justify-center gap-8 z-10 shadow-lg border-b-2 border-travian-gold text-sm font-bold">
            <div className="flex flex-col items-center hover:text-green-400 cursor-default">
                <span>🪵 چوب: {Math.floor(resources.wood).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">+{production.wood}/ساعت</span>
            </div>
            <div className="flex flex-col items-center hover:text-orange-400 cursor-default">
                <span>🧱 خشت: {Math.floor(resources.clay).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">+{production.clay}/ساعت</span>
            </div>
            <div className="flex flex-col items-center hover:text-gray-400 cursor-default">
                <span>⚒️ آهن: {Math.floor(resources.iron).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">+{production.iron}/ساعت</span>
            </div>
            <div className="flex flex-col items-center hover:text-yellow-400 cursor-default">
                <span>🌾 گندم: {Math.floor(resources.crop).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">+{production.crop}/ساعت</span>
            </div>
        </div>
    );
}