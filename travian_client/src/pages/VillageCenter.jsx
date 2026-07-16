import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Modal } from '../components/Modal';
import { AlertModal } from '../components/Modal';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from "../utils/formatter.js";

const DORF2_SLOTS = {
    19: { x: 310, y: 230 },
    20: { x: 210, y: 180 }, 21: { x: 260, y: 140 }, 22: { x: 360, y: 140 }, 23: { x: 410, y: 180 },
    24: { x: 170, y: 240 }, 25: { x: 450, y: 240 }, 26: { x: 190, y: 310 }, 27: { x: 270, y: 330 },
    28: { x: 350, y: 330 }, 29: { x: 430, y: 310 }, 30: { x: 130, y: 190 }, 31: { x: 490, y: 190 },
    32: { x: 110, y: 270 }, 33: { x: 510, y: 270 }, 34: { x: 150, y: 360 }, 35: { x: 470, y: 360 },
    36: { x: 230, y: 390 }, 37: { x: 390, y: 390 }, 38: { x: 310, y: 390 },
    39: { x: 480, y: 140 },
    40: { x: 310, y: 440 },
    41: { x: 150, y: 400 },
};

// Travian building IDs: g1=main, g2=woodcutter, g3=clay, g4=iron, g5=cropland,
// g6=mill, g7=smithy, g8=bakery, g9=warehouse, g10=granary, g11=rallypoint,
// g12=statue, g13=barracks, g14=stable, g15=workshop, g16=academy,
// g17=cranny, g18=townhall, g19=residence, g20=chancery, g21=blacksmith,
// g22=market, g23=timbercamp, g24=claypit, g25=ironmine, g26=farm,
// g27=granary2, g28=smithy2, g29=tournamentsquare, g30=main2,
// g34=trapper, g35=heromansion, g36=merchants, g37=stonemason,
// g38=horsedrinking, g39=wall, g40=worldwonder
const BUILDING_META = {
    'ساختمان اصلی': { asset: '/assets/buildings/g1.gif', color: 0xb5652f, icon: '🏛️' },
    'انبار': { asset: '/assets/buildings/g9.gif', color: 0x8a6b4a, icon: '📦' },
    'سیلوی غله': { asset: '/assets/buildings/g10.gif', color: 0xd9a62e, icon: '🌾' },
    'پادگان': { asset: '/assets/buildings/g13.gif', color: 0x8b3a3a, icon: '⚔️' },
    'اصطبل': { asset: '/assets/buildings/g14.gif', color: 0x6b4a2f, icon: '🐎' },
    'کارگاه': { asset: '/assets/buildings/g15.gif', color: 0x555555, icon: '🎯' },
    'بازارچه': { asset: '/assets/buildings/g22.gif', color: 0xd9942a, icon: '⚖️' },
    'سفارتخانه': { asset: '/assets/buildings/g18.gif', color: 0x2f6b8a, icon: '🏰' },
    'خزانه‌داری': { asset: '/assets/buildings/g17.gif', color: 0xb5972f, icon: '💰' },
    'آکادمی': { asset: '/assets/buildings/g16.gif', color: 0x4a6b8a, icon: '🎓' },
    'اقامتگاه': { asset: '/assets/buildings/g19.gif', color: 0x8a4a6b, icon: '🏯' },
    'تالار شهر': { asset: '/assets/buildings/g18.gif', color: 0x6b6b4a, icon: '🏢' },
    'مخفیگاه': { asset: '/assets/buildings/g17.gif', color: 0x3a3a3a, icon: '🕳️' },
    'آهنگری': { asset: '/assets/buildings/g21.gif', color: 0x4a3a2f, icon: '🔨' },
    'کارگاه سنگ‌تراشی': { asset: '/assets/buildings/g37.gif', color: 0x7a7a7a, icon: '⛏️' },
    'عمارت قهرمان': { asset: '/assets/buildings/g35.gif', color: 0x8a2f6b, icon: '🦸' },
    'آبشخور اسب': { asset: '/assets/buildings/g38.gif', color: 0x4a8a6b, icon: '💧' },
    'اداره تجارت': { asset: '/assets/buildings/g36.gif', color: 0xd9942a, icon: '🐪' },
    'پادگان بزرگ': { asset: '/assets/buildings/g29.gif', color: 0x8b3a3a, icon: '⚔️' },
    'آسیاب': { asset: '/assets/buildings/g8.gif', color: 0xc4a265, icon: '⚙️' },
    'قصر': { asset: '/assets/buildings/g19.gif', color: 0xb5972f, icon: '👑' },
    'محل گردهمایی': { asset: '/assets/buildings/g11.gif', color: 0x2f8a4a, icon: '🚩' },
    'دیوار': { asset: '/assets/buildings/g39.gif', color: 0x6b6b6b, icon: '🧱' },
    'شگفتی جهان': { asset: '/assets/buildings/g40.gif', color: 0xd9b52f, icon: '🏛️' },
    'تله': { asset: '/assets/buildings/g34.gif', color: 0x4a2f4a, icon: '🪤' },
};

function remainingSeconds(endTimeIso) {
    if (!endTimeIso) return 0;
    return Math.max(0, Math.round((new Date(endTimeIso).getTime() - Date.now()) / 1000));
}

