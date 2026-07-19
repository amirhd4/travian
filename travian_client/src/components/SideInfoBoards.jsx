import { useState, useEffect, useCallback } from 'react';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

function formatCountdown(seconds) {
    if (!seconds || seconds <= 0) return null;
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

const TRIBE_NAMES = { 1: 'رومی‌ها', 2: 'توتون‌ها', 3: 'گل‌ها' };

export default function SideInfoBoards() {
    const user = useGameStore((state) => state.user);
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const activeVillage = villages.find((v) => v.id === activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const [buildingQueue, setBuildingQueue] = useState([]);
    const [hero, setHero] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [serverConfig, setServerConfig] = useState(null);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchBuildingQueue = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get(`game/villages/${activeVillageId}/buildings/`);
            const buildings = data.buildings || [];
            setBuildingQueue(buildings.filter(b => b.is_upgrading && b.upgrade_end_time));
        } catch { /* silent */ }
    }, [activeVillageId]);

    const fetchHero = useCallback(async () => {
        try {
            const { data } = await api.get('combat/hero/');
            setHero(data);
        } catch { /* silent */ }
    }, []);

    const fetchServerConfig = useCallback(async () => {
        try {
            const { data } = await api.get('game/server-status/');
            setServerConfig(data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchBuildingQueue();
        fetchHero();
        fetchServerConfig();
        const interval = setInterval(() => { fetchBuildingQueue(); }, 15000);
        return () => clearInterval(interval);
    }, [fetchBuildingQueue, fetchHero, fetchServerConfig]);

    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'BUILDING_COMPLETE' || lastMessage.type === 'BUILDING_UPGRADE') fetchBuildingQueue();
    }, [lastMessage, fetchBuildingQueue]);

    if (!user) return null;

    const heroGender = hero?.appearance?.gender || 'FEMALE';
    const heroHairStyle = hero?.appearance?.hair_style || 1;

    // Calculate server timers (catapult, inscription, WW plan)
    const nowSec = Math.floor(now / 1000);
    const cataTime = serverConfig?.catapult_release_time || 0;
    const katibeTime = serverConfig?.inscription_release_time || 0;
    const wwPlanTime = serverConfig?.ww_plan_release_time || 0;

    const cataRemaining = cataTime > nowSec ? cataTime - nowSec : 0;
    const katibeRemaining = katibeTime > nowSec ? katibeTime - nowSec : 0;
    const wwPlanRemaining = wwPlanTime > nowSec ? wwPlanTime - nowSec : 0;

    // Medal distribution timer (daily at midnight)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const medalRemaining = Math.max(0, Math.floor((tomorrow.getTime() - now) / 1000));

    return (
    <div id="side_info">
        <div className="sideInfoHero">
            <div className="heroImageBorder"></div>
            <a className="heroProfile" href="/hero" title="قهرمان">
                <img
                    src="/assets/hero/hero-portrait.png"
                    alt="قهرمان"
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
            </a>
            {/* دو دایره کوچیک - href رو خودت مقداردهی کن */}
            <a className="heroLinkTop" href="/hero#adventure" title="ماجراجویی"></a>
            <a className="heroLinkBottom" href="/hero#auction" title="حراجی"></a>
        </div>

        <div className="sideInfoPlayer" title="پروفایل بازیکن">
                <a className="signLink" href="/profile">
                    <span className="wrap">{user.username}</span>
                </a>
                {user.tribe && (
                    <img
                        className={`nationBig nationBig${user.tribe}`}
                        title={TRIBE_NAMES[user.tribe] || ''}
                        src={`/assets/tribes/tribe-${user.tribe}.png`}
                        style={{ position: 'absolute', left: '5px', top: '8px', width: '20px', height: '20px' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                )}
            </div>

            {/* Alliance */}
            {user.alliance_tag && (
                <div className="sideInfoAlly">
                    <a className="signLink" href="/embassy">
                        <span className="wrap">{user.alliance_tag}</span>
                    </a>
                </div>
            )}

            {/* Village list */}
            <div id="villageList" className="listing">
                <div className="head">
                    <a href="/villages" title="نمای کلی دهکده‌ها">آمار دهکده‌ها:</a>
                </div>
                <div className="list">
                    <ul>
                        {villages.map((v) => {
                            const isActive = v.id === activeVillageId;
                            const hasAttacks = v.incoming_attacks > 0;
                            return (
                                <li key={v.id} className={`entry ${hasAttacks ? 'attack' : ''} ${isActive ? 'active' : ''}`}>
                                    <a
                                        href="#"
                                        className={isActive ? 'active' : ''}
                                        title={`${v.name} (${v.y_coord}|${v.x_coord})`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            useGameStore.getState().setActiveVillageId(v.id);
                                        }}
                                    >
                                        {v.name}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div className="foot"></div>
            </div>

            {/* Server timers (catapult, inscription, WW plan) */}
            <div id="villageList" className="listing" style={{ marginTop: '0' }}>
                <div className="head"></div>
                <div className="list" style={{ padding: '8px', marginTop: '-40px', textAlign: 'center', fontSize: '11px' }}>
                    {cataRemaining > 0 ? (
                        <>
                            <span>آزاد شدن منجنیق</span>
                            <br />
                            <b>{formatCountdown(cataRemaining)}</b>
                        </>
                    ) : (
                        <span>منجنیق آزاد شد</span>
                    )}
                    <br />
                    <span style={{ color: '#999' }}>---------</span>
                    <br />
                    {katibeRemaining > 0 ? (
                        <>
                            <span>زمان آزاد شدن کتیبه‌ها</span>
                            <br />
                            <b>{formatCountdown(katibeRemaining)}</b>
                        </>
                    ) : (
                        <span>کتیبه‌ها آزاد شدند</span>
                    )}
                    <br />
                    <span style={{ color: '#999' }}>---------</span>
                    <br />
                    {wwPlanRemaining > 0 ? (
                        <>
                            <span>آزادسازی نقشه ساخت شگفتی</span>
                            <br />
                            <b>{formatCountdown(wwPlanRemaining)}</b>
                        </>
                    ) : (
                        <span>نقشه‌های ساخت شگفتی آزاد شدند</span>
                    )}
                    <br />
                    <span style={{ color: '#999' }}>---------</span>
                </div>
                <div className="foot"></div>
            </div>

            {/* Building queue */}
            {buildingQueue.length > 0 && (
                <div className="sideBuildingQueue">
                    <div className="sideBuildingQueue-header">
                        در حال ساخت
                    </div>
                    <div className="sideBuildingQueue-body">
                        {buildingQueue.slice(0, 3).map((b, i) => {
                            const endTime = new Date(b.upgrade_end_time).getTime();
                            const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
                            return (
                                <div key={i} style={{ marginBottom: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{b.name}</span>
                                        <span style={{ color: '#F88C1F', fontWeight: 'bold' }}>Lv.{b.level + 1}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ flex: 1, height: '3px', background: '#CCC' }}>
                                            <div style={{ height: '3px', background: '#FF0', width: '50%' }} />
                                        </div>
                                        <span style={{ fontSize: '10px', color: '#99C01A' }}>{formatCountdown(remaining)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
