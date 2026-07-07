import { useEffect } from 'react';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

export default function ResourceBar() {
    const { resources, production, tickResources, updateResources, setProduction } = useGameStore();
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    // نمایش هشدار قحطی به محض دریافت از سرور (لحظه‌ی واقعی مرگ نیرو از گرسنگی)
    useEffect(() => {
        if (lastMessage?.type === 'FAMINE_WARNING') {
            alert(lastMessage.data.message);
        }
    }, [lastMessage]);

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
        const syncInterval = setInterval(fetchVillageResources, 15000);

        return () => {
            cancelled = true;
            clearInterval(syncInterval);
        };
    }, [activeVillageId, setProduction, updateResources]);

    useEffect(() => {
        const interval = setInterval(() => {
            tickResources();
        }, 1000);

        return () => clearInterval(interval);
    }, [tickResources]);

    const isStarving = production.crop < 0 && resources.crop <= 0;

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
                <span>{isStarving ? '⚠️' : '🌾'} گندم: {Math.floor(resources.crop).toLocaleString()}</span>
                <span className={`text-[10px] font-bold ${production.crop < 0 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
                    {production.crop >= 0 ? '+' : ''}{Math.round(production.crop)}/ساعت
                    {isStarving && ' - قحطی!'}
                </span>
            </div>
        </div>
    );
}