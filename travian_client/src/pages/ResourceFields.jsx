import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from "../utils/formatter.js";

const DORF1_SLOTS = {
    1: { x: 150, y: 100 }, 2: { x: 250, y: 70 }, 3: { x: 370, y: 70 }, 4: { x: 470, y: 100 },
    5: { x: 520, y: 180 }, 6: { x: 540, y: 280 }, 7: { x: 480, y: 360 }, 8: { x: 380, y: 400 },
    9: { x: 240, y: 400 }, 10: { x: 140, y: 360 }, 11: { x: 80, y: 280 }, 12: { x: 100, y: 180 },
    13: { x: 210, y: 150 }, 14: { x: 310, y: 130 }, 15: { x: 410, y: 150 }, 16: { x: 430, y: 250 },
    17: { x: 360, y: 320 }, 18: { x: 260, y: 320 },
};

// رنگ متفاوت برای هر دسته منبع - وقتی عکس نیست هم قابل تشخیصه
const RESOURCE_COLORS = {
    'چوب‌بری': 0x2f6b3a,
    'گودال خاک رس': 0xb5652f,
    'معدن آهن': 0x5b6470,
    'مزرعه گندم': 0xd9a62e,
};
const RESOURCE_ICONS = {
    'چوب‌بری': '🪵', 'گودال خاک رس': '🧱', 'معدن آهن': '⚒️', 'مزرعه گندم': '🌾',
};

// مسیر پیشنهادی عکس هر مزرعه: /assets/fields/{name}.jpg (اگر نبود، دایره‌ی رنگی جایگزین می‌شود)
const getAssetPath = (building) => {
    if (building.level === 0 && !building.is_upgrading) return null;
    const nameMap = {
        'چوب‌بری': '/assets/fields/f1.jpg',
        'گودال خاک رس': '/assets/fields/f2.jpg',
        'معدن آهن': '/assets/fields/f3.jpg',
        'مزرعه گندم': '/assets/fields/f4.jpg',
    };
    return nameMap[building.name] || null;
};

