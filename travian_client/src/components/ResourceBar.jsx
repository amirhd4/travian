import { useEffect, useState } from 'react';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

function useLiveClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return now;
}

function isNightTime() {
    const h = new Date().getHours();
    return h >= 20 || h < 6;
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
                console.error(error);
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

    const nightMode = isNightTime();
    const cropProduction = production.crop || 0;
    const cropConsumption = useGameStore((s) => s.village?.crop_consumption || 0);
    const cropNet = cropProduction - cropConsumption;

    return (
        <>
            <div id="stime" className="stime">
                <div className={`content ${nightMode ? 'night' : 'day'}`}>
                    <span style={{ fontWeight: 'bold' }}>{now.toLocaleTimeString('fa-IR')}</span>
                    <span>&nbsp;{nightMode ? 'Night' : 'Day'}</span>
                </div>
            </div>
            <div id="plusLink">
                <div id="gs">
                    <p className="gold">
                        <a href="/gold-shop" title="Gold">
                            <img src="/assets/ui/gold-icon.gif" alt="Gold" className="gold" />
                            <br />
                            {(user?.gold_coins ?? 0).toLocaleString()}
                        </a>
                    </p>
                    <p className="silver">
                        <a href="/hero" title="Silver">
                            <img src="/assets/ui/plus-icon.gif" alt="Silver" className="silver" />
                            <br />
                            {(user?.silver_coins ?? 0).toLocaleString()}
                        </a>
                    </p>
                    <div className="clear"></div>
                </div>
                <div id="plus">
                    <a href="/plus" className="plusBtn" title="Plus">
                        <span className="plusBtn-l"><span className="plus_g">Plus</span></span>
                        <span className="plusBtn-r">&nbsp;</span>
                    </a>
                </div>
            </div>
            <ul id="res">
                {[
                    { key: 'wood', img: '/assets/ui/res-1.gif', label: 'چوب', maxKey: 'maxStorage' },
                    { key: 'clay', img: '/assets/ui/res-2.gif', label: 'خاک رس', maxKey: 'maxStorage' },
                    { key: 'iron', img: '/assets/ui/res-3.gif', label: 'آهن', maxKey: 'maxStorage' },
                    { key: 'crop', img: '/assets/ui/res-4.gif', label: 'گندم', maxKey: 'maxGranary' },
                ].map(({ key, img, label, maxKey }, idx) => {
                    const value = Math.floor(resources[key]);
                    const max = maxKey === 'maxGranary' ? maxGranary : maxStorage;
                    const percent = Math.min(100, (value / (max || 1)) * 100);
                    const prod = Math.floor(production[key] || 0);
                    return (
                        <li key={key} className={`r${idx + 1}`}
                            title={`${label} - Production: ${prod}`}>
                            <p>
                                <img src={img} alt={label} />
                                <span className="value">{value.toLocaleString()}</span>
                            </p>
                            <div className="bar-bg">
                                <div className="bar" style={{ width: `${percent}%` }}></div>
                            </div>
                        </li>
                    );
                })}
                <li className="r5" title={`Crop consumption: ${cropConsumption} - Net: ${cropNet}`}>
                    <p>
                        <img src="/assets/ui/res-5.gif" alt="Crop consumption" />
                        <span className="value">{Math.floor(cropConsumption).toLocaleString()}</span>
                    </p>
                    <div className="bar-bg">
                        <div className="bar" style={{
                            width: `${Math.min(100, cropProduction > 0 ? (cropConsumption / cropProduction) * 100 : 0)}%`,
                            backgroundColor: cropNet < 0 ? '#F00' : '#FF0'
                        }}></div>
                    </div>
                </li>
            </ul>
        </>
    );
}
