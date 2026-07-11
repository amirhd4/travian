import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from "../utils/formatter.js";
import Footer from "../components/Footer.jsx";

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

// مسیر پیشنهادی عکس هر مزرعه: /assets/buildings/{name}.png (اگر نبود، دایره‌ی رنگی جایگزین می‌شود)
const getAssetPath = (building) => {
    if (building.level === 0 && !building.is_upgrading) return null;
    const nameMap = {
        'چوب‌بری': 'woodcutter', 'گودال خاک رس': 'claypit',
        'معدن آهن': 'ironmine', 'مزرعه گندم': 'cropland',
    };
    return `/assets/buildings/${nameMap[building.name] || 'default_building'}.png`;
};

function remainingSeconds(endTimeIso) {
    if (!endTimeIso) return 0;
    return Math.max(0, Math.round((new Date(endTimeIso).getTime() - Date.now()) / 1000));
}

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
        if (!activeVillageId) return;
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
                width: 660, height: 500,
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

            activeBuildings.forEach((b) => {
                const coords = DORF1_SLOTS[b.position];
                const container = new PIXI.Container();
                container.x = coords.x;
                container.y = coords.y;

                const assetPath = getAssetPath(b);
                let hasImage = false;
                if (assetPath) {
                    const sprite = PIXI.Sprite.from(assetPath);
                    sprite.anchor.set(0.5);
                    sprite.width = 64; sprite.height = 64;
                    sprite.on?.('error', () => { hasImage = false; });
                    container.addChild(sprite);
                    hasImage = true;
                }

                // دایره‌ی رنگی پایه (همیشه رسم می‌شود، زیر عکس - اگر عکس نبود این دیده می‌شود)
                const baseColor = RESOURCE_COLORS[b.name] || 0x999999;
                const circle = new PIXI.Graphics();
                circle.circle(0, 0, 30)
                    .fill({ color: baseColor, alpha: b.level > 0 ? 0.9 : 0.35 })
                    .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
                container.addChildAt(circle, 0);

                const icon = new PIXI.Text({
                    text: RESOURCE_ICONS[b.name] || '❔',
                    style: { fontSize: 26 },
                });
                icon.anchor.set(0.5);
                container.addChild(icon);

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
            });
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

    const upgradingBuildings = buildings.filter(b => b.is_upgrading)
        .sort((a, b) => new Date(a.upgrade_end_time) - new Date(b.upgrade_end_time));

    return (
        <div className="game-bg flex flex-col items-center">
            {loading ? (
                <p className="font-bold text-ink-700 mt-16">در حال بارگذاری دهکده...</p>
            ) : (
                <div className="w-full max-w-4xl px-4 flex flex-col items-center gap-4 mt-4">
                    {villageInfo && (
                        <div className="flex items-center gap-3">
                            <span className="badge-green text-sm px-4 py-1.5">
                                👥 جمعیت: {villageInfo.population?.toLocaleString() ?? '—'}
                            </span>
                            <span className="badge-gold text-sm px-4 py-1.5">
                                {villageInfo.name}
                            </span>
                        </div>
                    )}

                    <div className="rounded-2xl overflow-hidden shadow-card border-4 border-ink-800 bg-ink-900"
                         ref={pixiContainerRef} style={{ width: '660px', height: '500px', maxWidth: '100%' }} />

                    {upgradingBuildings.length > 0 && (
                        <div className="panel w-full max-w-[660px]">
                            <div className="panel-header !py-2.5">
                                <span className="panel-title text-sm">🔨 صف ساخت‌وساز</span>
                            </div>
                            <div className="panel-body !py-2 space-y-1">
                                {upgradingBuildings.map((b) => (
                                    <div key={b.id} className="flex justify-between items-center py-1.5 border-b border-parchment-200 last:border-0 text-sm">
                                        <span className="font-bold text-ink-700">{b.name} (سطح {b.level + 1})</span>
                                        <span className="font-mono font-bold text-rose-600" dir="ltr">
                                            {formatDuration(remainingSeconds(b.upgrade_end_time))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedSlot && (
                <div className="fixed inset-0 bg-ink-900/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="panel max-w-sm w-full p-6 relative">
                        <button onClick={() => setSelectedSlot(null)}
                            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-rose-100 text-rose-600 font-bold hover:bg-rose-200 transition">×</button>

                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{RESOURCE_ICONS[selectedSlot.name] || '🏗️'}</span>
                            <h3 className="text-xl font-extrabold text-ink-800">
                                {selectedSlot.level > 0 ? selectedSlot.name : 'زمین خالی'}
                            </h3>
                        </div>
                        <p className="text-sm text-ink-600 mb-4">سطح فعلی: <span className="font-bold">{selectedSlot.level}</span></p>

                        {selectedSlot.is_upgrading ? (
                            <div className="bg-gold-50 border border-gold-300 rounded-lg p-3 text-center mb-4">
                                <p className="text-sm font-bold text-gold-700">در حال ارتقا...</p>
                            </div>
                        ) : selectedSlot.is_max_level ? (
                            <div className="bg-brand-50 border border-brand-300 rounded-lg p-3 text-center mb-4">
                                <p className="text-sm font-bold text-brand-700">🏆 این مزرعه به حداکثر سطح رسیده است.</p>
                            </div>
                        ) : (
                            <div className="bg-parchment-100 rounded-lg border border-parchment-300 p-4 mb-4 text-sm">
                                <p className="font-bold text-ink-800 mb-2">هزینه ارتقا به سطح {selectedSlot.level + 1}:</p>
                                <div className="grid grid-cols-2 gap-2 text-xs font-bold mb-3">
                                    <span>🪵 {selectedSlot.next_level_cost.wood}</span>
                                    <span>🧱 {selectedSlot.next_level_cost.clay}</span>
                                    <span>⚒️ {selectedSlot.next_level_cost.iron}</span>
                                    <span>🌾 {selectedSlot.next_level_cost.crop}</span>
                                </div>
                                <p className="text-xs text-ink-600">⏱ زمان ساخت: {formatDuration(selectedSlot.next_level_time_seconds)}</p>
                                {!canAfford(selectedSlot) && <p className="text-xs text-rose-600 font-bold mt-3">منابع کافی ندارید.</p>}
                            </div>
                        )}

                        <button onClick={handleUpgrade}
                            disabled={selectedSlot.is_upgrading || upgrading || selectedSlot.is_max_level || !canAfford(selectedSlot)}
                            className="btn-primary w-full py-3">
                            {upgrading ? "صبر کنید..." : `ارتقا به سطح ${selectedSlot.level + 1}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}