export default function VillageCenter() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const [villageInfo, setVillageInfo] = useState(null);
    const [buildings, setBuildings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [upgrading, setUpgrading] = useState(false);
    const [alertMsg, setAlertMsg] = useState(null);

    const pixiContainerRef = useRef(null);
    const pixiAppRef = useRef(null);

    const fetchBuildings = useCallback(async () => {
        if (!activeVillageId) { setLoading(false); return; }
        try {
            const { data } = await api.get(`game/villages/${activeVillageId}/buildings/`);
            setVillageInfo(data.village);
            setBuildings(data.buildings);
        } catch (error) {
            console.error(error);
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
                width: 660, height: 500, backgroundColor: 0x2b2318,
                resolution: window.devicePixelRatio || 1, autoDensity: true, antialias: true,
            });
            if (!isMounted) { app.destroy(true, { children: true }); return; }
            pixiAppRef.current = app;
            pixiContainerRef.current.innerHTML = '';
            pixiContainerRef.current.appendChild(app.canvas);
            renderScene(app);
        }

        async function renderScene(app) {
            app.stage.removeChildren();
            try {
                const bgTexture = await PIXI.Assets.load('/assets/bgs/bgVillage-rtl.jpg');
                const bgSprite = new PIXI.Sprite(bgTexture);
                bgSprite.width = app.screen.width;
                bgSprite.height = app.screen.height;
                app.stage.addChild(bgSprite);
            } catch {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xa89361 });
                app.stage.addChild(bg);
            }

            const activeBuildings = buildings.filter(b => DORF2_SLOTS[b.position]);

            for (const b of activeBuildings) {
                const coords = DORF2_SLOTS[b.position];
                const container = new PIXI.Container();
                container.x = coords.x; container.y = coords.y;

                const meta = BUILDING_META[b.name] || { color: 0x999999, icon: '❔' };
                const hasLevel = b.level > 0 || b.is_upgrading;

                // Load and display the actual building GIF image
                try {
                    const texture = await PIXI.Assets.load(meta.asset);
                    const sprite = new PIXI.Sprite(texture);
                    sprite.anchor.set(0.5);
                    sprite.width = 68; sprite.height = 68;
                    container.addChild(sprite);
                } catch(e) {
                    // If image fails, show icon text as last resort
                    const icon = new PIXI.Text({ text: meta.icon, style: { fontSize: 28 } });
                    icon.anchor.set(0.5);
                    container.addChild(icon);
                }

                // Level badge
                if (hasLevel) {
                    const badge = new PIXI.Graphics();
                    badge.circle(0, 0, 15).fill({ color: 0xf5b638 }).stroke({ width: 2.5, color: 0x1c1710 });
                    badge.x = 26; badge.y = 26;
                    const lvlText = new PIXI.Text({ text: b.level.toString(), style: { fontFamily: 'Vazirmatn, Tahoma', fontSize: 15, fill: 0x1c1710, fontWeight: 'bold' } });
                    lvlText.anchor.set(0.5); lvlText.x = 26; lvlText.y = 26;
                    container.addChild(badge, lvlText);
                }

                // Upgrading indicator
                if (b.is_upgrading) {
                    const ring = new PIXI.Graphics();
                    ring.roundRect(-36, -36, 72, 72, 12).stroke({ width: 3, color: 0xf5b638, alpha: 0.9 });
                    container.addChild(ring);
                    const hammer = new PIXI.Text({ text: '🔨', style: { fontSize: 16 } });
                    hammer.anchor.set(0.5); hammer.x = -26; hammer.y = -26;
                    container.addChild(hammer);
                }

                container.eventMode = 'static';
                container.cursor = 'pointer';
                container.on('pointerover', () => container.scale.set(1.06));
                container.on('pointerout', () => container.scale.set(1));
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
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || "خطا در ارتقای ساختمان" });
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
        <div
            className="w-full h-full flex flex-col items-center"
            style={{
                backgroundImage: "url('/assets/bgs/bgVillage-rtl.jpg')",
                backgroundSize: "cover", backgroundPosition: "center", backgroundColor: '#cfe0a8',
            }}
        >
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="مرکز دهکده" />

            {loading ? (
                <p className="font-bold text-ink-700 mt-16">در حال بارگذاری مرکز دهکده...</p>
            ) : (
                <div className="flex flex-col items-center w-full max-w-4xl px-4 mt-2">
                    {villageInfo && (
                        <span className="badge-gold mb-3 text-sm px-4 py-1.5">
                            👥 جمعیت: {villageInfo.population?.toLocaleString() ?? '—'}
                        </span>
                    )}

                    <div className="rounded-2xl overflow-hidden shadow-card border-4 border-ink-800 bg-ink-900" ref={pixiContainerRef} style={{ width: '660px', height: '500px', maxWidth: '100%' }} />
                </div>
            )}

            <Modal open={!!selectedSlot} onClose={() => setSelectedSlot(null)} size="sm"
                title={selectedSlot?.level > 0 ? selectedSlot.name : 'زمین خالی'}
                icon={BUILDING_META[selectedSlot?.name]?.icon || '🏗️'}>
                {selectedSlot && (
                    <>
                        <p className="text-sm text-ink-600 mb-4">سطح فعلی: <span className="font-bold">{selectedSlot.level}</span></p>

                        {selectedSlot.is_upgrading ? (
                            <div className="bg-gold-50 border border-gold-300 rounded-xl p-3 text-center mb-4">
                                <p className="text-sm font-bold text-gold-700">در حال ارتقا...</p>
                            </div>
                        ) : selectedSlot.is_max_level ? (
                            <div className="bg-brand-50 border border-brand-300 rounded-xl p-3 text-center mb-4">
                                <p className="text-sm font-bold text-brand-700">🏆 این ساختمان به حداکثر سطح رسیده است.</p>
                            </div>
                        ) : (
                            <div className="bg-parchment-100 rounded-xl border border-parchment-300 p-4 mb-4 text-sm">
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
                    </>
                )}
            </Modal>
        </div>
    );
}