export default function ResourceFields() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const [villageInfo, setVillageInfo] = useState(null);
    const [buildings, setBuildings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [upgrading, setUpgrading] = useState(false);

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

    useEffect(() => { setLoading(true); fetchBuildings(); }, [fetchBuildings]);
    useEffect(() => { if (lastMessage?.type === 'building_completed') fetchBuildings(); }, [lastMessage, fetchBuildings]);
    useEffect(() => {
        const interval = setInterval(fetchBuildings, 30000);
        return () => clearInterval(interval);
    }, [fetchBuildings]);

    useEffect(() => {
        if (loading || !pixiContainerRef.current) return;
        let isMounted = true;
        const app = new PIXI.Application();

        async function initPixi() {
            await app.init({
                width: 555, height: 420,
                backgroundColor: 0x8ab961,
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

            // پس‌زمینه: تلاش برای بارگذاری عکس، وگرنه گرادیانت چمنزار زیبا
            try {
                const bgTexture = await PIXI.Assets.load('/assets/maps/f3-rtl.jpg');
                const bgSprite = new PIXI.Sprite(bgTexture);
                bgSprite.width = app.screen.width;
                bgSprite.height = app.screen.height;
                app.stage.addChild(bgSprite);
            } catch {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x8fbf6b });
                for (let i = 0; i < 40; i++) {
                    bg.circle(Math.random() * app.screen.width, Math.random() * app.screen.height, Math.random() * 3 + 1)
                        .fill({ color: 0x7aab58, alpha: 0.5 });
                }
                app.stage.addChild(bg);
            }

            const activeBuildings = buildings.filter(b => DORF1_SLOTS[b.position]);

            for (const b of activeBuildings) {
                const coords = DORF1_SLOTS[b.position];
                const container = new PIXI.Container();
                container.x = coords.x;
                container.y = coords.y;

                const assetPath = getAssetPath(b);

                // Load and display the actual field image
                if (assetPath) {
                    try {
                        const texture = await PIXI.Assets.load(assetPath);
                        const sprite = new PIXI.Sprite(texture);
                        sprite.anchor.set(0.5);
                        sprite.width = 64; sprite.height = 64;
                        container.addChild(sprite);
                    } catch(e) {
                        // If image fails, show icon
                        const icon = new PIXI.Text({ text: RESOURCE_ICONS[b.name] || '❔', style: { fontSize: 26 } });
                        icon.anchor.set(0.5);
                        container.addChild(icon);
                    }
                } else {
                    // Level 0 - show a subtle placeholder
                    const placeholder = new PIXI.Graphics();
                    placeholder.circle(0, 0, 28)
                        .fill({ color: RESOURCE_COLORS[b.name] || 0x999999, alpha: 0.2 })
                        .stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
                    container.addChild(placeholder);
                    const icon = new PIXI.Text({ text: RESOURCE_ICONS[b.name] || '❔', style: { fontSize: 22 } });
                    icon.anchor.set(0.5);
                    container.addChild(icon);
                }

                // بج سطح - بزرگ‌تر و خواناتر از قبل
                if (b.level > 0 || b.is_upgrading) {
                    const badge = new PIXI.Graphics();
                    badge.circle(0, 0, 15).fill({ color: 0xf5b638 }).stroke({ width: 2.5, color: 0x1c1710 });
                    badge.x = 24; badge.y = 24;

                    const lvlText = new PIXI.Text({
                        text: b.level.toString(),
                        style: { fontFamily: 'Vazirmatn, Tahoma', fontSize: 15, fill: 0x1c1710, fontWeight: 'bold' }
                    });
                    lvlText.anchor.set(0.5);
                    lvlText.x = 24; lvlText.y = 24;
                    container.addChild(badge, lvlText);
                }

                if (b.is_upgrading) {
                    const ring = new PIXI.Graphics();
                    ring.circle(0, 0, 33).stroke({ width: 3, color: 0xf5b638, alpha: 0.9 });
                    container.addChild(ring);
                    const hammer = new PIXI.Text({ text: '🔨', style: { fontSize: 16 } });
                    hammer.anchor.set(0.5);
                    hammer.x = -24; hammer.y = -24;
                    container.addChild(hammer);
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
    }, [loading, buildings]);

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

    return (
        <div>
            {loading ? (
                <p style={{ fontWeight: 'bold', marginTop: '64px', color: '#252525' }}>در حال بارگذاری دهکده...</p>
            ) : (
                <div>
                    {villageInfo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span className="badge-green">
                                👥 جمعیت: {villageInfo.population?.toLocaleString() ?? '—'}
                            </span>
                            <span className="badge-gold">
                                {villageInfo.name}
                            </span>
                        </div>
                    )}

                    {/* PixiJS canvas */}
                    <div style={{ border: '1px solid #C9C9C9', background: '#C3EDAE', width: '100%', maxWidth: '555px', overflow: 'hidden' }}>
                        <div ref={pixiContainerRef} style={{ width: '555px', height: '420px' }} />
                    </div>
                </div>
            )}

            {selectedSlot && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#FFF', border: '2px solid #C9C9C9', maxWidth: '400px', width: '100%', position: 'relative' }}>
                        {/* Header */}
                        <div style={{
                            height: '39px',
                            background: "url('/assets/layout/contentTitle.png') repeat-x",
                            backgroundColor: '#498843',
                            color: '#FFF',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            padding: '0 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{RESOURCE_ICONS[selectedSlot.name] || '🏗️'}</span>
                                {selectedSlot.level > 0 ? selectedSlot.name : 'زمین خالی'}
                            </span>
                            <button onClick={() => setSelectedSlot(null)}
                                style={{ background: '#DE0000', border: '1px solid #aa0000', color: '#FFF', width: '18px', height: '18px', cursor: 'pointer', fontSize: '12px', lineHeight: '18px', textAlign: 'center', padding: 0 }}>
                                ×
                            </button>
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
                                    <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#228B22', margin: 0 }}>🏆 این مزرعه به حداکثر سطح رسیده است.</p>
                                </div>
                            ) : (
                                <div style={{ padding: '16px', marginBottom: '16px', fontSize: '13px', background: '#F5F5F5', border: '1px solid #C9C9C9' }}>
                                    <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#252525' }}>هزینه ارتقا به سطح {selectedSlot.level + 1}:</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', fontWeight: 'bold', marginBottom: '12px', color: '#252525' }}>
                                        <span>🪵 {selectedSlot.next_level_cost.wood}</span>
                                        <span>🧱 {selectedSlot.next_level_cost.clay}</span>
                                        <span>⚒️ {selectedSlot.next_level_cost.iron}</span>
                                        <span>🌾 {selectedSlot.next_level_cost.crop}</span>
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#777', margin: 0 }}>⏱ زمان ساخت: {formatDuration(selectedSlot.next_level_time_seconds)}</p>
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