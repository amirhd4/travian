import { useEffect } from 'react';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

const RESOURCE_CONFIG = [
    { key: 'wood', icon: '🪵', maxKey: 'maxStorage' },
    { key: 'clay', icon: '🧱', maxKey: 'maxStorage' },
    { key: 'iron', icon: '⚒️', maxKey: 'maxStorage' },
    { key: 'crop', icon: '🌾', maxKey: 'maxGranary' },
];

export default function ResourceBar() {
    const { resources, production, tickResources, updateResources, setProduction, setCapacities } = useGameStore();
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const user = useGameStore((state) => state.user);
    const maxStorage = useGameStore((state) => state.maxStorage);
    const maxGranary = useGameStore((state) => state.maxGranary);
    const { lastMessage } = useGameWebSocket();

    useEffect(() => {
        if (lastMessage?.type === 'FAMINE_WARNING') alert(lastMessage.data.message);
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
                setCapacities(data.max_storage, data.max_granary);
            } catch (error) {
                console.error("خطا در دریافت منابع دهکده", error);
            }
        };
        fetchVillageResources().then(r => null);
        const syncInterval = setInterval(fetchVillageResources, 15000);
        return () => { cancelled = true; clearInterval(syncInterval); };
    }, [activeVillageId, setProduction, updateResources, setCapacities]);

    useEffect(() => {
        const interval = setInterval(() => { tickResources(); }, 1000);
        return () => clearInterval(interval);
    }, [tickResources]);

    const isStarving = production.crop < 0 && resources.crop <= 0;

    return (
        <div className="absolute top-0 left-0 w-full z-10 bg-parchment/95 border-b-2 border-wood-light shadow-md">
            <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[10px] font-bold text-wood">👤 {user?.username}</span>
                <span className="text-xs font-bold text-wood flex items-center gap-1">
                    💰 <span className="text-amber-700">{(user?.gold_coins ?? 0).toLocaleString()}</span>
                </span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 px-3 pb-1.5">
                {RESOURCE_CONFIG.map(({ key, icon, maxKey }) => {
                    const value = Math.floor(resources[key]);
                    const prod = Math.round(production[key]);
                    const max = maxKey === 'maxGranary' ? maxGranary : maxStorage;
                    const percent = Math.min(100, (value / (max || 1)) * 100);
                    const isCrop = key === 'crop';
                    return (
                        <div key={key} className="flex flex-col items-center min-w-[85px]">
                            <span className="text-xs font-bold text-wood-dark flex items-center gap-1">
                                {isCrop && isStarving ? '⚠️' : icon} {value.toLocaleString()}
                            </span>
                            <div className="resource-progress-track">
                                <div
                                    className={`resource-progress-fill ${isCrop && prod < 0 ? 'bg-red-700 animate-pulse' : ''}`}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <span className={`text-[10px] font-bold ${prod < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                {prod >= 0 ? '+' : ''}{prod}/ساعت
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}