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
    const { resources, production, tickResources, updateResources, setProduction, setCapacities, setCropConsumption } = useGameStore();
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
                const { data } = await api.get("game/villages/" + activeVillageId + "/");
                if (cancelled) return;
                updateResources(data.resources);
                setProduction(data.production);
                setCapacities(data.max_storage, data.max_granary);
                if (data.crop_consumption !== undefined) setCropConsumption(data.crop_consumption);
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
    const cropConsumption = useGameStore((s) => s.cropConsumption || 0);
    const cropNet = cropProduction - cropConsumption;

    return (
        <>
            <div id="stime" className="stime">
                <div className={"content " + (nightMode ? 'night' : 'day')}>
                    <span style={{ float: 'right' }}>{now.toLocaleTimeString('fa-IR')}</span>
                </div>
            </div>
            <div id="plusLink">
                <div id="gs">
                    <p className="gold">
                        <a href="/gold-shop" title="سکه طلا">
                            <img src="/assets/ui/gold-icon.gif" alt="طلا" className="gold" />
                            <br />
                            {(user?.gold_coins ?? 0).toLocaleString()}
                        </a>
                    </p>
                    <p className="silver">
                        <a href="/hero" title="سکه نقره">
                            <img src="/assets/ui/silver-icon.gif" alt="نقره" className="silver" />
                            <br />
                            {(user?.silver_coins ?? 0).toLocaleString()}
                        </a>
                    </p>
                    <div className="clear"></div>
                </div>
                <div id="plus" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <a href="/plus" className="plusBtn" title="اکانت پلاس">
                        <span className="plusBtn-l"><span className="plus_g">پلاس</span></span>
                        <span className="plusBtn-r">&nbsp;</span>
                    </a>
                    <a href="/messages" className="plusBtn" title="پشتیبانی">
                        <span className="plusBtn-l"><span className="plus_g">پشتیبانی</span></span>
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
                ].map(function(item, idx) {
                    var value = Math.floor(resources[item.key]);
                    var max = item.maxKey === 'maxGranary' ? maxGranary : maxStorage;
                    var percent = Math.min(100, (value / (max || 1)) * 100);
                    var prod = Math.floor(production[item.key] || 0);
                    var barColor = percent > 90 ? '#DE0000' : percent > 70 ? '#F88C1F' : '#006900';
                    return (
                        <li key={item.key} className={"r" + (idx + 1)}
                            title={item.label + " - تولید: " + prod + "/ساعت"}>
                            <p>
                                <img src={item.img} alt={item.label} />
                                <span className="value">{value.toLocaleString()}/{max.toLocaleString()}</span>
                            </p>
                            <div className="bar-bg">
                                <div className="bar" style={{ width: percent + '%', backgroundColor: barColor }}></div>
                            </div>
                        </li>
                    );
                })}
                <li className="r5" title={"مصرف گندم: " + cropConsumption + " - تولید: " + cropProduction + " - تراز: " + (cropNet >= 0 ? '+' : '') + Math.floor(cropNet)}>
                    <p>
                        <img src="/assets/ui/res-5.gif" alt="تراز گندم" />
                        <span className="value">{Math.floor(cropConsumption).toLocaleString()}/{Math.floor(cropProduction).toLocaleString()}</span>
                    </p>
                </li>
            </ul>
        </>
    );
}