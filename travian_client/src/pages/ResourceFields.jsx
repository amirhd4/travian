import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from "../utils/formatter.js";

// PHP field.tpl exact coordinates (scaled to 500x370 canvas)
const DORF1_SLOTS = {
    1: { x: 180, y: 80 }, 2: { x: 269, y: 81 }, 3: { x: 338, y: 93 },
    4: { x: 122, y: 119 }, 5: { x: 235, y: 132 }, 6: { x: 292, y: 139 },
    7: { x: 377, y: 137 }, 8: { x: 62, y: 170 }, 9: { x: 143, y: 171 },
    10: { x: 333, y: 171 }, 11: { x: 420, y: 171 }, 12: { x: 70, y: 231 },
    13: { x: 143, y: 221 }, 14: { x: 279, y: 257 }, 15: { x: 401, y: 226 },
    16: { x: 174, y: 311 }, 17: { x: 265, y: 316 }, 18: { x: 355, y: 293 },
};

// PHP field type to image mapping
const FIELD_IMAGES = {
    1: '/assets/fields/f1.jpg',  // Woodcutter
    2: '/assets/fields/f2.jpg',  // Clay Pit
    3: '/assets/fields/f3.jpg',  // Iron Mine
    4: '/assets/fields/f4.jpg',  // Cropland
};

// PHP village terrain type to background image
const VILLAGE_BACKGROUNDS = {
    1: '/assets/fields/f1.jpg',
    2: '/assets/fields/f2.jpg',
    3: '/assets/fields/f3.jpg',
    4: '/assets/fields/f4.jpg',
    5: '/assets/fields/f5.jpg',
    6: '/assets/fields/f6.jpg',
    7: '/assets/fields/f7.jpg',
    8: '/assets/fields/f8.jpg',
    9: '/assets/fields/f9.jpg',
    10: '/assets/fields/f10.jpg',
    11: '/assets/fields/f11.jpg',
    12: '/assets/fields/f12.jpg',
};

