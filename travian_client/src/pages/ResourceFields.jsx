import { useEffect, useState, useCallback } from 'react';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from "../utils/formatter.js";

// مختصات جدید و کاملا قرینه شده، مخصوص زمانی که عکس پس‌زمینه scaleX(-1) دارد
// تنظیم شده برای بوم دقیق 484x317
const DORF1_SLOTS = {
    1: { x: 242, y: 40 },   // بالا مرکز (مزرعه گندم)
    2: { x: 145, y: 65 },   // بالا چپ 1 (جنگل چوب)
    3: { x: 95, y: 105 },   // بالا چپ 2 (جنگل چوب)
    4: { x: 60, y: 160 },   // چپ دور (مزرعه گندم)
    5: { x: 105, y: 245 },  // پایین چپ 1 (گودال خشت)
    6: { x: 160, y: 275 },  // پایین چپ 2 (گودال خشت)
    7: { x: 242, y: 285 },  // پایین مرکز (جنگل چوب)
    8: { x: 324, y: 275 },  // پایین راست 1 (گودال خشت)
    9: { x: 379, y: 245 },  // پایین راست 2 (گودال خشت)
    10: { x: 424, y: 160 }, // راست دور (مزرعه گندم)
    11: { x: 389, y: 105 }, // بالا راست 1 (معدن آهن)
    12: { x: 339, y: 65 },  // بالا راست 2 (معدن آهن)
    // حلقه داخلی (دور خندق دهکده)
    13: { x: 185, y: 115 }, // داخلی بالا چپ
    14: { x: 155, y: 175 }, // داخلی چپ
    15: { x: 185, y: 225 }, // داخلی پایین چپ
    16: { x: 299, y: 225 }, // داخلی پایین راست
    17: { x: 329, y: 175 }, // داخلی راست
    18: { x: 299, y: 115 }, // داخلی بالا راست
};

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

