import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import {formatDuration} from "../utils/formatter.js";

// ==========================================
// 1. تنظیمات و مختصات اسلات‌ها (Slots Coordinates)
// ==========================================
// مختصات مزارع منابع (Dorf1)
const DORF1_SLOTS = {
    1: { x: 150, y: 100 }, 2: { x: 250, y: 70 }, 3: { x: 370, y: 70 }, 4: { x: 470, y: 100 }, // چوب‌بری‌ها
    5: { x: 520, y: 180 }, 6: { x: 540, y: 280 }, 7: { x: 480, y: 360 }, 8: { x: 380, y: 400 }, // گودال‌های خشت
    9: { x: 240, y: 400 }, 10: { x: 140, y: 360 }, 11: { x: 80, y: 280 }, 12: { x: 100, y: 180 }, // معادن آهن
    13: { x: 210, y: 150 }, 14: { x: 310, y: 130 }, 15: { x: 410, y: 150 }, 16: { x: 430, y: 250 }, // گندم‌زارها
    17: { x: 360, y: 320 }, 18: { x: 260, y: 320 }  // گندم‌زارها
};

// مختصات ساختمان‌های مرکز دهکده (Dorf2)
const DORF2_SLOTS = {
    19: { x: 310, y: 230 }, // مرکز (ساختمان اصلی)
    20: { x: 210, y: 180 }, 21: { x: 260, y: 140 }, 22: { x: 360, y: 140 }, 23: { x: 410, y: 180 },
    24: { x: 170, y: 240 }, 25: { x: 450, y: 240 }, 26: { x: 190, y: 310 }, 27: { x: 270, y: 330 },
    28: { x: 350, y: 330 }, 29: { x: 430, y: 310 }, 30: { x: 130, y: 190 }, 31: { x: 490, y: 190 },
    32: { x: 110, y: 270 }, 33: { x: 510, y: 270 }, 34: { x: 150, y: 360 }, 35: { x: 470, y: 360 },
    36: { x: 230, y: 390 }, 37: { x: 390, y: 390 }, 38: { x: 310, y: 390 },
    39: { x: 480, y: 140 }, // عمارت فرعی (Rally Point)
    40: { x: 310, y: 440 }  // دیوار (Wall)
};

// تولید نام فایل تصویر بر اساس نوع ساختمان
const getAssetPath = (building, view) => {
    if (building.level === 0 && !building.is_upgrading) {
        return view === 'dorf1' ? null : '/assets/buildings/empty_slot.png';
    }

    // می‌توانید نام‌ها را دقیقاً با این فرمت در پوشه public/assets/ قرار دهید
    // مثلا: woodcutter.png یا main_building.png
    const nameMap = {
        'چوب‌بری': 'woodcutter',
        'گودال خاک رس': 'claypit',
        'معدن آهن': 'ironmine',
        'مزرعه گندم': 'cropland',
        'ساختمان اصلی': 'main_building',
        'انبار': 'warehouse',
        'انبار غذا': 'granary',
        'سربازخانه': 'barracks',
        'دیوار': 'wall',
        'اردوگاه': 'rally_point'
    };

    const engName = nameMap[building.name] || 'default_building';
    return `/assets/buildings/${engName}.png`;
};

// ==========================================
// 2. توابع کمکی زمان
// ==========================================


function remainingSeconds(endTimeIso) {
    if (!endTimeIso) return 0;
    return Math.max(0, Math.round((new Date(endTimeIso).getTime() - Date.now()) / 1000));
}

