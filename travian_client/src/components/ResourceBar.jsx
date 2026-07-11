import { useEffect, useState } from 'react';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

const RESOURCE_CONFIG = [
    { key: 'wood', icon: '🪵', label: 'چوب', maxKey: 'maxStorage' },
    { key: 'clay', icon: '🧱', label: 'خشت', maxKey: 'maxStorage' },
    { key: 'iron', icon: '⚒️', label: 'آهن', maxKey: 'maxStorage' },
    { key: 'crop', icon: '🌾', label: 'گندم', maxKey: 'maxGranary' },
];

function useLiveClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return now;
}

export default function ResourceBar() {
    const { resources, production, tickResources, updateResources, setProduction, setCapacities } = useGameStore();
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const user = useGameStore((state) => state.user);
    const maxStorage = useGameStore((state) => state.maxStorage);
    const maxGranary = useGameStore((state) => state.maxGranary);
    const { lastMessage } = useGameWebSocket();
    const now = useLiveClock();

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
        fetchVillageResources();
        const syncInterval = setInterval(fetchVillageResources, 15000);
        return () => { cancelled = true; clearInterval(syncInterval); };
    }, [activeVillageId, setProduction, updateResources, setCapacities]);

    useEffect(() => {
        const interval = setInterval(() => { tickResources(); }, 1000);
        return () => clearInterval(interval);
    }, [tickResources]);

    const isStarving = production.crop < 0 && resources.crop <= 0;

    return (
        <div className="fixed top-0 left-0 w-full z-[110] bg-gradient-to-b from-ink-900 to-ink-800 text-parchment-100 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gold-500/20 border border-gold-500/50 flex items-center justify-center text-sm">👤</div>
                    <span className="text-xs font-bold text-parchment-200">{user?.username}</span>
                </div>

                <span className="text-xs font-bold text-gold-300 flex items-center gap-1 font-mono" dir="ltr">
                    🕐 {now.toLocaleTimeString('fa-IR')}
                </span>

                <span className="text-xs font-bold flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-gold-500/20 border border-gold-500/50 flex items-center justify-center">💰</span>
                    <span className="text-gold-300">{(user?.gold_coins ?? 0).toLocaleString()}</span>
                </span>
            </div>

            <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-3 sm:gap-6 px-3 pb-2">
                {RESOURCE_CONFIG.map(({ key, icon, label, maxKey }) => {
                    const value = Math.floor(resources[key]);
                    const prod = Math.round(production[key]);
                    const max = maxKey === 'maxGranary' ? maxGranary : maxStorage;
                    const percent = Math.min(100, (value / (max || 1)) * 100);
                    const isCrop = key === 'crop';
                    return (
                        <div key={key} className="flex flex-col items-center min-w-[80px]">
                            <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-sm">{isCrop && isStarving ? '⚠️' : icon}</span>
                                <span className="text-[10px] text-parchment-400">{label}</span>
                            </div>
                            <span className="text-sm font-bold text-parchment-50">{value.toLocaleString()}</span>
                            <div className="progress-track w-20 !bg-white/10">
                                <div
                                    className={`progress-fill ${isCrop && prod < 0 ? 'animate-pulse' : ''}`}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <span className={`text-[10px] font-bold ${prod < 0 ? 'text-rose-400' : 'text-brand-300'}`}>
                                {prod >= 0 ? '+' : ''}{prod}/س
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}