export default function ResourceFields() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const [villageInfo, setVillageInfo] = useState(null);
    const [buildings, setBuildings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [upgrading, setUpgrading] = useState(false);
    const [bgFailed, setBgFailed] = useState(false);

    const [movements, setMovements] = useState([]);
    const [troops, setTroops] = useState([]);

    const fetchBuildings = useCallback(async () => {
        if (!activeVillageId) { setLoading(false); return; }
        try {
            const { data } = await api.get(`game/villages/${activeVillageId}/buildings/`);
            setVillageInfo(data.village);
            setBuildings(data.buildings);
        } catch (error) {
            console.error("خطا در دریافت اطلاعات دهکده", error);
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    const fetchMovements = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get(`combat/movements/?village_id=${activeVillageId}`);
            setMovements([...(data.outgoing || []).map(m => ({...m, direction: "outgoing"})), ...(data.incoming || []).map(m => ({...m, direction: "incoming"}))]);
        } catch { /* silent */ }
    }, [activeVillageId]);

    const fetchTroops = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get(`combat/village-troops/?village_id=${activeVillageId}`);
            setTroops(Array.isArray(data) ? data : (data.troops || []));
        } catch { /* silent */ }
    }, [activeVillageId]);

    useEffect(() => {
        setLoading(true);
        fetchBuildings();
        fetchMovements();
        fetchTroops();
    }, [fetchBuildings, fetchMovements, fetchTroops]);

    useEffect(() => {
        if (lastMessage?.type === 'building_completed') {
            fetchBuildings();
            fetchMovements();
            fetchTroops();
        }
    }, [lastMessage, fetchBuildings, fetchMovements, fetchTroops]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchBuildings();
            fetchMovements();
            fetchTroops();
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchBuildings, fetchMovements, fetchTroops]);

    const handleUpgrade = async () => {
        if (!selectedSlot || !activeVillageId) return;
        setUpgrading(true);
        try {
            await api.post('game/upgrade-building/', { village_id: activeVillageId, position: selectedSlot.position });
            setSelectedSlot(null);
            fetchBuildings();
        } catch (error) {
            alert(error.response?.data?.error || "خطا در ارتقای ساختمان");
        } finally {
            setUpgrading(false);
        }
    };

    const canAfford = (building) => {
        if (!villageInfo || !building.next_level_cost) return false;
        const r = villageInfo.resources, c = building.next_level_cost;
        return r.wood >= c.wood && r.clay >= c.clay && r.iron >= c.iron && r.crop >= c.crop;
    };

    const getMovementInfo = (type) => {
        const types = {
            'incoming_attack': { label: 'حمله', aclass: 'a1' },
            'incoming_reinforcement': { label: 'نیروی کمکی ورودی', aclass: 'd1' },
            'outgoing_attack': { label: 'حمله', aclass: 'a2' },
            'outgoing_reinforcement': { label: 'نیروی کمکی خروجی', aclass: 'd2' },
            'new_village': { label: 'تأسیس دهکده', aclass: 'a3' },
            'adventure': { label: 'ماجراجویی', aclass: 'a4' },
        };
        return types[type] || { label: type, aclass: '' };
    };

    const activeSlots = buildings.filter((b) => DORF1_SLOTS[b.position]);

    return (
        <div className="village1">
            <div id="village_map" style={{ position: 'relative', width: '484px', height: '317px', top: "90px", left: "-100px", margin: '0 auto', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}>
                {loading ? (
                    <p style={{ fontWeight: 'bold', paddingTop: '160px', color: '#252525', textAlign: 'center' }}>
                        در حال بارگذاری دهکده...
                    </p>
                ) : (
                    <>
                        {/* عکس پس زمینه که با دستور scaleX(-1) برعکس شده است */}
                        {!bgFailed ? (
                            <img
                                src="/assets/bgs/f3-rtl.jpg"
                                alt="Village Map"
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, transform: 'scaleX(-1)' }}
                                onError={() => setBgFailed(true)}
                            />
                        ) : (
                            <div style={{ position: 'absolute', inset: 0, background: '#C3EDAE', zIndex: 0 }} />
                        )}

                        {activeSlots.map((b) => {
                            const coords = DORF1_SLOTS[b.position];
                            const isEmpty = b.level === 0 && !b.is_upgrading;

                            return (
                                <div
                                    key={b.id}
                                    className={`level-indicator ${b.is_upgrading ? 'upgrading' : ''} ${isEmpty ? 'empty' : 'active'}`}
                                    style={{
                                        position: 'absolute',
                                        left: coords.x,
                                        top: coords.y,
                                        transform: 'translate(-50%, -50%)', // نکته مهم: دایره‌ها scaleX نمی‌شوند تا اعداد درست خوانده شوند
                                        zIndex: 5
                                    }}
                                    onClick={() => setSelectedSlot(b)}
                                    title={b.name}
                                >
                                    {!isEmpty ? b.level : '+'}
                                </div>
                            );
                        })}
                    </>
                )}

                <style>{`
                    .level-indicator { 
                        width: 28px; 
                        height: 28px; 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        font-weight: bold; 
                        font-size: 13px; 
                        cursor: pointer; 
                        box-shadow: 0 1px 4px rgba(0,0,0,0.6); 
                        transition: all 0.2s ease;
                        font-family: Tahoma, Arial, sans-serif;
                    }
                    .level-indicator.active {
                        background-color: #ffffff; 
                        border: 2px solid #73b544;
                        color: #252525;
                    }
                    .level-indicator.upgrading { 
                        background-color: #fce2a8; 
                        border: 2px solid #f88c1f;
                        color: #a65a12;
                    }
                    .level-indicator.empty {
                        background-color: rgba(255,255,255,0.6);
                        border: 2px dashed #73b544;
                        color: rgba(37,37,37,0.5);
                    }
                    .level-indicator:hover { 
                        transform: translate(-50%, -50%) scale(1.2) !important; 
                        z-index: 10 !important;
                    }
                    .level-indicator.empty:hover {
                        background-color: #ffffff;
                        color: #252525;
                    }
                `}</style>
            </div>

            <div id="map_details" style={{ marginTop: '20px' }}>
                {movements.length > 0 && (
                    <div className="boxes villageList movements">
                        <div className="boxes-tl"></div>
                        <div className="boxes-tr"></div>
                        <div className="boxes-tc"></div>
                        <div className="boxes-ml"></div>
                        <div className="boxes-mr"></div>
                        <div className="boxes-mc"></div>
                        <div className="boxes-bl"></div>
                        <div className="boxes-br"></div>
                        <div className="boxes-bc"></div>
                        <div className="boxes-contents">
                            <table id="movements" cellPadding="1" cellSpacing="1">
                                <thead>
                                    <tr><th colSpan="3">حرکت نیروها</th></tr>
                                </thead>
                                <tbody>
                                    {movements.map((m, i) => {
                                        const info = getMovementInfo(m);
                                        const remaining = m.end_time ? Math.max(0, Math.floor((new Date(m.end_time).getTime() - Date.now()) / 1000)) : 0;
                                        return (
                                            <tr key={i}>
                                                <td className="typ"><span className={info.aclass}>&raquo;</span></td>
                                                <td>
                                                    <div className="mov"><span className={info.aclass}>{m.count || 1} {info.label}</span></div>
                                                    <div className="dur_r">&nbsp;<span>{formatCountdown(remaining)}</span>&nbsp;ساعت</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                

                {villageInfo && (
                    <div className="boxes villageList production">
                        <div className="boxes-tl"></div>
                        <div className="boxes-tr"></div>
                        <div className="boxes-tc"></div>
                        <div className="boxes-ml"></div>
                        <div className="boxes-mr"></div>
                        <div className="boxes-mc"></div>
                        <div className="boxes-bl"></div>
                        <div className="boxes-br"></div>
                        <div className="boxes-bc"></div>
                        <div className="boxes-contents">
                            <table id="production" cellPadding="1" cellSpacing="1">
                                <thead>
                                    <tr><th colSpan="4">تولید منابع</th></tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="ico"><div><img className="r1Big" src="/assets/ui/res-1.gif" alt="چوب" title="چوب" /></div></td>
                                        <td className="res">چوب:</td>
                                        <td className="num">{villageInfo.production?.wood ?? 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="ico"><div><img className="r2Big" src="/assets/ui/res-2.gif" alt="خاک رس" title="خاک رس" /></div></td>
                                        <td className="res">خاک رس:</td>
                                        <td className="num">{villageInfo.production?.clay ?? 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="ico"><div><img className="r3Big" src="/assets/ui/res-3.gif" alt="آهن" title="آهن" /></div></td>
                                        <td className="res">آهن:</td>
                                        <td className="num">{villageInfo.production?.iron ?? 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="ico"><div><img className="r4Big" src="/assets/ui/res-4.gif" alt="گندم" title="گندم" /></div></td>
                                        <td className="res">گندم:</td>
                                        <td className="num">{villageInfo.production?.crop ?? 0}</td>
                                    </tr>
                                    <tr style={{ borderTop: '2px solid #99C01A' }}>
                                        <td className="ico"><div><img className="r5Big" src="/assets/ui/res-5.gif" alt="مصرف" title="مصرف گندم" /></div></td>
                                        <td className="res">مصرف گندم:</td>
                                        <td className="num" style={{ color: '#DE0000' }}>-{villageInfo.crop_consumption ?? 0}</td>
                                    </tr>
                                    <tr style={{ borderTop: '1px solid #CCC' }}>
                                        <td className="ico"></td>
                                        <td className="res" style={{ fontWeight: 'bold' }}>تراز گندم:</td>
                                        <td className="num" style={{ fontWeight: 'bold', color: ((villageInfo.production?.crop ?? 0) - (villageInfo.crop_consumption ?? 0)) >= 0 ? '#228B22' : '#DE0000' }}>
                                            {((villageInfo.production?.crop ?? 0) - (villageInfo.crop_consumption ?? 0)) >= 0 ? '+' : ''}{Math.round((villageInfo.production?.crop ?? 0) - (villageInfo.crop_consumption ?? 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {troops.length > 0 && (
                    <div className="boxes villageList units">
                        <div className="boxes-tl"></div>
                        <div className="boxes-tr"></div>
                        <div className="boxes-tc"></div>
                        <div className="boxes-ml"></div>
                        <div className="boxes-mr"></div>
                        <div className="boxes-mc"></div>
                        <div className="boxes-bl"></div>
                        <div className="boxes-br"></div>
                        <div className="boxes-bc"></div>
                        <div className="boxes-contents">
                            <table id="troops" cellPadding="1" cellSpacing="1">
                                <thead>
                                    <tr><th colSpan="3">نیروهای مستقر در دهکده</th></tr>
                                </thead>
                                <tbody>
                                    {troops.length > 0 && (
                                    <tr style={{ background: '#E5EECC' }}>
                                        <td className="ico"><img className="unit uhero" src="/assets/troops/hero-portrait.png" alt="قهرمان" title="قهمان" onError={(e) => { e.target.style.display = 'none'; }} /></td>
                                        <td className="num" style={{ fontWeight: 'bold' }}>{troops.reduce((sum, t) => sum + (t.is_hero ? t.count : 0), 0) || '-'}</td>
                                        <td className="un" style={{ fontWeight: 'bold' }}>قهرمان</td>
                                    </tr>
                                )}
                                {troops.filter(t => !t.is_hero).map((t, i) => (
                                        <tr key={i}>
                                            <td className="ico">
                                                <img className={`unit u${t.unit_id}`} src={`/assets/troops/unit-${t.unit_id}.gif`} alt={t.name} title={t.name} />
                                            </td>
                                            <td className="num">{t.count}</td>
                                            <td className="un">{t.name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="clear" />

            {selectedSlot && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#FFF', border: '2px solid #C9C9C9', borderRadius: '8px', maxWidth: '400px', width: '100%', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
                        <div style={{ background: '#f8f8f8', padding: '12px 16px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{selectedSlot.level > 0 ? selectedSlot.name : 'زمین خالی'}</span>
                            <button onClick={() => setSelectedSlot(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#888' }}>✖</button>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <p style={{ fontSize: '14px', marginBottom: '16px', color: '#333' }}>
                                سطح فعلی: <span style={{ fontWeight: 'bold', color: '#73b544' }}>{selectedSlot.level}</span>
                            </p>

                            {selectedSlot.is_upgrading ? (
                                <div style={{ padding: '12px', textAlign: 'center', marginBottom: '16px', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '4px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#856404', margin: 0 }}>در حال ارتقا...</p>
                                </div>
                            ) : selectedSlot.is_max_level ? (
                                <div style={{ padding: '12px', textAlign: 'center', marginBottom: '16px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#155724', margin: 0 }}>این مزرعه به حداکثر سطح رسیده است.</p>
                                </div>
                            ) : (
                                <div style={{ padding: '16px', marginBottom: '16px', fontSize: '13px', background: '#fdfdfd', border: '1px solid #eee', borderRadius: '4px' }}>
                                    <p style={{ fontWeight: 'bold', marginBottom: '12px', color: '#444' }}>هزینه ارتقا به سطح {selectedSlot.level + 1}:</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', fontWeight: 'bold', marginBottom: '16px', color: '#222' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><img src="/assets/ui/res-1.gif" alt="چوب" width="14" /> {selectedSlot.next_level_cost.wood}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><img src="/assets/ui/res-2.gif" alt="رس" width="14" /> {selectedSlot.next_level_cost.clay}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><img src="/assets/ui/res-3.gif" alt="آهن" width="14" /> {selectedSlot.next_level_cost.iron}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><img src="/assets/ui/res-4.gif" alt="گندم" width="14" /> {selectedSlot.next_level_cost.crop}</span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#666', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        🕒 زمان ساخت: <span style={{ fontWeight: 'bold' }}>{formatDuration(selectedSlot.next_level_time_seconds)}</span>
                                    </p>
                                    {!canAfford(selectedSlot) && <p style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '12px', color: '#dc3545', textAlign: 'center' }}>منابع کافی ندارید.</p>}
                                </div>
                            )}

                            <button onClick={handleUpgrade}
                                disabled={selectedSlot.is_upgrading || upgrading || selectedSlot.is_max_level || !canAfford(selectedSlot)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: (selectedSlot.is_upgrading || upgrading || selectedSlot.is_max_level || !canAfford(selectedSlot)) ? '#ccc' : '#73b544',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    cursor: (selectedSlot.is_upgrading || upgrading || selectedSlot.is_max_level || !canAfford(selectedSlot)) ? 'not-allowed' : 'pointer',
                                    transition: 'background 0.2s'
                                }}>
                                {upgrading ? "صبر کنید..." : `ارتقا به سطح ${selectedSlot.level + 1}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}