// Resource type to field image key
const RESOURCE_TO_FIELD = {
    'چوب‌بری': 1, 'گودال خاک رس': 2, 'معدن آهن': 3, 'مزرعه گندم': 4,
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

    // Movement and troop data
    const [movements, setMovements] = useState([]);
    const [troops, setTroops] = useState([]);

    const pixiContainerRef = useRef(null);
    const pixiAppRef = useRef(null);

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
            const { data } = await api.get(`game/villages/${activeVillageId}/movements/`);
            setMovements(data.movements || []);
        } catch { /* silent */ }
    }, [activeVillageId]);

    const fetchTroops = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get(`game/villages/${activeVillageId}/troops/`);
            setTroops(data.troops || []);
        } catch { /* silent */ }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchBuildings(); fetchMovements(); fetchTroops(); }, [fetchBuildings, fetchMovements, fetchTroops]);
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

    // PixiJS village map rendering
    useEffect(() => {
        if (loading || !pixiContainerRef.current) return;
        let isMounted = true;
        const app = new PIXI.Application();

        async function initPixi() {
            await app.init({
                width: 500, height: 370,
                backgroundColor: 0xC3EDAE,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true, antialias: true,
            });
            if (!isMounted) { app.destroy(true, { children: true }); return; }
            pixiAppRef.current = app;
            pixiContainerRef.current.innerHTML = '';
            pixiContainerRef.current.appendChild(app.canvas);
            renderScene(app);
        }

        async function renderScene(app) {
            app.stage.removeChildren();

            // Background: try to load village terrain image
            const terrainType = villageInfo?.terrain_type || 1;
            const bgPath = VILLAGE_BACKGROUNDS[terrainType] || '/assets/fields/f1.jpg';
            try {
                const bgTexture = await PIXI.Assets.load(bgPath);
                const bgSprite = new PIXI.Sprite(bgTexture);
                bgSprite.width = app.screen.width;
                bgSprite.height = app.screen.height;
                app.stage.addChild(bgSprite);
            } catch {
                // Fallback: solid green background
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xC3EDAE });
                app.stage.addChild(bg);
            }

            // Render resource fields
            const activeBuildings = buildings.filter(b => DORF1_SLOTS[b.position]);

            for (const b of activeBuildings) {
                const coords = DORF1_SLOTS[b.position];
                const container = new PIXI.Container();
                container.x = coords.x;
                container.y = coords.y;

                // Field image
                const fieldType = RESOURCE_TO_FIELD[b.name] || 4;
                const fieldPath = FIELD_IMAGES[fieldType] || FIELD_IMAGES[4];

                if (b.level > 0 || b.is_upgrading) {
                    try {
                        const texture = await PIXI.Assets.load(fieldPath);
                        const sprite = new PIXI.Sprite(texture);
                        sprite.anchor.set(0.5);
                        sprite.width = 50;
                        sprite.height = 50;
                        container.addChild(sprite);
                    } catch {
                        // Fallback: colored circle
                        const fallback = new PIXI.Graphics();
                        fallback.circle(0, 0, 25).fill({ color: fieldType === 1 ? 0x2f6b3a : fieldType === 2 ? 0xb5652f : fieldType === 3 ? 0x5b6470 : 0xd9a62e });
                        container.addChild(fallback);
                    }
                } else {
                    // Empty field: subtle placeholder
                    const placeholder = new PIXI.Graphics();
                    placeholder.circle(0, 0, 20).fill({ color: 0x999999, alpha: 0.3 }).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
                    container.addChild(placeholder);
                }

                // PHP-style level badge: green gradient circle
                if (b.level > 0 || b.is_upgrading) {
                    // Outer border
                    const badgeBorder = new PIXI.Graphics();
                    badgeBorder.circle(0, 0, 14).fill({ color: 0x506d00 });
                    badgeBorder.x = 20;
                    badgeBorder.y = 20;
                    container.addChild(badgeBorder);

                    // Green gradient fill
                    const badge = new PIXI.Graphics();
                    badge.circle(0, 0, 12).fill({ color: 0x7da100 });
                    badge.x = 20;
                    badge.y = 20;
                    container.addChild(badge);

                    // Level text
                    const lvlText = new PIXI.Text({
                        text: b.level.toString(),
                        style: { fontFamily: 'Arial, Helvetica, Verdana', fontSize: 11, fill: 0xFFFFFF, fontWeight: 'bold' }
                    });
                    lvlText.anchor.set(0.5);
                    lvlText.x = 20;
                    lvlText.y = 20;
                    container.addChild(lvlText);
                }

                // Upgrading indicator
                if (b.is_upgrading) {
                    const ring = new PIXI.Graphics();
                    ring.circle(0, 0, 28).stroke({ width: 2, color: 0xF88C1F, alpha: 0.9 });
                    container.addChild(ring);
                }

                container.eventMode = 'static';
                container.cursor = 'pointer';
                container.on('pointerover', () => { container.scale.set(1.08); });
                container.on('pointerout', () => { container.scale.set(1); });
                container.on('pointerdown', () => setSelectedSlot(b));

                app.stage.addChild(container);
            }
        }

        initPixi();
        return () => {
            isMounted = false;
            if (pixiAppRef.current) { pixiAppRef.current.destroy(true, { children: true }); pixiAppRef.current = null; }
        };
    }, [loading, buildings, villageInfo]);

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

    // Get movement type label and color (matching PHP movement.tpl)
    const getMovementInfo = (type) => {
        const types = {
            'incoming_attack': { label: 'حمله', color: '#F00', icon: 'att1', aclass: 'a1' },
            'incoming_reinforcement': { label: 'نیروی کمکی ورودی', color: '#228B22', icon: 'def1', aclass: 'd1' },
            'outgoing_attack': { label: 'حمله', color: '#F2C700', icon: 'att2', aclass: 'a2' },
            'outgoing_reinforcement': { label: 'نیروی کمکی خروجی', color: '#F2C700', icon: 'def2', aclass: 'd2' },
            'new_village': { label: 'تأسیس دهکده', color: '#B500A3', icon: 'att3', aclass: 'a3' },
            'adventure': { label: 'ماجراجویی', color: '#B500A3', icon: 'att4', aclass: 'a4' },
        };
        return types[type] || { label: type, color: '#333', icon: '', aclass: '' };
    };

    return (
        <div className="village1">
            {/* Village Map - PixiJS Canvas */}
            <div id="village_map">
                {loading ? (
                    <p style={{ fontWeight: 'bold', marginTop: '64px', color: '#252525' }}>در حال بارگذاری دهکده...</p>
                ) : (
                    <div ref={pixiContainerRef} style={{ width: '500px', height: '370px' }} />
                )}
            </div>

            {/* Map Details: Movements, Production, Troops */}
            <div id="map_details">
                {/* Troop Movements */}
                {movements.length > 0 && (
                    <div className="boxes villageList movements">
                        <div className="boxes-contents">
                            <table id="movements" cellPadding="1" cellSpacing="1">
                                <thead>
                                    <tr><th colSpan="3">حرکت نیروها</th></tr>
                                </thead>
                                <tbody>
                                    {movements.map((m, i) => {
                                        const info = getMovementInfo(m.type);
                                        const remaining = m.end_time ? Math.max(0, Math.floor((new Date(m.end_time).getTime() - Date.now()) / 1000)) : 0;
                                        return (
                                            <tr key={i}>
                                                <td className="typ">
                                                    <span className={info.aclass}>&raquo;</span>
                                                </td>
                                                <td>
                                                    <div className="mov">
                                                        <span className={info.aclass}>{m.count || 1} {info.label}</span>
                                                    </div>
                                                    <div className="dur_r">
                                                        &nbsp;<span>{formatCountdown(remaining)}</span>&nbsp;ساعت
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Production Table */}
                {villageInfo && (
                    <div className="boxes villageList production">
                        <div className="boxes-contents">
                            <table id="production" cellPadding="1" cellSpacing="1">
                                <thead>
                                    <tr><th colSpan="3">تولید منابع</th></tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="ico"><img className="r1" src="/assets/ui/res-1.gif" alt="چوب" /></td>
                                        <td className="res">چوب:</td>
                                        <td className="num">{villageInfo.production?.wood ?? 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="ico"><img className="r2" src="/assets/ui/res-2.gif" alt="خاک رس" /></td>
                                        <td className="res">خاک رس:</td>
                                        <td className="num">{villageInfo.production?.clay ?? 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="ico"><img className="r3" src="/assets/ui/res-3.gif" alt="آهن" /></td>
                                        <td className="res">آهن:</td>
                                        <td className="num">{villageInfo.production?.iron ?? 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="ico"><img className="r4" src="/assets/ui/res-4.gif" alt="گندم" /></td>
                                        <td className="res">گندم:</td>
                                        <td className="num">{villageInfo.production?.crop ?? 0}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Stationed Troops */}
                {troops.length > 0 && (
                    <div className="boxes villageList units">
                        <div className="boxes-contents">
                            <table id="troops" cellPadding="1" cellSpacing="1">
                                <thead>
                                    <tr><th colSpan="3">نیروهای مستقر</th></tr>
                                </thead>
                                <tbody>
                                    {troops.map((t, i) => (
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

            {/* Upgrade Dialog */}
            {selectedSlot && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#FFF', border: '2px solid #C9C9C9', maxWidth: '400px', width: '100%', position: 'relative' }}>
                        {/* Header */}
                        <div className="round" style={{ width: '100%', boxSizing: 'border-box', margin: 0, left: 0 }}>
                            <span>{selectedSlot.level > 0 ? selectedSlot.name : 'زمین خالی'}</span>
                        </div>
                        {/* Body */}
                        <div style={{ padding: '12px' }}>
                            <p style={{ fontSize: '13px', marginBottom: '12px', color: '#252525' }}>
                                سطح فعلی: <span style={{ fontWeight: 'bold' }}>{selectedSlot.level}</span>
                            </p>

                            {selectedSlot.is_upgrading ? (
                                <div style={{ padding: '12px', textAlign: 'center', marginBottom: '16px', background: '#ffe4b5', border: '1px solid #F88C1F' }}>
                                    <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#b3721f', margin: 0 }}>در حال ارتقا...</p>
                                </div>
                            ) : selectedSlot.is_max_level ? (
                                <div style={{ padding: '12px', textAlign: 'center', marginBottom: '16px', background: '#E5EECC', border: '1px solid #99C01A' }}>
                                    <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#228B22', margin: 0 }}>این مزرعه به حداکثر سطح رسیده است.</p>
                                </div>
                            ) : (
                                <div style={{ padding: '16px', marginBottom: '16px', fontSize: '13px', background: '#F5F5F5', border: '1px solid #C9C9C9' }}>
                                    <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#252525' }}>هزینه ارتقا به سطح {selectedSlot.level + 1}:</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', fontWeight: 'bold', marginBottom: '12px', color: '#252525' }}>
                                        <span>چوب: {selectedSlot.next_level_cost.wood}</span>
                                        <span>خاک رس: {selectedSlot.next_level_cost.clay}</span>
                                        <span>آهن: {selectedSlot.next_level_cost.iron}</span>
                                        <span>گندم: {selectedSlot.next_level_cost.crop}</span>
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#777', margin: 0 }}>زمان ساخت: {formatDuration(selectedSlot.next_level_time_seconds)}</p>
                                    {!canAfford(selectedSlot) && <p style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '12px', color: '#DE0000' }}>منابع کافی ندارید.</p>}
                                </div>
                            )}

                            <button onClick={handleUpgrade}
                                disabled={selectedSlot.is_upgrading || upgrading || selectedSlot.is_max_level || !canAfford(selectedSlot)}
                                className="btn-primary"
                                style={{ width: '100%', padding: '8px 20px' }}>
                                {upgrading ? "صبر کنید..." : `ارتقا به سطح ${selectedSlot.level + 1}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
