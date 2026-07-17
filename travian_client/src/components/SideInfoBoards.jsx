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

export default function SideInfoBoards() {
    const user = useGameStore((state) => state.user);
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const activeVillage = villages.find((v) => v.id === activeVillageId);
    const production = useGameStore((state) => state.production);
    const { lastMessage } = useGameWebSocket();

    const [buildingQueue, setBuildingQueue] = useState([]);
    const [hero, setHero] = useState(null);
    const [now, setNow] = useState(Date.now());

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

    useEffect(() => {
        fetchBuildingQueue();
        fetchHero();
        const interval = setInterval(() => { fetchBuildingQueue(); }, 15000);
        return () => clearInterval(interval);
    }, [fetchBuildingQueue, fetchHero]);

    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'BUILDING_COMPLETE' || lastMessage.type === 'BUILDING_UPGRADE') fetchBuildingQueue();
    }, [lastMessage, fetchBuildingQueue]);

    if (!user) return null;

    const xpForLevel = (level) => Math.max(100, Math.floor(level * level * 100));
    const heroLevel = hero?.level || 1;
    const heroXpCurrent = hero?.experience || 0;
    const heroXpForNext = xpForLevel(heroLevel);
    const heroXpPercent = heroXpForNext > 0 ? Math.min(100, (heroXpCurrent / heroXpForNext) * 100) : 0;

    return (
        <div id="side_info">
            {/* Hero section */}
            <div className="sideInfoHero">
                <div className="heroImageBorder">
                    <div style={{
                        width: '106px',
                        height: '106px',
                        margin: '15px 0 0 8px',
                        background: '#E5E5E5',
                        border: '2px solid #C9C9C9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px',
                    }}>
                        🦸
                    </div>
                </div>
                <a href="/hero" className="heroProfile" title="پروفایل قهرمان" />
                <a href="/hero?tab=adventures" style={{ position: 'absolute', left: '112px', top: '36px', width: '30px', height: '30px' }} title="ماجراجویی‌ها" />
                <a href="/hero?tab=auction" style={{ position: 'absolute', left: '115px', top: '68px', width: '30px', height: '30px' }} title="حراجی" />
            </div>

            {/* Player name */}
            <div className="sideInfoPlayer">
                <a href="/profile" className="signLink">
                    <span className="wrap" style={{ display: 'block', height: '22px', width: '128px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {user.username}
                    </span>
                </a>
            </div>

            {/* Alliance */}
            {user.alliance && (
                <div className="sideInfoAlly">
                    <a href="/embassy" className="signLink">
                        <span className="wrap" style={{ display: 'block', height: '21px', width: '114px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {user.alliance_tag || 'بدون اتحاد'}
                        </span>
                    </a>
                </div>
            )}

            {/* Village list */}
            <div id="villageList">
                {/* Header */}
                <div className="head">
                    <a href="/villages">
                        📊 آمار دهکده‌ها
                    </a>
                </div>

                {/* Village list */}
                <div className="list">
                    <ul>
                        {villages.map((v) => (
                            <li key={v.id}>
                                <a
                                    href="#"
                                    className={v.id === activeVillageId ? 'active' : ''}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        useGameStore.getState().setActiveVillageId(v.id);
                                    }}
                                >
                                    {v.is_capital ? '👑 ' : ''}{v.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer */}
                <div className="foot" />
            </div>

            {/* Building queue */}
            {buildingQueue.length > 0 && (
                <div style={{ position: 'relative', right: '9px', marginTop: '8px', width: '172px' }}>
                    <div style={{ background: '#E5E5E5', borderTop: '1px solid #C9C9C9', borderLeft: '1px solid #C9C9C9', borderRight: '1px solid #C9C9C9', padding: '4px 8px', fontWeight: 'bold', fontSize: '11px' }}>
                        🔨 در حال ساخت
                    </div>
                    <div style={{ background: '#F5F5F5', borderLeft: '1px solid #C9C9C9', borderRight: '1px solid #C9C9C9', borderBottom: '1px solid #C9C9C9', padding: '4px 8px', fontSize: '11px' }}>
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

            {/* Hero stats */}
            {hero && (
                <div style={{ position: 'relative', right: '9px', marginTop: '8px', width: '172px' }}>
                    <div style={{ background: '#E5E5E5', borderTop: '1px solid #C9C9C9', borderLeft: '1px solid #C9C9C9', borderRight: '1px solid #C9C9C9', padding: '4px 8px', fontWeight: 'bold', fontSize: '11px' }}>
                        🦸 قهرمان
                    </div>
                    <div style={{ background: '#F5F5F5', borderLeft: '1px solid #C9C9C9', borderRight: '1px solid #C9C9C9', borderBottom: '1px solid #C9C9C9', padding: '4px 8px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>سطح:</span>
                            <span style={{ fontWeight: 'bold' }}>{hero.level ?? 1}</span>
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                                <span>تجربه</span>
                                <span>{Math.floor(heroXpCurrent)}/{heroXpForNext}</span>
                            </div>
                            <div style={{ width: '100%', height: '3px', background: '#CCC' }}>
                                <div style={{ height: '3px', background: '#99C01A', width: `${heroXpPercent}%` }} />
                            </div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                                <span>❤️ سلامتی</span>
                                <span>{hero.health ?? 100}%</span>
                            </div>
                            <div style={{ width: '100%', height: '3px', background: '#CCC' }}>
                                <div style={{ height: '3px', background: '#DE0000', width: `${hero.health ?? 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
