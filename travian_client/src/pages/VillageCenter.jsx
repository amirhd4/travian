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
    20: { x: 115, y: 52 }, 21: { x: 198, y: 27 }, 22: { x: 258, y: 17 }, 23: { x: 332, y: 32 },
    24: { x: 388, y: 81 }, 25: { x: 80, y: 91 }, 26: { x: 161, y: 98 }, 27: { x: 247, y: 81 },
    28: { x: 395, y: 122 }, 29: { x: 66, y: 161 }, 30: { x: 192, y: 126 }, 31: { x: 155, y: 152 },
    32: { x: 402, y: 180 }, 33: { x: 84, y: 200 }, 34: { x: 227, y: 196 }, 35: { x: 354, y: 213 },
    36: { x: 158, y: 236 }, 37: { x: 286, y: 247 }, 38: { x: 144, y: 267 },
    39: { x: 262, y: 276 },
    40: { x: 240, y: 350 },
};

const BUILDING_META = {
    'ساختمان اصلی': { asset: '/assets/buildings/g15.png' },
    'انبار': { asset: '/assets/buildings/g10.png' },
    'سیلوی غله': { asset: '/assets/buildings/g11.png' },
    'پادگان': { asset: '/assets/buildings/g19.png' },
    'اصطبل': { asset: '/assets/buildings/g20.png' },
    'کارگاه': { asset: '/assets/buildings/g21.png' },
    'بازارچه': { asset: '/assets/buildings/g17.png' },
    'سفارتخانه': { asset: '/assets/buildings/g18.png' },
    'خزانه‌داری': { asset: '/assets/buildings/g27.png' },
    'آکادمی': { asset: '/assets/buildings/g22.png' },
    'اقامتگاه': { asset: '/assets/buildings/g25.png' },
    'تالار شهر': { asset: '/assets/buildings/g24.png' },
    'مخفیگاه': { asset: '/assets/buildings/g23.png' },
    'آهنگری': { asset: '/assets/buildings/g12.png' },
    'کارگاه سنگ‌تراشی': { asset: '/assets/buildings/g41.png' },
    'عمارت قهرمان': { asset: '/assets/buildings/g35.png' },
    'آبشخور اسب': { asset: '/assets/buildings/g38.png' },
    'اداره تجارت': { asset: '/assets/buildings/g28.png' },
    'پادگان بزرگ': { asset: '/assets/buildings/g29.png' },
    'آسیاب': { asset: '/assets/buildings/g8.png' },
    'قصر': { asset: '/assets/buildings/g26.png' },
    'محل گردهمایی': { asset: '/assets/buildings/g16.png' },
    'دیوار': { asset: '/assets/buildings/g39.png' },
    'شگفتی جهان': { asset: '/assets/buildings/g37.png' },
    'تله': { asset: '/assets/buildings/g34.png' },
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
    const [movingCapital, setMovingCapital] = useState(false);
    const [townHallStatus, setTownHallStatus] = useState(null);
    const [celebrating, setCelebrating] = useState(null);

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
                width: 540, height: 448,
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

            try {
                const bgTexture = await PIXI.Assets.load('/assets/bgs/bg1.jpg');
                const bgSprite = new PIXI.Sprite(bgTexture);
                bgSprite.width = app.screen.width;
                bgSprite.height = app.screen.height;
                app.stage.addChild(bgSprite);
            } catch {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xC3EDAE });
                app.stage.addChild(bg);
            }

            const activeBuildings = buildings.filter(b => DORF2_SLOTS[b.position]);

            for (const b of activeBuildings) {
                const coords = DORF2_SLOTS[b.position];
                const container = new PIXI.Container();
                container.x = coords.x;
                container.y = coords.y;

                const meta = BUILDING_META[b.name];
                const hasLevel = b.level > 0 || b.is_upgrading;

                if (meta) {
                    try {
                        const texture = await PIXI.Assets.load(meta.asset);
                        const sprite = new PIXI.Sprite(texture);
                        sprite.anchor.set(0.5);
                        sprite.width = 64;
                        sprite.height = 64;
                        container.addChild(sprite);
                    } catch {
                        const fallback = new PIXI.Graphics();
                        fallback.circle(0, 0, 25).fill({ color: 0x8B7355 });
                        container.addChild(fallback);
                    }
                } else {
                    try {
                        const texture = await PIXI.Assets.load('/assets/buildings/g1.png');
                        const sprite = new PIXI.Sprite(texture);
                        sprite.anchor.set(0.5);
                        sprite.width = 64;
                        sprite.height = 64;
                        sprite.alpha = 0.3;
                        container.addChild(sprite);
                    } catch {
                        const placeholder = new PIXI.Graphics();
                        placeholder.circle(0, 0, 20).fill({ color: 0x999999, alpha: 0.3 });
                        container.addChild(placeholder);
                    }
                }

                if (hasLevel) {
                    const badge = new PIXI.Graphics();
                    badge.circle(0, 0, 11).fill({ color: 0xFFFFFF });
                    badge.x = 22;
                    badge.y = 22;
                    container.addChild(badge);

                    const lvlText = new PIXI.Text({
                        text: b.level.toString(),
                        style: { fontFamily: 'Arial, Helvetica, Verdana', fontSize: 11, fill: 0x000000, fontWeight: 'normal' }
                    });
                    lvlText.anchor.set(0.5);
                    lvlText.x = 22;
                    lvlText.y = 22;
                    container.addChild(lvlText);
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

    const handleMoveCapital = async () => {
        if (!activeVillageId) return;
        setMovingCapital(true);
        try {
            const { data } = await api.post('game/villages/move-capital/', { village_id: activeVillageId });
            setAlertMsg({ tone: 'success', text: data.message });
            setSelectedSlot(null);
            fetchBuildings();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || "خطا در انتقال پایتخت" });
        } finally {
            setMovingCapital(false);
        }
    };

    useEffect(() => {
        if (selectedSlot?.name === 'تالار شهر' && activeVillageId) {
            api.get('game/town-hall/celebrate/', { params: { village_id: activeVillageId } })
                .then(({ data }) => setTownHallStatus(data))
                .catch(() => setTownHallStatus(null));
        } else {
            setTownHallStatus(null);
        }
    }, [selectedSlot, activeVillageId]);

    const handleCelebrate = async (celebrationType) => {
        if (!activeVillageId) return;
        setCelebrating(celebrationType);
        try {
            const { data } = await api.post('game/town-hall/celebrate/', {
                village_id: activeVillageId, celebration_type: celebrationType,
            });
            setAlertMsg({ tone: 'success', text: data.message });
            const refreshed = await api.get('game/town-hall/celebrate/', { params: { village_id: activeVillageId } });
            setTownHallStatus(refreshed.data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || "خطا در برگزاری جشن" });
        } finally {
            setCelebrating(null);
        }
    };

    const canAfford = (building) => {
        if (!villageInfo || !building.next_level_cost) return false;
        const r = villageInfo.resources, c = building.next_level_cost;
        return r.wood >= c.wood && r.clay >= c.clay && r.iron >= c.iron && r.crop >= c.crop;
    };

    return (
        <div className="village2">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="مرکز دهکده" />

            {loading ? (
                <p style={{ fontWeight: 'bold', marginTop: '64px', color: '#252525', textAlign: 'center' }}>در حال بارگذاری مرکز دهکده...</p>
            ) : (
                <div id="village_map">
                    <div ref={pixiContainerRef} style={{ width: '540px', height: '448px' }} />
                </div>
            )}

            <Modal open={!!selectedSlot} onClose={() => setSelectedSlot(null)} size="sm"
                title={selectedSlot?.level > 0 ? selectedSlot.name : 'زمین خالی'}>
                {selectedSlot && (
                    <>
                        <p style={{ fontSize: '13px', marginBottom: '16px', color: '#252525' }}>
                            سطح فعلی: <span style={{ fontWeight: 'bold' }}>{selectedSlot.level}</span>
                        </p>

                        {selectedSlot.is_upgrading ? (
                            <div style={{ padding: '12px', textAlign: 'center', marginBottom: '16px', background: '#ffe4b5', border: '1px solid #F88C1F' }}>
                                <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#b3721f', margin: 0 }}>در حال ارتقا...</p>
                            </div>
                        ) : selectedSlot.is_max_level ? (
                            <div style={{ padding: '12px', textAlign: 'center', marginBottom: '16px', background: '#E5EECC', border: '1px solid #99C01A' }}>
                                <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#228B22', margin: 0 }}>این ساختمان به حداکثر سطح رسیده است.</p>
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

                        {selectedSlot.name === 'قصر' && selectedSlot.level > 0 && villageInfo && !villageInfo.is_capital && (
                            <button onClick={handleMoveCapital}
                                disabled={movingCapital}
                                className="btn-gold"
                                style={{ width: '100%', padding: '8px 20px', marginTop: '8px' }}>
                                {movingCapital ? "در حال انتقال..." : "انتقال پایتخت به این دهکده"}
                            </button>
                        )}

                        {selectedSlot.name === 'تالار شهر' && selectedSlot.level > 0 && townHallStatus && (
                            <div style={{ marginTop: '12px', padding: '12px', background: '#F5F5F5', border: '1px solid #C9C9C9' }}>
                                <p style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px', color: '#252525' }}>جشن‌های تالار شهر</p>
                                {townHallStatus.active_celebration ? (
                                    <p style={{ fontSize: '12px', color: '#b3721f', fontWeight: 'bold' }}>
                                        {townHallStatus.active_celebration.celebration_type_display} در حال برگزاری است —{' '}
                                        {formatDuration(townHallStatus.active_celebration.remaining_seconds)} باقی مانده
                                    </p>
                                ) : (
                                    townHallStatus.options.map((opt) => (
                                        <div key={opt.type} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #E5E5E5' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#252525' }}>
                                                {opt.label} {!opt.is_unlocked && `(نیازمند تالار شهر سطح ${opt.min_town_hall_level})`}
                                            </p>
                                            <p style={{ fontSize: '11px', color: '#777' }}>
                                                چوب:{opt.cost.wood} خاک رس:{opt.cost.clay} آهن:{opt.cost.iron} گندم:{opt.cost.crop} — {opt.culture_points} امتیاز فرهنگی — {opt.duration_hours} ساعت
                                            </p>
                                            <button
                                                onClick={() => handleCelebrate(opt.type)}
                                                disabled={!opt.is_unlocked || celebrating === opt.type}
                                                className="btn-gold"
                                                style={{ width: '100%', padding: '5px 20px', marginTop: '4px' }}
                                            >
                                                {celebrating === opt.type ? "در حال برگزاری..." : `برگزاری ${opt.label}`}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </Modal>
        </div>
    );
}