// ==========================================
// 3. کامپوننت اصلی
// ==========================================
export default function VillageMap() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const [view, setView] = useState('dorf1'); // 'dorf1' | 'dorf2'
    const [villageInfo, setVillageInfo] = useState(null);
    const [buildings, setBuildings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [upgrading, setUpgrading] = useState(false);
    const [now, setNow] = useState(Date.now());

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

    useEffect(() => {
        setLoading(true);
        fetchBuildings();
    }, [fetchBuildings]);

    useEffect(() => {
        if (lastMessage?.type === 'building_completed') fetchBuildings();
    }, [lastMessage, fetchBuildings]);

    useEffect(() => {
        const interval = setInterval(fetchBuildings, 30000);
        return () => clearInterval(interval);
    }, [fetchBuildings]);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // ==========================================
    // 4. موتور رندر PixiJS برای نقشه‌های Dorf1 و Dorf2
    // ==========================================
    useEffect(() => {
        if (loading || !pixiContainerRef.current) return;

        let isMounted = true;
        const app = new PIXI.Application();

        async function initPixi() {
            await app.init({
                width: 620,
                height: 460,
                backgroundColor: 0x000000,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                antialias: true,
            });

            if (!isMounted) {
                app.destroy(true, { children: true });
                return;
            }

            pixiAppRef.current = app;
            pixiContainerRef.current.innerHTML = '';
            pixiContainerRef.current.appendChild(app.canvas);

            renderScene(app);
        }

        async function renderScene(app) {
            app.stage.removeChildren();

            // 1. بارگذاری پس‌زمینه بر اساس نوع تب
            const bgPath = view === 'dorf1' ? '/assets/map/dorf1_bg.png' : '/assets/map/dorf2_bg.png';
            try {
                const bgTexture = await PIXI.Assets.load(bgPath);
                const bgSprite = new PIXI.Sprite(bgTexture);
                bgSprite.width = app.screen.width;
                bgSprite.height = app.screen.height;
                app.stage.addChild(bgSprite);
            } catch (e) {
                console.warn('تصویر پس‌زمینه یافت نشد، از رنگ ساده استفاده می‌شود.');
                const fallbackBg = new PIXI.Graphics();
                fallbackBg.rect(0,0, app.screen.width, app.screen.height).fill({color: view === 'dorf1' ? 0x8ab961 : 0x769b50});
                app.stage.addChild(fallbackBg);
            }

            // 2. فیلتر کردن ساختمان‌ها بر اساس نمای فعلی
            const activeSlots = view === 'dorf1' ? DORF1_SLOTS : DORF2_SLOTS;
            const activeBuildings = buildings.filter(b => activeSlots[b.position]);

            // 3. رندر کردن ساختمان‌ها در مختصات
            activeBuildings.forEach((b) => {
                const coords = activeSlots[b.position];
                const container = new PIXI.Container();
                container.x = coords.x;
                container.y = coords.y;

                const assetPath = getAssetPath(b, view);
                if (assetPath) {
                    const sprite = PIXI.Sprite.from(assetPath);
                    sprite.anchor.set(0.5);
                    sprite.width = view === 'dorf1' ? 60 : 70; // اندازه‌های متفاوت برای منابع و ساختمان‌ها
                    sprite.height = view === 'dorf1' ? 60 : 70;
                    container.addChild(sprite);
                } else if (view === 'dorf1') {
                    // پالی‌بک برای مزارع اگر عکس نبود
                    const circle = new PIXI.Graphics();
                    circle.circle(0, 0, 25).fill({color: 0xffffff, alpha: 0.3}).stroke({width:2, color: 0x000000});
                    container.addChild(circle);
                }

                // بج سطح (Level Badge) سبک تراوین
                if (b.level > 0 || b.is_upgrading) {
                    const badge = new PIXI.Graphics();
                    badge.circle(0, 0, 12).fill({color: 0xffcc00}).stroke({width: 2, color: 0x000000});
                    badge.x = 20; badge.y = 20;

                    const lvlText = new PIXI.Text({
                        text: b.level.toString(),
                        style: { fontFamily: 'Tahoma', fontSize: 12, fill: 0x000000, fontWeight: 'bold' }
                    });
                    lvlText.anchor.set(0.5);
                    lvlText.x = 20; lvlText.y = 20;

                    container.addChild(badge, lvlText);
                }

                // آیکون در حال ساخت
                if (b.is_upgrading) {
                    const buildIcon = PIXI.Sprite.from('/assets/ui/hammer.png');
                    buildIcon.anchor.set(0.5);
                    buildIcon.x = -20; buildIcon.y = -20;
                    buildIcon.width = 20; buildIcon.height = 20;
                    container.addChild(buildIcon);
                }

                container.eventMode = 'static';
                container.cursor = 'pointer';
                container.on('pointerover', () => { container.scale.set(1.05); });
                container.on('pointerout', () => { container.scale.set(1); });
                container.on('pointerdown', () => setSelectedSlot(b));

                app.stage.addChild(container);
            });
        }

        initPixi();

        return () => {
            isMounted = false;
            if (pixiAppRef.current) {
                pixiAppRef.current.destroy(true, { children: true });
                pixiAppRef.current = null;
            }
        };
    }, [loading, buildings, view]); // وقتی دیتا یا تب عوض شد، دوباره رندر کن

    // ==========================================
    // 5. هندلرهای کاربر و UI
    // ==========================================
    const handleUpgrade = async () => {
        if (!selectedSlot || !activeVillageId) return;
        setUpgrading(true);
        try {
            const response = await api.post('game/upgrade-building/', {
                village_id: activeVillageId,
                position: selectedSlot.position,
            });
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
        const r = villageInfo.resources;
        const c = building.next_level_cost;
        return r.wood >= c.wood && r.clay >= c.clay && r.iron >= c.iron && r.crop >= c.crop;
    };

    const upgradingBuildings = buildings.filter(b => b.is_upgrading).sort((a,b) => new Date(a.upgrade_end_time) - new Date(b.upgrade_end_time));

    return (
        <div className="w-full min-h-screen bg-[#c2d69b] flex flex-col items-center pt-32 pb-10 font-tahoma">
            <ResourceBar />
            <Navbar />

            {loading ? (
                <p className="font-bold text-[#3d2b1a] mt-10">در حال بارگذاری دهکده...</p>
            ) : (
                <div className="flex flex-col items-center w-full max-w-4xl">

                    {/* تب‌های انتخاب نمای منابع و ساختمان */}
                    {villageInfo && (
                        <p className="text-xs font-bold text-[#3d2b1a] bg-[#f4ebd0] px-3 py-1 rounded-full mb-2 border-2 border-[#593d2b]">
                            👥 جمعیت: {villageInfo.population?.toLocaleString() ?? '—'}
                        </p>
                    )}
                    <div className="flex gap-1 mb-2">
                        <button
                            onClick={() => setView('dorf1')}
                            className={`px-6 py-2 rounded-t-lg font-bold border-2 border-b-0 ${view === 'dorf1' ? 'bg-[#f4ebd0] border-[#593d2b] text-[#593d2b]' : 'bg-[#e0d6b8] border-gray-400 text-gray-500'}`}
                        >
                            🌾 منابع (Dorf1)
                        </button>
                        <button
                            onClick={() => setView('dorf2')}
                            className={`px-6 py-2 rounded-t-lg font-bold border-2 border-b-0 ${view === 'dorf2' ? 'bg-[#f4ebd0] border-[#593d2b] text-[#593d2b]' : 'bg-[#e0d6b8] border-gray-400 text-gray-500'}`}
                        >
                            🏛 ساختمان‌ها (Dorf2)
                        </button>
                    </div>

                    {/* بوم نقاشی بازی */}
                    <div
                        className="shadow-2xl border-8 border-[#593d2b] rounded-b-lg rounded-tr-lg overflow-hidden relative bg-black"
                        ref={pixiContainerRef}
                        style={{ width: '620px', height: '460px', maxWidth: '100%' }}
                    />

                    {/* صف ساخت‌وساز تراوین (Construction Queue) */}
                    {upgradingBuildings.length > 0 && (
                        <div className="bg-[#f4ebd0] border-4 border-[#593d2b] rounded-lg shadow-xl mt-6 p-4 w-[620px] max-w-full">
                            <h3 className="font-bold text-[#593d2b] mb-3 border-b-2 border-[#d9c49a] pb-1">🔨 صف ساخت‌وساز</h3>
                            <ul className="text-sm">
                                {upgradingBuildings.map((b, idx) => (
                                    <li key={b.id} className="flex justify-between items-center py-1 border-b border-dashed border-gray-300 last:border-0">
                                        <span className="font-bold text-[#3d2b1a]">{b.name} (سطح {b.level + 1})</span>
                                        <span className="font-mono text-red-600 font-bold" dir="ltr">
                                            {formatDuration(remainingSeconds(b.upgrade_end_time) - Math.floor((now - now) / 1000))}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* پاپ‌آپ ارتقا */}
            {selectedSlot && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <div className="bg-[#f4ebd0] border-4 border-[#593d2b] rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
                        <button onClick={() => setSelectedSlot(null)} className="absolute top-2 right-3 text-2xl font-bold text-red-700">×</button>

                        <h3 className="text-xl font-bold text-[#593d2b] mb-1">
                            {selectedSlot.level > 0 ? selectedSlot.name : 'زمین خالی'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">سطح فعلی: <span className="font-bold">{selectedSlot.level}</span></p>

                        {selectedSlot.is_upgrading ? (
                            <div className="bg-yellow-100 border border-yellow-400 rounded p-3 text-center mb-4">
                                <p className="text-sm font-bold text-yellow-800 mb-1">در حال ارتقا...</p>
                            </div>
                        ) : selectedSlot.is_max_level ? (
                            <div className="bg-green-100 border border-green-500 rounded p-3 text-center mb-4">
                                <p className="text-sm font-bold text-green-800">
                                    🏆 این ساختمان به حداکثر سطح ({selectedSlot.max_level}) رسیده است.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white/60 rounded border border-[#d9c49a] p-3 mb-4 text-sm">
                                <p className="font-bold text-[#593d2b] mb-2">هزینه ارتقا به سطح {selectedSlot.level + 1}:</p>
                                <div className="grid grid-cols-2 gap-2 text-xs font-bold mb-3">
                                    <span className="flex items-center gap-1">
                                        {/*<img src="/assets/ui/wood.png" className="w-4 h-4" alt=""/>*/}
                                        🪵
                                        {selectedSlot.next_level_cost.wood}</span>
                                    <span className="flex items-center gap-1">
                                        {/*<img src="/assets/ui/clay.png" className="w-4 h-4" alt=""/>*/}
                                        🧱
                                        {selectedSlot.next_level_cost.clay}</span>
                                    <span className="flex items-center gap-1">
                                        🧲
                                        {/*<img src="/assets/ui/iron.png" className="w-4 h-4" alt=""/> */}
                                        {selectedSlot.next_level_cost.iron}</span>
                                    <span className="flex items-center gap-1">
                                        🌾
                                        {/*<img src="/assets/ui/crop.png" className="w-4 h-4" alt=""/>*/}
                                        {selectedSlot.next_level_cost.crop}</span>
                                </div>
                                <p className="text-xs text-gray-700 flex items-center gap-1">
                                    ⏱ زمان ساخت: {formatDuration(selectedSlot.next_level_time_seconds)}
                                </p>
                                {!canAfford(selectedSlot) && (
                                    <p className="text-xs text-red-600 font-bold mt-3">منابع کافی برای این ارتقا ندارید.</p>
                                )}
                            </div>
                        )}

                        <div className="flex justify-center">
                            <button
                                onClick={handleUpgrade}
                                disabled={selectedSlot.is_upgrading || upgrading || !canAfford(selectedSlot)}
                                className="bg-[#593d2b] text-[#f4ebd0] px-8 py-2 rounded-full font-bold hover:bg-[#4a3224] disabled:bg-gray-400 disabled:text-gray-200 transition-colors shadow-md"
                            >
                                {upgrading ? "صبر کنید..." : "ارتقا به سطح " + (selectedSlot.level + 1)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}